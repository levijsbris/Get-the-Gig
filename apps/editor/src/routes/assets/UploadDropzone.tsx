import { useRef, useState } from 'react';
import { useUploadAsset } from '../../hooks/useAssets';
import { ApiError } from '../../lib/apiClient';
import { isAllowedContentType } from '../../lib/imageProcessing';

interface UploadDropzoneProps {
  portfolioId: string;
  disabled?: boolean;
}

interface UploadJob {
  id: string;
  filename: string;
  status: 'uploading' | 'done' | 'error';
  message?: string;
}

export function UploadDropzone({ portfolioId, disabled }: UploadDropzoneProps) {
  const upload = useUploadAsset(portfolioId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<UploadJob[]>([]);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      const jobId = `${file.name}-${Date.now()}-${Math.random()}`;
      if (!isAllowedContentType(file.type)) {
        setJobs((prev) => [
          ...prev,
          { id: jobId, filename: file.name, status: 'error', message: 'Unsupported file type.' },
        ]);
        continue;
      }
      setJobs((prev) => [...prev, { id: jobId, filename: file.name, status: 'uploading' }]);
      try {
        await upload.mutateAsync(file);
        setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: 'done' } : j)));
      } catch (err) {
        const message =
          err instanceof ApiError
            ? (err.body?.detail ?? err.body?.title ?? 'Upload failed.')
            : err instanceof Error
              ? err.message
              : 'Upload failed.';
        setJobs((prev) =>
          prev.map((j) => (j.id === jobId ? { ...j, status: 'error', message } : j)),
        );
      }
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600 hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {disabled ? 'Quota reached — delete assets to free space' : 'Click to choose files (JPEG, PNG, WebP, GIF, PDF)'}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {jobs.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {jobs.map((job) => (
            <li
              key={job.id}
              className={`flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2 text-xs ${
                job.status === 'error' ? 'border-red-300 bg-red-50' : ''
              }`}
            >
              <span className="truncate">{job.filename}</span>
              <span
                className={
                  job.status === 'done'
                    ? 'text-green-700'
                    : job.status === 'error'
                      ? 'text-red-700'
                      : 'text-slate-500'
                }
              >
                {job.status === 'done'
                  ? 'Uploaded'
                  : job.status === 'error'
                    ? (job.message ?? 'Failed')
                    : 'Uploading…'}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
