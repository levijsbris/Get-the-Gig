---
name: add-component
description: Use whenever adding, modifying, renaming, or removing a portfolio component type (Text, Image, Card, Button, Container, PDF, or any new component the user proposes). Adding a component touches the snapshot schema, the renderer, the editor palette and toolbar, validation, and default props — missing any of these causes silent breakage or schema drift. Trigger this skill even when the user only mentions one of those layers (e.g. "add a video component to the renderer"), because the change is always cross-cutting. Also use when reviewing a PR that adds a component, to verify nothing was missed.
---

# Adding a Portfolio Component

A portfolio component is a leaf in the snapshot tree. Every component type lives in six places. Missing any of them is a bug.

## The six places

1. **Schema** — `packages/snapshot-schema/src/components/{component}.ts`. Zod schema, exported and added to the discriminated union in `packages/snapshot-schema/src/index.ts`. Re-run JSON Schema generation (`pnpm --filter @portfoliopro/snapshot-schema build`).

2. **Renderer** — `packages/renderer/src/components/{Component}.tsx`. The plain React component that renders the published output. Reads theme tokens via `useTheme()`. Takes the component schema type as props. No editor concepts (no selection, no drag handles).

3. **Editor wrapper** — `packages/editor-kit/src/components/{Component}Editable.tsx`. Wraps the renderer component with: selection ring on click, drag handle, context menu (duplicate/delete/move). Imports the renderer component, doesn't reimplement it.

4. **Palette entry** — `apps/editor/src/components/palette/components.tsx`. Registers the component in the "Add" tab with thumbnail, label, and description.

5. **Default props factory** — `packages/snapshot-schema/src/defaults.ts`. A function returning a fresh, valid instance of the component (used when dragging from the palette).

6. **Backend validation hook** — usually nothing to do if the schema is correctly defined (validation is JSON-Schema-driven). But if the component has cross-reference invariants (e.g. an `assetId` that must exist for this user, like Image and PDF), add a check to `apps/api/src/PortfolioPro.Api/Services/SnapshotValidator.cs`.

## Procedure

### 1. Define the schema

Before writing any code, write the schema. Decide:

- What fields does the component have?
- Which fields accept `TokenRef` (so theme tokens propagate)? Default: anything color-related, anything spacing-related, anything radius-related.
- Does it reference assets (`assetId`)? Then it participates in asset reference tracking — add it to the walker in `apps/api/src/PortfolioPro.Api/Services/AssetReferenceWalker.cs`.
- Does it have a `link: NavTarget`? If so, cross-reference validation already handles it via the shared `NavTarget` type — don't reinvent.

Create the Zod schema, export it, add to the discriminated union, regenerate JSON Schema.

```ts
// packages/snapshot-schema/src/components/video.ts
import { z } from 'zod';
import { TokenRefOrColor, NavTargetSchema } from '../shared';

export const VideoComponentSchema = z.object({
  id: z.string(),
  type: z.literal('video'),
  assetId: z.string(),
  autoplay: z.boolean().default(false),
  loop: z.boolean().default(false),
  controls: z.boolean().default(true),
  poster: z.string().optional(),
  link: NavTargetSchema.optional(),
});

export type VideoComponent = z.infer<typeof VideoComponentSchema>;
```

### 2. Implement the renderer

Renderer components are pure presentation. They:

- Take the schema type as props.
- Resolve `TokenRef` values via `useTheme()`.
- Render plain HTML/JSX, no editor-only affordances.
- Are used unchanged by both the editor (wrapped) and the viewer (directly).

```tsx
// packages/renderer/src/components/Video.tsx
import { useTheme, resolveToken } from '../theme';
import type { VideoComponent } from '@portfoliopro/snapshot-schema';

export function Video({ component }: { component: VideoComponent }) {
  // ...
}
```

### 3. Implement the editor wrapper

```tsx
// packages/editor-kit/src/components/VideoEditable.tsx
import { Video } from '@portfoliopro/renderer';
import { useSelection, useDrag } from '../hooks';
// wrap Video with selection ring, drag handle, context menu
```

Selection wrapping is consistent across components — there's a `withEditable` HOC at `packages/editor-kit/src/hocs/withEditable.tsx` that does the heavy lifting. Use it.

### 4. Add the default props factory

```ts
// packages/snapshot-schema/src/defaults.ts
export function createVideoComponent(): VideoComponent {
  return {
    id: ulid(),
    type: 'video',
    assetId: '',                  // user must pick one
    autoplay: false,
    loop: false,
    controls: true,
  };
}
```

The factory MUST return a value that passes Zod validation. If it can't (e.g. requires an `assetId`), the palette entry must open a picker before insertion — see "Components requiring user input on insert" below.

### 5. Register in the palette

```ts
// apps/editor/src/components/palette/components.tsx
{
  type: 'video',
  label: 'Video',
  description: 'Embed a video clip',
  thumbnail: VideoThumbnail,
  insert: async () => {
    const assetId = await openAssetPicker({ kinds: ['video/*'] });
    if (!assetId) return null;
    return { ...createVideoComponent(), assetId };
  },
}
```

### 6. Update the asset reference walker (if applicable)

```cs
// apps/api/src/PortfolioPro.Api/Services/AssetReferenceWalker.cs
case "video":
    if (component.TryGetProperty("assetId", out var assetIdEl))
        yield return assetIdEl.GetString();
    break;
```

### 7. Tests

- Unit test for the renderer (snapshot test with two theme variants).
- Unit test for the default factory (must pass Zod parse).
- Validation test: a snapshot containing one of these components round-trips through the backend's JSON Schema validator.
- If the component has cross-reference invariants (asset, NavTarget): add a validation test that constructs invalid references and expects a 400.

## Components requiring user input on insert

If the component cannot be valid with zero user input (e.g. Image and PDF require an asset), the palette `insert` function MUST open a picker before insertion and return `null` if cancelled. Never insert an invalid component. This is enforced by the editor — components are validated before being added to the draft.

## Components with token-bearing props

Any color, spacing, or radius prop should accept `TokenRef | concrete`. The renderer's resolver handles both. This makes theme tweaks propagate without rewriting every component.

```ts
backgroundColor: z.union([TokenRefSchema, HexColorSchema]).optional()
```

## Components with `link: NavTarget`

Don't reinvent NavTarget — use the shared schema. The publish-time validator already checks page/section refs resolve. Your component just declares the field and the renderer handles click behaviour by calling `useNavTarget(link)` from `packages/renderer`.

## Components that shouldn't nest

A Container can't nest a Container in v1. If your component has containment, decide at schema time whether nesting is allowed. If not, the publish validator must enforce it — add a rule to `SnapshotValidator.cs`.

## Backwards compatibility

Adding a new component type is backwards-compatible — older snapshots simply don't contain it. No schema version bump needed.

Removing or renaming a component type is NOT backwards-compatible. See the **snapshot-and-publish** skill for the migration procedure.

## Checklist before merging

- [ ] Zod schema defined and exported, JSON Schema regenerated.
- [ ] Discriminated union in `packages/snapshot-schema/src/index.ts` includes the new type.
- [ ] Renderer component implemented and theme-token-aware.
- [ ] Editor wrapper implemented using `withEditable`.
- [ ] Palette entry registered with thumbnail and (if needed) picker.
- [ ] Default factory returns a Zod-valid instance.
- [ ] Asset reference walker updated if the component references assets.
- [ ] Snapshot validator updated if the component has cross-reference invariants.
- [ ] Tests: renderer snapshot, factory validity, validator round-trip, invariant violations.
- [ ] Manual smoke: add component in editor, save draft, publish, view in viewer.
