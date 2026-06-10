import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiClient';

export interface AvailabilityResponse {
  available: boolean;
  reason: string | null;
}

export function useUsernameAvailability(username: string, debounceMs = 300) {
  const [debounced, setDebounced] = useState(username);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(username), debounceMs);
    return () => clearTimeout(handle);
  }, [username, debounceMs]);

  const trimmed = debounced.trim();
  const query = useQuery({
    queryKey: ['username-availability', trimmed],
    queryFn: () =>
      apiFetch<AvailabilityResponse>(
        `/api/auth/username/availability?username=${encodeURIComponent(trimmed)}`,
        { anonymous: true },
      ),
    enabled: trimmed.length >= 3,
    staleTime: 30_000,
    retry: false,
  });

  return {
    isChecking: query.isFetching,
    data: query.data,
    isStale: trimmed !== username,
  };
}
