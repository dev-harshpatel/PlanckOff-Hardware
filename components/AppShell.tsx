'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useProject } from '@/contexts/ProjectContext';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import Header from '@/components/Header';
import ToastContainer from '@/components/ToastContainer';
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

  const { user: currentUser, isAuthenticated, isLoading } = useAuth();
  const { toasts, removeToast } = useToast();
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const activeProjectName = pathname.startsWith('/project/')
    ? projects.find((p) => p.id === pathname.split('/')[2])?.name
    : undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userRoleCompat = (currentUser?.role ?? 'Estimator') as any;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
      <UploadProgressWidget />

      <Header
        currentPage={getCurrentPage() as never}
        onNavigate={handleNavigate as never}
        projectName={activeProjectName}
        userRole={userRoleCompat}
      />

      <main>{children}</main>

      <KeyboardShortcutsHelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
}
