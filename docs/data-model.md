# Data Model

Canonical reference for the Firestore and Cloud Storage layout. Read this before designing a query or a write path.

## Firestore collections

### `/usernames/{username}`

Uniqueness lock. Document ID is the username (lowercased, normalised). Used to atomically claim and release usernames.

```ts
{
  uid: string;            // owner
  claimedAt: Timestamp;
}
```

Writes are always transactional with the corresponding `users/{uid}` write. The username string must match `^[a-z0-9-]{3,30}$` and not appear in the reserved word list (`admin`, `api`, `login`, `signup`, `www`, `portfolio`, `portfoliopro`, `support`, `help`, `static`, `assets`, `v`).

### `/users/{uid}`

Top-level user document. Document ID is the Firebase UID.

```ts
{
  uid: string;
  username: string;       // current username (also held in /usernames/{username})
  email: string;          // from Firebase Auth, denormalised for queries
  createdAt: Timestamp;
  updatedAt: Timestamp;
  storageBytesUsed: number; // running total across all portfolios
  softDeletedAt: Timestamp | null;  // 7-day grace before hard delete
}
```

### `/users/{uid}/portfolios/{portfolioId}`

A single portfolio. Document ID is a generated string (ULID).

```ts
{
  id: string;
  uid: string;            // denormalised owner for rules
  slug: string;           // unique within user; ^[a-z0-9-]{1,40}$
  title: string;
  description: string;
  isPublished: boolean;
  publishedAt: Timestamp | null;
  publishedSnapshotPath: string | null;  // gs:// path
  publishedVisibility: 'public' | 'password' | null;
  requiresPassword: boolean;
  draft: SnapshotJson;    // current editor state (see snapshot-schema.md)
  draftUpdatedAt: Timestamp;
  draftSchemaVersion: number;
  assetRefsDraft: string[];      // asset IDs referenced by draft
  assetRefsPublished: string[];  // asset IDs referenced by current published snapshot
  storageBytesPortfolio: number; // sum of asset sizes for this portfolio
  createdAt: Timestamp;
  updatedAt: Timestamp;
  softDeletedAt: Timestamp | null;
}
```

### `/users/{uid}/portfolios/{portfolioId}/viewerPasswords/{passwordId}`

```ts
{
  id: string;
  label: string;                  // user-facing label e.g. "ACME recruiter"
  hash: string;                   // argon2id hash, includes parameters
  createdAt: Timestamp;
  expiresAt: Timestamp | null;    // optional
  revokedAt: Timestamp | null;
  lastUsedAt: Timestamp | null;
}
```

### `/users/{uid}/assets/{assetId}`

Asset metadata. Assets are owned by the user, not by a specific portfolio. The binary lives in Cloud Storage.

```ts
{
  id: string;
  uid: string;
  filename: string;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf';
  byteSize: number;
  storagePath: string;            // gs:// path in private assets bucket
  width?: number;                 // images only
  height?: number;                // images only
  createdAt: Timestamp;
  softDeletedAt: Timestamp | null;
}
```

### `/portfolioRoutes/{username}_{slug}`

Top-level lookup index for the viewer. Avoids needing to query users by username at view time.

```ts
{
  uid: string;
  portfolioId: string;
  isPublished: boolean;
  requiresPassword: boolean;
  publishedSnapshotPath: string;
  publishedVisibility: 'public' | 'password';
  publishedAt: Timestamp;
}
```

Written and deleted by the publish/unpublish endpoint. Username change updates this index for every published portfolio of the user.

### `/portfolioRoutes/{username}_{slug}/attempts/{ipBucket}`

