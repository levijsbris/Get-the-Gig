import { z } from 'zod';
import { NavTargetSchema } from '../shared';

/**
 * Button component. Three visual variants resolve their concrete styles
 * against the theme at render time — Phase 6 adds editable preset configs;
 * for v1 the variant maps to a hard-coded color/border/padding recipe in
 * the renderer.
 *
 *   - `primary`   solid background using theme.colors.primary
 *   - `secondary` outlined using theme.colors.primary
 *   - `ghost`     no background, plain text using theme.colors.foreground
 *
 * `alignment` controls horizontal placement within the column (the renderer
 * wraps the button in a flex container). `link` is optional — when absent
 * the button still renders but is a non-navigating action stub (useful for
 * placeholder content while authoring).
 */
export const ButtonComponentSchema = z.object({
  id: z.string(),
  type: z.literal('button'),
  label: z.string().min(1).max(80),
  link: NavTargetSchema.optional(),
  variant: z.enum(['primary', 'secondary', 'ghost']).default('primary'),
  alignment: z.enum(['left', 'center', 'right']).default('left'),
});

export type ButtonComponent = z.infer<typeof ButtonComponentSchema>;
