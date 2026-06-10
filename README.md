# PortfolioPro

Multi-tenant portfolio builder. Users sign in, build portfolios in a visual editor, and publish them at `portfoliopro.com/{username}/{portfolio-slug}`.

## Quick start

Prereqs: Node 20+, pnpm 9, .NET 8 SDK, Docker.

```bash
pnpm install
docker compose up -d                                     # emulators
pnpm --filter @portfoliopro/editor dev                   # editor:  http://localhost:5173
pnpm --filter @portfoliopro/viewer dev                   # viewer:  http://localhost:5174
(cd apps/api/src/PortfolioPro.Api && dotnet watch)       # api:     http://localhost:5080
```

Verify the round-trip: with the API and editor running, open `http://localhost:5173` — the page should display `API health: ok` (the editor proxies `/api/health` through Vite to the .NET API).

## Local ports

| Service                | Port |
| ---------------------- | ---- |
| Editor (Vite)          | 5173 |
| Viewer (Vite)          | 5174 |
| API (ASP.NET Core)     | 5080 |
| Firestore emulator     | 8080 |
| Firebase Auth emulator | 9099 |
| Firebase Emulator UI   | 4000 |
| Firebase Emulator Hub  | 4400 |
| Firebase Emulator Logs | 4500 |
| fake-gcs-server        | 9199 |

## macOS .NET 8 note

`dotnet@8` from Homebrew is keg-only. Add to your shell rc (`~/.zshrc`):

```bash
export PATH="/opt/homebrew/opt/dotnet@8/bin:$PATH"
export DOTNET_ROOT="/opt/homebrew/opt/dotnet@8/libexec"
```

## Scripts

```bash
pnpm build         # build all workspaces (frontend)
pnpm test          # run all workspace tests (Vitest)
pnpm lint          # ESLint + Prettier check
pnpm typecheck     # tsc --noEmit across workspaces
pnpm format        # Prettier write
pnpm emulators:up  # docker compose up -d
pnpm emulators:down
```

For .NET:

```bash
cd apps/api && dotnet build && dotnet test
```

## Repo layout

```
portfoliopro/
├── apps/
│   ├── editor/                # React + Vite (Firebase Hosting)
│   ├── viewer/                # React + Vite (Firebase Hosting)
│   └── api/                   # ASP.NET Core 8 minimal API (Cloud Run)
├── packages/
│   ├── snapshot-schema/       # Zod schemas (lands Phase 2)
│   └── shared-types/          # TS types derived from snapshot-schema
├── infra/                     # Firebase config (rules, indexes, emulator config)
├── tools/                     # Build/dev scripts (template seeding, etc.)
├── .github/workflows/         # CI/CD
└── docs/                      # Architecture, data model, schema, plan
```

`packages/renderer` and `packages/editor-kit` arrive in later phases (see [`docs/build-plan.md`](docs/build-plan.md)).

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — standing context for Claude Code sessions in this repo.
- [`docs/architecture.md`](docs/architecture.md) — full architecture and cost rationale.
- [`docs/data-model.md`](docs/data-model.md) — Firestore + Storage layout and security rules.
- [`docs/snapshot-schema.md`](docs/snapshot-schema.md) — published-snapshot JSON shape.
- [`docs/publish-flow.md`](docs/publish-flow.md) — publish/unpublish lifecycle.
- [`docs/build-plan.md`](docs/build-plan.md) — phased build plan; work through phases in order.

## Skills

Project-specific skills live in `.claude/skills/`. Claude Code reads them automatically when triggered:

- `add-component` — adding a new portfolio component (Text, Card, etc.).
- `add-endpoint` — adding a backend HTTP endpoint with the project's auth/validation/error patterns.
- `firestore-data-model` — reference for data access patterns.
- `snapshot-and-publish` — schema evolution and the publish pipeline.

## Stack

- React + Vite (editor and viewer apps), TypeScript strict.
- ASP.NET Core 8 minimal API.
- Firestore Native, Cloud Storage, Firebase Auth.
- Cloud Run (scale-to-zero), Firebase Hosting.
- GitHub Actions via Workload Identity Federation.
- Region: `australia-southeast1`.

## License

Private, all rights reserved.
