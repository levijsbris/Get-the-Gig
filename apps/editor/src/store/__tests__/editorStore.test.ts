import { emptySnapshot, type Snapshot, type TextComponent } from '@portfoliopro/snapshot-schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '../editorStore';

function getSnapshot(): Snapshot {
  return useEditorStore.getState().snapshot();
}

describe('editorStore — basics', () => {
  beforeEach(() => {
    useEditorStore.getState().init(emptySnapshot());
  });

  it('init seeds history with one entry, no selection, isDirty=false', () => {
    const state = useEditorStore.getState();
    expect(state.history.entries).toHaveLength(1);
    expect(state.history.index).toBe(0);
    expect(state.selection).toBeNull();
    expect(state.isDirty).toBe(false);
  });
});

describe('editorStore — page mutations', () => {
  beforeEach(() => {
    useEditorStore.getState().init(emptySnapshot());
  });

  it('addPage appends a new page and bumps history', () => {
    useEditorStore.getState().addPage();
    expect(getSnapshot().pages).toHaveLength(2);
    expect(useEditorStore.getState().history.index).toBe(1);
    expect(useEditorStore.getState().isDirty).toBe(true);
  });

  it('renamePage updates the title', () => {
    const pageId = getSnapshot().pages[0]!.id;
    useEditorStore.getState().renamePage(pageId, 'About');
    expect(getSnapshot().pages[0]!.title).toBe('About');
  });

  it('deletePage refuses to remove the last page', () => {
    const pageId = getSnapshot().pages[0]!.id;
    useEditorStore.getState().deletePage(pageId);
    expect(getSnapshot().pages).toHaveLength(1);
  });

  it('deletePage removes other pages and switches active pageId if needed', () => {
    useEditorStore.getState().addPage();
    const [first, second] = getSnapshot().pages;
    useEditorStore.getState().setPage(second!.id);
    useEditorStore.getState().deletePage(second!.id);
    expect(getSnapshot().pages).toHaveLength(1);
    expect(useEditorStore.getState().pageId).toBe(first!.id);
  });
});

describe('editorStore — section + component mutations', () => {
  beforeEach(() => {
    useEditorStore.getState().init(emptySnapshot());
  });

  it('addSection appends a 1-column section', () => {
    useEditorStore.getState().addSection();
    const section = getSnapshot().pages[0]!.sections[0]!;
    expect(section.layout.columns).toBe(1);
    expect(section.columns).toHaveLength(1);
  });

  it('setSectionLayout resizes columns and merges drops into the last surviving column', () => {
    const store = useEditorStore.getState();
    store.addSection();
    const sectionId = getSnapshot().pages[0]!.sections[0]!.id;

    store.setSectionLayout(sectionId, 3);
    store.addTextComponent(sectionId, 2); // component in column index 2
    expect(getSnapshot().pages[0]!.sections[0]!.columns[2]!.components).toHaveLength(1);

    // Shrink: components from col 2 should merge into col 0 (the last surviving).
    store.setSectionLayout(sectionId, 1);
    expect(getSnapshot().pages[0]!.sections[0]!.columns).toHaveLength(1);
    expect(getSnapshot().pages[0]!.sections[0]!.columns[0]!.components).toHaveLength(1);
  });

  it('duplicateSection clones with fresh ids', () => {
    const store = useEditorStore.getState();
    store.addSection();
    const sectionId = getSnapshot().pages[0]!.sections[0]!.id;
    store.addTextComponent(sectionId, 0);
    store.duplicateSection(sectionId);

    const sections = getSnapshot().pages[0]!.sections;
    expect(sections).toHaveLength(2);
    expect(sections[0]!.id).not.toBe(sections[1]!.id);
    const componentA = sections[0]!.columns[0]!.components[0]! as TextComponent;
    const componentB = sections[1]!.columns[0]!.components[0]! as TextComponent;
    expect(componentA.id).not.toBe(componentB.id);
  });

  it('addTextComponent + moveComponent moves between columns', () => {
    const store = useEditorStore.getState();
    store.addSection();
    const sectionId = getSnapshot().pages[0]!.sections[0]!.id;
    store.setSectionLayout(sectionId, 2);
    store.addTextComponent(sectionId, 0);
    const componentId = (
      getSnapshot().pages[0]!.sections[0]!.columns[0]!.components[0]! as TextComponent
    ).id;

    store.moveComponent(sectionId, 0, 0, 1, 0);
    expect(getSnapshot().pages[0]!.sections[0]!.columns[0]!.components).toHaveLength(0);
    expect(getSnapshot().pages[0]!.sections[0]!.columns[1]!.components).toHaveLength(1);
    expect(
      (getSnapshot().pages[0]!.sections[0]!.columns[1]!.components[0]! as TextComponent).id,
    ).toBe(componentId);
  });
});

describe('editorStore — history navigation + selection survival', () => {
  beforeEach(() => {
    useEditorStore.getState().init(emptySnapshot());
  });

  it('undo restores the prior snapshot; redo replays', () => {
    const store = useEditorStore.getState();
    store.addPage();
    expect(getSnapshot().pages).toHaveLength(2);
    store.undo();
    expect(getSnapshot().pages).toHaveLength(1);
    store.redo();
    expect(getSnapshot().pages).toHaveLength(2);
  });

  it('a new mutation after undo truncates the redo tail', () => {
    const store = useEditorStore.getState();
    store.addPage();
    store.addPage();
    expect(getSnapshot().pages).toHaveLength(3);
    store.undo();
    store.undo();
    expect(getSnapshot().pages).toHaveLength(1);
    store.addSection();
    // Cannot redo back to the 2-page or 3-page state — those entries are gone.
    expect(useEditorStore.getState().history.index).toBe(
      useEditorStore.getState().history.entries.length - 1,
    );
  });

  it('selection survives undo when the selected element still exists', () => {
    const store = useEditorStore.getState();
    store.addSection();
    const sectionId = getSnapshot().pages[0]!.sections[0]!.id;
    store.setSelection({ kind: 'section', pageId: getSnapshot().pages[0]!.id, sectionId });

    // Unrelated mutation that doesn't touch the section.
    store.addPage();
    expect(useEditorStore.getState().selection).not.toBeNull();

    store.undo();
    expect(useEditorStore.getState().selection?.kind).toBe('section');
  });

  it('undo past the creation of the selected component clears selection to null', () => {
    const store = useEditorStore.getState();
    store.addSection();
    const sectionId = getSnapshot().pages[0]!.sections[0]!.id;
    store.addTextComponent(sectionId, 0);
    const pageId = getSnapshot().pages[0]!.id;

    store.setSelection({
      kind: 'component',
      pageId,
      sectionId,
      columnIndex: 0,
      componentIndex: 0,
    });
    expect(useEditorStore.getState().selection).not.toBeNull();

    // Undo the addTextComponent — the component disappears.
    store.undo();
    expect(useEditorStore.getState().selection).toBeNull();
  });

  it('deleting the selected section clears selection on the same mutation', () => {
    const store = useEditorStore.getState();
    store.addSection();
    const sectionId = getSnapshot().pages[0]!.sections[0]!.id;
    const pageId = getSnapshot().pages[0]!.id;
    store.setSelection({ kind: 'section', pageId, sectionId });
    store.deleteSection(sectionId);
    expect(useEditorStore.getState().selection).toBeNull();
  });
});
