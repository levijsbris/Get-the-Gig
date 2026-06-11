// Configure pdf.js worker. Vite resolves the worker URL through ?url so it ends
// up next to the bundle at build time and doesn't need to be served separately.
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

let configured = false;

export function ensurePdfjsWorker() {
  if (configured) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
  configured = true;
}

export { pdfjsLib };
