import { emptySnapshot } from '@portfoliopro/snapshot-schema';
import { describe, expect, it } from 'vitest';
import { validateSelection } from '../selection';

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
});
