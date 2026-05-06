'use client';

import { Loader2 } from 'lucide-react';
import { useNavigationLoading } from '@/contexts/NavigationLoadingContext';

const formatTargetLabel = (href: string | null) => {
  if (!href) return 'Opening page...';
  if (href === '/') return 'Opening dashboard...';
  if (href.includes('/reports')) return 'Opening report...';
  if (href.includes('/project/')) return 'Opening project...';
  if (href.includes('/database')) return 'Opening database...';
  if (href.includes('/team')) return 'Opening team page...';
  if (href.includes('/settings')) return 'Opening settings...';
  return 'Opening page...';
};

export function RouteTransitionIndicator() {
  const { isNavigating, targetHref } = useNavigationLoading();

  if (!isNavigating) return null;

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-[70] h-1 overflow-hidden bg-[var(--primary-bg)] pointer-events-none">
        <div className="h-full w-1/3 animate-[route-loader_1.1s_ease-in-out_infinite] rounded-full bg-[var(--primary-action)]" />
      </div>
      <div className="fixed inset-0 z-[69] bg-black/16 backdrop-blur-[1px] pointer-events-none" />
      <div className="fixed inset-0 z-[71] flex items-center justify-center pointer-events-none px-4">
        <div className="flex min-w-[280px] max-w-[90vw] items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-6 py-5 shadow-2xl">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--primary-bg)]">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--primary-text-muted)]" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--text)]">{formatTargetLabel(targetHref)}</div>
            <div className="mt-0.5 text-xs text-[var(--text-muted)]">Loading the next screen and preparing data.</div>
          </div>
        </div>
      </div>
    </>
  );
}
