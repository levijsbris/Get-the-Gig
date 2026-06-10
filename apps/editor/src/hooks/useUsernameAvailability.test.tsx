import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();

vi.mock('../lib/apiClient', () => ({
  apiFetch: apiFetchMock,
  ApiError: class ApiError extends Error {},
}));

vi.mock('../lib/firebase', () => ({
  firebaseApp: {},
  firebaseAuth: { currentUser: null },
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useUsernameAvailability', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue({ available: true, reason: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not fetch until the username is at least 3 characters', async () => {
    const { useUsernameAvailability } = await import('./useUsernameAvailability');

    renderHook(({ value }) => useUsernameAvailability(value), {
      wrapper,
      initialProps: { value: 'ab' },
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('debounces calls and only fires once after the timeout', async () => {
    const { useUsernameAvailability } = await import('./useUsernameAvailability');

    const { rerender } = renderHook(({ value }) => useUsernameAvailability(value), {
      wrapper,
      initialProps: { value: 'al' },
    });

    rerender({ value: 'ali' });
    rerender({ value: 'alic' });
    rerender({ value: 'alice' });

    expect(apiFetchMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith(
      expect.stringContaining('username=alice'),
      expect.objectContaining({ anonymous: true }),
    );
  });
});
