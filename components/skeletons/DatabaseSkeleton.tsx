import { Skeleton } from '@/components/ui/skeleton';

const COLUMN_WIDTHS = ['w-[30%]', 'w-[20%]', 'w-[35%]', 'w-[10%]'];

const ROW_PATTERNS: Array<[string, string, string, string]> = [
  ['w-3/4', 'w-2/3', 'w-4/5', 'w-1/2'],
  ['w-1/2', 'w-3/4', 'w-3/5', 'w-2/3'],
  ['w-4/5', 'w-1/2', 'w-2/3', 'w-1/3'],
  ['w-2/3', 'w-4/5', 'w-1/2', 'w-3/5'],
  ['w-3/5', 'w-1/3', 'w-3/4', 'w-2/3'],
  ['w-4/5', 'w-2/3', 'w-1/2', 'w-1/2'],
  ['w-1/2', 'w-3/5', 'w-4/5', 'w-1/3'],
  ['w-2/3', 'w-1/2', 'w-3/5', 'w-3/4'],
];

export function DatabaseSkeleton() {
  return (
    <div className="flex flex-col h-full bg-[var(--bg-subtle)]">

      {/* Header */}
      <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-md flex-shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-44 rounded" />
            <Skeleton className="h-3 w-60 rounded" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-[var(--bg)] border-b border-[var(--border)] px-6 py-3 flex items-center gap-3 flex-shrink-0">
        <Skeleton className="h-9 w-72 rounded-md" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>

      {/* Table */}
      <div className="flex-grow overflow-hidden flex flex-col mx-6 my-5 rounded-xl border border-[var(--border)] bg-[var(--bg)]">

        {/* Table header */}
        <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] flex-shrink-0">
          <div className="flex px-4 py-2.5 gap-4">
            {COLUMN_WIDTHS.map((w, i) => (
              <div key={i} className={w}>
                <Skeleton className="h-3 w-20 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-[var(--border-subtle)]">
          {ROW_PATTERNS.map((cols, rowIdx) => (
            <div key={rowIdx} className="flex items-center px-4 py-2.5 gap-4">
              {cols.map((width, colIdx) => (
                <div key={colIdx} className={COLUMN_WIDTHS[colIdx]}>
                  <Skeleton className={`h-3.5 ${width} rounded`} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
