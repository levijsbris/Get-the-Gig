import { useDraggable } from '@dnd-kit/core';
import { selectionInsertTarget } from '../../store/selection';
import { useEditorStore } from '../../store/editorStore';

/**
 * Phase 4 palette. Two insertion paths:
 *
 *   1. Click "+ Text" → inserts into the column derived from the current
 *      selection (section → column 0; column or component → that column).
 *      Disabled when nothing is selected.
 *
 *   2. Drag "+ Text" → drops into any column droppable on the canvas (works
 *      regardless of selection). Powered by the editor-level DndContext.
 */
export function Palette() {
  const addSection = useEditorStore((s) => s.addSection);
  const addTextComponent = useEditorStore((s) => s.addTextComponent);
  const selection = useEditorStore((s) => s.selection);

  const insertTarget = selectionInsertTarget(selection);

  return (
    <aside className="flex w-56 flex-col gap-3 border-l border-slate-200 bg-slate-50 p-4">
      <section>
        <h2 className="mb-2 text-xs uppercase tracking-wider text-slate-500">Sections</h2>
        <button
          type="button"
          onClick={addSection}
          className="w-full rounded-md border border-slate-300 bg-white p-3 text-left text-sm hover:bg-slate-50"
        >
          + Add empty section
        </button>
      </section>
      <section>
        <h2 className="mb-2 text-xs uppercase tracking-wider text-slate-500">Components</h2>
        <DraggablePaletteText
          enabled={!!insertTarget}
          onClick={() => {
            if (insertTarget) addTextComponent(insertTarget.sectionId, insertTarget.columnIndex);
          }}
        />
        {!insertTarget ? (
          <p className="mt-2 text-xs text-slate-400">
            Select a column to insert into, or drag the card onto one.
          </p>
        ) : null}
      </section>
    </aside>
  );
}

function DraggablePaletteText({ enabled, onClick }: { enabled: boolean; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: 'palette:text',
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      disabled={!enabled && !isDragging}
      onClick={onClick}
      {...attributes}
      {...listeners}
      className={`w-full cursor-grab rounded-md border border-slate-300 bg-white p-3 text-left text-sm transition ${
        isDragging ? 'opacity-40' : 'hover:bg-slate-50'
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      + Text
      {!enabled ? (
        <span className="block text-xs text-slate-400">
          Click after selecting a column, or drag here
        </span>
      ) : null}
    </button>
  );
}
