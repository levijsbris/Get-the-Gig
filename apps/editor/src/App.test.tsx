import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App } from './App';

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok' }),
      }),
    );
  });

  it('renders the editor heading and reports API health', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /portfoliopro editor/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/api health: ok/i)).toBeInTheDocument());
  });
});
