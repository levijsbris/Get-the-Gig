import { z } from 'zod';

/**
 * Phase 5 introduces named type styles so the TipTap document can store the
 * *name* of a heading style (e.g. `h1`) rather than concrete font metrics.
 * Theme edits in Phase 6 then propagate to every component without rewriting
 * any document. Each style references a font family by alias
 * (heading or body), so changing `theme.fonts.heading` cascades through
 * every typeStyle that uses it.
 */
export const TypeStyleSchema = z.object({
  fontFamily: z.enum(['heading', 'body']),
  fontSize: z.number().positive(),
  fontWeight: z.number().int().min(100).max(900),
  lineHeight: z.number().positive(),
  letterSpacing: z.number().optional(),
});

export type TypeStyle = z.infer<typeof TypeStyleSchema>;

/** Named slots known to the TipTap editor. Phase 6 may add custom slots. */
export const TYPE_STYLE_NAMES = ['h1', 'h2', 'h3', 'lead', 'body', 'caption'] as const;
export type TypeStyleName = (typeof TYPE_STYLE_NAMES)[number];

export const TypeStylesSchema = z.object({
  h1: TypeStyleSchema,
  h2: TypeStyleSchema,
  h3: TypeStyleSchema,
  lead: TypeStyleSchema,
  body: TypeStyleSchema,
  caption: TypeStyleSchema,
});

export type TypeStyles = z.infer<typeof TypeStylesSchema>;

// Phase 2 first cut + Phase 5 typeStyles. Button presets and card presets land
// in Phase 6; fields are optional here so older snapshots parse cleanly once
// they exist.
export const ThemeSchema = z.object({
  fonts: z.object({
    heading: z.string(),
    body: z.string(),
  }),
  colors: z.object({
    background: z.string(),
    surface: z.string(),
    foreground: z.string(),
    muted: z.string(),
    primary: z.string(),
    accent: z.string(),
  }),
  spacing: z.object({
    xs: z.number(),
    sm: z.number(),
    md: z.number(),
    lg: z.number(),
    xl: z.number(),
  }),
  radii: z.object({
    sm: z.number(),
    md: z.number(),
    lg: z.number(),
  }),
  // Optional for forward-compat with Phase 2 snapshots; renderers fall back
  // to defaultTypeStyles when missing.
  typeStyles: TypeStylesSchema.optional(),
});

export type Theme = z.infer<typeof ThemeSchema>;

export const defaultTypeStyles: TypeStyles = {
  h1: { fontFamily: 'heading', fontSize: 36, fontWeight: 700, lineHeight: 1.2 },
  h2: { fontFamily: 'heading', fontSize: 28, fontWeight: 700, lineHeight: 1.25 },
  h3: { fontFamily: 'heading', fontSize: 20, fontWeight: 600, lineHeight: 1.3 },
  lead: { fontFamily: 'body', fontSize: 18, fontWeight: 400, lineHeight: 1.5 },
  body: { fontFamily: 'body', fontSize: 16, fontWeight: 400, lineHeight: 1.6 },
  caption: { fontFamily: 'body', fontSize: 12, fontWeight: 400, lineHeight: 1.4 },
};

export const defaultTheme: Theme = {
  fonts: {
    heading: 'Inter',
    body: 'Inter',
  },
  colors: {
    background: '#ffffff',
    surface: '#f7f7f8',
    foreground: '#0f172a',
    muted: '#64748b',
    primary: '#0f172a',
    accent: '#0ea5e9',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 32,
    xl: 64,
  },
  radii: {
    sm: 4,
    md: 8,
    lg: 16,
  },
  typeStyles: defaultTypeStyles,
};