Rate-limit subcollection for password unlock attempts. `ipBucket` is the SHA-256 of the client IP (so we don't store raw IPs).

```ts
{
  count: number;
  windowStart: Timestamp;        // current 15-min window
}
```

Endpoint reads-modifies-writes this atomically. Threshold: 10 attempts per 15 minutes per (route, ipBucket).

### `/templates/{templateId}`

Curated templates, seeded from `tools/seed-templates/`. Read-only to clients. A single flat collection with a `kind` discriminator — `kind: 'section'` templates appear in the section palette; `kind: 'portfolio'` templates are offered in the "New portfolio" wizard.

```ts
{
  id: string;
  kind: 'section' | 'portfolio';
  name: string;
  description: string;
  category: string;
  thumbnail: string;             // gs:// path in public template assets bucket
  snapshotFragment: object;      // a Section when kind === 'section'; a full Snapshot when kind === 'portfolio'
}
```

Why one collection with a discriminator rather than two collections at `/templates/sections/*` and `/templates/portfolios/*`: Firestore requires path segments to alternate collection/document, so `/templates/sections/{tid}` is not a legal document path. A flat `/templates/` collection is also easier to extend with new kinds later (e.g. `kind: 'theme'`).

### `/deletionQueue/{taskId}`

Scheduled hard deletions after grace period. Polled by a daily Cloud Run Job (or manual trigger in v1 — see build plan).

```ts
{
  kind: 'user' | 'portfolio' | 'asset';
  targetUid: string;
  targetId: string;
  scheduledFor: Timestamp;       // softDeletedAt + 7 days
}
```

## Required indexes

Defined in `infra/firestore.indexes.json`:

- Collection group `portfolios` on `(uid, isPublished, updatedAt desc)` — for the editor "your portfolios" listing.
- Collection group `viewerPasswords` on `(revokedAt, expiresAt)` — for the unlock check (filter out revoked/expired).
- Collection group `assets` on `(uid, softDeletedAt, createdAt desc)` — for the asset library.
- `templates` on `(kind asc, category asc, name asc)` — for the template gallery, filterable by kind and category.

## Cloud Storage layout

Two buckets:

- `portfoliopro-{env}-public` — publicly readable. Hosts public snapshots and assets referenced by them.
- `portfoliopro-{env}-private` — private. Hosts password-gated snapshots, private assets, drafts in transit, exports in transit.

Layout within each bucket:

```
users/{uid}/assets/{assetId}/{filename}          # source assets (private by default)
users/{uid}/assets/{assetId}/{filename}          # public copy when referenced by public snapshot
snapshots/{username}/{portfolioSlug}/snapshot.json
exports/{uid}/{portfolioId}/{exportId}.zip
template-thumbnails/{templateId}.{ext}            # public
```

When a portfolio is published as public, the referenced assets are *copied* (not moved) from the private bucket to the public bucket under the same key path. When republished or unpublished, the orphan-cleanup step removes copies that are no longer referenced.

## Security rules (patterns)

### Firestore — default deny

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{uid} {
      allow read: if request.auth.uid == uid;
      allow create: if request.auth.uid == uid;
      allow update: if request.auth.uid == uid
        && request.resource.data.uid == uid;
      allow delete: if false;   // soft delete via backend only

      match /portfolios/{pid} {
        allow read, write: if request.auth.uid == uid;

        match /viewerPasswords/{pwid} {
          allow read, write: if request.auth.uid == uid;
        }
      }

      match /assets/{aid} {
        allow read, write: if request.auth.uid == uid;
      }
    }

    match /usernames/{username} {
      allow read: if true;      // public — to check availability during signup
      allow write: if false;    // only backend (admin SDK) writes
    }

    match /portfolioRoutes/{routeId} {
      allow read: if true;      // public — viewer route resolution
      allow write: if false;    // only backend writes
    }

    match /templates/{templateId} {
      allow read: if true;      // public — template gallery
      allow write: if false;    // seeded out-of-band
    }
  }
}
```

### Storage — public bucket

```js
match /b/portfoliopro-{env}-public/o {
  match /{allPaths=**} {
    allow read: if true;
    allow write: if false;     // only backend writes
  }
}
```

### Storage — private bucket

```js
match /b/portfoliopro-{env}-private/o {
  match /users/{uid}/{allPaths=**} {
    allow read, write: if request.auth.uid == uid;
  }
  match /snapshots/{allPaths=**} {
    allow read: if false;      // signed URL only
    allow write: if false;     // backend only
  }
}
```

Direct user uploads to `users/{uid}/...` use the rule above. The backend mints signed upload URLs that scope the upload key and content type.

## Tenancy checklist

Before you merge a change that touches Firestore or Storage, confirm:

- [ ] Every read includes the user's UID in the path or as a `where` filter.
- [ ] Every write includes the user's UID and would fail security rules under any other UID.
- [ ] No request body or URL parameter is trusted as the source of UID — it's always derived from the validated ID token server-side.
- [ ] Storage paths begin with `users/{uid}/...` or `snapshots/...` (server-written only).
- [ ] Security rules deny by default and you can articulate why your specific allow rule is correct.
