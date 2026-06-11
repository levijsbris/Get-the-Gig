import { emptySnapshot } from '@portfoliopro/snapshot-schema';
import { describe, expect, it } from 'vitest';
import {
  canRedo,
  canUndo,
  currentSnapshot,
  initialHistory,
  MAX_HISTORY,
  pushHistory,
  redoHistory,
  undoHistory,
} from '../history';

describe('history', () => {
  it('initialHistory points at a single entry at index 0', () => {
    const h = initialHistory(emptySnapshot());
    expect(h.entries).toHaveLength(1);
    expect(h.index).toBe(0);
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
  });

  it('pushHistory appends and advances the index', () => {
    const start = initialHistory(emptySnapshot());
    const next = pushHistory(start, emptySnapshot());
    expect(next.entries).toHaveLength(2);
    expect(next.index).toBe(1);
    expect(canUndo(next)).toBe(true);
    expect(canRedo(next)).toBe(false);
  });

  it('undoHistory steps back and supports redo', () => {
    const a = initialHistory(emptySnapshot());
    const b = pushHistory(a, emptySnapshot());
    const undone = undoHistory(b);
    expect(undone).not.toBeNull();
    expect(undone!.index).toBe(0);
    expect(canRedo(undone!)).toBe(true);
    const redone = redoHistory(undone!);
    expect(redone!.index).toBe(1);
  });

  it('undoHistory returns null at the start of history', () => {
    expect(undoHistory(initialHistory(emptySnapshot()))).toBeNull();
  });

  it('redoHistory returns null at the head of history', () => {
    expect(redoHistory(initialHistory(emptySnapshot()))).toBeNull();
  });

  it('pushing after undo truncates the redo tail', () => {
    let h = initialHistory(emptySnapshot());
    h = pushHistory(h, emptySnapshot());
    h = pushHistory(h, emptySnapshot());
    h = pushHistory(h, emptySnapshot());
    // We are at index 3 with 4 entries. Undo twice.
    h = undoHistory(h)!;
    h = undoHistory(h)!;
    expect(h.entries).toHaveLength(4);
    expect(h.index).toBe(1);
    // A new mutation drops entries 2 and 3 and adds a new head.
    h = pushHistory(h, emptySnapshot());
    expect(h.entries).toHaveLength(3);
    expect(h.index).toBe(2);
    expect(canRedo(h)).toBe(false);
  });

  it('bounded at MAX_HISTORY entries — oldest dropped', () => {
    let h = initialHistory(emptySnapshot());
    for (let i = 0; i < MAX_HISTORY + 20; i += 1) {
      h = pushHistory(h, emptySnapshot());
    }
    expect(h.entries).toHaveLength(MAX_HISTORY);
    expect(h.index).toBe(MAX_HISTORY - 1);
  });

  it('currentSnapshot returns the entry at the index', () => {
    const a = emptySnapshot();
    const b = emptySnapshot();
    let h = initialHistory(a);
    h = pushHistory(h, b);
    expect(currentSnapshot(h)).toBe(b);
    expect(currentSnapshot(undoHistory(h)!)).toBe(a);
  });
});
