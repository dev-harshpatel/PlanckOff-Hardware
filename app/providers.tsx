'use client';

import { ToastProvider } from '@/contexts/ToastContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { BackgroundUploadProvider } from '@/contexts/BackgroundUploadContext';
import { AnnouncementProvider } from '@/contexts/AnnouncementContext';

interface ProvidersProps {
  children: React.ReactNode;
}

/** Wraps the entire app in all global context providers. */
export function Providers({ children }: ProvidersProps) {
  return (
    <ToastProvider>
      <AuthProvider>
        <ProjectProvider>
          <BackgroundUploadProvider>
            <AnnouncementProvider>
              {children}
            </AnnouncementProvider>
          </BackgroundUploadProvider>
        </ProjectProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
