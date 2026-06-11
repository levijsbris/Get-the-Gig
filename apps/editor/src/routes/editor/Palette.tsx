import { useDraggable } from '@dnd-kit/core';
import type { CSSProperties, KeyboardEvent } from 'react';
import { PALETTE_COMPONENTS, type PaletteEntry } from '../../components/palette';
import { selectionInsertTarget } from '../../store/selection';
import { useEditorStore } from '../../store/editorStore';

/**
 * Left-rail palette. Two top-level categories — Sections and Components.
 * Component entries are sourced from the PALETTE_COMPONENTS registry (Phase 5
 * appends new entries as each component type arrives), so the palette never
 * needs to be touched when adding a component beyond importing its
 * registerXxx.ts file.
 *
 * Two insertion paths per entry:
 *   1. Click → inserts into the column derived from the current selection,
 *      or shows a hint when no column target can be inferred.
 *   2. Drag → drops into any column droppable on the canvas via the
 *      editor-level DndContext.
 *
 * IMPORTANT: the draggable surface MUST NOT be an HTML <button disabled> — a
 * disabled button receives no pointer events at the browser level, which
 * prevents dnd-kit from ever seeing pointerdown. Use a non-disabled div with
 * a role and JS-gated onClick instead.
 */
export function Palette() {
  const addSection = useEditorStore((s) => s.addSection);

  return (
    <aside className="flex w-56 flex-col gap-3 border-l border-slate-200 bg-slate-50 p-4">
      <section>
        <h2 className="mb-2 text-xs uppercase tracking-wider text-slate-500">Sections</h2>
        <DraggablePaletteSection onClick={addSection} />
      </section>
      <section>
        <h2 className="mb-2 text-xs uppercase tracking-wider text-slate-500">Components</h2>
        <div className="flex flex-col gap-2">
          {PALETTE_COMPONENTS.map((entry) => (
            <DraggablePaletteEntry key={entry.type} entry={entry} />
          ))}
        </div>
      </section>
    </aside>
  );
}

function DraggablePaletteSection({ onClick }: { onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: 'palette:section' });
  const style: CSSProperties = { opacity: isDragging ? 0.4 : 1 };
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      {...attributes}
      {...listeners}
      className="w-full cursor-grab select-none rounded-md border border-slate-300 bg-white p-3 text-left text-sm transition hover:bg-slate-50"
    >
      <div className="font-medium text-slate-900">+ Section</div>
      <div className="mt-1 text-xs text-slate-500">
        Click to append, or drag between sections
      </div>
    </div>
  );
}

function DraggablePaletteEntry({ entry }: { entry: PaletteEntry }) {
  const selection = useEditorStore((s) => s.selection);
  const addComponentInstance = useEditorStore((s) => s.addComponentInstance);
  const insertTarget = selectionInsertTarget(selection);
  const enabled = !!insertTarget;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: entry.dragId });

  async function handleClick() {
    if (!insertTarget) return;
    const instance = entry.factory
      ? entry.factory()
      : entry.insert
        ? await entry.insert()
        : null;
    if (!instance) return;
    addComponentInstance(insertTarget.sectionId, insertTarget.columnIndex, instance);
  }

  return (
    <div
      ref={setNodeRef}
      onClick={() => {
        if (enabled) void handleClick();
      }}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && enabled) {
          event.preventDefault();
          void handleClick();
        }
      }}
      {...attributes}
      {...listeners}
      aria-disabled={!enabled}
      className={`w-full cursor-grab select-none rounded-md border border-slate-300 bg-white p-3 text-left text-sm transition ${
        isDragging ? 'opacity-40' : 'hover:bg-slate-50'
      } ${!enabled ? 'opacity-60' : ''}`}
    >
      <div className="font-medium text-slate-900">{entry.label}</div>
      <div className="mt-1 text-xs text-slate-500">
        {enabled ? entry.description : 'Drag onto any column, or select one and click'}
      </div>
    </div>
  );
}
