interface QuotaBarProps {
  used: number;
  quota: number;
  warn: boolean;
}

export function QuotaBar({ used, quota, warn }: QuotaBarProps) {
  const ratio = quota > 0 ? Math.min(used / quota, 1) : 0;
  const usedMb = (used / 1024 / 1024).toFixed(1);
  const quotaMb = (quota / 1024 / 1024).toFixed(0);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs text-slate-600">
        <span>
          {usedMb} MB used of {quotaMb} MB
        </span>
        {warn ? (
          <span className="font-medium text-amber-600">
            Approaching quota — consider deleting unused assets.
          </span>
        ) : null}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full transition-all ${warn ? 'bg-amber-500' : 'bg-slate-700'}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}
