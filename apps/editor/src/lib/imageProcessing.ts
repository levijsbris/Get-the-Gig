// Phase 3 client-side resize utility.
//
// JPEG/PNG: if the longest edge exceeds 2400px, downscale via canvas and re-encode
// as JPEG at quality 0.85. Reduces uploads dramatically for camera-resolution
// originals and converges on a single content type for the API.
//
// WebP / GIF / PDF: pass through untouched per the build plan.
//
// Phase 4 moves this util to packages/editor-kit alongside the crop UI.

export const MAX_EDGE_PX = 2400;
export const JPEG_QUALITY = 0.85;
export const PASSTHROUGH_CONTENT_TYPES = new Set<string>([
  'image/webp',
  'image/gif',
  'application/pdf',
]);
export const RESIZABLE_CONTENT_TYPES = new Set<string>(['image/jpeg', 'image/png']);

export interface ProcessedAsset {
  blob: Blob;
  contentType: string;
  width: number | null;
  height: number | null;
  /** True if we re-encoded the source (resize or PNG→JPEG conversion). */
  reencoded: boolean;
}

/** Compute the downscaled dimensions while preserving aspect ratio. */
export function computeResizedDimensions(
  width: number,
  height: number,
  maxEdge: number = MAX_EDGE_PX,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/** Pure: should this image be re-encoded through the canvas pipeline? */
export function shouldResize(contentType: string, width: number, height: number): boolean {
  if (!RESIZABLE_CONTENT_TYPES.has(contentType)) return false;
  return Math.max(width, height) > MAX_EDGE_PX;
}

export function isAllowedContentType(contentType: string): boolean {
  return PASSTHROUGH_CONTENT_TYPES.has(contentType) || RESIZABLE_CONTENT_TYPES.has(contentType);
}

/**
 * Process a File for upload. Pure function (deterministic per File contents) but
 * relies on the browser's canvas APIs — not callable in jsdom unit tests.
 */
export async function processImageForUpload(file: File): Promise<ProcessedAsset> {
  if (!isAllowedContentType(file.type)) {
    throw new Error(`Content type '${file.type}' is not allowed.`);
  }

  // PDFs: pass through. We don't have a dimension to report.
  if (file.type === 'application/pdf') {
    return { blob: file, contentType: file.type, width: null, height: null, reencoded: false };
  }

  // Images: measure dimensions first.
  const bitmap = await createImageBitmap(file);
  try {
    if (!shouldResize(file.type, bitmap.width, bitmap.height)) {
      return {
        blob: file,
        contentType: file.type,
        width: bitmap.width,
        height: bitmap.height,
        reencoded: false,
      };
    }

    const { width, height } = computeResizedDimensions(bitmap.width, bitmap.height);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2d canvas context');
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
    return {
      blob,
      contentType: 'image/jpeg',
      width,
      height,
      reencoded: true,
    };
  } finally {
    bitmap.close();
  }
}
