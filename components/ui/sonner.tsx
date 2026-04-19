'use client';

import { useTheme } from 'next-themes';
import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  const { resolvedTheme } = useTheme();

  return (
    <SonnerToaster
      position="bottom-right"
      theme={resolvedTheme as 'light' | 'dark'}
      toastOptions={{
        classNames: {
          toast:       'group flex items-start gap-3 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-4 py-3 shadow-lg text-sm text-[var(--text)]',
          title:       'font-medium text-[var(--text)]',
          description: 'text-[var(--text-muted)] text-xs mt-0.5',
          actionButton:'bg-[var(--primary-action)] text-white text-xs px-2 py-1 rounded',
          cancelButton:'bg-[var(--bg-muted)] text-[var(--text-secondary)] text-xs px-2 py-1 rounded',
          closeButton: 'text-[var(--text-faint)] hover:text-[var(--text-muted)]',
          error:       'border-l-4 border-l-red-500',
          success:     'border-l-4 border-l-green-500',
          warning:     'border-l-4 border-l-amber-500',
          info:        'border-l-4 border-l-[var(--primary-action)]',
        },
        duration: 4000,
      }}
      richColors={false}
      closeButton
    />
  );
}
