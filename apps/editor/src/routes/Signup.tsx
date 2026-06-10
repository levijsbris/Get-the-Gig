import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { FormField } from '../components/FormField';
import { useAuth } from '../hooks/useAuth';
import { useUsernameAvailability } from '../hooks/useUsernameAvailability';
import { ApiError, apiFetch } from '../lib/apiClient';

const SignupSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  username: z
    .string()
    .regex(/^[a-z0-9-]{3,30}$/, 'Lowercase letters, digits, or hyphens. 3-30 characters.'),
});
type SignupForm = z.infer<typeof SignupSchema>;

export function Signup() {
  const { signUp, refetchMe } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupForm>({ resolver: zodResolver(SignupSchema), mode: 'onChange' });

  const username = watch('username') ?? '';
  const availability = useUsernameAvailability(username);

  async function onSubmit(values: SignupForm) {
    setSubmitError(null);
    try {
      await signUp(values.email, values.password);
      await apiFetch('/api/auth/signup', {
        method: 'POST',
        body: { username: values.username },
      });
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      await refetchMe();
      navigate('/account', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.body?.detail ?? err.body?.title ?? 'Signup failed.');
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Signup failed.');
      }
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-md p-6">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Create your account</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <FormField
          label="Password"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <FormField
          label="Username"
          autoComplete="off"
          error={errors.username?.message}
          hint={<UsernameHint isStale={availability.isStale} data={availability.data} value={username} />}
          {...register('username')}
        />
        {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}
        <button
          type="submit"
          disabled={isSubmitting || (availability.data && !availability.data.available)}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        Already have an account?{' '}
        <Link to="/login" className="text-slate-900 underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function UsernameHint({
  value,
  data,
  isStale,
}: {
  value: string;
  data: { available: boolean; reason: string | null } | undefined;
  isStale: boolean;
}) {
  if (value.length < 3) return <>Pick something unique to you.</>;
  if (isStale || !data) return <>Checking…</>;
  if (data.available) return <span className="text-green-600">Available</span>;
  return <span className="text-red-600">{data.reason ?? 'Unavailable'}</span>;
}
