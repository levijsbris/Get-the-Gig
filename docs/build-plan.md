# Build Plan

Phased plan for building PortfolioPro with Claude Code. Each phase ends in a working, demoable state. Don't skip ahead — later phases depend on earlier ones being solid.

For each phase: **Goal**, **Acceptance criteria**, **Tasks**.

---

## Phase 0 — Repo skeleton and local dev

**Goal.** A monorepo that builds, tests, and lints. Empty editor, viewer, and API apps that start locally against emulators and exchange a hello-world request.

**Acceptance.**
- `git clone && pnpm install && pnpm build` succeeds.
- `docker compose up -d` brings up Firestore, Auth, and fake-gcs-server emulators.
- Editor at http://localhost:5173, viewer at http://localhost:5174, API at http://localhost:5080.
- `GET /api/health` from the editor returns 200 with a JSON `{ status: "ok" }`.
- `pnpm test` and `dotnet test` both pass (with placeholder tests).
- `pnpm lint` passes.
- CI runs on push and is green.

**Tasks.**
- `pnpm` workspace at the root with `apps/editor`, `apps/viewer`, and the `packages/*` workspaces.
- Vite + React + TS scaffolds for editor and viewer. Strict TS config. ESLint + Prettier.
- .NET 8 minimal API in `apps/api/src/PortfolioPro.Api/` with `/api/health`. Nullable + `TreatWarningsAsErrors`.
- `docker-compose.yml` with `firebase-tools` (Firestore + Auth emulators) and `fsouza/fake-gcs-server`.
- `packages/shared-types` and `packages/snapshot-schema` as empty workspace packages.
- `.github/workflows/ci.yml` running build + lint + test on every PR.
- `.gitignore`, root `README.md`.

---

## Phase 1 — Auth and tenancy

**Goal.** Users can sign up with Firebase Auth, claim a username at signup, log in, change username, and request account deletion (7-day grace).

**Acceptance.**
- Signup flow: email/password, username claim. Reserved words and `^[a-z0-9-]{3,30}$` enforced both client and server side.
- Login flow and persistent session.
- Username change updates `/usernames/{old}` and `/usernames/{new}` transactionally.
- `/api/auth/account` DELETE sets `softDeletedAt` and signs the user out.
- Backend middleware: every protected endpoint requires a valid Firebase ID token and exposes `UserContext { uid, email, username }`.
- Firestore rules deny unauthenticated reads of `/users/{uid}`. Verified by an integration test.

**Tasks.**
- Firebase Auth SDK integration on editor.
- `useAuth` hook with Zustand persistence.
- `apps/api`: Firebase Admin SDK integration; `RequireUser` minimal-API filter that validates the bearer token and loads `UserContext`.
- Username service: claim, release, change, availability check. All transactional.
- Reserved word list in `apps/api/src/PortfolioPro.Api/Auth/ReservedUsernames.cs`.
- `/api/auth/me`, `/api/auth/username/availability`, `/api/auth/username` (change), `/api/auth/account` (DELETE).
- Initial `infra/firestore.rules` for users + usernames collections.
- Integration tests with the emulator.

---

## Phase 2 — Portfolio CRUD and home page

**Goal.** Users see a home page listing their portfolios. They can create, rename, delete (soft), and restore portfolios. Each portfolio has a unique slug within the user.

**Acceptance.**
- `/api/portfolios` GET (list), POST (create), `/api/portfolios/{id}` PATCH (rename/slug change), DELETE (soft).
- `/api/portfolios/{id}/restore` POST works within 7 days.
- Slug validation: `^[a-z0-9-]{1,40}$`, unique within user. 409 on collision.
- Home page UI: portfolio cards, "New portfolio" button, "Restore" tab for soft-deleted.
- A portfolio's `draft` field is initialised with an empty snapshot (`version: 1`, one empty page named "home", default theme).
- Firestore rules verified: a user cannot read another user's portfolios.

**Tasks.**
- Endpoint module `PortfolioEndpoints.cs`.
- DTOs + FluentValidation validators.
- Snapshot schema first cut in `packages/snapshot-schema/` — top-level type, Page, empty Section. Generate JSON Schema. Wire backend validation.
- Default theme in `packages/renderer/src/theme/defaults.ts`.
- Editor home page route with React Query hooks.
- Portfolio create modal (title, slug auto-suggestion from title, validation).
- Soft-delete listing and restore.

---

## Phase 3 — Asset upload pipeline

**Goal.** Users can upload images (jpeg/png/webp/gif) and PDFs to a per-user asset library. Quota enforced per portfolio.

