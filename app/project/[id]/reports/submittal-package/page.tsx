'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useProject } from '@/contexts/ProjectContext';
import { useEffect, useState } from 'react';
import type { MergedHardwareSet, MergedDoor } from '@/lib/db/hardware';
import type { HardwareSet, Door } from '@/types';
import { transformHardwareSets, transformDoors } from '@/utils/hardwareTransformers';
import { Package } from 'lucide-react';
import { ReportPageSkeleton } from '@/components/skeletons/ReportPageSkeleton';

const SubmittalGenerator = dynamic(() => import('@/components/submittals/SubmittalGenerator'), { ssr: false });

function reconstructFinalJson(hardwareSets: HardwareSet[], doors: Door[]): MergedHardwareSet[] {
  return hardwareSets
    .filter(set => set.items?.length > 0)
    .map((set): MergedHardwareSet => {
      const matchedDoors = doors.filter(
        d =>
          d.assignedHardwareSet?.id === set.id ||
          d.assignedHardwareSet?.name === set.name ||
          d.providedHardwareSet === set.name,
      );

      const mergedDoors: MergedDoor[] = matchedDoors.map((door): MergedDoor => ({
        doorTag: door.doorTag,
        hwSet: door.providedHardwareSet ?? set.name,
        matchedSetName: set.name,
        quantity: door.quantity,
        doorLocation: door.location,
        fireRating: door.fireRating,
        doorWidth: door.width ? String(door.width) : undefined,
        doorHeight: door.height ? String(door.height) : undefined,
        thickness: door.thickness ? String(door.thickness) : undefined,
        doorMaterial: door.doorMaterial,
        frameMaterial: door.frameMaterial as string | undefined,
        excludeReason: door.excludeReason,
        sections: door.sections as MergedDoor['sections'],
      }));

      return {
        setName: set.name,
        notes: set.description ?? '',
        hardwareItems: set.items.map(item => ({
          qty: item.quantity,
          item: item.name,
          manufacturer: item.manufacturer ?? '',
          description: item.description ?? '',
          finish: item.finish ?? '',
          multipliedQuantity: item.multipliedQuantity,
        })),
        doors: mergedDoors,
      };
    });
}

export default function SubmittalPackagePage() {
  const { id } = useParams<{ id: string }>();
  const { projects } = useProject();
  const activeProject = projects.find((p) => p.id === id);

  const [finalJson, setFinalJson] = useState<MergedHardwareSet[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'api' | 'fallback' | null>(null);

  useEffect(() => {
    if (!id || !activeProject) return;
    setLoading(true);

    fetch(`/api/projects/${id}/hardware-merge`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(async (json: { data?: { finalJson?: MergedHardwareSet[] } | null } | null) => {
        const apiData = json?.data?.finalJson;

        if (apiData && apiData.length > 0) {
          setFinalJson(apiData);
          setSource('api');
          return;
        }

        const [hwRes, dsRes] = await Promise.all([
          fetch(`/api/projects/${id}/hardware-pdf`, { credentials: 'include' }),
          fetch(`/api/projects/${id}/door-schedule`, { credentials: 'include' }),
        ]);

        const hwJson = hwRes.ok ? await hwRes.json() : null;
        const dsJson = dsRes.ok ? await dsRes.json() : null;

        const sets = hwJson?.data?.extractedJson
          ? transformHardwareSets(hwJson.data.extractedJson)
          : [];

        const loadedDoors = dsJson?.data?.scheduleJson
          ? transformDoors(dsJson.data.scheduleJson, sets)
          : [];

        const reconstructed = reconstructFinalJson(sets, loadedDoors);
        setFinalJson(reconstructed);
        setSource(reconstructed.length > 0 ? 'fallback' : null);

        if (reconstructed.length > 0) {
          fetch(`/api/projects/${id}/hardware-merge`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ finalJson: reconstructed }),
          }).catch(() => {});
        }
      })
      .catch(async () => {
        try {
          const [hwRes, dsRes] = await Promise.all([
            fetch(`/api/projects/${id}/hardware-pdf`, { credentials: 'include' }),
            fetch(`/api/projects/${id}/door-schedule`, { credentials: 'include' }),
          ]);
          const hwJson = hwRes.ok ? await hwRes.json() : null;
          const dsJson = dsRes.ok ? await dsRes.json() : null;
          const sets = hwJson?.data?.extractedJson ? transformHardwareSets(hwJson.data.extractedJson) : [];
          const loadedDoors = dsJson?.data?.scheduleJson ? transformDoors(dsJson.data.scheduleJson, sets) : [];
          const reconstructed = reconstructFinalJson(sets, loadedDoors);
          setFinalJson(reconstructed);
          setSource(reconstructed.length > 0 ? 'fallback' : null);
        } catch {
          setFinalJson([]);
          setSource(null);
        }
      })
      .finally(() => setLoading(false));
  }, [id, activeProject?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!activeProject) return null;

  const setCount = finalJson?.length ?? 0;
  const doorCount = finalJson?.reduce((s, set) => s + set.doors.length, 0) ?? 0;

  if (loading) {
    return <ReportPageSkeleton badgeWidth="w-36" rows={6} />;
  }

  return (
    <div className="bg-[var(--bg)] rounded-md border border-[var(--border)] overflow-hidden flex flex-col h-[calc(100vh-8rem)]">
      <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-5 py-3 flex items-center gap-3 flex-shrink-0">
        <Package className="h-4 w-4 text-[var(--primary-text-muted)]" />
        <h2 className="text-sm font-semibold text-[var(--text)]">Submittal Package</h2>
        {finalJson && (
          <>
            <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--primary-border)] text-[var(--primary-text)]">
              {setCount} sets · {doorCount} doors
            </span>
            {source === 'fallback' && (
              <span className="text-xs px-2 py-0.5 rounded bg-[var(--warning-bg)] text-[var(--warning-text)] border border-[var(--warning-border)]">
                Run the merge pipeline for full data
              </span>
            )}
          </>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        {finalJson && finalJson.length > 0 && (
          <SubmittalGenerator
            finalJson={finalJson}
            projectName={activeProject.name}
          />
        )}
        {(!finalJson || finalJson.length === 0) && (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-[var(--text-muted)]">
            <p>No hardware sets found in final JSON</p>
            <p className="text-xs">Run the merge pipeline first to generate the submittal package.</p>
          </div>
        )}
      </div>
    </div>
  );
}
