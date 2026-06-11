import { z } from 'zod';

// Phase 2 first cut. Type scale, button presets, and card presets land in Phase 6;
// fields are optional here so older snapshots parse cleanly once they exist.
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
});

export type Theme = z.infer<typeof ThemeSchema>;

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
};
