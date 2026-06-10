---
name: snapshot-and-publish
description: Use whenever changing the snapshot schema (the JSON shape of portfolios), the publish/unpublish pipeline, or anything that produces, consumes, validates, or stores a portfolio snapshot. Schema changes are dangerous because existing drafts and published snapshots may be on older versions; the publish pipeline is the most cross-cutting flow in the system (Firestore + Storage + route index + orphan cleanup). Trigger this skill proactively for any work involving the Zod schemas in `packages/snapshot-schema/`, the publish endpoint, asset reference tracking, or snapshot versioning. Also use when reviewing PRs that touch any of these.
---

# Snapshot and Publish

This skill covers two coupled things: the snapshot schema (the JSON document representing a portfolio) and the publish pipeline (the flow that takes a draft and makes it live). Read `docs/snapshot-schema.md` and `docs/publish-flow.md` for the canonical references — this skill is the working playbook for changing them safely.

## When you're changing the schema

### Decide: backwards-compatible or breaking?

**Backwards-compatible (no version bump):**

- Adding a new optional field to an existing component.
- Adding a new component type.
- Adding a new section template.
- Adding a new theme token slot if old themes default to a sensible value.
- Loosening a constraint (regex, max length).

**Breaking (requires version bump and migration):**

- Removing or renaming a field.
- Removing or renaming a component type.
- Changing a field's type (e.g. number → string).
- Tightening a constraint that older valid docs might violate.
- Restructuring (e.g. flattening or nesting fields).

### Backwards-compatible change procedure

1. Add the new field to the Zod schema as `.optional()` or with a `.default(...)`.
2. Update the renderer to handle both old (field absent) and new (field present) docs. Don't assume the field is set.
3. Update the editor to write the new field for new content. Old drafts will gain the field on next save if the default factory is updated; but they MUST also keep parsing without the field.
4. Update the default factory if applicable.
5. Regenerate JSON Schema: `pnpm --filter @portfoliopro/snapshot-schema build`.
6. No `version` bump.
7. Test: load an old fixture (without the field), parse it, render it, save it, publish it.

### Breaking change procedure

1. Bump the version constant: `version: 2` etc. in `packages/snapshot-schema/src/index.ts`.
2. Write a migration in `packages/snapshot-schema/migrations/v1-to-v2.ts`:
   ```ts
   export function migrateV1ToV2(input: SnapshotV1): SnapshotV2 {
     // pure function, no I/O, deterministic
   }
   ```
3. Update the loader in `packages/snapshot-schema/src/load.ts` to detect the version and run the chain of migrations up to the current version.
4. The editor always loads drafts through `loadSnapshot()`, which runs migrations and returns a current-version doc. The first save after migration writes the migrated doc back. (Lazy migration.)
5. The publish endpoint also runs `loadSnapshot()` on the draft before validation, so a publish migrates the snapshot in storage too.
6. Add a fixture for each historical version in `packages/snapshot-schema/__fixtures__/v{n}/` and a test that asserts each migrates cleanly to the current version and renders correctly.
7. Update `docs/snapshot-schema.md` with the new version.
8. Roll out: deploy backend first (which can read v1 and v2), then frontend (which writes v2). This is the standard schema-rollout order — never deploy a frontend that writes a version the backend can't read.

### Why lazy migration

We could batch-migrate every draft on deploy day. We don't, because:

- Most portfolios are dormant; migrating them is wasted work.
- A botched migration on a hot user's draft is more damaging than a botched migration discovered on the first read.
- Lazy migration is testable per-document — every reader runs the same code path.

The trade-off: support code lives forever, since v1 fixtures must still parse. Don't ship a breaking change unless the benefit is real.

## When you're changing the publish pipeline

The publish endpoint does a lot. The canonical sequence is in `docs/publish-flow.md` — read it before touching `PublishService.cs`. Common changes and their gotchas:

### Adding a new validation rule

Add to `apps/api/src/PortfolioPro.Api/Services/SnapshotValidator.cs`. The validator runs after JSON Schema validation, for cross-reference and invariant checks the schema can't express:

- NavTarget `kind: 'page'` references resolve to a real page in the snapshot.
- NavTarget `kind: 'section'` references resolve to a real section.
- `Section.columns.length === Section.layout.columns`.
- Asset IDs reference assets owned by this user and not soft-deleted.
- Container components don't nest.
- Page slugs are unique within the portfolio.

