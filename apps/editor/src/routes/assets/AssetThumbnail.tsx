import { useEffect, useRef, useState } from 'react';
import { useAssetPreviewUrl } from '../../hooks/useAssetPreviewUrl';

interface AssetThumbnailProps {
  portfolioId: string;
  assetId: string;
  contentType: string;
  alt: string;
}

type LoadState = 'idle' | 'loading' | 'error';

export function AssetThumbnail({ portfolioId, assetId, contentType, alt }: AssetThumbnailProps) {
  const preview = useAssetPreviewUrl(portfolioId, assetId);
  const isImage = contentType.startsWith('image/');
  const isPdf = contentType === 'application/pdf';

  if (preview.isLoading) {
    return <ThumbnailFrame>Loading…</ThumbnailFrame>;
  }
  if (preview.isError || !preview.data) {
    return <ThumbnailFrame variant="error">No preview</ThumbnailFrame>;
  }

  if (isImage) {
    return (
      <ImageThumbnail url={preview.data.url} alt={alt} onRefresh={() => void preview.refresh()} />
    );
  }
  if (isPdf) {
    return <PdfThumbnail url={preview.data.url} onRefresh={() => void preview.refresh()} />;
  }
  return <ThumbnailFrame>{contentType}</ThumbnailFrame>;
}

interface ChildThumbnailProps {
  url: string;
  alt?: string;
  onRefresh: () => void;
}

function ImageThumbnail({ url, alt, onRefresh }: ChildThumbnailProps) {
  // One auto-retry on load error to absorb expired URLs; second failure shows
  // the error fallback. Tracked per-mount so a successful load resets the budget.
  const [retried, setRetried] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setRetried(false);
    setErrored(false);
  }, [url]);

  if (errored) {
    return <ThumbnailFrame variant="error">Preview unavailable</ThumbnailFrame>;
  }

  return (
    <ThumbnailFrame>
      <img
        src={url}
        alt={alt}
        className="h-full w-full object-cover"
        onError={() => {
          if (retried) {
            setErrored(true);
            return;
          }
          setRetried(true);
          onRefresh();
        }}
      />
    </ThumbnailFrame>
  );
}

function PdfThumbnail({ url, onRefresh }: ChildThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [retried, setRetried] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState('loading');

    void (async () => {
      try {
        // Lazy-load pdf.js so the ~400KB dependency only enters the bundle when
        // a PDF preview is actually rendered. Users with image-only libraries
        // never download it.
        const { ensurePdfjsWorker, pdfjsLib } = await import('../../lib/pdfjsWorker');
        ensurePdfjsWorker();
        const doc = await pdfjsLib.getDocument({ url, withCredentials: false }).promise;
        if (cancelled) return;
        const page = await doc.getPage(1);
        const canvas = canvasRef.current;
        if (!canvas) return;
        // Render at the canvas's intrinsic CSS size — the parent container
        // sizes the box, we just compute a viewport that fits.
        const baseViewport = page.getViewport({ scale: 1 });
        const targetWidth = canvas.clientWidth || 200;
        const scale = targetWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        if (!cancelled) setState('idle');
      } catch {
        if (cancelled) return;
        if (!retried) {
          setRetried(true);
          onRefresh();
        } else {
          setState('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, retried, onRefresh]);

  if (state === 'error') {
    return <ThumbnailFrame variant="error">Preview unavailable</ThumbnailFrame>;
  }

  return (
    <ThumbnailFrame>
      <canvas ref={canvasRef} className="h-full w-full object-cover" />
      {state === 'loading' ? (
        <span className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
          Rendering PDF…
        </span>
      ) : null}
    </ThumbnailFrame>
  );
}

function ThumbnailFrame({ children, variant }: { children: React.ReactNode; variant?: 'error' }) {
  return (
    <div
      className={`relative mb-2 flex h-32 items-center justify-center overflow-hidden rounded text-xs uppercase ${
        variant === 'error' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'
      }`}
    >
      {children}
    </div>
  );
}
