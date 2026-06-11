import { z } from 'zod';
import { PageSchema } from './page';
import { SectionSchema } from './section';
import { ThemeSchema } from './theme';

export const SCHEMA_VERSION = 1 as const;

export const SnapshotSchema = z.object({
  version: z.literal(SCHEMA_VERSION),
  portfolio: z.object({
    title: z.string(),
    description: z.string(),
  }),
  theme: ThemeSchema,
  globalSections: z.object({
    header: SectionSchema.nullable(),
    footer: SectionSchema.nullable(),
  }),
  pages: z.array(PageSchema).min(1),
});

export type Snapshot = z.infer<typeof SnapshotSchema>;
