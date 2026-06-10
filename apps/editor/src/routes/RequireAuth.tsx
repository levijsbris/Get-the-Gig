import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function RequireAuth() {
  const { firebaseUser, status, me, meStatus } = useAuth();

  if (status === 'initializing') {
    return <div className="p-8 text-slate-500">Loading…</div>;
  }

  if (!firebaseUser) {
    return <Navigate to="/login" replace />;
  }

  if (meStatus === 'pending') {
    return <div className="p-8 text-slate-500">Loading account…</div>;
  }

  if (me && !me.hasAccount) {
    return <Navigate to="/signup/username" replace />;
  }

  return <Outlet />;
}
