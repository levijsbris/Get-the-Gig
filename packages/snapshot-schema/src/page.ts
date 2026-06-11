import { z } from 'zod';
import { SectionSchema } from './section';

export const PageSchema = z.object({
  id: z.string(),
  slug: z.string().regex(/^[a-z0-9-]{1,40}$/),
  title: z.string(),
  sections: z.array(SectionSchema),
  hideGlobalHeader: z.boolean().optional(),
  hideGlobalFooter: z.boolean().optional(),
});

export type Page = z.infer<typeof PageSchema>;
