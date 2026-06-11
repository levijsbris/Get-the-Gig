import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
} from '@dnd-kit/core';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDraftAutosave } from '../hooks/useDraftAutosave';
import { useEditorStore } from '../store/editorStore';
import { Canvas } from './editor/Canvas';
import { ContextToolbar } from './editor/ContextToolbar';
import { PageTabs } from './editor/PageTabs';
import { Palette } from './editor/Palette';
import { Toolbar } from './editor/Toolbar';
import {
  parseComponentId,
  resolveComponentDropTarget,
  resolveSectionInsertIndex,
  resolveTextInsertion,
} from './editor/dnd';

/**
 * Find the droppable container whose id starts with the given prefix and whose
 * rect's vertical center is closest to the cursor's Y. Used by palette:text
 * collision detection to pick a component within a known column when the
 * pointer is in an inter-component gap, the column's padding, or the
 * section's padding above/below the column.
 */
function closestComponentInColumn(
  args: Parameters<CollisionDetection>[0],
  componentPrefix: string,
): { id: ReturnType<typeof String>; data: Record<string, unknown> } | null {
  if (!args.pointerCoordinates) return null;
  const cursorY = args.pointerCoordinates.y;
  let bestContainer: (typeof args.droppableContainers)[number] | null = null;
  let bestDist = Infinity;
  for (const container of args.droppableContainers) {
    if (!String(container.id).startsWith(componentPrefix)) continue;
    const rect = args.droppableRects.get(container.id);
    if (!rect) continue;
    const center = rect.top + rect.height / 2;
    const dist = Math.abs(cursorY - center);
    if (dist < bestDist) {
      bestDist = dist;
      bestContainer = container;
    }
  }
  if (!bestContainer) return null;
  return {
    id: bestContainer.id as never,
    data: { droppableContainer: bestContainer, value: bestDist },
  };
}

/**
 * MeasuringStrategy.Always re-measures every droppable's rect on every drag
 * movement. Required for our ghost-placeholder model: when the ghost renders
 * at insertIndex 0, every component below it shifts down via natural flow.
 * Under the default WhileDragging strategy, droppable rects are cached from
 * earlier in the drag and don't reflect the new positions, so collision
 * detection sees a "stale" component 0 rect (now visually wrong), falls back
 * to the column hit, and the ghost can't latch at the top. Bottom-insertion
 * doesn't suffer because no components shift in that case.
 */
const measuring = { droppable: { strategy: MeasuringStrategy.Always } };

/**
 * Centers the DragOverlay pill on the cursor instead of leaving it offset by
 * wherever the user grabbed the palette card. Without this, the pill renders
 * below the cursor when the user grabbed near the top of the card — so the
 * insertion decision (driven by cursor Y) and the visible pill (offset from
 * cursor) disagree, which makes "drop at the top of the page" feel unreachable.
 */
const snapCenterToCursor: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (!draggingNodeRect || !activatorEvent) return transform;
  const activator = activatorEvent as MouseEvent | PointerEvent;
  const grabOffsetX = activator.clientX - draggingNodeRect.left;
  const grabOffsetY = activator.clientY - draggingNodeRect.top;
  return {
    ...transform,
    x: transform.x + grabOffsetX - draggingNodeRect.width / 2,
    y: transform.y + grabOffsetY - draggingNodeRect.height / 2,
  };
};

export function Editor() {
  const { id: portfolioId } = useParams<{ id: string }>();
  const { load, saveStatus } = useDraftAutosave(portfolioId ?? '');
  const setSelection = useEditorStore((s) => s.setSelection);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  // Keyboard: ⌘Z / ctrl-Z undo; ⌘⇧Z / ctrl-Y redo; Escape clears selection.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      if (event.key === 'Escape') {
        setSelection(null);
        return;
      }
      if (meta && (event.key === 'z' || event.key === 'Z')) {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (meta && (event.key === 'y' || event.key === 'Y')) {
        event.preventDefault();
        redo();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setSelection, undo, redo]);

  if (!portfolioId) {
    return <p className="p-6 text-sm text-red-600">Missing portfolio id.</p>;
  }
  if (load.status === 'loading') {
    return <p className="p-6 text-sm text-slate-500">Loading editor…</p>;
  }
  if (load.status === 'error') {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">Could not load draft: {load.error.message}</p>
        <Link to="/" className="mt-3 inline-block text-sm text-slate-700 underline">
          ← Back to portfolios
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <Link to="/" className="text-sm text-slate-500 hover:underline">
          ← Portfolios
        </Link>
      </header>
      <Toolbar saveStatus={saveStatus} />
      <PageTabs />
      <ContextToolbar />
      <EditorSurface />
    </div>
  );
}

/**
 * Single DndContext wrapping both the Canvas and the Palette so palette items
 * can drag into the canvas's columns. Drag dispatch lives here so it can see
 * the union of palette ids and canvas ids; Canvas + Palette are purely
 * presentational w.r.t. drag wiring.
 */