**Acceptance.**
- Client-side resize for images: max 2400px on long edge, JPEG quality 0.85. WebP and GIF passed through.
- Per-file caps: 10MB images, 25MB PDFs. Enforced client and server.
- Per-portfolio storage cap: warning at 500MB, hard block at 600MB.
- Upload flow: client requests signed URL → uploads directly to private bucket → confirms upload to backend, which writes the asset Firestore doc.
- Asset library UI: grid, filter by type, delete (soft).
- Deleting an asset that's referenced in the draft is blocked (return list of references).

**Tasks.**
- `/api/portfolios/{id}/assets/upload-url` POST: returns signed PUT URL scoped to a specific key and content type.
- `/api/portfolios/{id}/assets` POST (confirm), GET (list), DELETE (soft).
- Client-side resize utility in `packages/editor-kit` (canvas-based).
- Asset library component in editor.
- Storage rules update for `users/{uid}/assets/*`.
- Quota tracking on the portfolio doc (`storageBytesPortfolio`) and user doc (`storageBytesUsed`).

---

## Phase 4 — Editor MVP: structure

**Goal.** A working editor for the structural parts of a portfolio: pages, sections, columns, component placement (but only one component type — Text — works).

**Acceptance.**
- Page tabs: add, rename, reorder (drag), delete.
- Section add from a stub palette ("Add empty section").
- Section reorder (up/down arrows + drag), duplicate, delete.
- Section layout selector: 1 / 2 / 3 / 4 columns.
- Drop a Text component into a column. Reorder within column. Move between columns. Duplicate. Delete.
- Selection model: clicking a section selects it (border + toolbar); clicking inside selects the component.
- Contextual toolbar shell (no content yet — wired in next phase).
- Undo/redo (in-memory, lost on reload).
- Autosave to draft (debounce 2s, optimistic localStorage shadow).
- Viewport switcher (laptop/tablet/mobile) changes the canvas width; rendering is desktop-only for now.

**Tasks.**
- Zustand store for editor state: `EditorState { snapshot, selection, history }`.
- dnd-kit integration for drag.
- Section/Column/Component components in `packages/editor-kit` wrapping plain renderer components.
- Autosave hook with debounce, last-write-wins server-side.
- History stack with structural sharing (immer).
- Schema expansion in `packages/snapshot-schema/`: Section, Column, base Component, TextComponent.

---

## Phase 5 — Editor MVP: components

**Goal.** All component types work in the editor.

**Acceptance.**
- **Text** — TipTap editor with marks for the theme's type styles, inline overrides (bold/italic/link), alignment.
- **Image** — picker from asset library, alt text, crop UI (free-form rectangle, fixed aspect presets), rotation, lightbox toggle, link target.
- **Card** — three presets, optional title/body/image/link, body uses TipTap.
- **Button** — three presets, label, link, alignment within column.
- **Container** — background, border, padding, columns, can contain non-Container components.
- **PDF** — file picker (PDFs only), inline preview toggle, download label.
- Component palette ("Add" tab in left rail) shows all six types with thumbnails.
- Right-click / context menu: duplicate, delete, move up/down.

**Tasks.**
- TipTap integration in `packages/editor-kit/src/components/TextEditor.tsx`.
- Crop UI (react-image-crop or custom canvas).
- pdf.js integration (lazy-loaded) in `packages/renderer/src/components/Pdf.tsx`.
- Card and Button presets in renderer.
- Container component in renderer + editor-kit.
- Validator updates: NavTarget cross-reference, container nesting rule, layout/columns consistency.

---

## Phase 6 — Theme system

**Goal.** Users can edit theme tokens (fonts, colors, type scale, buttons, cards) and see live updates across the editor canvas.

**Acceptance.**
- Theme tab in left rail.
- Curated 30 Google Fonts list. Selecting heading/body font triggers font load (only the chosen weights).
- Color palette with 6 named slots, color picker per slot.
- Type scale editor: H1–H4, Paragraph, Caption — family/size/weight/lineHeight/letterSpacing/color per style.
- Button preset editor: primary/secondary/ghost.
- Card preset editor: cardA/B/C.
- Spacing and radii scales.
- TokenRef resolution in renderer — component props can reference tokens by name.

**Tasks.**
- `packages/renderer/src/theme/`: token system, ThemeProvider, font loader.
- Curated font list at `packages/renderer/src/theme/fonts.ts`.
- Theme tab UI in editor.
- TokenRef type in schema; resolver utility in renderer.

---

## Phase 7 — Responsive preview and global sections

**Goal.** Mobile/tablet preview accurately reflects published behaviour. Global header/footer apply across pages.

