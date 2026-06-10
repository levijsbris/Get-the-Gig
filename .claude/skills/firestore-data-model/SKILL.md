---
name: firestore-data-model
description: Use whenever reading or writing to Firestore or Cloud Storage in this project, designing a new query path, adding an index, modifying security rules, or reasoning about multi-tenant isolation. Wrong queries leak data across tenants; wrong indexes burn money; wrong security rules expose user data publicly. Trigger this skill proactively whenever you see Firestore client calls, collection paths, security rules, or anything that touches `/users/`, `/usernames/`, `/portfolioRoutes/`, or Storage paths. Also use when reviewing data-access PRs.
---

# Firestore Data Model

This skill is a quick reference for Firestore and Cloud Storage in PortfolioPro. The full canonical document is `docs/data-model.md` — read it the first time you touch a new collection.

## Collections at a glance

```
/usernames/{username}                              # uniqueness lock (public read, server write)
/users/{uid}                                       # user profile (self read/write)
/users/{uid}/portfolios/{pid}                      # portfolio + draft + asset refs
/users/{uid}/portfolios/{pid}/viewerPasswords/{id} # argon2id hashed
/users/{uid}/assets/{aid}                          # asset metadata (binary in Storage)
/portfolioRoutes/{username}_{slug}                 # viewer lookup index (public read, server write)
/portfolioRoutes/{username}_{slug}/attempts/{ipBucket}  # rate-limit (server only)
/templates/{tid}                                   # curated, public read, seeded; kind: 'section' | 'portfolio' field
/deletionQueue/{taskId}                            # hard-delete tasks (server only)
```

## The tenancy rule

**A tenant is a single user. Every data access must be UID-scoped at the application layer.** Security rules are the last line of defence, not the only one.

Two acceptable patterns:

```csharp
// Pattern A: UID in the path
db.Collection("users").Document(user.Uid).Collection("portfolios").Document(portfolioId)

// Pattern B: UID in a where filter (for collection group queries, rare)
db.CollectionGroup("portfolios").WhereEqualTo("uid", user.Uid).WhereEqualTo("isPublished", true)
```

Unacceptable:

```csharp
// BAD: cross-tenant leak — returns the portfolio regardless of owner
db.CollectionGroup("portfolios").WhereEqualTo("id", portfolioId)
```

The `apps/api/tests/PortfolioPro.Api.Tests/TenancyTests.cs` integration test seeds data for two users and asserts every endpoint refuses cross-tenant reads. Extend it when adding endpoints.

## Cloud Storage paths

```
users/{uid}/assets/{assetId}/{filename}              # source asset
users/{uid}/assets/{assetId}/derivatives/{snapshotId}-{componentId}.{ext}
snapshots/{username}/{slug}/snapshot.json            # public bucket if public, private if password-gated
exports/{uid}/{portfolioId}/{exportId}.zip           # private only, lifecycle-deleted after 24h
template-thumbnails/{templateId}.{ext}               # public only, seeded
```

**Two buckets per environment:** `portfoliopro-{env}-public` and `portfoliopro-{env}-private`. The signed URL service refuses to sign anything outside `users/{user.Uid}/...` for user-initiated uploads.

## Reading patterns

### List a user's portfolios

```csharp
var snap = await db.Collection("users")
    .Document(user.Uid)
    .Collection("portfolios")
    .WhereEqualTo("softDeletedAt", null)
    .OrderByDescending("updatedAt")
    .Limit(50)
    .GetSnapshotAsync(ct);
```

Index: implicit (single-field on `softDeletedAt`).

### Resolve a viewer URL to a portfolio

```csharp
var route = await db.Collection("portfolioRoutes")
    .Document($"{username}_{slug}")
    .GetSnapshotAsync(ct);
```

One read, no scan. Always use this — never query users by username first.

### Get a draft for the editor

```csharp
var doc = await db.Collection("users")
    .Document(user.Uid)
    .Collection("portfolios")
    .Document(portfolioId)
    .GetSnapshotAsync(ct);
```

Draft is on the same doc. Don't store drafts in Storage — they fit easily under the 1MiB doc limit and Firestore is cheaper for the autosave write rate.

## Writing patterns

### Autosave a draft

```csharp
await portfolioRef.UpdateAsync(new Dictionary<string, object>
{
    ["draft"] = newDraftJson,
    ["draftUpdatedAt"] = Timestamp.GetCurrentTimestamp(),
    ["assetRefsDraft"] = walker.Walk(newDraftJson).ToList(),
    ["updatedAt"] = Timestamp.GetCurrentTimestamp(),
}, ct);
```

The client debounces autosave to ~once per 2 seconds during active editing. Last-write-wins. The client never sends a partial draft — always the full snapshot.

### Claim a username (transactional)

