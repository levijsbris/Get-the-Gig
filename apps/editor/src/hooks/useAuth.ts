import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import { useAuthStore } from '../stores/auth';

export interface MeResponse {
  uid: string;
  email: string;
  username: string | null;
  hasAccount: boolean;
}

export function useAuth() {
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const status = useAuthStore((s) => s.status);
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const signOut = useAuthStore((s) => s.signOut);

  const me = useQuery({
    queryKey: ['me', firebaseUser?.uid],
    queryFn: () => apiFetch<MeResponse>('/api/auth/me'),
    enabled: !!firebaseUser,
    retry: false,
    staleTime: 60_000,
  });

  return {
    firebaseUser,
    status,
    me: me.data,
    meStatus: me.status,
    refetchMe: me.refetch,
    signIn,
    signUp,
    signOut,
  };
}
