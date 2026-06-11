import { useDraggable } from '@dnd-kit/core';
import { selectionInsertTarget } from '../../store/selection';
import { useEditorStore } from '../../store/editorStore';

/**
 * Phase 4 palette. Two insertion paths:
 *
 *   1. Click "+ Text" → inserts into the column derived from the current
 *      selection (section → column 0; column or component → that column).
 *      No-op when nothing is selected, with a hint shown below the button.
 *
 *   2. Drag "+ Text" → drops into any column droppable on the canvas (works
 *      regardless of selection). Powered by the editor-level DndContext.
 *
 * IMPORTANT: the draggable surface MUST NOT be an HTML <button disabled> — a
 * disabled button receives no pointer events at the browser level, which
 * prevents dnd-kit from ever seeing pointerdown. Use a non-disabled div with
 * role="button" instead, and gate the click handler in JS.
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
      </section>
    </aside>
  );
}

function DraggablePaletteText({ enabled, onClick }: { enabled: boolean; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: 'palette:text',
  });
  return (
    <div
      ref={setNodeRef}
      onClick={() => {
        if (enabled) onClick();
      }}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && enabled) {
          event.preventDefault();
          onClick();
        }
      }}
      {...attributes}
      {...listeners}
      // dnd-kit's attributes provide role / tabIndex / aria-disabled; we add
      // a more accurate aria-disabled in case enabled === false.
      aria-disabled={!enabled}
      className={`w-full cursor-grab select-none rounded-md border border-slate-300 bg-white p-3 text-left text-sm transition ${
        isDragging ? 'opacity-40' : 'hover:bg-slate-50'
      } ${!enabled ? 'opacity-60' : ''}`}
    >
      <div className="font-medium text-slate-900">+ Text</div>
      <div className="mt-1 text-xs text-slate-500">
        {enabled
          ? 'Click to insert, or drag onto a column'
          : 'Drag onto any column, or select one and click'}
      </div>
    </div>
  );
}
