import { useEditorStore } from '../../store/editorStore';

/**
 * Phase 4 stub palette: just two buttons. "Add empty section" appends a 1-col
 * section to the current page; the component palette only has Text and it
 * inserts into the FIRST column of the SELECTED section (or no-ops if no
 * section is selected). Phase 5 expands this with drag-from-palette and an
 * "image / pdf / card / button / container" component set.
 */
export function Palette() {
  const addSection = useEditorStore((s) => s.addSection);
  const addTextComponent = useEditorStore((s) => s.addTextComponent);
  const selection = useEditorStore((s) => s.selection);

  const selectedSectionId =
    selection?.kind === 'section'
      ? selection.sectionId
      : selection?.kind === 'component'
        ? selection.sectionId
        : null;

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
        <button
          type="button"
          disabled={!selectedSectionId}
          onClick={() => {
            if (selectedSectionId) addTextComponent(selectedSectionId, 0);
          }}
          className="w-full rounded-md border border-slate-300 bg-white p-3 text-left text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Text
          {selectedSectionId ? null : (
            <span className="block text-xs text-slate-400">Select a section first</span>
          )}
        </button>
      </section>
    </aside>
  );
}
