import {
  createColumn,
  createPage,
  createSection,
  createTextComponent,
  emptySnapshot,
  type Snapshot,
} from '@portfoliopro/snapshot-schema';
import { produce } from 'immer';
import { ulid } from 'ulid';
import { create } from 'zustand';
import {
  currentSnapshot,
  initialHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type History,
} from './history';
import { validateSelection, type Selection } from './selection';

export type Viewport = 'desktop' | 'tablet' | 'mobile';

export interface EditorState {
  history: History;
  selection: Selection | null;
  pageId: string;
  viewport: Viewport;
  /** True when the snapshot has unsaved mutations. Cleared by markClean(). */
  isDirty: boolean;

  // selectors
  snapshot: () => Snapshot;

  // session commands
  init: (snapshot: Snapshot, opts?: { isDirty?: boolean }) => void;
  setSelection: (selection: Selection | null) => void;
  setPage: (pageId: string) => void;
  setViewport: (viewport: Viewport) => void;
  markClean: () => void;

  // history
  undo: () => void;
  redo: () => void;

  // page operations
  addPage: () => void;
  renamePage: (pageId: string, title: string) => void;
  reorderPages: (oldIndex: number, newIndex: number) => void;
  deletePage: (pageId: string) => void;

  // section operations
  addSection: () => void;
  addSectionAt: (pageId: string, index: number) => void;
  setSectionLayout: (sectionId: string, columns: 1 | 2 | 3 | 4) => void;
  moveSection: (oldIndex: number, newIndex: number) => void;
  duplicateSection: (sectionId: string) => void;
  deleteSection: (sectionId: string) => void;

  // component operations
  addTextComponent: (sectionId: string, columnIndex: number, insertIndex?: number) => void;
  moveComponent: (
    sectionId: string,
    fromColumn: number,
    fromIndex: number,
    toColumn: number,
    toIndex: number,
  ) => void;
  duplicateComponent: (sectionId: string, columnIndex: number, componentIndex: number) => void;
  deleteComponent: (sectionId: string, columnIndex: number, componentIndex: number) => void;
}

/**
 * THE HISTORY SEAM. Every mutation that should be undoable flows through this
 * one function:
 *
 *   1. immer.produce gives us a draft + the next immutable snapshot
 *   2. pushHistory appends to history (truncates redo tail; bounded)
 *   3. validateSelection clears selection if its target is gone
 *   4. isDirty flips on
 *
 * Phase 5 typing flows will add a sibling commitMutationDebounced(key, mutate)
 * that batches multiple mutator calls within a window into ONE history entry.
 * It will reuse the same primitive — no refactor of individual mutations.
 * Mutations call commit(); commit() owns the seam. Nothing else writes to
 * history directly.
 */
function commit(state: EditorState, mutate: (draft: Snapshot) => void): Partial<EditorState> {
  const current = currentSnapshot(state.history);
  const next = produce(current, mutate);
  if (next === current) return {};
  const history = pushHistory(state.history, next);
  return {
    history,
    selection: validateSelection(state.selection, next),
    isDirty: true,
  };
}

function initialState(snapshot: Snapshot): {
  history: History;
  pageId: string;
  selection: null;
  viewport: Viewport;
  isDirty: boolean;
} {
  return {
    history: initialHistory(snapshot),
    pageId: snapshot.pages[0]?.id ?? '',
    selection: null,
    viewport: 'desktop',
    isDirty: false,
  };
}

