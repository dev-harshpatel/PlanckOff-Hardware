'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { FileSpreadsheet } from 'lucide-react';
import type { Door, HardwareSet, ElevationType } from '@/types';
import { transformDoors, transformHardwareSets } from '@/utils/hardwareTransformers';

function totalDoorQuantity(doors: Door[]): number {
  return doors.reduce((sum, d) => {
    const raw = (d.sections as unknown as Record<string, Record<string, string | undefined>> | undefined)
      ?.basic_information?.['QUANTITY'];
    const q = parseInt(raw ?? '', 10);
    return sum + (isNaN(q) || q < 1 ? 1 : q);
  }, 0);
}

const DoorScheduleConfig = dynamic(() => import('@/components/DoorScheduleConfig'), { ssr: false });

export default function DoorScheduleReportPage() {
  const { id } = useParams<{ id: string }>();
  const [doors, setDoors] = useState<Door[]>([]);
  const [hardwareSets, setHardwareSets] = useState<HardwareSet[]>([]);
  const [elevationTypes, setElevationTypes] = useState<ElevationType[]>([]);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function load() {
      try {
        const [dsRes, hwRes, projRes] = await Promise.all([
          fetch(`/api/projects/${id}/door-schedule`),
          fetch(`/api/projects/${id}/hardware-pdf`),
          fetch(`/api/projects/${id}`),
        ]);

        const [dsJson, hwJson, projJson] = await Promise.all([
          dsRes.json(),
          hwRes.json(),
          projRes.json(),
        ]);

        const sets: HardwareSet[] = hwJson?.data?.extractedJson
          ? transformHardwareSets(hwJson.data.extractedJson)
          : [];

        const loadedDoors: Door[] = dsJson?.data?.scheduleJson
          ? transformDoors(dsJson.data.scheduleJson, sets)
          : [];

        setHardwareSets(sets);
        setDoors(loadedDoors);
        setProjectName(projJson?.data?.name ?? '');
        setElevationTypes(projJson?.data?.elevationTypes ?? []);
      } catch (err) {
        console.error('[DoorScheduleReport] Load failed:', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  return (
    <div className="bg-[var(--bg)] rounded-md border border-[var(--border)] overflow-hidden">
      <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-5 py-3 flex items-center gap-3">
        <FileSpreadsheet className="h-4 w-4 text-[var(--primary-text-muted)]" />
        <h2 className="text-sm font-semibold text-[var(--text)]">Door Schedule Report</h2>
        {!loading && (
          <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--primary-border)] text-[var(--primary-text)]">
            {totalDoorQuantity(doors)} doors
          </span>
        )}
      </div>

      {loading ? (
        <div className="p-10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-5 h-5 border-2 border-[var(--primary-action)] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[var(--text-faint)]">Loading door schedule…</p>
          </div>
        </div>
      ) : (
        <div className="p-5">
          <DoorScheduleConfig
            doors={doors}
            hardwareSets={hardwareSets}
            elevationTypes={elevationTypes}
            projectName={projectName}
          />
        </div>
      )}
    </div>
  );
}
