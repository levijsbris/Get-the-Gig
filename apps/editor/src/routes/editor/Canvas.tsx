import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { EditableShell, TextEditable } from '@portfoliopro/editor-kit';
import { ThemeProvider, useTheme } from '@portfoliopro/renderer';
import { type Section } from '@portfoliopro/snapshot-schema';
import { useState } from 'react';
import { useEditorStore, type Viewport } from '../../store/editorStore';

const VIEWPORT_WIDTHS: Record<Viewport, number> = {
  desktop: 1280,
  tablet: 768,
  mobile: 380,
};

export function Canvas() {
  const snapshot = useEditorStore((s) => s.history.entries[s.history.index]!);
  const pageId = useEditorStore((s) => s.pageId);
  const setSelection = useEditorStore((s) => s.setSelection);
  const moveSection = useEditorStore((s) => s.moveSection);
  const moveComponent = useEditorStore((s) => s.moveComponent);
  const viewport = useEditorStore((s) => s.viewport);
  const selection = useEditorStore((s) => s.selection);
  const [draggingComponentId, setDraggingComponentId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const page = snapshot.pages.find((p) => p.id === pageId) ?? snapshot.pages[0];
  if (!page) return null;
  // Capture page in a const that's narrowed for the closures below — TS won't
  // narrow `page` inside callback bodies otherwise.
  const activePage = page;

  function onDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    if (id.startsWith('component:')) setDraggingComponentId(id);
  }

  function onDragEnd(event: DragEndEvent) {
    setDraggingComponentId(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith('section:') && overId.startsWith('section:')) {
      const oldIndex = activePage.sections.findIndex(
        (s) => s.id === activeId.slice('section:'.length),
      );
      const newIndex = activePage.sections.findIndex(
        (s) => s.id === overId.slice('section:'.length),
      );
      if (oldIndex >= 0 && newIndex >= 0) moveSection(oldIndex, newIndex);
      return;
    }

    if (activeId.startsWith('component:')) {
      const sourcePath = parseComponentId(activeId);
      if (!sourcePath) return;
      // Drop target may be either a sibling component (component:...) or an
      // empty column (column:...). Resolve to a column + index either way.
      const targetPath = resolveDropTarget(activePage.sections, overId, sourcePath);
      if (!targetPath) return;
      moveComponent(
        sourcePath.sectionId,
        sourcePath.columnIndex,
        sourcePath.componentIndex,
        targetPath.columnIndex,
        targetPath.componentIndex,
      );
    }
  }

  const draggingComponent = (() => {
    if (!draggingComponentId) return null;
    const path = parseComponentId(draggingComponentId);
    if (!path) return null;
    const section = activePage.sections.find((s) => s.id === path.sectionId);
    return section?.columns[path.columnIndex]?.components[path.componentIndex] ?? null;
  })();

  return (
    <ThemeProvider theme={snapshot.theme}>
      <div className="flex-1 overflow-auto bg-slate-100 p-6" onClick={() => setSelection(null)}>
        <div
          className="mx-auto rounded-lg border border-slate-200 bg-white shadow-sm transition-all"
          style={{ maxWidth: VIEWPORT_WIDTHS[viewport], minHeight: '60vh' }}
        >
          {activePage.sections.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-400">
              Empty page. Use the palette to add a section.
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={activePage.sections.map((s) => `section:${s.id}`)}
                strategy={verticalListSortingStrategy}
              >
                {activePage.sections.map((section) => (
                  <SortableSection
                    key={section.id}
                    section={section}
                    pageId={page.id}
                    selected={selection?.kind === 'section' && selection.sectionId === section.id}
                  />
                ))}
              </SortableContext>
              <DragOverlay>
                {draggingComponent ? (
                  <div className="rounded-md border border-sky-400 bg-white p-2 shadow-lg">
                    <TextEditable
                      component={draggingComponent as never}
                      selected={false}
                      onSelect={() => {}}
                    />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
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
  children,
}: {
  id: string;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[60px] flex-col gap-2 rounded transition-colors ${
        isOver ? 'bg-sky-50' : ''
      }`}
    >
      {isEmpty ? (
        <div className="flex min-h-[60px] items-center justify-center rounded border border-dashed border-slate-200 text-center text-xs text-slate-400">
          Drop here
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

interface ComponentPath {
  sectionId: string;
  columnIndex: number;
  componentIndex: number;
}

function parseComponentId(id: string): ComponentPath | null {
  // component:{sectionId}:{columnIndex}:{componentIndex}:{componentId}
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

function resolveDropTarget(
  sections: Section[],
  overId: string,
  source: ComponentPath,
): ComponentPath | null {
  if (overId.startsWith('component:')) {
    const target = parseComponentId(overId);
    if (!target) return null;
    return target;
  }
  if (overId.startsWith('column:')) {
    // column:{sectionId}:{columnIndex} — drop at the end of the column.
    const [, sectionId, columnIndexRaw] = overId.split(':');
    if (!sectionId || columnIndexRaw === undefined) return null;
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return null;
    const columnIndex = Number(columnIndexRaw);
    const column = section.columns[columnIndex];
    if (!column) return null;
    return { sectionId, columnIndex, componentIndex: column.components.length };
  }
  return source;
}
