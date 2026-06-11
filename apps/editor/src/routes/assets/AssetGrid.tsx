import { useState } from 'react';
import { type AssetSummary, useSoftDeleteAsset } from '../../hooks/useAssets';

interface AssetGridProps {
  portfolioId: string;
  assets: AssetSummary[];
}

export function AssetGrid({ portfolioId, assets }: AssetGridProps) {
  const softDelete = useSoftDeleteAsset(portfolioId);
  const [error, setError] = useState<string | null>(null);

  if (assets.length === 0) {
    return (
      <p className="rounded border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        No assets yet. Upload an image or PDF above.
      </p>
    );
  }

  async function onDelete(asset: AssetSummary) {
    setError(null);
    if (!window.confirm(`Delete "${asset.filename}"?`)) return;
    try {
      await softDelete.mutateAsync(asset.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {assets.map((asset) => (
          <article
            key={asset.id}
            className="flex flex-col rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
          >
            <div className="mb-2 flex h-32 items-center justify-center rounded bg-slate-100 text-xs uppercase text-slate-500">
              {asset.contentType.split('/')[1] ?? asset.contentType}
            </div>
            <p className="truncate text-sm font-medium text-slate-900">{asset.filename}</p>
            <p className="text-xs text-slate-500">
              {(asset.byteSize / 1024).toFixed(0)} KB
              {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ''}
            </p>
            <button
              type="button"
              onClick={() => onDelete(asset)}
              className="mt-2 self-start text-xs text-red-600 hover:text-red-700"
              disabled={softDelete.isPending}
            >
              Delete
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