function EditorSurface() {
  const snapshot = useEditorStore((s) => s.history.entries[s.history.index]!);
  const pageId = useEditorStore((s) => s.pageId);
  const moveSection = useEditorStore((s) => s.moveSection);
  const moveComponent = useEditorStore((s) => s.moveComponent);
  const addTextComponent = useEditorStore((s) => s.addTextComponent);
  const addSectionAt = useEditorStore((s) => s.addSectionAt);

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Collision strategy:
  //   - palette:section → prefer the explicit edge slots (section-slot:*) so
  //     "insert at top/bottom" has a wide, easy hit area, then fall back to
  //     section sortable rects (top/bottom-half logic in the resolver).
  //   - palette:text → pointerWithin to find which column the cursor is in.
  //     If a component is directly under the cursor, use it. Otherwise (the
  //     cursor is in an inter-component gap, in column padding, or in an
  //     empty area) pick the closest component IN THAT COLUMN by cursor Y.
  //     Without that step, gaps fall back to "top/bottom-half-of-column",
  //     which makes the ghost snap to the column's extremes as the user
  //     scrubs vertically — the bouncing behaviour reported.
  //   - sortable reorders (sections, components) → closestCenter for the
  //     usual "snap to nearest" feel.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const aid = String(args.active.id);

    if (aid === 'palette:section') {
      const candidates = [...pointerWithin(args), ...rectIntersection(args)];
      const slot = candidates.find((c) => String(c.id).startsWith('section-slot:'));
      if (slot) return [slot];
      const section = candidates.find((c) => String(c.id).startsWith('section:'));
      return section ? [section] : [];
    }

    if (aid === 'palette:text') {
      const pointer = pointerWithin(args);

      // Explicit column-edge zones win when the pointer is on them — they
      // exist precisely to make "insert at top/bottom of column" a wide,
      // dedicated target during a palette:text drag.
      const edge = pointer.find((c) => String(c.id).startsWith('column-edge:'));
      if (edge) return [edge];

      // Direct component hit — most specific, use it.
      const directComponent = pointer.find((c) => String(c.id).startsWith('component:'));
      if (directComponent) return [directComponent];

      // Cursor is over a column but not over a component. Find the closest
      // component IN THIS COLUMN by cursor Y so the ghost transitions
      // smoothly through inter-component gaps.
      const directColumn = pointer.find((c) => String(c.id).startsWith('column:'));
      if (directColumn) {
        const colId = String(directColumn.id); // column:{sectionId}:{columnIndex}
        const [, sectionId, columnIndex] = colId.split(':');
        const componentPrefix = `component:${sectionId}:${columnIndex}:`;

        if (args.pointerCoordinates) {
          const closest = closestComponentInColumn(args, componentPrefix);
          if (closest) return [closest];
        }

        // Empty column (no components) — keep the column hit so the resolver
        // returns insertIndex 0.
        return [directColumn];
      }

      // Cursor is over a section but not a column or component. Almost
      // always means the cursor is in the section's vertical padding above
      // or below the column row (theme.spacing.lg top/bottom). Find the
      // column whose horizontal range contains the cursor's X and treat
      // the drop as if the cursor were in that column at this Y — that
      // makes "insert at top of column" reachable by scrubbing up past
      // the first component, which otherwise leaves the ghost stranded.
      const directSection = pointer.find((c) => String(c.id).startsWith('section:'));
      if (directSection && args.pointerCoordinates) {
        const sectionId = String(directSection.id).slice('section:'.length);
        const columnPrefix = `column:${sectionId}:`;
        const cursorX = args.pointerCoordinates.x;

        let targetColumn: (typeof args.droppableContainers)[number] | null = null;
        for (const container of args.droppableContainers) {
          if (!String(container.id).startsWith(columnPrefix)) continue;
          const rect = args.droppableRects.get(container.id);
          if (!rect) continue;
          if (cursorX >= rect.left && cursorX <= rect.right) {
            targetColumn = container;
            break;
          }
        }

        if (targetColumn) {
          const colId = String(targetColumn.id);
          const columnIndex = colId.split(':')[2];
          const componentPrefix = `component:${sectionId}:${columnIndex}:`;
          const closest = closestComponentInColumn(args, componentPrefix);
          if (closest) return [closest];
          return [
            {
              id: targetColumn.id,
              data: { droppableContainer: targetColumn, value: 0 },
            },
          ];
        }
      }

      return rectIntersection(args);
    }

    return closestCenter(args);
  }, []);

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const aid = String(active.id);
    const oid = String(over.id);

    const page = snapshot.pages.find((p) => p.id === pageId);
    if (!page) return;

    // Palette section → resolve insertion index from the section under
    // the pointer (top/bottom half) or from the empty-page section-slot.
    if (aid === 'palette:section') {
      const insertIndex = resolveSectionInsertIndex(event, page.sections);
      if (insertIndex !== null) addSectionAt(page.id, insertIndex);
      return;
    }

    // Palette text → resolve insertion (column + index within that column)
    // from the component or column under the pointer.
    if (aid === 'palette:text') {
      const target = resolveTextInsertion(event, page.sections);
      if (target) {
        addTextComponent(target.sectionId, target.columnIndex, target.insertIndex);
      }
      return;
    }

    // Section reorder.
    if (aid.startsWith('section:') && oid.startsWith('section:')) {
      const oldIndex = page.sections.findIndex((s) => s.id === aid.slice('section:'.length));
      const newIndex = page.sections.findIndex((s) => s.id === oid.slice('section:'.length));
      if (oldIndex >= 0 && newIndex >= 0) moveSection(oldIndex, newIndex);
      return;
    }

    // Component move (cross-column allowed within a section).
    if (aid.startsWith('component:')) {
      const source = parseComponentId(aid);
      if (!source) return;
      const target = resolveComponentDropTarget(page.sections, oid, source);
      if (!target) return;
      moveComponent(
        source.sectionId,
        source.columnIndex,
        source.componentIndex,
        target.columnIndex,
        target.componentIndex,
      );
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      measuring={measuring}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex flex-1 overflow-hidden">
        <Canvas />
        <Palette />
      </div>
      <DragOverlay modifiers={[snapCenterToCursor]}>
        {activeId === 'palette:text' ? (
          <div className="rounded-md border border-sky-400 bg-white p-3 text-sm shadow-lg">
            + Text
          </div>
        ) : activeId === 'palette:section' ? (
          <div className="rounded-md border border-sky-400 bg-white px-4 py-3 text-sm shadow-lg">
            + Section
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
