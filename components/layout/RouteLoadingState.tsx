'use client';

interface RouteLoadingStateProps {
  title?: string;
  message?: string;
}

export function RouteLoadingState({
  title = 'Loading page',
  message = 'Please wait while the latest project data is prepared.',
}: RouteLoadingStateProps) {
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center bg-[var(--bg-subtle)] px-6">
      <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 shadow-sm">
        <div className="relative h-7 w-7 flex-shrink-0 overflow-hidden">
          <div className="banter-loader">
            <div className="banter-loader__box" />
            <div className="banter-loader__box" />
            <div className="banter-loader__box" />
            <div className="banter-loader__box" />
            <div className="banter-loader__box" />
            <div className="banter-loader__box" />
            <div className="banter-loader__box" />
            <div className="banter-loader__box" />
            <div className="banter-loader__box" />
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-[var(--text)]">{title}</div>
          <div className="text-xs text-[var(--text-muted)]">{message}</div>
        </div>
      </div>
    </div>
  );
}
