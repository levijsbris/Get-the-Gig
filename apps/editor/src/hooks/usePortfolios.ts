import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';

export interface PortfolioSummary {
  id: string;
  title: string;
  slug: string;
  description: string;
  isPublished: boolean;
  requiresPassword: boolean;
  updatedAt: string;
  createdAt: string;
  softDeletedAt: string | null;
}

interface ListPortfoliosResponse {
  portfolios: PortfolioSummary[];
}

interface CreatePortfolioInput {
  title: string;
  slug: string;
  description?: string;
}

interface UpdatePortfolioInput {
  id: string;
  title?: string;
  description?: string;
  slug?: string;
}

const portfoliosKey = (includeDeleted: boolean) => ['portfolios', { includeDeleted }] as const;

export function usePortfolios(includeDeleted = false) {
  return useQuery({
    queryKey: portfoliosKey(includeDeleted),
    queryFn: async () => {
      const path = includeDeleted ? '/api/portfolios?includeDeleted=true' : '/api/portfolios';
      const body = await apiFetch<ListPortfoliosResponse>(path);
      return body.portfolios;
    },
  });
}

export function useCreatePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePortfolioInput) =>
      apiFetch<PortfolioSummary>('/api/portfolios', { method: 'POST', body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolios'] });
    },
  });
}

export function useUpdatePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...rest }: UpdatePortfolioInput) =>
      apiFetch<PortfolioSummary>(`/api/portfolios/${id}`, { method: 'PATCH', body: rest }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolios'] });
    },
  });
}

export function useSoftDeletePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/portfolios/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolios'] });
    },
  });
}

export function useRestorePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<PortfolioSummary>(`/api/portfolios/${id}/restore`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolios'] });
    },
  });
}
