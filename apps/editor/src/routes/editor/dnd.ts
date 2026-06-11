import type { DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import type { Section } from '@portfoliopro/snapshot-schema';

// dnd-kit id namespaces used by the editor's single DndContext (mounted at the
// Editor route). All ids parse via the helpers below so the onDragEnd handler
// can route to the right mutation regardless of which container fired the drag.
//
//   section:{sectionId}                              draggable + sortable + droppable for palette
//   section-slot:{pageId}:0                          droppable for palette section drop on empty page
//   column:{sectionId}:{columnIndex}                 droppable
//   component:{sectionId}:{col}:{idx}:{componentId}  draggable + sortable
//   palette:text                                     draggable (no drop target)
//   palette:section                                  draggable (no drop target)
//
// Insertion-position resolution (Y-axis):
//   For palette drags, the visible ghost placeholder + the final drop position
//   are derived from the pointer's vertical position relative to whichever
//   sortable item it is hovering over (top half → insert before, bottom half
//   → insert after). The same resolver is called from Canvas (onDragOver, to
//   place the ghost) and Editor (onDragEnd, to dispatch the mutation).

export interface ComponentPath {
  sectionId: string;
  columnIndex: number;
  componentIndex: number;
}

export interface ColumnTarget {
  sectionId: string;
  columnIndex: number;
}

export function parseComponentId(id: string): ComponentPath | null {
  if (!id.startsWith('component:')) return null;
  const parts = id.slice('component:'.length).split(':');
  if (parts.length < 4) return null;
  const [sectionId, columnIndex, componentIndex] = parts;
  if (!sectionId || columnIndex === undefined || componentIndex === undefined) return null;
  return {
    sectionId,
    columnIndex: Number(columnIndex),
    componentIndex: Number(componentIndex),
  };
}

export function parseColumnId(id: string): ColumnTarget | null {
  if (!id.startsWith('column:')) return null;
  const [, sectionId, columnIndexRaw] = id.split(':');
  if (!sectionId || columnIndexRaw === undefined) return null;
  return { sectionId, columnIndex: Number(columnIndexRaw) };
}

export interface SectionSlot {
  pageId: string;
  insertIndex: number;
}

export function parseSectionSlotId(id: string): SectionSlot | null {
  if (!id.startsWith('section-slot:')) return null;
  const [, pageId, insertIndexRaw] = id.split(':');
  if (!pageId || insertIndexRaw === undefined) return null;
  return { pageId, insertIndex: Number(insertIndexRaw) };
}

export interface ColumnEdge {
  sectionId: string;
  columnIndex: number;
  position: 'top' | 'bottom';
}

/** column-edge:{sectionId}:{columnIndex}:{top|bottom} — explicit insert-at-edge target. */
export function parseColumnEdgeId(id: string): ColumnEdge | null {
  if (!id.startsWith('column-edge:')) return null;
  const parts = id.split(':');
  if (parts.length !== 4) return null;
  const [, sectionId, columnIndexRaw, position] = parts;
  if (!sectionId || columnIndexRaw === undefined) return null;
  if (position !== 'top' && position !== 'bottom') return null;
  return {
    sectionId,
    columnIndex: Number(columnIndexRaw),
    position,
  };
}

/** Current viewport-space pointer Y, derived from activator + delta. */
function pointerY(event: DragOverEvent | DragEndEvent): number {
  const activator = event.activatorEvent as PointerEvent | MouseEvent;
  return activator.clientY + event.delta.y;
}

/**
 * Resolve the section insertion index for a palette:section drag from the
 * current drag-over state. Returns null when the pointer is not over a valid
 * target. On a non-empty page, expects the pointer to be over a section: id
 * and splits top/bottom half. On an empty page, expects section-slot:{pageId}:0.
 */
export function resolveSectionInsertIndex(
  event: DragOverEvent | DragEndEvent,
  sections: Section[],
): number | null {
  if (!event.over) return null;
  const overId = String(event.over.id);

  if (overId.startsWith('section-slot:')) {
    const slot = parseSectionSlotId(overId);
    return slot ? slot.insertIndex : null;
  }

  if (overId.startsWith('section:')) {
    const sectionId = overId.slice('section:'.length);
    const idx = sections.findIndex((s) => s.id === sectionId);
    if (idx < 0) return null;
    const rect = event.over.rect;
    const midY = rect.top + rect.height / 2;
    return pointerY(event) < midY ? idx : idx + 1;
  }

  return null;
}

export interface TextInsertion {
  sectionId: string;
  columnIndex: number;
  insertIndex: number;
}

/**
 * Resolve where a palette:text drop should insert relative to the current
 * drag-over state. When hovering a component, splits top/bottom half for
 * before/after placement; when hovering a column, appends to the end.
 */
export function resolveTextInsertion(
  event: DragOverEvent | DragEndEvent,
  sections: Section[],
): TextInsertion | null {
  if (!event.over) return null;
  const overId = String(event.over.id);

  const edge = parseColumnEdgeId(overId);
  if (edge) {
    const section = sections.find((s) => s.id === edge.sectionId);
    if (!section) return null;
    const column = section.columns[edge.columnIndex];
    if (!column) return null;
    const insertIndex = edge.position === 'top' ? 0 : column.components.length;
    return { sectionId: edge.sectionId, columnIndex: edge.columnIndex, insertIndex };
  }

  const cmp = parseComponentId(overId);
  if (cmp) {
    const section = sections.find((s) => s.id === cmp.sectionId);
    if (!section) return null;
    const column = section.columns[cmp.columnIndex];
    if (!column) return null;
    const rect = event.over.rect;
    // Biased thresholds at the column edges: the first component's "insert
    // before" zone fills the top 80% of its rect, and the last component's
    // "insert after" zone fills the bottom 80%. Without this, approaching
    // either edge from the opposite end requires crossing a 50% boundary
    // inside a possibly-short component, which is fiddly. Middle components
    // keep 50/50 so mid-column insertion stays precise.
    const total = column.components.length;
    const isFirst = cmp.componentIndex === 0;
    const isLast = cmp.componentIndex === total - 1;
    let ratio = 0.5;
    if (isFirst && !isLast) ratio = 0.8;
    else if (isLast && !isFirst) ratio = 0.2;
    const threshold = rect.top + rect.height * ratio;
    const insertIndex =
      pointerY(event) < threshold ? cmp.componentIndex : cmp.componentIndex + 1;
    return { sectionId: cmp.sectionId, columnIndex: cmp.columnIndex, insertIndex };
  }

  const col = parseColumnId(overId);
  if (col) {
    const section = sections.find((s) => s.id === col.sectionId);
    if (!section) return null;
    const column = section.columns[col.columnIndex];
    if (!column) return null;
    // When the pointer is over the column but not over a specific component
    // (e.g. in the bottom buffer below the last component, or in the
    // padding around an empty column), use top/bottom half to choose between
    // start and end. Mid-column insertion is still handled precisely when
    // the pointer is over a component (handled by the branch above).
    const rect = event.over.rect;
    const insertIndex =
      pointerY(event) < rect.top + rect.height / 2 ? 0 : column.components.length;
    return {
      sectionId: col.sectionId,
      columnIndex: col.columnIndex,
      insertIndex,
    };
  }

  return null;
}

/**
 * Given a drop target id (component or column), return the column + index pair
 * where a component dropped over it should land. Drops on a component land
 * adjacent to it (insertion index = that component's index); drops on a column
 * land at the end of the column.
 */
export function resolveComponentDropTarget(
  sections: Section[],
  overId: string,
  source?: ComponentPath,
): ComponentPath | null {
  if (overId.startsWith('component:')) {
    return parseComponentId(overId);
  }
  const col = parseColumnId(overId);
  if (col) {
    const section = sections.find((s) => s.id === col.sectionId);
    if (!section) return null;
    const column = section.columns[col.columnIndex];
    if (!column) return null;
    return { ...col, componentIndex: column.components.length };
  }
  return source ?? null;
}
