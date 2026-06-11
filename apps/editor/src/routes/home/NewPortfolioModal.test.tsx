import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));

vi.mock('../../lib/apiClient', () => ({
  apiFetch: apiFetchMock,
  ApiError: class ApiError extends Error {},
}));

vi.mock('../../lib/firebase', () => ({
  firebaseApp: {},
  firebaseAuth: { currentUser: null },
}));

import { NewPortfolioModal } from './NewPortfolioModal';

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('NewPortfolioModal', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('auto-fills the slug from the title until the user edits it', async () => {
    render(<NewPortfolioModal open onClose={() => {}} />, { wrapper: Wrapper });

    const title = screen.getByLabelText(/^title$/i) as HTMLInputElement;
    const slug = screen.getByLabelText(/^slug$/i) as HTMLInputElement;

    fireEvent.change(title, { target: { value: 'My Resume' } });
    await waitFor(() => expect(slug.value).toBe('my-resume'));

    fireEvent.change(slug, { target: { value: 'custom-thing' } });
    fireEvent.change(title, { target: { value: 'Some Other Title' } });

    // The slug stays at the manually-set value once the user edits it.
    await waitFor(() => expect(slug.value).toBe('custom-thing'));
  });

  it('rejects an invalid slug before submitting', async () => {
    render(<NewPortfolioModal open onClose={() => {}} />, { wrapper: Wrapper });

    fireEvent.change(screen.getByLabelText(/^title$/i), { target: { value: 'Valid Title' } });
    fireEvent.change(screen.getByLabelText(/^slug$/i), { target: { value: 'BAD SLUG!' } });
    fireEvent.click(screen.getByRole('button', { name: /create portfolio/i }));

    await waitFor(() =>
      expect(screen.getByText(/lowercase letters, digits, or hyphens/i)).toBeInTheDocument(),
    );
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('calls the API with form values and closes on success', async () => {
    apiFetchMock.mockResolvedValue({ id: 'pid-1' });
    const onClose = vi.fn();
    const onCreated = vi.fn();
    render(<NewPortfolioModal open onClose={onClose} onCreated={onCreated} />, {
      wrapper: Wrapper,
    });

    fireEvent.change(screen.getByLabelText(/^title$/i), { target: { value: 'Resume' } });
    fireEvent.click(screen.getByRole('button', { name: /create portfolio/i }));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/portfolios',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ title: 'Resume', slug: 'resume' }),
      }),
    );
    expect(onCreated).toHaveBeenCalledWith('pid-1');
    expect(onClose).toHaveBeenCalled();
  });
});
