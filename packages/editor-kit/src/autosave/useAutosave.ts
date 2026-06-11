import { useEffect, useRef, useState } from 'react';

export interface UseAutosaveOptions<T> {
  /** Source value to watch. Each new reference triggers the debounced save. */
  value: T;
  /** Called with the latest value once the debounce settles. */
  onSave: (value: T) => Promise<void>;
  /** Debounce delay in milliseconds. Defaults to 2000. */
  delayMs?: number;
  /** When false, no save fires regardless of value changes. */
  enabled?: boolean;
}

export interface UseAutosaveResult {
  status: 'idle' | 'pending' | 'saving' | 'saved' | 'error';
  error: Error | null;
  /** Force a save now, cancelling any pending debounce. */
  flush: () => Promise<void>;
}

/**
 * Debounced save with a single in-flight policy:
 *   - Each value change resets a `delayMs` timer.
 *   - When the timer fires, onSave is called with the latest value.
 *   - If a new change arrives WHILE a save is in flight, a follow-up save is
 *     scheduled with the value that landed after the in-flight call started.
 *   - flush() (called on unmount, route change, or explicit "Save now") runs
 *     onSave immediately with the latest value.
 */
export function useAutosave<T>({
  value,
  onSave,
  delayMs = 2000,
  enabled = true,
}: UseAutosaveOptions<T>): UseAutosaveResult {
  const [status, setStatus] = useState<UseAutosaveResult['status']>('idle');
  const [error, setError] = useState<Error | null>(null);

  // Refs that don't trigger re-renders.
  const latestValue = useRef<T>(value);
  const inFlight = useRef<Promise<void> | null>(null);
  const pendingAfterFlight = useRef<boolean>(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);

  // Keep callbacks fresh without re-triggering the debounce effect.
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  async function doSave() {
    if (inFlight.current) {
      pendingAfterFlight.current = true;
      return inFlight.current;
    }
    setStatus('saving');
    setError(null);
    const valueAtStart = latestValue.current;
    const promise = onSaveRef.current(valueAtStart)
      .then(() => {
        setStatus('saved');
      })
      .catch((err: unknown) => {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        setStatus('error');
      })
      .finally(() => {
        inFlight.current = null;
        if (pendingAfterFlight.current) {
          pendingAfterFlight.current = false;
          // A value change arrived during the in-flight save — fire a follow-up.
          void doSave();
        }
      });
    inFlight.current = promise;
    return promise;
  }

  // Schedule a save on value change.
  useEffect(() => {
    if (!enabled) return;
    latestValue.current = value;
    setStatus('pending');
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void doSave();
    }, delayMs);

    return () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, enabled, delayMs]);

  async function flush() {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    await doSave();
  }

  return { status, error, flush };
}
