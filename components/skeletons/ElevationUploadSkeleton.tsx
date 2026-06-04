import { Skeleton } from '@/components/ui/skeleton';

export function ElevationUploadSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Upload zone */}
      <Skeleton className="h-20 w-full rounded-xl" />

      {/* Door Elevations section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-3 rounded" />
          <Skeleton className="h-3 w-36 rounded" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-xl border border-[var(--border)] p-3">
              <Skeleton className="w-full aspect-[3/4] rounded-lg" />
              <Skeleton className="h-3.5 w-10 rounded" />
              <Skeleton className="h-7 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>

      {/* Frame Elevations section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-3 rounded" />
          <Skeleton className="h-3 w-40 rounded" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-xl border border-[var(--border)] p-3">
              <Skeleton className="w-full aspect-[3/4] rounded-lg" />
              <Skeleton className="h-3.5 w-10 rounded" />
              <Skeleton className="h-7 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
