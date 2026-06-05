'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { FileSpreadsheet } from 'lucide-react';
import type { Door, HardwareSet, ElevationType } from '@/types';
import { transformDoors, transformHardwareSets, transformFromFinalJson } from '@/utils/hardwareTransformers';
import { filterExcludedDoors } from '@/utils/reportFilters';
import type { MergedHardwareSet } from '@/lib/db/hardware';
import { ReportPageSkeleton } from '@/components/skeletons/ReportPageSkeleton';

function totalDoorQuantity(doors: Door[]): number {
  return doors.reduce((sum, d) => {
    const raw = (d.sections as unknown as Record<string, Record<string, string | undefined>> | undefined)
      ?.basic_information?.['QUANTITY'];
    const q = parseInt(raw ?? '', 10);
    return sum + (isNaN(q) || q < 1 ? 1 : q);
  }, 0);
}

const DoorScheduleConfig = dynamic(() => import('@/components/doorSchedule/DoorScheduleConfig'), { ssr: false });

export default function DoorScheduleReportPage() {
  const { id } = useParams<{ id: string }>();
  const [doors, setDoors] = useState<Door[]>([]);
  const [hardwareSets, setHardwareSets] = useState<HardwareSet[]>([]);
  const [elevationTypes, setElevationTypes] = useState<ElevationType[]>([]);
  const [projectName, setProjectName] = useState('');
  const [projectLocation, setProjectLocation] = useState('');
  const [projectProvince, setProjectProvince] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function load() {
      try {
        const [mergeRes, projRes] = await Promise.all([
          fetch(`/api/projects/${id}/hardware-merge`),
          fetch(`/api/projects/${id}`),
        ]);

        const [mergeJson, projJson] = await Promise.all([
          mergeRes.ok ? mergeRes.json() : null,
          projRes.ok ? projRes.json() : null,
        ]);

        setProjectName(projJson?.data?.name ?? '');
        setProjectLocation(projJson?.data?.location ?? '');
        setProjectProvince(projJson?.data?.province ?? '');
        setElevationTypes(projJson?.data?.elevationTypes ?? []);

        const finalData: MergedHardwareSet[] | undefined = mergeJson?.data?.finalJson;
        if (finalData && finalData.length > 0) {
          const { hardwareSets: sets, doors: loadedDoors } = transformFromFinalJson(finalData);
          setHardwareSets(sets);
          setDoors(filterExcludedDoors(loadedDoors));
          return;
        }

        // Fallback: raw sources (no finalJson yet — pre-pipeline state)
        const [dsRes, hwRes] = await Promise.all([
          fetch(`/api/projects/${id}/door-schedule`),
          fetch(`/api/projects/${id}/hardware-pdf`),
        ]);
        const [dsJson, hwJson] = await Promise.all([
          dsRes.ok ? dsRes.json() : null,
          hwRes.ok ? hwRes.json() : null,
        ]);

        const sets: HardwareSet[] = hwJson?.data?.extractedJson
          ? transformHardwareSets(hwJson.data.extractedJson)
          : [];
        setHardwareSets(sets);
        setDoors(
          dsJson?.data?.scheduleJson
            ? filterExcludedDoors(transformDoors(dsJson.data.scheduleJson, sets))
            : [],
        );
      } catch (err) {
        console.error('[DoorScheduleReport] Load failed:', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  if (loading) {
    return <ReportPageSkeleton badgeWidth="w-24" rows={8} />;
  }

  return (
    <div className="bg-[var(--bg)] rounded-md border border-[var(--border)] overflow-hidden">
      <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-5 py-3 flex items-center gap-3">
        <FileSpreadsheet className="h-4 w-4 text-[var(--primary-text-muted)]" />
        <h2 className="text-sm font-semibold text-[var(--text)]">Door-Frame Reports</h2>
        <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--primary-border)] text-[var(--primary-text)]">
          {totalDoorQuantity(doors)} doors
        </span>
      </div>

      <div className="p-5">
        <DoorScheduleConfig
          doors={doors}
          hardwareSets={hardwareSets}
          elevationTypes={elevationTypes}
          projectName={projectName}
          projectLocation={projectLocation}
          projectProvince={projectProvince}
        />
      </div>
    </div>
  );
}
