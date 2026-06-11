import { useEffect, useRef, useState } from 'react';
import {
  useSoftDeletePortfolio,
  useUpdatePortfolio,
  type PortfolioSummary,
} from '../../hooks/usePortfolios';

interface PortfolioCardProps {
  portfolio: PortfolioSummary;
}

export function PortfolioCard({ portfolio }: PortfolioCardProps) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(portfolio.title);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const update = useUpdatePortfolio();
  const softDelete = useSoftDeletePortfolio();

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    setDraftTitle(portfolio.title);
  }, [portfolio.title]);

  async function commit() {
    const next = draftTitle.trim();
    setError(null);
    if (next === portfolio.title) {
      setEditing(false);
      return;
    }
    if (next.length === 0 || next.length > 200) {
      setError('Title must be 1-200 characters.');
      return;
    }
    try {
      await update.mutateAsync({ id: portfolio.id, title: next });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    }
  }

  function cancel() {
    setDraftTitle(portfolio.title);
    setError(null);
    setEditing(false);
  }

  async function onDelete() {
    if (!window.confirm(`Delete "${portfolio.title}"? You have 7 days to restore.`)) return;
    try {
      await softDelete.mutateAsync(portfolio.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  }

  return (
    <article className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void commit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancel();
              }
            }}
            className="w-full rounded border border-slate-300 px-2 py-1 text-base font-medium focus:border-slate-500 focus:outline-none"
            aria-label="Portfolio title"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-left text-base font-medium text-slate-900 hover:underline"
          >
            {portfolio.title || <span className="text-slate-400">(untitled)</span>}
          </button>
        )}
        <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
          /{portfolio.slug}
        </span>
      </div>
      {portfolio.description ? (
        <p className="text-sm text-slate-600">{portfolio.description}</p>
      ) : null}
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>Updated {new Date(portfolio.updatedAt).toLocaleString()}</span>
        <button
          type="button"
          onClick={onDelete}
          className="text-red-600 hover:text-red-700"
          disabled={softDelete.isPending}
        >
          {softDelete.isPending ? 'Deleting…' : 'Delete'}
        </button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </article>
  );
}
