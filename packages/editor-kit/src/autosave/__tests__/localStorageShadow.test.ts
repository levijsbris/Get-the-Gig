import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearShadow,
  readShadow,
  shadowKey,
  shadowWins,
  writeShadow,
} from '../localStorageShadow';

describe('localStorageShadow', () => {
  const PORTFOLIO_ID = '01HEXAMPLE';

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('write / read round trip', () => {
    it('writes a typed snapshot and reads it back with a savedAt timestamp', () => {
      writeShadow(PORTFOLIO_ID, { version: 1, hello: 'world' });
      const result = readShadow(PORTFOLIO_ID, (raw) => raw as { version: number; hello: string });
      expect(result).not.toBeNull();
      expect(result!.snapshot).toEqual({ version: 1, hello: 'world' });
      expect(typeof result!.savedAt).toBe('number');
    });

    it('returns null when no shadow has been written', () => {
      expect(readShadow(PORTFOLIO_ID, (r) => r)).toBeNull();
    });

    it('returns null when the stored JSON is malformed', () => {
      localStorage.setItem(shadowKey(PORTFOLIO_ID), 'not json');
      expect(readShadow(PORTFOLIO_ID, (r) => r)).toBeNull();
    });

    it('returns null when the parse function rejects (Phase 5 schema tightening case)', () => {
      writeShadow(PORTFOLIO_ID, { stale: 'snapshot' });
      // The parse function simulates a Zod tightening that now rejects this doc.
      const result = readShadow(PORTFOLIO_ID, () => null);
      expect(result).toBeNull();
    });

    it('clearShadow removes the stored entry', () => {
      writeShadow(PORTFOLIO_ID, { x: 1 });
      clearShadow(PORTFOLIO_ID);
      expect(readShadow(PORTFOLIO_ID, (r) => r)).toBeNull();
    });
  });

  describe('shadowWins (strict greater-than)', () => {
    it('returns false when there is no shadow', () => {
      expect(shadowWins(null, 5000)).toBe(false);
    });

    it('returns true when shadow.savedAt is strictly greater than the server timestamp', () => {
      expect(shadowWins({ savedAt: 5001, snapshot: {} }, 5000)).toBe(true);
    });

    it('returns false on a tie — server is authoritative when they match', () => {
      expect(shadowWins({ savedAt: 5000, snapshot: {} }, 5000)).toBe(false);
    });

    it('multi-device case: shadow older than server save wins to server', () => {
      // Device A wrote a shadow at t=100 but never reached the server.
      const deviceAShadow = { savedAt: 100, snapshot: { from: 'A' } };
      // Device B saved successfully to the server at t=200.
      const serverUpdatedAt = 200;
      // Device A reopens — its stale shadow must NOT win.
      expect(shadowWins(deviceAShadow, serverUpdatedAt)).toBe(false);
    });

    it('single-device case: shadow newer than server wins to shadow', () => {
      // User edited locally, never saved to server (e.g. offline).
      const localShadow = { savedAt: 500, snapshot: { from: 'local' } };
      const serverUpdatedAt = 200;
      expect(shadowWins(localShadow, serverUpdatedAt)).toBe(true);
    });
  });
});
