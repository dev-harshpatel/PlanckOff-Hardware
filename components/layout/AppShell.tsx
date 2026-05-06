'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { useProcessingWidget } from '@/contexts/ProcessingWidgetContext';
import { useNavigationLoading } from '@/contexts/NavigationLoadingContext';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import Header from '@/components/layout/Header';
import { RouteTransitionIndicator } from '@/components/layout/RouteTransitionIndicator';
import { Toaster } from '@/components/ui/sonner';
import UploadProgressWidget from '@/components/upload/UploadProgressWidget';
import KeyboardShortcutsHelpModal from '@/components/shared/KeyboardShortcutsHelpModal';
import { Loader2, CheckCircle2, Database, ChevronUp } from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const { user: currentUser, isAuthenticated, isLoading, logout } = useAuth();
  const { projects } = useProject();
  const { widget, expandModal } = useProcessingWidget();
  const { startNavigation } = useNavigationLoading();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch pending hardware count — refresh whenever processing completes or pathname changes
  useEffect(() => {
    if (!isAuthenticated) return;
    fetch('/api/master-hardware/pending', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((json: { data?: unknown[] } | null) => {
        if (json?.data) setPendingCount(json.data.length);
      })
      .catch(() => {});
  }, [isAuthenticated, pathname, widget.isProcessing]);

  useKeyboardShortcuts([
    {
      combo: 'shift+?',
      handler: () => setIsHelpOpen(true),
      global: true,
      description: 'Open Keyboard Shortcuts Help',
    },
  ]);

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec.toString().padStart(2, '0')}s` : `${sec}s`;
  };

  const handleWidgetClick = () => {
    if (widget.projectPath && pathname === widget.projectPath) {
      expandModal();
    } else if (widget.projectPath) {
      startNavigation(widget.projectPath);
      router.push(widget.projectPath);
    }
  };

  const getCurrentPage = () => {
    if (pathname === '/' || pathname.startsWith('/dashboard')) return 'dashboard';
    if (pathname.startsWith('/project')) return 'project';
    if (pathname.startsWith('/database')) return 'database';
    if (pathname.startsWith('/team')) return 'team';
    if (pathname.startsWith('/settings')) return 'settings';
    return 'dashboard';
  };

  const handleNavigate = (page: string) => {
    const href = page === 'dashboard' ? '/' : `/${page}`;
    startNavigation(href);
    router.push(href);
  };

  // Public paths — render without the shell
  const isPublicPath = pathname === '/login' || pathname.startsWith('/set-password');
  if (isPublicPath) return <>{children}</>;

  // Avoid hydration mismatch on first render
  if (!isMounted) return <>{children}</>;

  // Hydrating session
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-subtle)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary-action)]" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const activeProjectName = pathname.startsWith('/project/')
    ? projects.find((p) => p.id === pathname.split('/')[2])?.name
    : undefined;

  return (
    <div className="h-full flex flex-col bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
      <Toaster />
      <RouteTransitionIndicator />
      <UploadProgressWidget />

      <Header
        currentPage={getCurrentPage() as never}
        onNavigate={handleNavigate as never}
        projectName={activeProjectName}
        user={currentUser}
        onLogout={logout}
        pendingCount={pendingCount}
      />

      <main className="flex-1 min-h-0 overflow-hidden">{children}</main>

      {/* Global floating processing widget — visible everywhere when minimized */}
      {widget.isActive && widget.isMinimized && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={handleWidgetClick}
            className="flex items-center gap-3 bg-[var(--bg)] border border-[var(--border)] rounded-full shadow-lg px-4 py-3 hover:bg-[var(--bg-muted)] transition-colors group"
          >
            <div className="relative flex-shrink-0">
              {widget.isProcessing ? (
                <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
              ) : widget.progress === 100 ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Database className="h-4 w-4 text-[var(--text-muted)]" />
              )}
            </div>
            <div className="flex flex-col items-start min-w-0">
              <div className="flex items-center gap-2 w-full">
                <span className="text-xs font-medium text-[var(--text)] truncate max-w-[160px]">
                  {widget.step || 'Processing files…'}
                </span>
                {widget.isProcessing && (
                  <span className="flex-shrink-0 text-xs font-mono font-semibold text-blue-500 dark:text-blue-400 tabular-nums">
                    {formatElapsed(widget.elapsedSeconds)}
                  </span>
                )}
              </div>
              <div className="w-full h-1 bg-[var(--bg-muted)] rounded-full mt-1.5 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${widget.progress}%` }}
                />
              </div>
            </div>
            <ChevronUp className="h-3.5 w-3.5 text-[var(--text-muted)] group-hover:text-[var(--text)] flex-shrink-0" />
          </button>
        </div>
      )}

      <KeyboardShortcutsHelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
}
