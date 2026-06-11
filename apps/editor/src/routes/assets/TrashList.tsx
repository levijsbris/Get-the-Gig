import { useState } from 'react';
import { type AssetSummary, useRestoreAsset } from '../../hooks/useAssets';
import { ApiError } from '../../lib/apiClient';

interface TrashListProps {
  portfolioId: string;
  assets: AssetSummary[];
}

export function TrashList({ portfolioId, assets }: TrashListProps) {
  const restore = useRestoreAsset(portfolioId);
  const [error, setError] = useState<string | null>(null);

  const trashed = assets.filter((a) => a.softDeletedAt !== null);
  if (trashed.length === 0) {
    return (
      <p className="rounded border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        Nothing in trash. Soft-deleted assets appear here for 7 days.
      </p>
    );
  }

  async function onRestore(id: string) {
    setError(null);
    try {
      await restore.mutateAsync(id);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body?.detail ?? err.body?.title ?? 'Restore failed.');
      } else {
        setError(err instanceof Error ? err.message : 'Restore failed.');
      }
    }
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {trashed.map((asset) => (
        <div
          key={asset.id}
          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="min-w-0">
            <p className="truncate text-base font-medium text-slate-900">{asset.filename}</p>
            <p className="text-xs text-slate-500">
              {(asset.byteSize / 1024).toFixed(0)} KB · deleted{' '}
              {asset.softDeletedAt ? new Date(asset.softDeletedAt).toLocaleString() : 'unknown'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRestore(asset.id)}
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
