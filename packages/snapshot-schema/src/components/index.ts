import { z } from 'zod';
import { ButtonComponentSchema } from './button';
import { TextComponentSchema } from './text';

// Phase 4 introduces the union with a single member (Text). Phase 5 adds
// Button / Image / PDF / Card / Container in a backwards-compatible way —
// existing Text-only snapshots keep parsing unchanged.
export const ComponentSchema = z.discriminatedUnion('type', [
  TextComponentSchema,
  ButtonComponentSchema,
]);

export type Component = z.infer<typeof ComponentSchema>;

export { ButtonComponentSchema, TextComponentSchema };
export type { ButtonComponent } from './button';
export type { TextComponent } from './text';
