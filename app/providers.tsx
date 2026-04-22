'use client';

import { ThemeProvider } from 'next-themes';
import { ToastProvider } from '@/contexts/ToastContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { BackgroundUploadProvider } from '@/contexts/BackgroundUploadContext';
import { AnnouncementProvider } from '@/contexts/AnnouncementContext';
import { ProcessingWidgetProvider } from '@/contexts/ProcessingWidgetContext';

interface ProvidersProps {
  children: React.ReactNode;
}

/** Wraps the entire app in all global context providers. */
export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ToastProvider>
        <AuthProvider>
          <ProjectProvider>
            <BackgroundUploadProvider>
              <ProcessingWidgetProvider>
                <AnnouncementProvider>
                  {children}
                </AnnouncementProvider>
              </ProcessingWidgetProvider>
            </BackgroundUploadProvider>
          </ProjectProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
