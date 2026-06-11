import { useEditorStore } from '../../store/editorStore';

/**
 * Phase 4 shell: shows what's selected and a few coarse actions
 * (duplicate / delete / column layout for sections). Phase 5+ fills in
 * inline editors (TipTap for Text, picker for Image, etc.) and contextual
 * controls per component type.
 */
export function ContextToolbar() {
  const selection = useEditorStore((s) => s.selection);
  const snapshot = useEditorStore((s) => s.history.entries[s.history.index]!);
  const setSectionLayout = useEditorStore((s) => s.setSectionLayout);
  const duplicateSection = useEditorStore((s) => s.duplicateSection);
  const deleteSection = useEditorStore((s) => s.deleteSection);
  const duplicateComponent = useEditorStore((s) => s.duplicateComponent);
  const deleteComponent = useEditorStore((s) => s.deleteComponent);
  const moveSection = useEditorStore((s) => s.moveSection);

  if (!selection) {
    return (
      <div className="border-b border-slate-200 bg-white px-4 py-2 text-xs text-slate-400">
        Nothing selected. Click a section, column, or component on the canvas.
      </div>
    );
  }

  if (selection.kind === 'column') {
    return (
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 text-sm">
        <span className="text-slate-500">
          Column {selection.columnIndex + 1} selected — click + Text in the palette, or drag a
          component in.
        </span>
      </div>
    );
  }

  if (selection.kind === 'section') {
    const page = snapshot.pages.find((p) => p.id === selection.pageId);
    const section = page?.sections.find((s) => s.id === selection.sectionId);
    if (!section || !page) return null;
    const index = page.sections.indexOf(section);
    return (
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 text-sm">
        <div className="flex items-center gap-3">
          <span className="text-slate-500">Section</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500">Columns</span>
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSectionLayout(section.id, n as 1 | 2 | 3 | 4)}
                className={`rounded px-2 py-0.5 text-xs ${
                  section.layout.columns === n
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => moveSection(index, Math.max(0, index - 1))}
            disabled={index === 0}
            className="text-slate-700 hover:underline disabled:opacity-40"
          >
            ↑ Up
          </button>
          <button
            type="button"
            onClick={() => moveSection(index, Math.min(page.sections.length - 1, index + 1))}
            disabled={index >= page.sections.length - 1}
            className="text-slate-700 hover:underline disabled:opacity-40"
          >
            ↓ Down
          </button>
          <button
            type="button"
            onClick={() => duplicateSection(section.id)}
            className="text-slate-700 hover:underline"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={() => deleteSection(section.id)}
            className="text-red-600 hover:underline"
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  // Component selection
  return (
    <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 text-sm">
      <span className="text-slate-500">Text component</span>
      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() =>
            duplicateComponent(selection.sectionId, selection.columnIndex, selection.componentIndex)
          }
          className="text-slate-700 hover:underline"
        >
          Duplicate
        </button>
        <button
          type="button"
          onClick={() =>
            deleteComponent(selection.sectionId, selection.columnIndex, selection.componentIndex)
          }
          className="text-red-600 hover:underline"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
