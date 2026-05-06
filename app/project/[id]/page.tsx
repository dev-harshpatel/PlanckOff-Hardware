'use client';

import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { RouteLoadingState } from '@/components/layout/RouteLoadingState';
import { useNavigationLoading } from '@/contexts/NavigationLoadingContext';
import { useProject } from '@/contexts/ProjectContext';
import { useToast } from '@/contexts/ToastContext';

// ssr: false — ProjectView imports components that use browser-only APIs (jsPDF, pdfjs, etc.)
const ProjectView = dynamic(() => import('@/views/ProjectView'), { ssr: false });

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { startNavigation } = useNavigationLoading();
  const { projects, projectsHydrated, updateProject, appSettings } = useProject();
  const { addToast } = useToast();

  const activeProject = projects.find((p) => p.id === id);

  if (!projectsHydrated) {
    return <RouteLoadingState title="Opening project" message="Loading project data and saved hardware information." />;
  }

  if (!activeProject) {
    return null;
  }

  return (
    <ProjectView
      project={activeProject}
      onProjectUpdate={updateProject}
      appSettings={appSettings}
      onBackToDashboard={() => {
        startNavigation('/');
        router.push('/');
      }}
      addToast={addToast}
    />
  );
}
