# PortfolioPro

A multi-tenant portfolio builder for IT and design professionals. Users sign in, build one or more portfolios in a visual editor, and publish them at `portfoliopro.com/{username}/{portfolio-slug}`. Viewer access can be public or gated by user-minted passwords with revocable labels (e.g. "ACME recruiter").

This file is your standing context for the repo. Read it once at the start of every session. The `.claude/skills/` directory contains skills for the most common recurring tasks — consult them when their triggers fire.

---

## Architecture (one-paragraph version)

ASP.NET Core 8 minimal API on Cloud Run (scale-to-zero). React + Vite frontends on Firebase Hosting (one editor app, one public viewer app). Firestore Native for application data. Cloud Storage for user assets and published JSON snapshots. Firebase Auth for editor identity (viewer passwords are app-managed, argon2id-hashed). GitHub Actions deploy via Workload Identity Federation. Region: `australia-southeast1`. The hosting plane is selected for near-zero idle cost — no Cloud SQL, no Serverless VPC Access, no Cloud NAT, no load balancer.

For the longer version see [`docs/architecture.md`](docs/architecture.md).

---

## Repo layout

```
portfoliopro/
├── apps/
│   ├── editor/                # React Vite, authenticated builder (Firebase Hosting)
│   ├── viewer/                # React Vite, public portfolio renderer (Firebase Hosting)
│   └── api/                   # ASP.NET Core 8 minimal API (Cloud Run)
├── packages/
│   ├── snapshot-schema/       # Zod schemas + generated JSON Schema (source of truth)
│   ├── renderer/              # Shared React component library used by editor + viewer (created Phase 4)
│   ├── editor-kit/            # Editor-only wrappers: selection, drag, toolbars (created Phase 4)
│   └── shared-types/          # TypeScript types derived from snapshot-schema
├── infra/
│   ├── firestore.rules
│   ├── firestore.indexes.json
│   ├── storage.rules
│   ├── firebase.json
│   └── .firebaserc
├── tools/                     # build/dev scripts (template seeding, schema sync, etc.)
├── .github/workflows/         # CI/CD via Workload Identity Federation
├── .claude/
│   └── skills/                # Project-specific skills — read these before touching the things they cover
├── docs/                      # Architecture, data model, schema, publish flow, build plan
├── docker-compose.yml         # Emulators for local dev (Firestore, Auth, fake-gcs)
└── CLAUDE.md                  # This file
```

---

## Skills (consult these — don't reinvent)

- **add-component** — adding a new portfolio component (Text, Card, etc.). Cross-cutting: schema, renderer, editor palette, validation, defaults.
- **add-endpoint** — adding a new C# minimal API endpoint with the project's auth, tenancy, validation, and error conventions.
- **firestore-data-model** — the canonical data model. Read before reading or writing Firestore.
- **snapshot-and-publish** — the snapshot schema and the publish pipeline (validation, asset reference tracking, orphan cleanup, route updates).

Skills live in `.claude/skills/{name}/SKILL.md`. Read the SKILL.md before doing the thing the skill covers.

---

## Documents

- [`docs/architecture.md`](docs/architecture.md) — full architecture, hosting plane, cost rationale
- [`docs/data-model.md`](docs/data-model.md) — Firestore collections, indexes, security rules summary
- [`docs/snapshot-schema.md`](docs/snapshot-schema.md) — published-snapshot schema reference
- [`docs/publish-flow.md`](docs/publish-flow.md) — end-to-end publish/unpublish lifecycle
- [`docs/build-plan.md`](docs/build-plan.md) — phased build plan; work through phases in order

---

## Multi-tenancy invariants

Every operation that reads or writes user data MUST be scoped to a tenant. A tenant is a single user, identified by Firebase UID.

- Every Firestore query that touches user content includes the user's UID either as a doc path component or as a `where("uid", "==", uid)` filter. No exceptions.
- Every Cloud Storage path is prefixed with the user's UID: `users/{uid}/...`. No flat keyspaces.
- Backend endpoints derive the UID from the validated Firebase ID token. They NEVER trust a UID from the request body or URL.
- Security rules enforce this at the Firestore/Storage layer too — they're the last line of defence, not the only one.
- A username collision check uses the `usernames` collection as a uniqueness lock (doc ID = username, value = uid), written transactionally with the user doc.

If you find yourself writing a query without a UID scope, stop. Something is wrong.

---

## Security invariants

