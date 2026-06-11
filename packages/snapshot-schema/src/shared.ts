import { z } from 'zod';

/**
 * Shared Zod schemas used by multiple component types.
 *
 * These intentionally live here (not inside any one component file) so:
 *   - link semantics (NavTarget) are consistent across Button, Image, Card,
 *     and the TipTap link mark — one validator covers all of them.
 *   - colors and numeric metrics accept either a theme TokenRef (recommended,
 *     so theme edits propagate) or a concrete value (escape hatch).
 *   - the publish-time validator only has one cross-reference rule per kind
 *     instead of one per component.
 */

// -- HexColor -----------------------------------------------------------------

/**
 * 3-, 4-, 6-, or 8-digit hex color including the leading `#`. Lowercase is
 * canonical; we accept either case at parse time, callers should not depend
 * on case being preserved.
 */
export const HexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);

export type HexColor = z.infer<typeof HexColorSchema>;

// -- TokenRef -----------------------------------------------------------------

/**
 * A reference to a theme token, resolved at render time. The path is a
 * dot-separated lookup against the theme object (e.g. `colors.primary`,
 * `spacing.md`, `radii.sm`). Storing the *reference* rather than the resolved
 * value means theme edits in Phase 6 propagate to every component without
 * touching the document.
 */
export const TokenRefSchema = z.object({
  kind: z.literal('token'),
  path: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)+$/),
});

export type TokenRef = z.infer<typeof TokenRefSchema>;

/** A color slot that accepts either a theme token reference or a literal hex. */
export const TokenRefOrColorSchema = z.union([TokenRefSchema, HexColorSchema]);
export type TokenRefOrColor = z.infer<typeof TokenRefOrColorSchema>;

/** A spacing / radius slot that accepts either a theme token or a literal number (px). */
export const TokenRefOrNumberSchema = z.union([TokenRefSchema, z.number().nonnegative()]);
export type TokenRefOrNumber = z.infer<typeof TokenRefOrNumberSchema>;

// -- NavTarget ----------------------------------------------------------------

/**
 * Where a clickable thing should go. Discriminated union so the renderer can
 * dispatch on `kind` without ambiguity, and so the publish validator can
 * cross-reference the right snapshot subtree for each variant.
 *
 *   - `page`     → portfolio page by id
 *   - `section`  → page + anchor section
 *   - `url`      → off-site link
 *   - `mailto`   → email address
 *
 * Phone (tel:) and file-download targets can be added later without breaking
 * existing docs.
 */
const NavTargetPageSchema = z.object({
  kind: z.literal('page'),
  pageId: z.string(),
});

const NavTargetSectionSchema = z.object({
  kind: z.literal('section'),
  pageId: z.string(),
  sectionId: z.string(),
});

const NavTargetUrlSchema = z.object({
  kind: z.literal('url'),
  href: z.string().url(),
  openInNewTab: z.boolean().default(false),
});

const NavTargetMailtoSchema = z.object({
  kind: z.literal('mailto'),
  email: z.string().email(),
});

export const NavTargetSchema = z.discriminatedUnion('kind', [
  NavTargetPageSchema,
  NavTargetSectionSchema,
  NavTargetUrlSchema,
  NavTargetMailtoSchema,
]);

export type NavTarget = z.infer<typeof NavTargetSchema>;
