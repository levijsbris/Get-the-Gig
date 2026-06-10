# Publish Flow

End-to-end lifecycle for taking a portfolio from draft to a live URL, and back.

## States

A portfolio has three orthogonal state dimensions:

- **Draft** — always present once the portfolio exists. The current editor state.
- **Published** — present iff `isPublished == true`. A frozen snapshot in Cloud Storage.
- **Soft-deleted** — `softDeletedAt != null`. Invisible to viewers, restorable by owner within 7 days.

| `isPublished` | `softDeletedAt` | Viewer behaviour                        | Editor behaviour       |
|---------------|------------------|-----------------------------------------|------------------------|
| false         | null             | 404 (unpublished)                       | Editable               |
| true          | null             | Renders published snapshot              | Editable               |
| any           | not null         | 404 (soft-deleted)                      | Read-only, "Restore"   |

The draft and the published snapshot drift independently — editing after publish doesn't change the live site until the next publish.

## Publish (or re-publish)

Endpoint: `POST /api/portfolios/{portfolioId}/publish`

Body:
```json
{ "visibility": "public" | "password" }
```

Sequence:

1. **Authorise.** Validate Firebase ID token. Resolve UID. Load the portfolio doc scoped to `(uid, portfolioId)`. 403 if not found.

2. **Validate the draft.**
   - Schema validation against the generated JSON Schema.
   - Cross-reference validation: every `NavTarget { kind: 'page' | 'section' }` resolves; every `Section.columns.length === Section.layout.columns`; every component's `assetId` corresponds to an asset owned by this user and not soft-deleted; no Container nested in a Container; `pages[].slug` is unique within the portfolio.
   - Reject with `400 ValidationError` containing the list of issues.

3. **Compute the new asset reference set.** Walk the draft, collect every `assetId`. Call this `assetRefsNew`.

4. **Resolve asset accessibility.**
   - If `visibility === "public"`: every referenced asset must have a copy in the public bucket. For any that don't, copy from private → public.
   - If `visibility === "password"`: assets stay in the private bucket. They'll be served via signed URLs after unlock.

5. **Render image derivatives.** Image components with non-default `crop` or `rotation` need a derivative file. The editor renders these in the browser at publish time and uploads them to Storage at `users/{uid}/assets/{assetId}/derivatives/{snapshotId}-{componentId}.{ext}`. The snapshot references the derivative URL inline. (Why client-side: zero backend cost, and the canvas pipeline already exists for the crop UI.)

6. **Write the snapshot.** Serialise the draft JSON. Add `publishedAt` and `snapshotId`. Write to:
   - `portfoliopro-{env}-public/snapshots/{username}/{slug}/snapshot.json` if public
   - `portfoliopro-{env}-private/snapshots/{username}/{slug}/snapshot.json` if password-gated
   Always with `Cache-Control: public, max-age=60, must-revalidate` (short cache; users expect publishes to go live quickly).

7. **Update the portfolio doc** in Firestore (in a transaction with step 8):
   ```
   isPublished: true
   publishedAt: now
   publishedSnapshotPath: <gs:// path>
   publishedVisibility: <visibility>
   requiresPassword: <visibility === "password">
   assetRefsPublished: assetRefsNew
   ```

8. **Update the route index.**
   - Upsert `/portfolioRoutes/{username}_{slug}` with the current portfolio metadata.
   - If the visibility changed, also update the index entry's `publishedVisibility` and `requiresPassword`.

9. **Orphan asset cleanup.** Compare the *previous* `assetRefsPublished` (before this publish) with `assetRefsNew`. For each asset in the previous set but not in the new set AND not referenced by `assetRefsDraft`: that asset is an orphan from the previous publish. Remove it from the public bucket (if present) and append it to the user's "orphan candidates" list. Hard deletion of the underlying asset binary happens lazily — the next time the user opens the asset library, orphan candidates that are still unreferenced are offered for deletion. (Why lazy: avoids accidental deletion if the user republishes-with-fix immediately, and avoids a server-side scanner.)

