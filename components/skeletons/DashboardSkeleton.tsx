import { Skeleton } from '@/components/ui/skeleton';

const COLUMNS = [
  { cards: 3 },
  { cards: 2 },
  { cards: 1 },
  { cards: 2 },
  { cards: 1 },
];

function SkeletonCard() {
  return (
    <div className="bg-[var(--bg)] rounded-md border border-[var(--border)] p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-3/4 rounded" />
          <Skeleton className="h-3 w-1/2 rounded" />
        </div>
      </div>
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="h-3 w-16 rounded" />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="h-5 w-16 rounded" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col h-full bg-[var(--bg-subtle)]">

      {/* Header */}
      <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-md" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-3 w-52 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
        </div>

        {/* Stat pills */}
        <div className="flex items-center gap-2 mt-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-md" />
          ))}
          <Skeleton className="h-8 w-20 rounded-md ml-auto" />
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-[var(--bg)] border-b border-[var(--border)] px-6 py-3 flex items-center gap-3 flex-shrink-0">
        <Skeleton className="h-9 w-64 rounded-md" />
        <Skeleton className="h-9 w-48 rounded-md" />
        <div className="ml-auto flex items-center gap-1">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>

      {/* Kanban columns */}
      <div className="flex-grow overflow-x-auto overflow-y-hidden px-6 py-5">
        <div className="flex gap-4 h-full min-w-[1200px]">
          {COLUMNS.map((col, colIdx) => (
            <div
              key={colIdx}
              className="flex-1 min-w-[240px] flex flex-col h-full rounded-md overflow-hidden border border-[var(--border)]"
            >
              {/* Column header */}
              <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-4 py-2.5 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-2 h-2 rounded-full" />
                  <Skeleton className="h-3 w-20 rounded" />
                </div>
                <Skeleton className="h-5 w-6 rounded" />
              </div>

              {/* Cards */}
              <div className="flex-grow bg-[var(--bg-subtle)] p-2.5 space-y-2 overflow-hidden">
                {Array.from({ length: col.cards }).map((_, cardIdx) => (
                  <SkeletonCard key={cardIdx} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
