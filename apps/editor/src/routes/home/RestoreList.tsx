import { useState } from 'react';
import { useRestorePortfolio, type PortfolioSummary } from '../../hooks/usePortfolios';

interface RestoreListProps {
  portfolios: PortfolioSummary[];
}

export function RestoreList({ portfolios }: RestoreListProps) {
  const restore = useRestorePortfolio();
  const [error, setError] = useState<string | null>(null);

  const softDeleted = portfolios.filter((p) => p.softDeletedAt !== null);
  if (softDeleted.length === 0) {
    return (
      <p className="rounded border border-dashed border-slate-300 p-6 text-sm text-slate-500">
        Nothing to restore. Soft-deleted portfolios appear here for 7 days.
      </p>
    );
  }

  async function onRestore(id: string) {
    setError(null);
    try {
      await restore.mutateAsync(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed.');
    }
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {softDeleted.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div>
            <p className="text-base font-medium text-slate-900">{p.title || '(untitled)'}</p>
            <p className="text-xs text-slate-500">
              Deleted {p.softDeletedAt ? new Date(p.softDeletedAt).toLocaleString() : 'unknown'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRestore(p.id)}
            disabled={restore.isPending}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {restore.isPending ? 'Restoring…' : 'Restore'}
          </button>
        </div>
      ))}
    </div>
  );
}