10. **Return.** Response includes the public URL, snapshot path, and any non-fatal warnings (e.g. "your portfolio has no viewer passwords and is publicly visible to anyone with the link" if `visibility === "public"`).

## Unpublish

Endpoint: `POST /api/portfolios/{portfolioId}/unpublish`

1. Authorise.
2. Delete `portfoliopro-{env}-{public|private}/snapshots/{username}/{slug}/snapshot.json`.
3. Update portfolio doc: `isPublished = false`, `publishedSnapshotPath = null`, etc.
4. Delete the route index entry.
5. Public asset copies (in the public bucket) are kept for 24 hours then deleted by the lazy orphan sweep. (Why: handles immediate re-publish without re-copying.)

## Username change

Endpoint: `POST /api/auth/username`

Body: `{ "newUsername": "..." }`

This is more involved than it looks because route index entries embed the username.

1. Authorise. Validate `newUsername` against `^[a-z0-9-]{3,30}$` and the reserved word list.
2. Transactionally:
   - Create `/usernames/{newUsername}` claiming for this UID. If it exists, 409.
   - Delete `/usernames/{oldUsername}`.
   - Update `/users/{uid}.username`.
3. For each published portfolio of the user:
   - Read the snapshot from `snapshots/{oldUsername}/{slug}/snapshot.json`.
   - Write it to `snapshots/{newUsername}/{slug}/snapshot.json`.
   - Delete the old snapshot file.
   - Delete `/portfolioRoutes/{oldUsername}_{slug}`.
   - Upsert `/portfolioRoutes/{newUsername}_{slug}`.
4. Return.

Old URLs 404 by design — no redirect. The user is warned in the UI before confirming.

If the user has many published portfolios this could be slow. In v1, the endpoint runs them in series and returns once all are migrated. If this becomes painful, batch into a background Cloud Run Job triggered from this endpoint.

## Soft delete and restore

### Soft delete

`DELETE /api/portfolios/{portfolioId}`:
- Set `softDeletedAt = now`.
- If currently published: unpublish (steps above) before setting `softDeletedAt`.
- Schedule a hard-delete task in `/deletionQueue/`.

### Restore

`POST /api/portfolios/{portfolioId}/restore`:
- Allowed iff `softDeletedAt` is set and < 7 days old.
- Clear `softDeletedAt`. Remove the deletion queue entry.
- Portfolio is restored as unpublished — user must re-publish to make it live. (Avoids the failure mode where a portfolio re-appears live unexpectedly.)

### Hard delete

A daily Cloud Run Job (or, in v1, a manually-triggered admin endpoint) processes `/deletionQueue/` entries with `scheduledFor <= now`. For each:
- Delete all assets owned by the user/portfolio (Firestore docs + Storage objects).
- Delete the portfolio Firestore doc and its subcollections.
- For user deletions: also delete the user doc and release the username lock.

## Account deletion

`DELETE /api/auth/account`:
- Set `softDeletedAt` on the user doc and on every portfolio.
- Unpublish every published portfolio.
- Schedule a hard-delete task.
- Sign the user out (Firebase Auth user record is deleted on hard delete, not now — gives the 7-day grace window for the user to change their mind).

## Export

`POST /api/portfolios/{portfolioId}/export` (returns a job id, polled, or streamed):

- Walk the draft. Collect `assetRefsDraft`.
- Generate a zip containing:
  - `portfolio.json` — the draft snapshot
  - `theme.json` — convenience extraction
  - `assets/{originalFilename}` — original asset binaries
  - `README.md` — orientation
- Upload to `portfoliopro-{env}-private/exports/{uid}/{portfolioId}/{exportId}.zip`.
- Return a signed URL (TTL 60 minutes) for download.
- Export files are deleted after 24 hours (lifecycle rule on the bucket).
