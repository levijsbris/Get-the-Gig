import { z } from 'zod';
import { TextComponentSchema } from './text';

// Phase 4 introduces the union with a single member (Text). Phase 5 adds
// Image / Card / Button / Container / PDF in a backwards-compatible way —
// existing Text-only snapshots keep parsing unchanged.
export const ComponentSchema = z.discriminatedUnion('type', [TextComponentSchema]);

export type Component = z.infer<typeof ComponentSchema>;

export { TextComponentSchema };
export type { TextComponent } from './text';