```csharp
await db.RunTransactionAsync(async tx =>
{
    var usernameDoc = await tx.GetSnapshotAsync(db.Collection("usernames").Document(username));
    if (usernameDoc.Exists)
        throw new UsernameConflictException();

    tx.Create(db.Collection("usernames").Document(username), new Dictionary<string, object>
    {
        ["uid"] = user.Uid,
        ["claimedAt"] = Timestamp.GetCurrentTimestamp(),
    });
    tx.Update(db.Collection("users").Document(user.Uid), new Dictionary<string, object>
    {
        ["username"] = username,
        ["updatedAt"] = Timestamp.GetCurrentTimestamp(),
    });
}, cancellationToken: ct);
```

NEVER write to `/usernames/{u}` outside a transaction with the user doc. The lock and the user record must move together.

### Rate-limit a password attempt

```csharp
await db.RunTransactionAsync(async tx =>
{
    var attemptRef = db.Collection("portfolioRoutes")
        .Document(routeId)
        .Collection("attempts")
        .Document(ipBucket);

    var snap = await tx.GetSnapshotAsync(attemptRef);
    var now = DateTimeOffset.UtcNow;
    var windowStart = snap.Exists ? snap.GetValue<DateTimeOffset>("windowStart") : now;
    var count = snap.Exists && (now - windowStart) < TimeSpan.FromMinutes(15)
        ? snap.GetValue<int>("count") + 1
        : 1;
    var resetWindow = !snap.Exists || (now - windowStart) >= TimeSpan.FromMinutes(15);

    if (count > 10)
        throw new RateLimitedException();

    tx.Set(attemptRef, new Dictionary<string, object>
    {
        ["count"] = count,
        ["windowStart"] = resetWindow ? now : windowStart,
    });
}, cancellationToken: ct);
```

## Indexes

Add new composite indexes to `infra/firestore.indexes.json`. The emulator and production both load this file. The Firestore client logs the exact required index for a missing-index error, including a console URL — but for repeatable deployment, capture it in the indexes file.

Current composite indexes:

- `portfolios` collection group, `(uid asc, isPublished asc, updatedAt desc)` — for admin/cross-portfolio listings. Audit before Phase 11 deploy: if no read path uses it by then, delete the entry.
- `viewerPasswords` collection group, `(revokedAt asc, expiresAt asc)` — for the unlock check.
- `assets` collection group, `(uid asc, softDeletedAt asc, createdAt desc)` — for asset library listings.
- `templates`, `(kind asc, category asc, name asc)` — for the template gallery (filter by kind, then category).

## Security rules — the patterns

See `infra/firestore.rules` for the live source. Key patterns:

```js
// Owner-only — most common
match /users/{uid}/portfolios/{pid} {
  allow read, write: if request.auth.uid == uid;
}

// Public read, server write — for lookup indexes
match /portfolioRoutes/{routeId} {
  allow read: if true;
  allow write: if false;
}

// Public read, server write — for username availability check
match /usernames/{username} {
  allow read: if true;
  allow write: if false;
}
```

Rules are tested via the Firebase emulator's rules test SDK. See `infra/firestore.rules.test.ts`. Every new rule needs at least one passing and one failing test. (The rules-test harness — `@firebase/rules-unit-testing`, the `infra/firestore.rules.test.ts` file, and the CI step that runs it — lands with the first real rule in Phase 1. Until then, `infra/firestore.rules` is the deny-by-default placeholder from Phase 0.)

## Cost-aware patterns

- **Prefer one read over a scan.** Use `/portfolioRoutes/{username}_{slug}` instead of a username-then-portfolios query.
- **Denormalise judiciously.** The route index duplicates `isPublished` and `publishedSnapshotPath` from the portfolio doc — that's intentional, so a viewer route resolution is one read instead of two.
- **Avoid listening (`onSnapshot`) on hot collections.** The editor uses one-shot reads with React Query, not real-time listeners. Listeners are billed per result, which can be expensive for collaborative or always-on UIs.
- **Batch writes.** When publishing, the route index update, portfolio doc update, and orphan ref list update all go in one `WriteBatch` or transaction.
- **Don't store binary or large blobs in Firestore.** Drafts go in Firestore (small structured JSON); image and PDF binaries go in Storage.

## When to break out of this model

Some operations don't fit cleanly:

- **Username-wide scan** (e.g. "rename my account, update every portfolio's route index"). This is a multi-write across denormalised indexes. Handle in the username-change endpoint with a `WriteBatch`. If a user has many portfolios, batch into chunks of 500.
- **Global search.** Out of scope for v1 — no directory, no discovery. If added later, use a dedicated search index (Algolia free tier or self-hosted Meilisearch on Cloud Run with min-instances=0).
- **Analytics.** Out of scope for v1. If added later, write events to BigQuery, not Firestore.

## Checklist before merging a data-access change

- [ ] Every read includes UID in the path or `where` filter.
- [ ] Every write includes UID and is rejected by security rules under a different UID.
- [ ] No client-supplied UID is trusted — always derived from validated token.
- [ ] Storage path is `users/{uid}/...` or a server-written prefix.
- [ ] New composite indexes added to `infra/firestore.indexes.json`.
- [ ] New security rules have at least one positive and one negative test.
- [ ] Read amplification considered — does the change turn one read into many?
