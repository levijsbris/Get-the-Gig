import { useEffect, useState } from 'react';

type HealthStatus =
  | { state: 'loading' }
  | { state: 'ok'; status: string }
  | { state: 'error'; message: string };

export function App() {
  const [health, setHealth] = useState<HealthStatus>({ state: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/health')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as { status: string };
      })
      .then((body) => {
        if (!cancelled) setHealth({ state: 'ok', status: body.status });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setHealth({
            state: 'error',
            message: err instanceof Error ? err.message : String(err),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>PortfolioPro Editor</h1>
      <p>Phase 0 skeleton. API health: {renderHealth(health)}</p>
    </main>
  );
}

function renderHealth(h: HealthStatus): string {
  if (h.state === 'loading') return 'checking…';
  if (h.state === 'ok') return h.status;
  return `error (${h.message})`;
}
