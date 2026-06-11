import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { EditableShell, TextEditable } from '@portfoliopro/editor-kit';
import { ThemeProvider, useTheme } from '@portfoliopro/renderer';
import { type Section } from '@portfoliopro/snapshot-schema';
import { useEditorStore, type Viewport } from '../../store/editorStore';

const VIEWPORT_WIDTHS: Record<Viewport, number> = {
  desktop: 1280,
  tablet: 768,
  mobile: 380,
};

/**
 * Canvas renders the structural editor surface. dnd-kit infrastructure
 * (DndContext, sensors, drag handlers, DragOverlay) lives at the Editor route
 * level so the palette can drag items into the canvas's columns. This
 * component is purely presentational w.r.t. drag wiring.
 */
export function Canvas() {
  const snapshot = useEditorStore((s) => s.history.entries[s.history.index]!);
  const pageId = useEditorStore((s) => s.pageId);
  const setSelection = useEditorStore((s) => s.setSelection);
  const viewport = useEditorStore((s) => s.viewport);
  const selection = useEditorStore((s) => s.selection);

  const page = snapshot.pages.find((p) => p.id === pageId) ?? snapshot.pages[0];
  if (!page) return null;

  return (
    <ThemeProvider theme={snapshot.theme}>
      <div className="flex-1 overflow-auto bg-slate-100 p-6" onClick={() => setSelection(null)}>
        <div
          className="mx-auto rounded-lg border border-slate-200 bg-white shadow-sm transition-all"
          style={{ maxWidth: VIEWPORT_WIDTHS[viewport], minHeight: '60vh' }}
        >
          {page.sections.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-400">
              Empty page. Use the palette to add a section.
            </div>
          ) : (
            <SortableContext
              items={page.sections.map((s) => `section:${s.id}`)}
              strategy={verticalListSortingStrategy}
            >
              {page.sections.map((section) => (
                <SortableSection
                  key={section.id}
                  section={section}
                  pageId={page.id}
                  selected={selection?.kind === 'section' && selection.sectionId === section.id}
                />
              ))}
            </SortableContext>
          )}
        </div>
      </div>
    </ThemeProvider>
  );
}

function SortableSection({
  section,
  pageId,
  selected,
}: {
  section: Section;
  pageId: string;
  selected: boolean;
}) {
  const setSelection = useEditorStore((s) => s.setSelection);
  const selectionState = useEditorStore((s) => s.selection);
  const theme = useTheme();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `section:${section.id}`,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="group relative border-b border-slate-100 last:border-b-0"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1 z-10 hidden cursor-grab rounded bg-slate-100 px-1 text-xs text-slate-500 group-hover:block"
      >
        ⋮⋮
      </button>
      <EditableShell
        selected={selected}
        onSelect={() => setSelection({ kind: 'section', pageId, sectionId: section.id })}
        label="Section"
      >
        <section
          style={{
            background: section.background.color ?? 'transparent',
            paddingTop: section.padding?.top ?? theme.spacing.lg,
            paddingBottom: section.padding?.bottom ?? theme.spacing.lg,
            paddingLeft: theme.spacing.md,
            paddingRight: theme.spacing.md,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${section.layout.columns}, minmax(0, 1fr))`,
              gap: section.layout.gap ?? theme.spacing.md,
            }}
          >
            {section.columns.map((column, columnIndex) => (
              <SortableContext
                key={column.id}
                items={column.components.map(
                  (c, componentIndex) =>
                    `component:${section.id}:${columnIndex}:${componentIndex}:${c.id}`,
                )}
                strategy={verticalListSortingStrategy}
              >
                <DroppableColumn
                  id={`column:${section.id}:${columnIndex}`}
                  isEmpty={column.components.length === 0}
                  selected={
                    selectionState?.kind === 'column' &&
                    selectionState.sectionId === section.id &&
                    selectionState.columnIndex === columnIndex
                  }
                  onSelect={() =>
                    setSelection({
                      kind: 'column',
                      pageId,
                      sectionId: section.id,
                      columnIndex,
                    })
                  }
                >
                  {column.components.map((component, componentIndex) => (
                    <SortableComponent
                      key={component.id}
                      componentId={`component:${section.id}:${columnIndex}:${componentIndex}:${component.id}`}
                      component={component}
                      pageId={pageId}
                      sectionId={section.id}
                      columnIndex={columnIndex}
                      componentIndex={componentIndex}
                      selected={
                        selectionState?.kind === 'component' &&
                        selectionState.sectionId === section.id &&
                        selectionState.columnIndex === columnIndex &&
                        selectionState.componentIndex === componentIndex
                      }
                    />
                  ))}
                </DroppableColumn>
              </SortableContext>
            ))}
          </div>
        </section>
      </EditableShell>
    </div>
  );
}

function DroppableColumn({
  id,
  isEmpty,
  selected,
  onSelect,
  children,
}: {
  id: string;
  isEmpty: boolean;
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  // Visible state combinations:
  //   isOver    sky-100 background + 2px solid sky-500 inset ring
  //   selected  sky-50 background  + 2px solid sky-500 inset ring
  //   neither   transparent + hover background
  const stateClass = isOver
    ? 'bg-sky-100 ring-2 ring-sky-500 ring-inset'
    : selected
      ? 'bg-sky-50 ring-2 ring-sky-500 ring-inset'
      : 'ring-2 ring-transparent ring-inset hover:bg-slate-50';
  return (
    <div
      ref={setNodeRef}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      className={`flex min-h-[80px] cursor-pointer flex-col gap-2 rounded p-2 transition-colors ${stateClass}`}
    >
      {isEmpty ? (
        <div
          className={`flex min-h-[60px] items-center justify-center rounded border-2 border-dashed text-center text-xs ${
            selected ? 'border-sky-500 font-medium text-sky-700' : 'border-slate-300 text-slate-400'
          }`}
        >
          {selected ? '✓ Column selected — use the palette' : 'Click to select, or drop here'}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function SortableComponent({
  componentId,
  component,
  pageId,
  sectionId,
  columnIndex,
  componentIndex,
  selected,
}: {
  componentId: string;
  component: Section['columns'][number]['components'][number];
  pageId: string;
  sectionId: string;
  columnIndex: number;
  componentIndex: number;
  selected: boolean;
}) {
  const setSelection = useEditorStore((s) => s.setSelection);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: componentId,
  });
  if (component.type !== 'text') return null;
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="relative"
      {...attributes}
      {...listeners}
    >
      <TextEditable
        component={component}
        selected={selected}
        onSelect={() =>
          setSelection({
            kind: 'component',
            pageId,
            sectionId,
            columnIndex,
            componentIndex,
          })
        }
      />
    </div>
  );
}
