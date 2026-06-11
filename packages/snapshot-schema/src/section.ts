import { z } from 'zod';

// Components arrive in Phase 4/5. For now Column.components is just an empty tuple;
// when a component union exists it becomes z.array(ComponentSchema).
export const ColumnSchema = z.object({
  id: z.string(),
  components: z.array(z.unknown()).default([]),
});

export type Column = z.infer<typeof ColumnSchema>;

export const SectionSchema = z.object({
  id: z.string(),
  templateId: z.string().optional(),
  background: z
    .object({
      color: z.string().optional(),
    })
    .default({}),
  layout: z.object({
    columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    gap: z.number().optional(),
    columnRatios: z.array(z.number()).optional(),
  }),
  padding: z
    .object({
      top: z.number().optional(),
      bottom: z.number().optional(),
    })
    .optional(),
  columns: z.array(ColumnSchema),
});

export type Section = z.infer<typeof SectionSchema>;