- Viewer passwords are hashed with **argon2id** at rest (see `add-endpoint` skill for the standard parameters). Plaintext passwords never touch Firestore or logs.
- Editor auth uses Firebase ID tokens validated server-side via the Firebase Admin SDK (or equivalent JWT validation against Google's published keys). Token expiry is honoured.
- Signed URLs for assets and private snapshots have a TTL ≤ 15 minutes.
- Rate limiting on the password-unlock endpoint: 10 attempts per portfolio per 15-minute window (IP-bucketed). Tracked in Firestore.
- Never log: passwords (plaintext or hash), full ID tokens, signed URLs, asset contents.
- All endpoints validate input against a schema (FluentValidation on backend, Zod on frontend before submit).

---

## Cost guardrails

The product is designed to cost approximately zero at zero traffic. Any change that breaks that property needs an explicit decision.

- Cloud Run services run with `min-instances=0`. Never set this higher without a recorded reason.
- No Cloud SQL, no Serverless VPC Access, no Cloud NAT, no L7 load balancer. If you think you need one, escalate first.
- Firestore reads dominate cost at scale. Prefer denormalised lookup docs (e.g. `portfolioRoutes/{username_slug}`) over composite queries when the access pattern is hot.
- Published snapshot reads must NOT round-trip through Cloud Run for public portfolios. They go directly to Cloud Storage. Only password-gated viewer requests hit the backend.
- Image transforms happen client-side. No server-side image processing in v1.
- Set a GCP budget alert at $5/month per environment. Recorded in `docs/architecture.md`.

---

## Conventions

### TypeScript (frontend + shared packages)

- `pnpm` workspaces. Node 20 LTS.
- Strict TS (`"strict": true`, `"noUncheckedIndexedAccess": true`).
- ESLint + Prettier. Run via `pnpm lint` / `pnpm format` from the repo root.
- React function components only. Hooks. No class components.
- State: Zustand for editor state, React Query for server state, React Hook Form + Zod for forms.
- Styling: Tailwind for editor/viewer chrome only. Rendered portfolio components use the theme token system from `packages/renderer` — never raw Tailwind classes on user-rendered output (they break theming and bloat the snapshot).
- File naming: `kebab-case.tsx` for components, `camelCase.ts` for hooks/utilities.
- Types from `@portfoliopro/shared-types`. Never duplicate snapshot types.

### C# (backend)

- .NET 8 LTS. ASP.NET Core minimal APIs. Nullable reference types enabled. `TreatWarningsAsErrors=true`.
- Endpoints in `apps/api/src/PortfolioPro.Api/Endpoints/{Resource}Endpoints.cs`. One static class per resource. Each endpoint method registered in a `MapXxx` extension.
- Validation: FluentValidation. Validators live alongside their DTOs.
- Auth: every endpoint that touches user data calls a `RequireUser` extension that returns the validated `UserContext` (UID, claims). No raw `HttpContext.User` reads.
- Errors: throw `ProblemDetailsException` with a `ProblemDetails` payload. A single exception filter maps to RFC 7807 responses.
- Logging: `ILogger<T>` with structured fields. No `Console.WriteLine`. No PII in logs.
- Tests: xUnit. One test project per app project.

### Schema source of truth

The snapshot schema is defined ONCE in `packages/snapshot-schema/` using Zod. JSON Schema is generated from it at build time. The C# backend validates incoming snapshots against the generated JSON Schema using NJsonSchema — it does NOT have hand-written C# DTOs for snapshot internals. This decouples backend deployments from schema evolution.

When changing the snapshot schema, read the **snapshot-and-publish** skill first.

### Commits and branches

- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`. Scope optional.
- Trunk-based: one `main` branch, short-lived feature branches, squash-merge.
- PRs include: what changed, why, how tested, any cost/security implications.

---

## Local development

Local dev runs against emulators — no GCP connection required for normal work.

```bash
# Start emulators (Firestore, Firebase Auth, fake-gcs-server)
docker compose up -d

# Editor app
pnpm --filter @portfoliopro/editor dev          # http://localhost:5173

# Viewer app
pnpm --filter @portfoliopro/viewer dev          # http://localhost:5174

# API
cd apps/api/src/PortfolioPro.Api
dotnet watch                                     # http://localhost:5080
```

Emulator endpoints are wired via `.env.local` files in each app. Environment switching (local / dev / prod) is via Vite env modes and ASP.NET environment names — never via code branches.

Seed data (curated section templates, portfolio templates, fonts list) is loaded by `tools/seed-templates/`. Run on first emulator boot.

---

## Things that look easy but aren't

- **Adding a new component type.** Touches the Zod schema, JSON Schema regeneration, the renderer package, the editor palette, default props, drag/drop registration, and the validator. Use the **add-component** skill.
- **Changing the snapshot schema.** Drafts and published snapshots can be on older versions. Decide on backwards-compatible field addition vs. versioned migration before you write code. Read the **snapshot-and-publish** skill.
- **Anything involving usernames.** Usernames are claimed transactionally via the `usernames` lock collection, can be changed (old usernames are released, old URLs 404), and have a reserved word list. Don't read or write the user doc's `username` field without going through the username service.
- **Publishing a portfolio.** Validation, snapshot upload to Storage, route table update, asset reference tracking, orphan asset queuing, public-vs-private bucket prefix selection — all need to happen atomically-ish. Use the **snapshot-and-publish** skill.
