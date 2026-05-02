'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Package } from 'lucide-react';
import { useNavigationLoading } from '@/contexts/NavigationLoadingContext';
import type { Door, HardwareSet } from '@/types';
import type { MergedHardwareSet } from '@/lib/db/hardware';
import { transformFromFinalJson, transformDoors, transformHardwareSets } from '@/utils/hardwareTransformers';
import { exportHardwareSet } from '@/services/reportExportService';
import type { HardwareSetExportConfig } from '@/components/HardwareSetConfig';
import { ReportPageSkeleton } from '@/components/skeletons/ReportPageSkeleton';

const HardwareSetConfig = dynamic(() => import('@/components/HardwareSetConfig'), { ssr: false });

export default function HardwareSetReportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { startNavigation } = useNavigationLoading();

  const [doors, setDoors] = useState<Door[]>([]);
  const [hardwareSets, setHardwareSets] = useState<HardwareSet[]>([]);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function load() {
      try {
        const [mergeRes, projRes] = await Promise.all([
          fetch(`/api/projects/${id}/hardware-merge`, { credentials: 'include' }),
          fetch(`/api/projects/${id}`, { credentials: 'include' }),
        ]);

        const [mergeJson, projJson] = await Promise.all([
          mergeRes.ok ? mergeRes.json() : null,
          projRes.ok ? projRes.json() : null,
        ]);

        setProjectName(projJson?.data?.name ?? '');

        const finalData: MergedHardwareSet[] | undefined = mergeJson?.data?.finalJson;
        if (finalData && finalData.length > 0) {
          const { hardwareSets: sets, doors: loadedDoors } = transformFromFinalJson(finalData);
          setHardwareSets(sets);
          setDoors(loadedDoors);
          return;
        }

        const [dsRes, hwRes] = await Promise.all([
          fetch(`/api/projects/${id}/door-schedule`, { credentials: 'include' }),
          fetch(`/api/projects/${id}/hardware-pdf`, { credentials: 'include' }),
        ]);
        const [dsJson, hwJson] = await Promise.all([
          dsRes.ok ? dsRes.json() : null,
          hwRes.ok ? hwRes.json() : null,
        ]);

        const sets: HardwareSet[] = hwJson?.data?.extractedJson
          ? transformHardwareSets(hwJson.data.extractedJson)
          : [];
        const loadedDoors: Door[] = dsJson?.data?.scheduleJson
          ? transformDoors(dsJson.data.scheduleJson, sets)
          : [];
        setHardwareSets(sets);
        setDoors(loadedDoors);
      } catch (err) {
        console.error('[HardwareSetReport] Load failed:', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  const handleExport = (config: HardwareSetExportConfig) => {
    try {
      exportHardwareSet(doors, hardwareSets, config, projectName);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  if (loading) {
    return <ReportPageSkeleton badgeWidth="w-28" rows={6} />;
  }

  return (
    <div className="bg-[var(--bg)] rounded-md border border-[var(--border)] overflow-hidden">
      <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-5 py-3 flex items-center gap-3">
        <Package className="h-4 w-4 text-[var(--primary-text-muted)]" />
        <h2 className="text-sm font-semibold text-[var(--text)]">Hardware Set Report</h2>
        <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--primary-border)] text-[var(--primary-text)]">
          {hardwareSets.length} sets · {doors.length} doors
        </span>
      </div>

      <div className="p-5">
        <HardwareSetConfig
          doors={doors}
          hardwareSets={hardwareSets}
          projectName={projectName}
          onBack={() => {
            const href = `/project/${id}/reports`;
            startNavigation(href);
            router.push(href);
          }}
          onExport={handleExport}
        />
      </div>
    </div>
  );
}
