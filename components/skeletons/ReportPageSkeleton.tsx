import { Skeleton } from '@/components/ui/skeleton';

interface ReportPageSkeletonProps {
  badgeWidth?: string;
  rows?: number;
}

export function ReportPageSkeleton({
  badgeWidth = 'w-24',
  rows = 6,
}: ReportPageSkeletonProps) {
  return (
    <div className="bg-[var(--bg)] rounded-md border border-[var(--border)] overflow-hidden">
      <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-5 py-3 flex items-center gap-3">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-40 rounded" />
        <div className="ml-auto">
          <Skeleton className={`h-6 rounded-full ${badgeWidth}`} />
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
        </div>

        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
          <div className="border-b border-[var(--border)] p-4">
            <Skeleton className="h-5 w-56 rounded" />
          </div>
          <div className="p-4 space-y-3">
            {Array.from({ length: rows }).map((_, idx) => (
              <div key={idx} className="grid grid-cols-4 gap-3">
                <Skeleton className="h-4 rounded" />
                <Skeleton className="h-4 rounded" />
                <Skeleton className="h-4 rounded" />
                <Skeleton className="h-4 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
