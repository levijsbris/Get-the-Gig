import { emptySnapshot } from '@portfoliopro/snapshot-schema';
import { describe, expect, it } from 'vitest';
import { selectionInsertTarget, validateSelection } from '../selection';

describe('validateSelection', () => {
  const snapshot = emptySnapshot();
  const pageId = snapshot.pages[0]!.id;

  it('returns null for null input', () => {
    expect(validateSelection(null, snapshot)).toBeNull();
  });

  it('returns null when the page is gone', () => {
    const sel = { kind: 'section' as const, pageId: 'gone', sectionId: 'whatever' };
    expect(validateSelection(sel, snapshot)).toBeNull();
  });

  it('returns null when the section is gone', () => {
    const sel = { kind: 'section' as const, pageId, sectionId: 'gone' };
    expect(validateSelection(sel, snapshot)).toBeNull();
  });

  it('returns the selection when the section exists', () => {
    const snap = emptySnapshot();
    const sectionId = '01HSECTION';
    snap.pages[0]!.sections.push({
      id: sectionId,
      background: {},
      layout: { columns: 1 },
      columns: [{ id: '01HCOL', components: [] }],
    });
    const sel = { kind: 'section' as const, pageId: snap.pages[0]!.id, sectionId };
    expect(validateSelection(sel, snap)).toEqual(sel);
  });

  it('returns null when the component index is out of range', () => {
    const snap = emptySnapshot();
    snap.pages[0]!.sections.push({
      id: '01HSECTION',
      background: {},
      layout: { columns: 1 },
      columns: [{ id: '01HCOL', components: [] }],
    });
    const sel = {
      kind: 'component' as const,
      pageId: snap.pages[0]!.id,
      sectionId: '01HSECTION',
      columnIndex: 0,
      componentIndex: 0,
    };
    expect(validateSelection(sel, snap)).toBeNull();
  });

  it('returns the selection for an empty column when the column exists', () => {
    const snap = emptySnapshot();
    snap.pages[0]!.sections.push({
      id: '01HSECTION',
      background: {},
      layout: { columns: 2 },
      columns: [
        { id: '01HCOL1', components: [] },
        { id: '01HCOL2', components: [] },
      ],
    });
    const sel = {
      kind: 'column' as const,
      pageId: snap.pages[0]!.id,
      sectionId: '01HSECTION',
      columnIndex: 1,
    };
    expect(validateSelection(sel, snap)).toEqual(sel);
  });

  it('returns null for a column selection when the column was removed (shrink)', () => {
    const snap = emptySnapshot();
    snap.pages[0]!.sections.push({
      id: '01HSECTION',
      background: {},
      layout: { columns: 1 },
      columns: [{ id: '01HCOL', components: [] }],
    });
    const sel = {
      kind: 'column' as const,
      pageId: snap.pages[0]!.id,
      sectionId: '01HSECTION',
      columnIndex: 2,
    };
    expect(validateSelection(sel, snap)).toBeNull();
  });
});

describe('selectionInsertTarget', () => {
  it('returns null when nothing is selected', () => {
    expect(selectionInsertTarget(null)).toBeNull();
  });

  it('defaults section selection to column 0', () => {
    const sel = { kind: 'section' as const, pageId: 'p', sectionId: 's' };
    expect(selectionInsertTarget(sel)).toEqual({ sectionId: 's', columnIndex: 0 });
  });

  it('uses the column index for a column selection', () => {
    const sel = { kind: 'column' as const, pageId: 'p', sectionId: 's', columnIndex: 2 };
    expect(selectionInsertTarget(sel)).toEqual({ sectionId: 's', columnIndex: 2 });
  });

  it('uses the component-owning column for a component selection', () => {
    const sel = {
      kind: 'component' as const,
      pageId: 'p',
      sectionId: 's',
      columnIndex: 1,
      componentIndex: 0,
    };
    expect(selectionInsertTarget(sel)).toEqual({ sectionId: 's', columnIndex: 1 });
  });
});
