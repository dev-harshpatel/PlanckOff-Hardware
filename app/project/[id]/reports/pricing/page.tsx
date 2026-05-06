'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { DollarSign } from 'lucide-react';
import type { Door, HardwareSet } from '@/types';
import type { MergedHardwareSet } from '@/lib/db/hardware';
import { transformFromFinalJson, transformDoors, transformHardwareSets } from '@/utils/hardwareTransformers';
import { ReportPageSkeleton } from '@/components/skeletons/ReportPageSkeleton';

const PricingReportConfig = dynamic(() => import('@/components/pricing/PricingReportConfig'), { ssr: false });

export default function PricingReportPage() {
  const { id } = useParams<{ id: string }>();

  const [doors, setDoors] = useState<Door[]>([]);
  const [hardwareSets, setHardwareSets] = useState<HardwareSet[]>([]);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function load() {
      try {
        const [dsRes, mergeRes, projRes] = await Promise.all([
          fetch(`/api/projects/${id}/door-schedule`, { credentials: 'include' }),
          fetch(`/api/projects/${id}/hardware-merge`, { credentials: 'include' }),
          fetch(`/api/projects/${id}`, { credentials: 'include' }),
        ]);
        const [dsJson, mergeJson, projJson] = await Promise.all([
          dsRes.ok ? dsRes.json() : null,
          mergeRes.ok ? mergeRes.json() : null,
          projRes.ok ? projRes.json() : null,
        ]);

        setProjectName(projJson?.data?.name ?? '');

        let sets: HardwareSet[] = [];
        const finalData: MergedHardwareSet[] | undefined = mergeJson?.data?.finalJson;
        if (finalData && finalData.length > 0) {
          const { hardwareSets: mergedSets } = transformFromFinalJson(finalData);
          sets = mergedSets;
        } else {
          const hwRes = await fetch(`/api/projects/${id}/hardware-pdf`, { credentials: 'include' });
          const hwJson = hwRes.ok ? await hwRes.json() : null;
          if (hwJson?.data?.extractedJson) sets = transformHardwareSets(hwJson.data.extractedJson);
        }

        const loadedDoors: Door[] = dsJson?.data?.scheduleJson
          ? transformDoors(dsJson.data.scheduleJson, sets)
          : [];

        setHardwareSets(sets);
        setDoors(loadedDoors);
      } catch (err) {
        console.error('[PricingReport] Load failed:', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  if (loading) {
    return <ReportPageSkeleton badgeWidth="w-32" rows={7} />;
  }

  return (
    <div className="bg-[var(--bg)] rounded-md border border-[var(--border)] overflow-hidden">
      <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-5 py-3 flex items-center gap-3">
        <DollarSign className="h-4 w-4 text-[var(--primary-text-muted)]" />
        <h2 className="text-sm font-semibold text-[var(--text)]">Pricing Report</h2>
        <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--primary-border)] text-[var(--primary-text)]">
          {doors.length} doors · {hardwareSets.length} sets
        </span>
      </div>

      <div className="p-5">
        <PricingReportConfig
          projectId={id}
          doors={doors}
          hardwareSets={hardwareSets}
          projectName={projectName}
        />
      </div>
    </div>
  );
}
