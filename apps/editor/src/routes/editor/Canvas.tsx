import { useDndMonitor, useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  EditableShell,
  TextEditable,
  type ContextMenuAction,
} from '@portfoliopro/editor-kit';
import { ThemeProvider, useTheme } from '@portfoliopro/renderer';
import { type Section } from '@portfoliopro/snapshot-schema';
import { Fragment, useState } from 'react';
import { useEditorStore, type Viewport } from '../../store/editorStore';
import {
  resolveSectionInsertIndex,
  resolveTextInsertion,
  type TextInsertion,
} from './dnd';

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
 *
 * Palette-drag preview model: when the user is dragging palette:section or
 * palette:text, useDndMonitor tracks an *insertion point* (sectionInsertIndex
 * or textInsertion). A ghost placeholder is rendered at that point so the
 * surrounding items physically shift to reveal where the drop will land,
 * instead of using dashed "Insert here" prompts.
 */
export function Canvas() {
  const snapshot = useEditorStore((s) => s.history.entries[s.history.index]!);
  const pageId = useEditorStore((s) => s.pageId);
  const setSelection = useEditorStore((s) => s.setSelection);
  const viewport = useEditorStore((s) => s.viewport);
  const selection = useEditorStore((s) => s.selection);

  const [paletteSectionDragging, setPaletteSectionDragging] = useState(false);
  const [sectionInsertIndex, setSectionInsertIndex] = useState<number | null>(null);
  const [paletteTextDragging, setPaletteTextDragging] = useState(false);
  const [textInsertion, setTextInsertion] = useState<TextInsertion | null>(null);

  const page = snapshot.pages.find((p) => p.id === pageId) ?? snapshot.pages[0];

  useDndMonitor({
    onDragStart: (event) => {
      const aid = String(event.active.id);
      if (aid === 'palette:section') setPaletteSectionDragging(true);
      if (aid === 'palette:text') setPaletteTextDragging(true);
    },
    onDragOver: (event) => {
      const aid = String(event.active.id);
      if (!page) return;
      if (aid === 'palette:section') {
        setSectionInsertIndex(resolveSectionInsertIndex(event, page.sections));
      } else if (aid === 'palette:text') {
        setTextInsertion(resolveTextInsertion(event, page.sections));
      }
    },
    onDragEnd: () => {
      setPaletteSectionDragging(false);
      setSectionInsertIndex(null);
      setPaletteTextDragging(false);
      setTextInsertion(null);
    },
    onDragCancel: () => {
      setPaletteSectionDragging(false);
      setSectionInsertIndex(null);
      setPaletteTextDragging(false);
      setTextInsertion(null);
    },
  });

  if (!page) return null;
  const activePage = page;

  return (
    <ThemeProvider theme={snapshot.theme}>
      <div className="flex-1 overflow-auto bg-slate-100 p-6" onClick={() => setSelection(null)}>
        <div
          className="mx-auto rounded-lg border border-slate-200 bg-white shadow-sm transition-all"
          style={{ maxWidth: VIEWPORT_WIDTHS[viewport], minHeight: '60vh' }}
        >
          {activePage.sections.length === 0 ? (
            <EmptyPageDropZone
              pageId={activePage.id}
              paletteDragging={paletteSectionDragging}
            />
          ) : (
            <>
              <SectionEdgeDropZone
                id={`section-slot:${activePage.id}:0`}
                active={paletteSectionDragging}
              />
              <SortableContext
                items={activePage.sections.map((s) => `section:${s.id}`)}
                strategy={verticalListSortingStrategy}
              >
                {activePage.sections.map((section, sectionIndex) => (
                  <Fragment key={section.id}>
                    {sectionInsertIndex === sectionIndex && <GhostSection />}
                    <SortableSection
                      section={section}
                      pageId={activePage.id}
                      selected={selection?.kind === 'section' && selection.sectionId === section.id}
                      textInsertion={
                        paletteTextDragging && textInsertion?.sectionId === section.id
                          ? textInsertion
                          : null
                      }
                      paletteTextDragging={paletteTextDragging}
                    />
                  </Fragment>
                ))}
                {sectionInsertIndex === activePage.sections.length && <GhostSection />}
              </SortableContext>
              <SectionEdgeDropZone
                id={`section-slot:${activePage.id}:${activePage.sections.length}`}
                active={paletteSectionDragging}
              />
            </>
          )}
        </div>
      </div>
    </ThemeProvider>
  );
}

function GhostSection() {
  // Mimics the height of an empty section so surrounding sections shift
  // visibly. No prompt text — purely a placeholder for "this is where it lands".
  return <div className="mx-4 my-3 h-20 rounded border-2 border-dashed border-sky-400 bg-sky-100/70" />;
}

/**
 * Invisible drop zone at the top or bottom of the section list. Provides a
 * dedicated, easy-to-hit "insert at edge" target during a palette:section
 * drag. The id encodes the insert index via the section-slot:* namespace,
 * which resolveSectionInsertIndex understands. The hit area appears only
 * while a section is being dragged so the canvas layout doesn't shift
 * during normal editing.
 */
