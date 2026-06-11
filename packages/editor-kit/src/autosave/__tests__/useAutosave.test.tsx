import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutosave } from '../useAutosave';

function Probe({
  value,
  onSave,
  delayMs,
  onResult,
}: {
  value: number;
  onSave: (v: number) => Promise<void>;
  delayMs?: number;
  onResult?: (status: string) => void;
}) {
  const result = useAutosave({ value, onSave, delayMs });
  useEffect(() => {
    onResult?.(result.status);
  }, [result.status, onResult]);
  return null;
}

describe('useAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces multiple rapid changes into a single save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<Probe value={1} onSave={onSave} delayMs={500} />);
    rerender(<Probe value={2} onSave={onSave} delayMs={500} />);
    rerender(<Probe value={3} onSave={onSave} delayMs={500} />);

    expect(onSave).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(3);
  });

  it('does not save if the value never changes after a save settles', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<Probe value={1} onSave={onSave} delayMs={500} />);
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('schedules a follow-up save when the value changes during an in-flight save', async () => {
    let resolveSave: (() => void) | null = null;
    const onSave = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );

    const { rerender } = render(<Probe value={1} onSave={onSave} delayMs={500} />);
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenLastCalledWith(1);

    // Value changes while the first save is still pending.
    rerender(<Probe value={42} onSave={onSave} delayMs={500} />);
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // First save is still in flight — the debounce timer fired but the doSave
    // call sees inFlight and queues a follow-up rather than starting a parallel
    // save.
    expect(onSave).toHaveBeenCalledTimes(1);

    // Resolve the first save. The follow-up should now run.
    await act(async () => {
      resolveSave?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave).toHaveBeenLastCalledWith(42);
  });
});
