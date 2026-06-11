import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';

interface PreviewUrlEntry {
  assetId: string;
  url: string;
  expiresAt: string;
}

interface PreviewUrlsResponse {
  urls: PreviewUrlEntry[];
}

const previewKey = (portfolioId: string, assetId: string) =>
  ['asset-preview-url', portfolioId, assetId] as const;

/**
 * Per-asset preview URL hook. Keyed per asset id so each card has its own
 * cache lifetime — when one URL expires, only that card refetches; the
 * asset list query (metadata) is not invalidated.
 *
 * Implementation note: the backend endpoint is a batch (POST with a list of
 * asset ids) so a future optimization could collect visible cards' ids into a
 * single network call. For now each card sends a batch of one — simple, and
 * the cache stays per-asset which the asset-list churn avoidance needs.
 */
export function useAssetPreviewUrl(portfolioId: string, assetId: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: previewKey(portfolioId, assetId),
    queryFn: async () => {
      const response = await apiFetch<PreviewUrlsResponse>(
        `/api/portfolios/${portfolioId}/assets/preview-urls`,
        { method: 'POST', body: { assetIds: [assetId] } },
      );
      return response.urls.find((u) => u.assetId === assetId) ?? null;
    },
    enabled: !!portfolioId && !!assetId,
    // The backend ExpiresAt is 14m; refetch a minute earlier so callers get a
    // fresh URL before the in-flight image request would otherwise hit a
    // mid-load expiry. A long-running tab also re-fetches automatically.
    staleTime: 13 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  return {
    ...query,
    refresh: () => qc.invalidateQueries({ queryKey: previewKey(portfolioId, assetId) }),
  };
}
