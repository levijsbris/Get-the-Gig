import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEditorStore } from '../../store/editorStore';

export function PageTabs() {
  const pages = useEditorStore((s) => s.history.entries[s.history.index]!.pages);
  const pageId = useEditorStore((s) => s.pageId);
  const setPage = useEditorStore((s) => s.setPage);
  const addPage = useEditorStore((s) => s.addPage);
  const reorderPages = useEditorStore((s) => s.reorderPages);
  const deletePage = useEditorStore((s) => s.deletePage);
  const renamePage = useEditorStore((s) => s.renamePage);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = pages.findIndex((p) => p.id === active.id);
    const newIndex = pages.findIndex((p) => p.id === over.id);
    if (oldIndex >= 0 && newIndex >= 0) reorderPages(oldIndex, newIndex);
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 bg-slate-50 px-4 py-2">
      <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={pages.map((p) => p.id)} strategy={horizontalListSortingStrategy}>
          {pages.map((page) => (
            <PageTab
              key={page.id}
              id={page.id}
              title={page.title}
              active={pageId === page.id}
              onSelect={() => setPage(page.id)}
              onRename={(t) => renamePage(page.id, t)}
              onDelete={pages.length > 1 ? () => deletePage(page.id) : undefined}
            />
          ))}
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={addPage}
        className="ml-2 rounded border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-white"
      >
        + Page
      </button>
    </div>
  );
}

interface PageTabProps {
  id: string;
  title: string;
  active: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDelete?: () => void;
}

function PageTab({ id, title, active, onSelect, onRename, onDelete }: PageTabProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
        active ? 'border-slate-900 bg-white shadow-sm' : 'border-slate-200 bg-white'
      }`}
    >
      <span {...attributes} {...listeners} className="cursor-grab text-slate-400">
        ⋮⋮
      </span>
      <button
        type="button"
        onClick={onSelect}
        onDoubleClick={() => {
          const next = window.prompt('Rename page', title);
          if (next && next.trim()) onRename(next.trim());
        }}
        className="text-slate-900"
      >
        {title}
      </button>
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          className="text-xs text-slate-400 hover:text-red-600"
          aria-label="Delete page"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
