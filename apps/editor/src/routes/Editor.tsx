import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDraftAutosave } from '../hooks/useDraftAutosave';
import { useEditorStore } from '../store/editorStore';
import { Canvas } from './editor/Canvas';
import { ContextToolbar } from './editor/ContextToolbar';
import { PageTabs } from './editor/PageTabs';
import { Palette } from './editor/Palette';
import { Toolbar } from './editor/Toolbar';
import { parseColumnId, parseComponentId, resolveComponentDropTarget } from './editor/dnd';

export function Editor() {
  const { id: portfolioId } = useParams<{ id: string }>();
  const { load, saveStatus } = useDraftAutosave(portfolioId ?? '');
  const setSelection = useEditorStore((s) => s.setSelection);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  // VERSION MARKER — temporary, lets the user verify they're on the latest
  // phase-4 build. Increment the suffix on any subsequent fix so a stale tab is
  // easy to spot.
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log(
      '[PortfolioPro editor] BUILD MARKER v3 — DndContext lifted to editor; DroppableColumn wired for selection',
    );
  }, []);

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

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

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

    // Palette → column (or palette → component-adjacent).
    if (aid === 'palette:text') {
      let target = parseColumnId(oid);
      if (!target) {
        const cmp = parseComponentId(oid);
        if (cmp) target = { sectionId: cmp.sectionId, columnIndex: cmp.columnIndex };
      }
      if (target) addTextComponent(target.sectionId, target.columnIndex);
      return;
    }

    // Section reorder.
    if (aid.startsWith('section:') && oid.startsWith('section:')) {
      const oldIndex = page.sections.findIndex((s) => s.id === aid.slice('section:'.length));
      const newIndex = page.sections.findIndex((s) => s.id === oid.slice('section:'.length));
      if (oldIndex >= 0 && newIndex >= 0) moveSection(oldIndex, newIndex);
      return;
    }

    // Component move (same section, cross-column allowed).
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
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex flex-1 overflow-hidden">
        <Canvas />
        <Palette />
      </div>
      <DragOverlay>
        {activeId === 'palette:text' ? (
          <div className="rounded-md border border-sky-400 bg-white p-3 text-sm shadow-lg">
            + Text
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
