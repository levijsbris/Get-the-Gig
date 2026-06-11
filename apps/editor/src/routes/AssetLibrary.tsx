import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAssets } from '../hooks/useAssets';
import { AssetGrid } from './assets/AssetGrid';
import { QuotaBar } from './assets/QuotaBar';
import { UploadDropzone } from './assets/UploadDropzone';

type Filter = 'all' | 'image' | 'pdf';

export function AssetLibrary() {
  const { id: portfolioId } = useParams<{ id: string }>();
  const [filter, setFilter] = useState<Filter>('all');
  const list = useAssets(portfolioId ?? '', filter);

  if (!portfolioId) {
    return <p className="p-6 text-sm text-red-600">Missing portfolio id.</p>;
  }

  const data = list.data;
  const quotaReached =
    data !== undefined &&
    data.portfolioBytesQuota > 0 &&
    data.portfolioBytesUsed >= data.portfolioBytesQuota;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <Link to="/" className="text-sm text-slate-500 hover:underline">
            ← Portfolios
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Asset library</h1>
        </div>
      </header>

      {data ? (
        <QuotaBar
          used={data.portfolioBytesUsed}
          quota={data.portfolioBytesQuota}
          warn={data.warnPortfolioQuota}
        />
      ) : null}

      <section className="mt-6">
        <UploadDropzone portfolioId={portfolioId} disabled={quotaReached} />
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <div
            role="tablist"
            className="flex gap-1 rounded-md border border-slate-200 bg-white p-1"
          >
            <FilterButton current={filter} value="all" setFilter={setFilter}>
              All
            </FilterButton>
            <FilterButton current={filter} value="image" setFilter={setFilter}>
              Images
            </FilterButton>
            <FilterButton current={filter} value="pdf" setFilter={setFilter}>
              PDFs
            </FilterButton>
          </div>
        </div>
        {list.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : list.isError ? (
          <p className="text-sm text-red-600">Failed to load assets.</p>
        ) : (
          <AssetGrid portfolioId={portfolioId} assets={data?.assets ?? []} />
        )}
      </section>
    </main>
  );
}

function FilterButton({
  current,
  value,
  setFilter,
  children,
}: {
  current: Filter;
  value: Filter;
  setFilter: (f: Filter) => void;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => setFilter(value)}
      role="tab"
      aria-selected={active}
      className={`rounded px-3 py-1 text-sm transition ${
        active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}
