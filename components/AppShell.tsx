'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import Header from '@/components/Header';
import { Toaster } from '@/components/ui/sonner';
import UploadProgressWidget from '@/components/UploadProgressWidget';
import KeyboardShortcutsHelpModal from '@/components/KeyboardShortcutsHelpModal';

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

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useKeyboardShortcuts([
    {
      combo: 'shift+?',
      handler: () => setIsHelpOpen(true),
      global: true,
      description: 'Open Keyboard Shortcuts Help',
    },
  ]);

  const getCurrentPage = () => {
    if (pathname === '/' || pathname.startsWith('/dashboard')) return 'dashboard';
    if (pathname.startsWith('/project')) return 'project';
    if (pathname.startsWith('/database')) return 'database';
    if (pathname.startsWith('/team')) return 'team';
    return 'dashboard';
  };

  const handleNavigate = (page: string) => {
    if (page === 'dashboard') router.push('/');
    else router.push(`/${page}`);
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
      <UploadProgressWidget />

      <Header
        currentPage={getCurrentPage() as never}
        onNavigate={handleNavigate as never}
        projectName={activeProjectName}
        user={currentUser}
        onLogout={logout}
      />

      <main className="flex-1 min-h-0 overflow-hidden">{children}</main>

      <KeyboardShortcutsHelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
}