function SectionEdgeDropZone({ id, active }: { id: string; active: boolean }) {
  const { setNodeRef } = useDroppable({ id });
  return <div ref={setNodeRef} className={active ? 'h-4' : 'h-0'} />;
}

/**
 * Invisible drop zone at the top or bottom of a column, rendered only while a
 * palette:text drag is in flight. Provides a generous, dedicated "insert at
 * column edge" target so the user doesn't have to land precisely on the top
 * 80% of the first component or the bottom 80% of the last. The id encodes
 * the position (top|bottom) which resolveTextInsertion translates into
 * insertIndex 0 or end.
 */
function ColumnEdgeDropZone({ id, active }: { id: string; active: boolean }) {
  const { setNodeRef } = useDroppable({ id });
  return <div ref={setNodeRef} className={active ? 'h-6' : 'h-0'} />;
}

function GhostText() {
  return (
    <div className="my-2 h-10 rounded border-2 border-dashed border-sky-400 bg-sky-100/70" />
  );
}

function EmptyPageDropZone({
  pageId,
  paletteDragging,
}: {
  pageId: string;
  paletteDragging: boolean;
}) {
  // Single droppable that catches palette:section drops on a page with no
  // sections. We pass insertIndex=0 via the section-slot id namespace.
  const { setNodeRef } = useDroppable({ id: `section-slot:${pageId}:0` });
  return (
    <div ref={setNodeRef} className="p-6">
      {paletteDragging ? (
        <GhostSection />
      ) : (
        <div className="text-center text-sm text-slate-400">
          Empty page. Click + Section in the palette to start.
        </div>
      )}
    </div>
  );
}

function SortableSection({
  section,
  pageId,
  selected,
  textInsertion,
  paletteTextDragging,
}: {
  section: Section;
  pageId: string;
  selected: boolean;
  textInsertion: TextInsertion | null;
  paletteTextDragging: boolean;
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
            {section.columns.map((column, columnIndex) => {
              const columnTextInsertion =
                textInsertion && textInsertion.columnIndex === columnIndex ? textInsertion : null;
              return (
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
                    isPaletteTextTarget={!!columnTextInsertion}
                    onSelect={() =>
                      setSelection({
                        kind: 'column',
                        pageId,
                        sectionId: section.id,
                        columnIndex,
                      })
                    }
                  >
                    <ColumnEdgeDropZone
                      id={`column-edge:${section.id}:${columnIndex}:top`}
                      active={paletteTextDragging}
                    />
                    {columnTextInsertion && column.components.length === 0 && <GhostText />}
                    {column.components.map((component, componentIndex) => (
                      <Fragment key={component.id}>
                        {columnTextInsertion?.insertIndex === componentIndex && <GhostText />}
                        <SortableComponent
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
                      </Fragment>
                    ))}
                    {columnTextInsertion?.insertIndex === column.components.length &&
                      column.components.length > 0 && <GhostText />}
                    <ColumnEdgeDropZone
                      id={`column-edge:${section.id}:${columnIndex}:bottom`}
                      active={paletteTextDragging}
                    />
                  </DroppableColumn>
                </SortableContext>
              );
            })}
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
  isPaletteTextTarget,
  onSelect,
  children,
}: {
  id: string;
  isEmpty: boolean;
  selected: boolean;
  isPaletteTextTarget: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  // Visible state precedence:
  //   isPaletteTextTarget  sky-100 background + 2px sky-500 inset ring (column will receive the text)
  //   isOver               sky-100 background + 2px sky-500 inset ring
  //   selected             sky-50 background  + 2px sky-500 inset ring
  //   neither              transparent + hover background
  const stateClass =
    isPaletteTextTarget || isOver
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
      {isEmpty && !isPaletteTextTarget ? (
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
  const duplicateComponent = useEditorStore((s) => s.duplicateComponent);
  const deleteComponent = useEditorStore((s) => s.deleteComponent);
  const moveComponentUp = useEditorStore((s) => s.moveComponentUp);
  const moveComponentDown = useEditorStore((s) => s.moveComponentDown);
  const updateTextComponentDoc = useEditorStore((s) => s.updateTextComponentDoc);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: componentId,
  });
  if (component.type !== 'text') return null;

  const handleMenuAction = (action: ContextMenuAction) => {
    switch (action) {
      case 'duplicate':
        duplicateComponent(sectionId, columnIndex, componentIndex);
        return;
      case 'delete':
        deleteComponent(sectionId, columnIndex, componentIndex);
        return;
      case 'moveUp':
        moveComponentUp(sectionId, columnIndex, componentIndex);
        return;
      case 'moveDown':
        moveComponentDown(sectionId, columnIndex, componentIndex);
        return;
    }
  };

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
        onChange={(doc) =>
          updateTextComponentDoc(sectionId, columnIndex, componentIndex, doc)
        }
        onMenuAction={handleMenuAction}
      />
    </div>
  );
}
