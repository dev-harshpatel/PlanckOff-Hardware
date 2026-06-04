'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProject } from '@/contexts/ProjectContext';
import { useNavigationLoading } from '@/contexts/NavigationLoadingContext';
import { useToast } from '@/contexts/ToastContext';
import { transformDoors } from '@/utils/hardwareTransformers';
import { ElevationUploadSkeleton } from '@/components/skeletons/ElevationUploadSkeleton';
import type { Door, ElevationType } from '@/types';

// ssr: false — uses canvas, pdfjs, and other browser-only APIs
const ElevationExtractorPage = dynamic(
  () => import('@/components/elevation/ElevationExtractorPage'),
  { ssr: false, loading: () => <ElevationUploadSkeleton /> },
);

export default function ElevationUploadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { projects, updateProject } = useProject();
  const { startNavigation } = useNavigationLoading();
  const { addToast } = useToast();

  const [doors, setDoors] = useState<Door[]>([]);
  const [loading, setLoading] = useState(true);

  const activeProject = projects.find(p => p.id === id);

  useEffect(() => {
    if (!id) return;

    async function loadDoors() {
      try {
        const [dsRes, hwRes] = await Promise.all([
          fetch(`/api/projects/${id}/door-schedule`),
          fetch(`/api/projects/${id}/hardware-pdf`),
        ]);
        const [dsJson, hwJson] = await Promise.all([dsRes.json(), hwRes.json()]);

        const { transformHardwareSets } = await import('@/utils/hardwareTransformers');
        const sets = hwJson?.data?.extractedJson ? transformHardwareSets(hwJson.data.extractedJson) : [];
        const loaded: Door[] = dsJson?.data?.scheduleJson
          ? transformDoors(dsJson.data.scheduleJson, sets)
          : [];

        setDoors(loaded);
      } catch (err) {
        console.error('[ElevationUploadPage] Failed to load doors:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDoors();
  }, [id]);

  if (loading || !activeProject) {
    return <ElevationUploadSkeleton />;
  }

  const navigateBack = () => {
    const href = `/project/${id}`;
    startNavigation(href);
    router.push(href);
  };

  const handleSave = async (newTypes: ElevationType[]) => {
    // Merge new/updated types into the project's existing list
    const current = activeProject.elevationTypes ?? [];
    const merged = [...current];
    for (const nt of newTypes) {
      const idx = merged.findIndex(et => et.id === nt.id || et.code === nt.code);
      if (idx >= 0) merged[idx] = { ...merged[idx], ...nt };
      else merged.push(nt);
    }

    // Optimistically update the in-memory project context
    updateProject({ ...activeProject, elevationTypes: merged });

    // Persist to the database
    try {
      await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elevationTypes: merged }),
      });
    } catch {
      // Non-critical — context is already updated locally
    }

    addToast({
      type: 'success',
      message: `${newTypes.length} elevation image${newTypes.length !== 1 ? 's' : ''} saved successfully.`,
    });
    navigateBack();
  };

  return (
    <ElevationExtractorPage
      projectId={id}
      doors={doors}
      existingElevationTypes={activeProject.elevationTypes ?? []}
      onSave={handleSave}
      onClose={navigateBack}
    />
  );
}
