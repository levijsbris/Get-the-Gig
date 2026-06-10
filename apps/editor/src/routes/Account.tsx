import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { FormField } from '../components/FormField';
import { useAuth } from '../hooks/useAuth';
import { useUsernameAvailability } from '../hooks/useUsernameAvailability';
import { ApiError, apiFetch } from '../lib/apiClient';

const ChangeUsernameSchema = z.object({
  newUsername: z
    .string()
    .regex(/^[a-z0-9-]{3,30}$/, 'Lowercase letters, digits, or hyphens. 3-30 characters.'),
});
type ChangeUsernameForm = z.infer<typeof ChangeUsernameSchema>;

export function Account() {
  const { me, signOut, refetchMe } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSuccess, setUsernameSuccess] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ChangeUsernameForm>({ resolver: zodResolver(ChangeUsernameSchema) });

  const newUsername = watch('newUsername') ?? '';
  const availability = useUsernameAvailability(newUsername);

  if (!me) return null; // RequireAuth handles loading state.

  async function changeUsername(values: ChangeUsernameForm) {
    setUsernameError(null);
    setUsernameSuccess(null);
    try {
      await apiFetch('/api/auth/username', {
        method: 'POST',
        body: { newUsername: values.newUsername },
      });
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      await refetchMe();
      setUsernameSuccess(`Username changed to "${values.newUsername}".`);
      reset({ newUsername: '' });
    } catch (err) {
      if (err instanceof ApiError) {
        setUsernameError(err.body?.detail ?? err.body?.title ?? 'Change failed.');
      } else {
        setUsernameError(err instanceof Error ? err.message : 'Change failed.');
      }
    }
  }

  async function deleteAccount() {
    setDeleteError(null);
    if (!window.confirm('Delete your account? You have 7 days to restore it by signing back in.')) {
      return;
    }
    try {
      await apiFetch('/api/auth/account', { method: 'DELETE' });
      await signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed.');
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-2xl p-6 space-y-10">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Account</h1>
        <p className="mt-1 text-sm text-slate-600">
          Signed in as <strong>{me.email}</strong> · username <strong>{me.username}</strong>
        </p>
        <button
          type="button"
          onClick={() => signOut().then(() => navigate('/login'))}
          className="mt-2 text-sm text-slate-700 underline"
        >
          Sign out
        </button>
      </header>

      <section className="border-t pt-8">
        <h2 className="text-lg font-medium text-slate-900">Change username</h2>
        <p className="mb-4 text-sm text-slate-600">
          Old URLs at <code>portfoliopro.com/{me.username}/…</code> will 404 after the change.
        </p>
        <form onSubmit={handleSubmit(changeUsername)} className="space-y-3">
          <FormField
            label="New username"
            autoComplete="off"
            error={errors.newUsername?.message}
            hint={
              newUsername.length < 3
                ? '3-30 chars, lowercase letters/digits/hyphens'
                : availability.isStale || !availability.data
                  ? 'Checking…'
                  : availability.data.available
                    ? 'Available'
                    : (availability.data.reason ?? 'Unavailable')
            }
            {...register('newUsername')}
          />
          {usernameError ? <p className="text-sm text-red-600">{usernameError}</p> : null}
          {usernameSuccess ? <p className="text-sm text-green-700">{usernameSuccess}</p> : null}
          <button
            type="submit"
            disabled={isSubmitting || (availability.data && !availability.data.available)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving…' : 'Change username'}
          </button>
        </form>
      </section>

      <section className="border-t pt-8">
        <h2 className="text-lg font-medium text-slate-900">Delete account</h2>
        <p className="mb-4 text-sm text-slate-600">
          Soft-deletes immediately. Hard delete runs after a 7-day grace period; sign back in within
          that window to cancel.
        </p>
        <button
          type="button"
          onClick={deleteAccount}
          className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          Delete account
        </button>
        {deleteError ? <p className="mt-2 text-sm text-red-600">{deleteError}</p> : null}
      </section>
    </div>
  );
}
