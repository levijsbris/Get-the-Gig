import { z } from 'zod';
import { TipTapDocSchema } from '../tiptap';

export const TextComponentSchema = z.object({
  id: z.string(),
  type: z.literal('text'),
  doc: TipTapDocSchema,
  align: z.enum(['left', 'center', 'right']).optional(),
});

export type TextComponent = z.infer<typeof TextComponentSchema>;