**Acceptance.**
- Viewport switcher in editor (laptop / tablet / mobile) renders the canvas at 1280px / 768px / 380px with accurate breakpoints.
- Multi-column sections auto-stack to single column on mobile by default; user can override per breakpoint.
- Per-component visibility toggle per breakpoint.
- Global header and footer defined in a dedicated "Global sections" tab in the editor. Each page has a toggle to hide either.
- Buttons can scroll to in-page sections (NavTarget `kind: 'section'`).

**Tasks.**
- CSS media queries in renderer driven by `responsive` overrides on Section and Component.
- Global sections data shape in snapshot top level.
- Editor UI for global sections.
- In-page scroll behaviour in viewer (smooth scroll to section id).

---

## Phase 8 — Publish and public viewer

**Goal.** Users can publish a portfolio. Public portfolios are reachable at their URL and render correctly. No password handling yet — that's Phase 9.

**Acceptance.**
- `/api/portfolios/{id}/publish` validates, generates snapshot.json, uploads to the appropriate bucket, updates Firestore + route index.
- Image derivatives generated client-side before publish.
- Viewer app at `portfoliopro.com/{username}/{slug}/{page?}` fetches snapshot directly from public bucket and renders.
- Page routing within a portfolio works.
- Unpublish endpoint works.
- Orphan asset cleanup runs on re-publish.

**Tasks.**
- Publish endpoint + validator + asset-copy step.
- Snapshot upload utility in API.
- Route index management.
- Viewer app: route resolution via `portfolioRoutes`, snapshot fetch, shared renderer.
- Firebase Hosting config: rewrite `/{username}/{slug}` to the viewer SPA.

---

## Phase 9 — Viewer passwords

**Goal.** Users can mint, label, and revoke passwords. Password-gated portfolios require entry before display.

**Acceptance.**
- Password CRUD endpoints with argon2id hashing.
- Labels editable. Per-password revocation.
- Optional expiry per password.
- Unlock endpoint rate-limited (10 attempts per 15 min, per route, per ipBucket).
- On successful unlock: backend mints signed URL for the private snapshot, returns to client; client fetches and renders.
- Assets in password-gated portfolios served via signed URLs (TTL 15 min, refreshed by viewer SPA before expiry if user is still viewing).
- Publish endpoint warns when publishing public (no password) — UI warning, not a refusal.

**Tasks.**
- Password endpoints + DTOs + FluentValidation.
- Argon2id integration (`Konscious.Security.Cryptography.Argon2`).
- Rate-limit subcollection updates with transactional read-modify-write.
- Unlock flow on viewer SPA.
- Signed URL minting service in API.

---

## Phase 10 — Templates and export

**Goal.** Curated section and portfolio templates are seeded and pickable. Users can export their portfolio as a zip.

**Acceptance.**
- `tools/seed-templates/` populates `/templates/*` with `kind: 'section'` and `kind: 'portfolio'` documents.
- Editor section palette shows curated section templates with thumbnails.
- "New portfolio" wizard offers portfolio templates ("Developer", "Designer", "Photographer", etc.).
- `/api/portfolios/{id}/export` returns a zip with snapshot, theme, assets, README.
- Export download URL expires after 60 minutes; export object is deleted after 24h via bucket lifecycle.

**Tasks.**
- Seed script.
- Curated templates (start with 4 portfolio templates and 10 section templates).
- Export job + zip generation in API.
- Bucket lifecycle config for `exports/*`.

---

## Phase 11 — Deploy and CI/CD

**Goal.** Push to `main` deploys to `dev`. Push a `v*` tag deploys to `prod`. No service account JSON keys in repo secrets.

**Acceptance.**
- Workload Identity Federation configured for two GCP projects.
- GitHub Actions workflows: `deploy-api.yml`, `deploy-editor.yml`, `deploy-viewer.yml`, `deploy-rules.yml`.
- Cloud Run service deployed with `min-instances=0`. Verified zero idle cost in billing console.
- Firebase Hosting deployed with `/api/*` rewrite to Cloud Run.
- Firestore rules and indexes deployed via CI.
- $5 budget alert per environment.

**Tasks.**
- Terraform or `gcloud` scripts to bootstrap the two projects.
- Workload Identity pool + provider + service account bindings.
- Build pipelines for each app.
- Smoke test in CI post-deploy: hit `/api/health` on the deployed URL.

---

## Phase 12 — Polish

**Goal.** Production-readiness. Error boundaries, loading states, accessibility pass, basic observability.

**Acceptance.**
- Every async UI path has a loading state and an error state.
- React error boundary at the route level in both apps.
- WCAG 2.1 AA pass on editor and viewer (axe-core CI check).
- Structured request logging on backend with correlation IDs.
- Documented runbook for common ops tasks in `docs/runbook.md`.
