'use client';

import { useNavigationLoading } from '@/contexts/NavigationLoadingContext';

const formatTargetLabel = (href: string | null) => {
  if (!href) return 'Loading...';
  if (href === '/') return 'Opening dashboard...';
  if (href.includes('/reports')) return 'Opening report...';
  if (href.includes('/project/')) return 'Opening project...';
  if (href.includes('/database')) return 'Opening database...';
  if (href.includes('/team')) return 'Opening team page...';
  if (href.includes('/settings')) return 'Opening settings...';
  return 'Loading...';
};

export function RouteTransitionIndicator() {
  const { isNavigating, targetHref } = useNavigationLoading();

  if (!isNavigating) return null;

  return (
    <>
      {/* Full-screen blocker — sits on top with default pointer-events so clicks
          can't reach the page underneath while the route is transitioning. */}
      <div className="fixed inset-0 z-[71] flex items-center justify-center bg-black/16 backdrop-blur-[1px] cursor-wait">
        <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 shadow-2xl">
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
          <span className="text-xs font-medium text-[var(--text-secondary)]">{formatTargetLabel(targetHref)}</span>
        </div>
      </div>
    </>
  );
}