export const useEditorStore = create<EditorState>((set, get) => {
  const bootstrap = emptySnapshot();
  return {
    ...initialState(bootstrap),

    snapshot: () => currentSnapshot(get().history),

    init: (snapshot, opts) =>
      set({
        ...initialState(snapshot),
        isDirty: opts?.isDirty ?? false,
      }),

    setSelection: (selection) => set({ selection }),
    setPage: (pageId) => set({ pageId, selection: null }),
    setViewport: (viewport) => set({ viewport }),
    markClean: () => set({ isDirty: false }),

    undo: () =>
      set((state) => {
        const next = undoHistory(state.history);
        if (!next) return {};
        return {
          history: next,
          selection: validateSelection(state.selection, currentSnapshot(next)),
          isDirty: true,
        };
      }),

    redo: () =>
      set((state) => {
        const next = redoHistory(state.history);
        if (!next) return {};
        return {
          history: next,
          selection: validateSelection(state.selection, currentSnapshot(next)),
          isDirty: true,
        };
      }),

    addPage: () =>
      set((state) =>
        commit(state, (draft) => {
          draft.pages.push(
            createPage(`Page ${draft.pages.length + 1}`, `page-${ulid().slice(-8).toLowerCase()}`),
          );
        }),
      ),

    renamePage: (pageId, title) =>
      set((state) =>
        commit(state, (draft) => {
          const page = draft.pages.find((p) => p.id === pageId);
          if (page) page.title = title;
        }),
      ),

    reorderPages: (oldIndex, newIndex) =>
      set((state) =>
        commit(state, (draft) => {
          if (oldIndex === newIndex) return;
          if (oldIndex < 0 || oldIndex >= draft.pages.length) return;
          if (newIndex < 0 || newIndex >= draft.pages.length) return;
          const [moved] = draft.pages.splice(oldIndex, 1);
          if (moved) draft.pages.splice(newIndex, 0, moved);
        }),
      ),

    deletePage: (pageId) =>
      set((state) => {
        const snap = currentSnapshot(state.history);
        if (snap.pages.length <= 1) return {}; // never delete the last page
        const partial = commit(state, (draft) => {
          const idx = draft.pages.findIndex((p) => p.id === pageId);
          if (idx >= 0) draft.pages.splice(idx, 1);
        });
        // If the current pageId pointed at the deleted page, switch to the first remaining.
        if (partial.history && state.pageId === pageId) {
          const remainingFirst = currentSnapshot(partial.history).pages[0]?.id ?? '';
          return { ...partial, pageId: remainingFirst };
        }
        return partial;
      }),

    addSection: () =>
      set((state) =>
        commit(state, (draft) => {
          const page = draft.pages.find((p) => p.id === state.pageId);
          if (page) page.sections.push(createSection(1));
        }),
      ),

    addSectionAt: (pageId, index) =>
      set((state) =>
        commit(state, (draft) => {
          const page = draft.pages.find((p) => p.id === pageId);
          if (!page) return;
          const clamped = Math.max(0, Math.min(index, page.sections.length));
          page.sections.splice(clamped, 0, createSection(1));
        }),
      ),

    setSectionLayout: (sectionId, columns) =>
      set((state) =>
        commit(state, (draft) => {
          const target = findSection(draft, sectionId);
          if (!target) return;
          const { section } = target;
          section.layout.columns = columns;
          while (section.columns.length < columns) {
            section.columns.push(createColumn());
          }
          if (section.columns.length > columns) {
            const removed = section.columns.splice(columns);
            const lastSurviving = section.columns[columns - 1];
            if (lastSurviving) {
              for (const dropped of removed) {
                lastSurviving.components.push(...dropped.components);
              }
            }
          }
        }),
      ),

    moveSection: (oldIndex, newIndex) =>
      set((state) =>
        commit(state, (draft) => {
          const page = draft.pages.find((p) => p.id === state.pageId);
          if (!page) return;
          if (oldIndex === newIndex) return;
          if (oldIndex < 0 || oldIndex >= page.sections.length) return;
          if (newIndex < 0 || newIndex >= page.sections.length) return;
          const [moved] = page.sections.splice(oldIndex, 1);
          if (moved) page.sections.splice(newIndex, 0, moved);
        }),
      ),

    duplicateSection: (sectionId) =>
      set((state) =>
        commit(state, (draft) => {
          const target = findSection(draft, sectionId);
          if (!target) return;
          const { page, section } = target;
          const copy = JSON.parse(JSON.stringify(section)) as typeof section;
          regenerateIds(copy);
          const idx = page.sections.indexOf(section);
          page.sections.splice(idx + 1, 0, copy);
        }),
      ),

    deleteSection: (sectionId) =>
      set((state) =>
        commit(state, (draft) => {
          const target = findSection(draft, sectionId);
          if (!target) return;
          const { page, section } = target;
          page.sections.splice(page.sections.indexOf(section), 1);
        }),
      ),

    addTextComponent: (sectionId, columnIndex, insertIndex) =>
      set((state) =>
        commit(state, (draft) => {
          const target = findSection(draft, sectionId);
          if (!target) return;
          const column = target.section.columns[columnIndex];
          if (!column) return;
          const component = createTextComponent();
          if (insertIndex === undefined) {
            column.components.push(component);
          } else {
            const clamped = Math.max(0, Math.min(insertIndex, column.components.length));
            column.components.splice(clamped, 0, component);
          }
        }),
      ),

    moveComponent: (sectionId, fromColumn, fromIndex, toColumn, toIndex) =>
      set((state) =>
        commit(state, (draft) => {
          const target = findSection(draft, sectionId);
          if (!target) return;
          const src = target.section.columns[fromColumn];
          const dst = target.section.columns[toColumn];
          if (!src || !dst) return;
          const [moved] = src.components.splice(fromIndex, 1);
          if (!moved) return;
          const insertAt = Math.min(toIndex, dst.components.length);
          dst.components.splice(insertAt, 0, moved);
        }),
      ),

    duplicateComponent: (sectionId, columnIndex, componentIndex) =>
      set((state) =>
        commit(state, (draft) => {
          const target = findSection(draft, sectionId);
          if (!target) return;
          const column = target.section.columns[columnIndex];
          if (!column) return;
          const component = column.components[componentIndex];
          if (!component) return;
          const copy = JSON.parse(JSON.stringify(component)) as typeof component;
          copy.id = ulid();
          column.components.splice(componentIndex + 1, 0, copy);
        }),
      ),

    deleteComponent: (sectionId, columnIndex, componentIndex) =>
      set((state) =>
        commit(state, (draft) => {
          const target = findSection(draft, sectionId);
          if (!target) return;
          const column = target.section.columns[columnIndex];
          if (!column) return;
          column.components.splice(componentIndex, 1);
        }),
      ),
  };
});

interface SectionLookup {
  page: Snapshot['pages'][number];
  section: Snapshot['pages'][number]['sections'][number];
}

function findSection(snapshot: Snapshot, sectionId: string): SectionLookup | null {
  for (const page of snapshot.pages) {
    for (const section of page.sections) {
      if (section.id === sectionId) return { page, section };
    }
  }
  return null;
}

function regenerateIds(section: Snapshot['pages'][number]['sections'][number]): void {
  section.id = ulid();
  for (const column of section.columns) {
    column.id = ulid();
    for (const component of column.components) {
      component.id = ulid();
    }
  }
}
