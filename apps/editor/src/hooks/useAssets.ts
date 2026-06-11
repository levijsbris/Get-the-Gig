import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import { processImageForUpload } from '../lib/imageProcessing';

export interface AssetSummary {
  id: string;
  filename: string;
  contentType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  createdAt: string;
  softDeletedAt: string | null;
}

export interface ListAssetsResponse {
  assets: AssetSummary[];
  portfolioBytesUsed: number;
  portfolioBytesQuota: number;
  warnPortfolioQuota: boolean;
}

interface UploadUrlResponse {
  assetId: string;
  uploadUrl: string;
  uploadMethod: string;
  storagePath: string;
  portfolioBytesAfterUpload: number;
  portfolioBytesQuota: number;
  warnPortfolioQuota: boolean;
}

type AssetTypeFilter = 'all' | 'image' | 'pdf';

const assetsKey = (portfolioId: string, type: AssetTypeFilter) =>
  ['assets', portfolioId, type] as const;

export function useAssets(portfolioId: string, type: AssetTypeFilter = 'all') {
  return useQuery({
    queryKey: assetsKey(portfolioId, type),
    queryFn: () => {
      const qs = type === 'all' ? '' : `?type=${type}`;
      return apiFetch<ListAssetsResponse>(`/api/portfolios/${portfolioId}/assets${qs}`);
    },
    enabled: !!portfolioId,
  });
}

export function useUploadAsset(portfolioId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const processed = await processImageForUpload(file);

      const urlResponse = await apiFetch<UploadUrlResponse>(
        `/api/portfolios/${portfolioId}/assets/upload-url`,
        {
          method: 'POST',
          body: {
            filename: file.name,
            contentType: processed.contentType,
            byteSize: processed.blob.size,
            width: processed.width,
            height: processed.height,
          },
        },
      );

      // Step 2: direct upload to the storage emulator (or real GCS in prod).
      const uploadResponse = await fetch(urlResponse.uploadUrl, {
        method: urlResponse.uploadMethod,
        body: processed.blob,
        headers: { 'Content-Type': processed.contentType },
      });
      if (!uploadResponse.ok) {
        throw new Error(`Direct upload failed: ${uploadResponse.status}`);
      }

      // Step 3: confirm to the API, which HEADs the object then writes the asset doc.
      const asset = await apiFetch<AssetSummary>(
        `/api/portfolios/${portfolioId}/assets/${urlResponse.assetId}/confirm`,
        {
          method: 'POST',
          body: {
            filename: file.name,
            contentType: processed.contentType,
            byteSize: processed.blob.size,
            width: processed.width,
            height: processed.height,
          },
        },
      );
      return asset;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets', portfolioId] });
    },
  });
}

export function useSoftDeleteAsset(portfolioId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assetId: string) =>
      apiFetch<void>(`/api/portfolios/${portfolioId}/assets/${assetId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets', portfolioId] });
    },
  });
}
