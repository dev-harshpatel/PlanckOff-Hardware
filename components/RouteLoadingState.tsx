'use client';

import { Spinner } from '@/components/ui/spinner';

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
      <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-6 py-5 shadow-sm">
        <Spinner size="lg" className="text-[var(--primary-text-muted)]" />
        <div className="text-center">
          <div className="text-sm font-semibold text-[var(--text)]">{title}</div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">{message}</div>
        </div>
      </div>
    </div>
  );
}
