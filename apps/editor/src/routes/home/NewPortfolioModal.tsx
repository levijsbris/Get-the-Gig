import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormField } from '../../components/FormField';
import { useCreatePortfolio } from '../../hooks/usePortfolios';
import { ApiError } from '../../lib/apiClient';
import { slugify } from '../../lib/slug';

const NewPortfolioSchema = z.object({
  title: z.string().min(1, 'Title is required.').max(200, 'Title is too long.'),
  slug: z
    .string()
    .regex(/^[a-z0-9-]{1,40}$/, 'Lowercase letters, digits, or hyphens. 1-40 characters.'),
  description: z.string().max(500, 'Description is too long.').optional(),
});
type NewPortfolioForm = z.infer<typeof NewPortfolioSchema>;

interface NewPortfolioModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
}

export function NewPortfolioModal({ open, onClose, onCreated }: NewPortfolioModalProps) {
  const create = useCreatePortfolio();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [slugDirty, setSlugDirty] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewPortfolioForm>({
    resolver: zodResolver(NewPortfolioSchema),
    defaultValues: { title: '', slug: '', description: '' },
  });

  const title = watch('title');

  useEffect(() => {
    if (!slugDirty) {
      setValue('slug', slugify(title ?? ''), { shouldValidate: false });
    }
  }, [title, slugDirty, setValue]);

  useEffect(() => {
    if (!open) {
      reset({ title: '', slug: '', description: '' });
      setSlugDirty(false);
      setSubmitError(null);
    }
  }, [open, reset]);

  async function onSubmit(values: NewPortfolioForm) {
    setSubmitError(null);
    try {
      const created = await create.mutateAsync(values);
      onCreated?.(created.id);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.body?.detail ?? err.body?.title ?? 'Create failed.');
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Create failed.');
      }
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-slate-900">New portfolio</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            label="Title"
            autoComplete="off"
            error={errors.title?.message}
            {...register('title')}
          />
          <FormField
            label="Slug"
            autoComplete="off"
            error={errors.slug?.message}
            hint={slugDirty ? 'Manual slug' : 'Auto-suggested from title'}
            {...register('slug', {
              onChange: () => setSlugDirty(true),
            })}
          />
          <FormField
            label="Description (optional)"
            autoComplete="off"
            error={errors.description?.message}
            {...register('description')}
          />
          {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating…' : 'Create portfolio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
