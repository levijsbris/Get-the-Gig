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

  it('addSectionAt inserts at the given index and clamps out-of-range values', () => {
    const store = useEditorStore.getState();
    const pageId = getSnapshot().pages[0]!.id;
    store.addSection();
    store.addSection();
    const [a, b] = getSnapshot().pages[0]!.sections.map((s) => s.id);

    // Insert at index 1 (between a and b).
    store.addSectionAt(pageId, 1);
    const afterInsert = getSnapshot().pages[0]!.sections.map((s) => s.id);
    expect(afterInsert).toHaveLength(3);
    expect(afterInsert[0]).toBe(a);
    expect(afterInsert[2]).toBe(b);

    // Out-of-range index clamps to the end (no throw).
    store.addSectionAt(pageId, 999);
    expect(getSnapshot().pages[0]!.sections).toHaveLength(4);

    // Negative index clamps to 0 (prepended).
    store.addSectionAt(pageId, -5);
    const finalIds = getSnapshot().pages[0]!.sections.map((s) => s.id);
    expect(finalIds).toHaveLength(5);
    expect(finalIds[1]).toBe(a);
  });

  it('addSectionAt is a no-op for an unknown page id', () => {
    const store = useEditorStore.getState();
    const before = getSnapshot();
    store.addSectionAt('nope', 0);
    expect(getSnapshot()).toBe(before);
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

  it('addTextComponent inserts at the given index and clamps', () => {
    const store = useEditorStore.getState();
    store.addSection();
    const sectionId = getSnapshot().pages[0]!.sections[0]!.id;
    store.addTextComponent(sectionId, 0); // index 0 (appended)
    store.addTextComponent(sectionId, 0); // index 1 (appended)
    const ids = (
      getSnapshot().pages[0]!.sections[0]!.columns[0]!.components as TextComponent[]
    ).map((c) => c.id);

    // Insert between the two existing components.
    store.addTextComponent(sectionId, 0, 1);
    const afterInsert = (
      getSnapshot().pages[0]!.sections[0]!.columns[0]!.components as TextComponent[]
    ).map((c) => c.id);
    expect(afterInsert).toHaveLength(3);
    expect(afterInsert[0]).toBe(ids[0]);
    expect(afterInsert[2]).toBe(ids[1]);

    // Out-of-range index clamps to end.
    store.addTextComponent(sectionId, 0, 999);
    expect(getSnapshot().pages[0]!.sections[0]!.columns[0]!.components).toHaveLength(4);

    // Negative clamps to 0.
    store.addTextComponent(sectionId, 0, -3);
    const finalIds = (
      getSnapshot().pages[0]!.sections[0]!.columns[0]!.components as TextComponent[]
    ).map((c) => c.id);
    expect(finalIds).toHaveLength(5);
    expect(finalIds[1]).toBe(ids[0]);
  });

  it('moveComponentUp swaps with previous sibling; no-op at index 0', () => {
    const store = useEditorStore.getState();
    store.addSection();
    const sectionId = getSnapshot().pages[0]!.sections[0]!.id;
    store.addTextComponent(sectionId, 0);
    store.addTextComponent(sectionId, 0);
    store.addTextComponent(sectionId, 0);
    const ids = (
      getSnapshot().pages[0]!.sections[0]!.columns[0]!.components as TextComponent[]
    ).map((c) => c.id);

    store.moveComponentUp(sectionId, 0, 2);
    const after = (
      getSnapshot().pages[0]!.sections[0]!.columns[0]!.components as TextComponent[]
    ).map((c) => c.id);
    expect(after).toEqual([ids[0], ids[2], ids[1]]);

    // Already at top — no-op.
    const before = getSnapshot();
    store.moveComponentUp(sectionId, 0, 0);
    expect(getSnapshot()).toBe(before);
  });

  it('moveComponentDown swaps with next sibling; no-op at last index', () => {
    const store = useEditorStore.getState();
    store.addSection();
    const sectionId = getSnapshot().pages[0]!.sections[0]!.id;
    store.addTextComponent(sectionId, 0);
    store.addTextComponent(sectionId, 0);
    store.addTextComponent(sectionId, 0);
    const ids = (
      getSnapshot().pages[0]!.sections[0]!.columns[0]!.components as TextComponent[]
    ).map((c) => c.id);

    store.moveComponentDown(sectionId, 0, 0);
    const after = (
      getSnapshot().pages[0]!.sections[0]!.columns[0]!.components as TextComponent[]
    ).map((c) => c.id);
    expect(after).toEqual([ids[1], ids[0], ids[2]]);

    // Already at bottom — no-op.
    const before = getSnapshot();
    store.moveComponentDown(sectionId, 0, 2);
    expect(getSnapshot()).toBe(before);
  });

  it('addComponentInstance inserts a pre-built component at the given index', () => {
    const store = useEditorStore.getState();
    store.addSection();
    const sectionId = getSnapshot().pages[0]!.sections[0]!.id;
    store.addTextComponent(sectionId, 0);

    // Simulate a palette factory output.
    const built: TextComponent = {
      id: 'externally-built',
      type: 'text',
      doc: { type: 'doc', content: [] },
    };
    store.addComponentInstance(sectionId, 0, built, 0);
    const ids = (
      getSnapshot().pages[0]!.sections[0]!.columns[0]!.components as TextComponent[]
    ).map((c) => c.id);
    expect(ids[0]).toBe('externally-built');
    expect(ids).toHaveLength(2);
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
