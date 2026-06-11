import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePortfolios } from '../hooks/usePortfolios';
import { useAuth } from '../hooks/useAuth';
import { NewPortfolioModal } from './home/NewPortfolioModal';
import { PortfolioCard } from './home/PortfolioCard';
import { RestoreList } from './home/RestoreList';

type Tab = 'active' | 'restore';

export function Home() {
  const { me, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('active');
  const [modalOpen, setModalOpen] = useState(false);
  const portfolios = usePortfolios(tab === 'restore');

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {me?.username ? `${me.username}'s portfolios` : 'Portfolios'}
          </h1>
          {me?.email ? (
            <p className="text-sm text-slate-500">{me.email}</p>
          ) : null}
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <Link to="/account" className="text-slate-700 hover:underline">
            Account
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-slate-700 hover:underline"
          >
            Sign out
          </button>
        </nav>
      </header>

      <div className="mb-4 flex items-center justify-between">
        <div role="tablist" className="flex gap-1 rounded-md border border-slate-200 bg-white p-1">
          <TabButton current={tab} value="active" setTab={setTab}>
            Active
          </TabButton>
          <TabButton current={tab} value="restore" setTab={setTab}>
            Restore
          </TabButton>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          New portfolio
        </button>
      </div>

      {portfolios.isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : portfolios.isError ? (
        <p className="text-sm text-red-600">Failed to load portfolios.</p>
      ) : tab === 'active' ? (
        <ActivePortfolioList portfolios={portfolios.data ?? []} onCreate={() => setModalOpen(true)} />
      ) : (
        <RestoreList portfolios={portfolios.data ?? []} />
      )}

      <NewPortfolioModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </main>
  );
}

function TabButton({
  current,
  value,
  setTab,
  children,
}: {
  current: Tab;
  value: Tab;
  setTab: (t: Tab) => void;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => setTab(value)}
      className={`rounded px-3 py-1.5 text-sm transition ${
        active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}

function ActivePortfolioList({
  portfolios,
  onCreate,
}: {
  portfolios: ReturnType<typeof usePortfolios>['data'];
  onCreate: () => void;
}) {
  const active = portfolios?.filter((p) => p.softDeletedAt === null) ?? [];
  if (active.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center">
        <p className="text-sm text-slate-600">No portfolios yet.</p>
        <button
          type="button"
          onClick={onCreate}
          className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Create your first portfolio
        </button>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {active.map((p) => (
        <PortfolioCard key={p.id} portfolio={p} />
      ))}
    </div>
  );
}
