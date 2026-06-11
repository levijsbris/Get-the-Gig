/**
 * localStorage shadow store for in-flight portfolio drafts.
 *
 * The shadow is written on every snapshot change so a closed/crashed tab
 * never loses more than the current keystroke. On editor mount, the shadow
 * is compared against the server's draftUpdatedAt: shadow wins iff it is
 * STRICTLY newer than the server, so a save from another device (Device B)
 * that landed while this device (Device A) was closed always wins on
 * reopen — the server's clock is authoritative when they tie.
 *
 * If the shadow doc fails Zod validation on load (e.g. Phase 5 schema
 * tightening retroactively invalidated it), the helpers throw — callers
 * MUST try/catch and fall back to the server. The editor logs a one-time
 * warning so this isn't silent.
 */

export interface DraftShadow<T> {
  /** Epoch ms — Date.now() at the time of write. */
  savedAt: number;
  snapshot: T;
}

export function shadowKey(portfolioId: string): string {
  return `pp:draft:${portfolioId}`;
}

export function writeShadow<T>(portfolioId: string, snapshot: T): void {
  try {
    const shadow: DraftShadow<T> = { savedAt: Date.now(), snapshot };
    localStorage.setItem(shadowKey(portfolioId), JSON.stringify(shadow));
  } catch {
    // Quota errors / disabled storage are ignored — the autosave hook still
    // pushes to the server.
  }
}

export function clearShadow(portfolioId: string): void {
  try {
    localStorage.removeItem(shadowKey(portfolioId));
  } catch {
    // ignore
  }
}

/**
 * Loads and validates the shadow. The caller passes a parse function that
 * throws or returns null when the shadow snapshot is no longer schema-valid.
 * Returns null when there is no shadow, when JSON.parse fails, when the
 * shape isn't a DraftShadow, or when parse() returns null.
 */
export function readShadow<T>(
  portfolioId: string,
  parse: (raw: unknown) => T | null,
): DraftShadow<T> | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(shadowKey(portfolioId));
  } catch {
    return null;
  }
  if (raw === null) return null;

  let envelope: unknown;
  try {
    envelope = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isShadowEnvelope(envelope)) return null;

  const snapshot = parse(envelope.snapshot);
  if (snapshot === null) return null;
  return { savedAt: envelope.savedAt, snapshot };
}

interface ShadowEnvelope {
  savedAt: number;
  snapshot: unknown;
}

function isShadowEnvelope(value: unknown): value is ShadowEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    'savedAt' in value &&
    typeof (value as { savedAt: unknown }).savedAt === 'number' &&
    'snapshot' in value
  );
}

/** Strict greater-than: shadow wins iff its savedAt is strictly newer. */
export function shadowWins<T>(shadow: DraftShadow<T> | null, serverUpdatedAtMs: number): boolean {
  if (!shadow) return false;
  return shadow.savedAt > serverUpdatedAtMs;
}
