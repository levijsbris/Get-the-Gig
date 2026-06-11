import type { Section } from '@portfoliopro/snapshot-schema';

// dnd-kit id namespaces used by the editor's single DndContext (mounted at the
// Editor route). All ids parse via the helpers below so the onDragEnd handler
// can route to the right mutation regardless of which container fired the drag.
//
//   section:{sectionId}                              draggable + sortable
//   column:{sectionId}:{columnIndex}                 droppable
//   component:{sectionId}:{col}:{idx}:{componentId}  draggable + sortable
//   palette:text                                     draggable (no drop target)

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
