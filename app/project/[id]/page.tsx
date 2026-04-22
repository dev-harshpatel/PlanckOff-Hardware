'use client';

import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useProject } from '@/contexts/ProjectContext';
import { useToast } from '@/contexts/ToastContext';

// ssr: false — ProjectView imports components that use browser-only APIs (jsPDF, pdfjs, etc.)
const ProjectView = dynamic(() => import('@/views/ProjectView'), { ssr: false });

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { projects, projectsHydrated, updateProject, appSettings } = useProject();
  const { addToast } = useToast();

  const activeProject = projects.find((p) => p.id === id);

  if (!projectsHydrated || !activeProject) {
    return null;
  }

  return (
    <ProjectView
      project={activeProject}
      onProjectUpdate={updateProject}
      appSettings={appSettings}
      onBackToDashboard={() => router.push('/')}
      addToast={addToast}
    />
  );
}