If you add a rule, also add a failing-case test that constructs the invariant violation and expects a 400.

### Adding a new asset-bearing component

If your new component references assets (like Image, PDF), it needs entries in two places:

1. **Asset reference walker** (`Services/AssetReferenceWalker.cs`) — walks a snapshot and emits every referenced `assetId`. Used at publish time to compute the new ref set, and at draft-save time to keep `assetRefsDraft` current.
2. **Validator** — every referenced asset must belong to the user. Already enforced in `SnapshotValidator.cs` via the walker — adding to the walker covers both.

See the **add-component** skill for the full procedure.

### Changing the public/private bucket decision

Currently: `visibility === "public"` → public bucket; `visibility === "password"` → private bucket. Assets follow the snapshot's visibility — they are *copied* to the public bucket on publish if needed, and orphan-cleaned later.

If you want to add a third visibility level (e.g. "unlisted", linkable but not indexed), think hard. The current model assumes two buckets. Adding a third visibility likely means:

- A separate prefix in the public bucket, not a new bucket.
- A `noindex` meta in the viewer HTML for unlisted snapshots.
- The URL must be hard to guess (long opaque ID, not the username/slug pattern).

This is a meaningful architecture change — write a design note before coding.

### Orphan cleanup

The publish endpoint computes the diff between previous-published assets and new-published assets, and removes orphans from the public bucket. **It does NOT immediately hard-delete the underlying asset binary** — the asset Firestore doc and the private-bucket copy remain. Hard deletion happens lazily when the user opens the asset library, which lists orphan candidates with a one-click delete.

Why: avoids accidental deletion when a user immediately re-publishes with a fix. And it keeps the publish endpoint fast — no synchronous storage iteration over potentially hundreds of files.

When changing this, preserve the invariant: **a published snapshot's referenced assets must remain readable for as long as the snapshot is live**. Don't delete an asset just because it's no longer referenced — verify it's not in `assetRefsPublished` of any portfolio of this user.

### Image derivative generation

Cropped/rotated images need a derivative file. We render derivatives client-side at publish time:

1. Editor walks the draft for Image components with `crop` or `rotation`.
2. For each, renders to a canvas and `toBlob()`.
3. Uploads the blob to `users/{uid}/assets/{assetId}/derivatives/{snapshotId}-{componentId}.{ext}` via a signed URL.
4. Rewrites the component in the published snapshot to reference the derivative URL.

Why client-side: zero backend CPU/memory cost, and the canvas pipeline is already needed for the crop UI preview. The trade-off: large originals can be slow to render on weak devices. Mitigated by capping originals at 2400px on the long edge during upload.

If you change derivative generation, watch the publish flow's failure mode: a derivative upload failure must roll back the publish (don't write the snapshot.json if derivatives didn't all succeed).

### Route index updates

`/portfolioRoutes/{username}_{slug}` is denormalised — it contains `publishedVisibility` and `publishedSnapshotPath` copied from the portfolio doc. When you change *any* of those on publish, update the route index in the same transaction or batch.

Username change is the messy case: every published portfolio's route index entry must be deleted and recreated under the new username, and the snapshot files in Storage must be moved (write new, delete old). See `docs/publish-flow.md` § Username change for the full sequence.

## Tests that should always pass

- Every fixture in `packages/snapshot-schema/__fixtures__/` parses, validates, and renders.
- The publish endpoint, run end-to-end against the emulator, produces a snapshot file in the expected bucket and an updated route index.
- A publish with an invalid NavTarget returns 400.
- A re-publish with a removed asset removes the public copy and adds the asset to the orphan candidates list.
- An unpublish removes the snapshot file and the route index entry.

## Checklist before merging schema or publish changes

- [ ] If schema change: decided backwards-compatible vs. breaking and followed the right procedure.
- [ ] If breaking: migration written, fixture for each version, version bump, deploy order documented.
- [ ] If publish change: validation rules added with negative tests, asset walker updated, orphan invariant preserved.
- [ ] Route index update is in the same transaction/batch as the portfolio doc update.
- [ ] Fixture set updated with a new example of any new structure.
- [ ] Manual smoke: edit, publish, view, edit again, republish, unpublish.
