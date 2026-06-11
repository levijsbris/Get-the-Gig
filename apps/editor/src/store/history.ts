import type { Snapshot } from '@portfoliopro/snapshot-schema';

/**
 * Snapshot-based history with structural sharing via immer. Each entry is a
 * Snapshot reference; because mutations are produced via immer.produce(),
 * unchanged subtrees are shared between entries — so a 50-deep history with
 * a 100KB snapshot still costs nowhere near 5MB of memory.
 *
 * Bounded at MAX_HISTORY entries (oldest dropped on overflow). Selection is
 * NOT in here — it lives on the store and is re-validated on every history
 * navigation.
 */
export const MAX_HISTORY = 50;

export interface History {
  entries: Snapshot[];
  index: number;
}

export function initialHistory(snapshot: Snapshot): History {
  return { entries: [snapshot], index: 0 };
}

export function currentSnapshot(history: History): Snapshot {
  const entry = history.entries[history.index];
  if (!entry) throw new Error('History index out of bounds');
  return entry;
}

/**
 * Append the next snapshot. If the user has undone some entries, the redo tail
 * is truncated first — a new mutation after undo means the future is rewritten.
 * Overflows past MAX_HISTORY drop the oldest entry.
 */
export function pushHistory(history: History, next: Snapshot): History {
  const truncated = history.entries.slice(0, history.index + 1);
  truncated.push(next);
  const overflow = truncated.length - MAX_HISTORY;
  const entries = overflow > 0 ? truncated.slice(overflow) : truncated;
  return { entries, index: entries.length - 1 };
}

export function undoHistory(history: History): History | null {
  if (history.index <= 0) return null;
  return { entries: history.entries, index: history.index - 1 };
}

export function redoHistory(history: History): History | null {
  if (history.index >= history.entries.length - 1) return null;
  return { entries: history.entries, index: history.index + 1 };
}

export function canUndo(history: History): boolean {
  return history.index > 0;
}

export function canRedo(history: History): boolean {
  return history.index < history.entries.length - 1;
}
