import type { Snapshot } from '@portfoliopro/snapshot-schema';

export type Selection =
  | { kind: 'section'; pageId: string; sectionId: string }
  | { kind: 'column'; pageId: string; sectionId: string; columnIndex: number }
  | {
      kind: 'component';
      pageId: string;
      sectionId: string;
      columnIndex: number;
      componentIndex: number;
    };

/**
 * Re-validates a selection against the current snapshot. After every history
 * navigation (undo/redo) and every mutation, the previously-selected element
 * may no longer exist — its page deleted, its section removed, its component
 * dragged out, etc. Returns null when the selection no longer resolves so the
 * UI doesn't try to render chrome around a phantom path.
 */
export function validateSelection(
  selection: Selection | null,
  snapshot: Snapshot,
): Selection | null {
  if (!selection) return null;
  const page = snapshot.pages.find((p) => p.id === selection.pageId);
  if (!page) return null;
  const section = page.sections.find((s) => s.id === selection.sectionId);
  if (!section) return null;
  if (selection.kind === 'section') return selection;
  const column = section.columns[selection.columnIndex];
  if (!column) return null;
  if (selection.kind === 'column') return selection;
  if (selection.componentIndex >= column.components.length) return null;
  return selection;
}

/**
 * Returns the (sectionId, columnIndex) pair the palette should insert into,
 * given the current selection. Section selection defaults to column 0;
 * component selection uses that component's own column; column selection is
 * a direct hit. Returns null when there's no useful target.
 */
export function selectionInsertTarget(
  selection: Selection | null,
): { sectionId: string; columnIndex: number } | null {
  if (!selection) return null;
  if (selection.kind === 'section') return { sectionId: selection.sectionId, columnIndex: 0 };
  return { sectionId: selection.sectionId, columnIndex: selection.columnIndex };
}
