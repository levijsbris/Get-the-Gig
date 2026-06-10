# Architecture

## Product summary

A multi-tenant portfolio builder. Users authenticate with Firebase Auth, build one or more portfolios in a WYSIWYG editor (page-based, sectioned, component-driven), and publish them as static JSON snapshots served from Cloud Storage. Each portfolio is reached at `portfoliopro.com/{username}/{portfolio-slug}/{page-slug?}`. Portfolios can be fully public or gated by user-minted, individually-revocable passwords.

## Hosting plane and cost rationale

Everything is selected so that idle traffic costs approximately zero.

| Concern              | Choice                                                | Why                                                                                   |
|----------------------|-------------------------------------------------------|---------------------------------------------------------------------------------------|
| Backend compute      | Cloud Run, `min-instances=0`                          | Scales to zero. 2M requests/month free. .NET 8 containers supported natively.         |
| Frontend hosting     | Firebase Hosting                                      | Free tier with global CDN. No L7 LB (~$18/mo) required.                              |
| Database             | Firestore Native                                      | Pay-per-op, no idle cost. Fits multi-tenant document model.                          |
| Object storage       | Cloud Storage                                         | Pay-per-byte and per-op. Public prefix for unprotected snapshots.                    |
| Identity (editor)    | Firebase Auth                                         | Generous free tier. JWTs validated server-side. No Identity Platform upgrade needed. |
| Identity (viewer)    | App-managed, argon2id hashes in Firestore             | Low-stakes shared passwords, multiple per portfolio, per-label revocation.           |
| CI/CD                | GitHub Actions + Workload Identity Federation         | No long-lived service account keys in GitHub secrets.                                |
| Region               | `australia-southeast1` (Sydney)                       | Lowest latency from Brisbane; single-region to minimise cost.                        |

Explicitly NOT used:

- **App Engine Flexible** — does not scale to zero.
- **Cloud SQL** — always-on minimum cost.
- **L7 Load Balancer / Cloud CDN** — fixed ~$18/mo even at zero traffic.
- **Serverless VPC Access connector** — fixed monthly cost.
- **Cloud NAT** — fixed monthly cost.
- **Server-side image processing** — image transforms happen client-side.

Budget alert: $5/month per environment, configured in the GCP project console.

## Request flow

### Editor request flow

```
Browser (editor SPA on Firebase Hosting)
  ↓ Firebase ID token in Authorization header
Cloud Run (ASP.NET Core API)
  ↓ Firebase Admin SDK token validation
  ↓ UID-scoped operations
Firestore + Cloud Storage
```

`/api/*` paths on the editor's hostname are routed to Cloud Run via Firebase Hosting rewrites (which avoids the L7 load balancer's fixed cost).

### Public viewer request flow

```
Browser (viewer SPA on Firebase Hosting)
  ↓ direct HTTPS GET (no auth, no backend hop)
Cloud Storage public-snapshots prefix
  ↓ snapshot.json
Browser renders via shared renderer package
  ↓ direct HTTPS GET for each asset
Cloud Storage public-assets prefix
```

Zero backend cost per public view.

### Password-gated viewer request flow

```
Browser (viewer SPA)
  ↓ POST password
Cloud Run /api/v/{username}/{slug}/unlock
  ↓ argon2id verify, rate-limit check
  ↓ mint signed URL (TTL 15 min) for private snapshot
Browser fetches snapshot.json from Cloud Storage
  ↓ for each asset, mint signed URL on demand OR
  ↓ pre-mint a signed cookie / bundle signed asset URLs into the response
```

One Cloud Run hit per unlock, not per view.

## Frontend topology

Two separate Vite apps share a renderer package:

- **`apps/editor`** — authenticated SPA. Contains the WYSIWYG editor, asset library, theme designer, portfolio management dashboard. Imports `@portfoliopro/renderer` (to render components) and `@portfoliopro/editor-kit` (selection, drag, toolbars wrapping renderer components).
- **`apps/viewer`** — public SPA. Imports `@portfoliopro/renderer` only. Fetches snapshot JSON, renders. Tiny bundle — no auth, no editor code, no theme designer.

Why two apps: the viewer should be small and cacheable. Bundling editor and viewer wastes the viewer's bandwidth and risks leaking editor code paths into public output.

## Backend topology

Single Cloud Run service running a .NET 8 minimal API. Endpoints grouped by resource:

- `/api/auth/*` — username claim, username change, account deletion
- `/api/portfolios/*` — portfolio CRUD, draft autosave
- `/api/portfolios/{id}/assets/*` — asset upload (signed URL flow), asset list
- `/api/portfolios/{id}/publish` — publish snapshot
- `/api/portfolios/{id}/unpublish` — take down
- `/api/portfolios/{id}/passwords/*` — viewer password CRUD
- `/api/portfolios/{id}/export` — zip export
- `/api/v/{username}/{slug}/unlock` — viewer password verify (rate-limited)

There is no separate "media service", no message queue, no Pub/Sub. Orphan asset cleanup runs lazily inside the publish endpoint.

## Data plane: Firestore vs. Cloud Storage

| Data                            | Lives in                                      |
|---------------------------------|-----------------------------------------------|
| User profile (username, email)  | Firestore `/users/{uid}`                      |
| Username uniqueness lock        | Firestore `/usernames/{username}`             |
| Portfolio metadata              | Firestore `/users/{uid}/portfolios/{pid}`     |
| Portfolio draft JSON            | Firestore (same doc, `draft` field)           |
| Published snapshot JSON         | Cloud Storage (public or private prefix)      |
| Asset metadata (mime, size)     | Firestore `/users/{uid}/assets/{aid}`         |
| Asset binary                    | Cloud Storage                                 |
| Viewer passwords (hashed)       | Firestore subcollection of portfolio          |
| Public route lookup index       | Firestore `/portfolioRoutes/{username_slug}`  |
| Curated section/portfolio templates | Firestore `/templates/{templateId}` (RO, `kind` field) |

Drafts in Firestore are bounded by the 1MiB doc limit. The editor warns at 800KB and blocks save at 950KB. In practice a typical portfolio (10 pages, ~10 components each, all images by reference) stays under 100KB.

## Multi-tenancy and isolation

A tenant is a single user, identified by Firebase UID. Isolation is enforced at four layers:

1. **Firebase ID token validation** — UID derived from the validated token, never from the request body.
2. **Application-layer scoping** — every Firestore query includes the UID; every Storage path is prefixed with the UID.
3. **Firestore security rules** — deny-by-default; allow only `request.auth.uid == resource.data.uid` style matches.
4. **Storage security rules** — same model, prefix-matched.

See [`data-model.md`](data-model.md) for the rule patterns.

## Deployment topology

Two environments: `dev` and `prod`. Each is a separate GCP project (`portfoliopro-dev`, `portfoliopro-prod`) with its own Firebase project, Firestore database, Storage bucket, and Cloud Run service. No cross-project resources.

Promotion is by tag: pushing a `v*` tag to `main` deploys to prod via GitHub Actions. Regular pushes to `main` deploy to dev.

GitHub Actions authenticates to GCP using Workload Identity Federation — no service account JSON keys in repo secrets.

## Observability

Minimal in v1, designed for cost:

- Cloud Run request logs (free for stdout/stderr to default log bucket within retention).
- A single structured log line per request with: method, path, status, duration, UID (if any), correlation ID.
- No APM, no error tracker in v1. Add Sentry (free tier) once the surface area justifies it.
- Cost dashboard: GCP billing console + a $5 budget alert per environment.
