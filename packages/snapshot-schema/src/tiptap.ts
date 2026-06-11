import { z } from 'zod';

// Shallow but structured TipTap / ProseMirror document schema.
// Rejects obvious garbage (e.g. content arrays containing strings or numbers)
// at the schema boundary so broken docs never reach the renderer. Phase 5
// tightens which node types and marks are allowed for each component context;
// the doc shape itself doesn't change so no migration is needed.

export interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}

export const TipTapMarkSchema = z.object({
  type: z.string(),
  attrs: z.record(z.string(), z.unknown()).optional(),
});

export const TipTapDocSchema: z.ZodType<TipTapNode> = z.lazy(() =>
  z.object({
    type: z.string(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(TipTapDocSchema).optional(),
    marks: z.array(TipTapMarkSchema).optional(),
    text: z.string().optional(),
  }),
);

export type TipTapDoc = TipTapNode;

export const emptyTipTapDoc = (): TipTapDoc => ({ type: 'doc', content: [] });
