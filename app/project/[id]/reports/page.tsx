'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProject } from '@/contexts/ProjectContext';

// ssr: false — ReportsView imports export libraries (jsPDF, xlsx) that need browser APIs
const ReportsView = dynamic(() => import('@/views/ReportsView'), { ssr: false });

export default function ReportsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { projects, projectsHydrated } = useProject();

  const activeProject = projects.find((p) => p.id === id);

  useEffect(() => {
    if (!projectsHydrated) return;
    if (!activeProject) {
      router.replace('/');
    }
  }, [projectsHydrated, activeProject, router]);

  if (!projectsHydrated || !activeProject) {
    return null;
  }

  return (
    <ReportsView
      doors={activeProject.doors}
      hardwareSets={activeProject.hardwareSets}
      elevationTypes={activeProject.elevationTypes || []}
      projectName={activeProject.name}
    />
  );
}
