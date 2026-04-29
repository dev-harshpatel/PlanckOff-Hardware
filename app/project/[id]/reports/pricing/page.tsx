'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { DollarSign } from 'lucide-react';
import type { Door, HardwareSet } from '@/types';
import type { MergedHardwareSet } from '@/lib/db/hardware';
import { transformFromFinalJson, transformDoors, transformHardwareSets } from '@/utils/hardwareTransformers';

const PricingReportConfig = dynamic(() => import('@/components/PricingReportConfig'), { ssr: false });

export default function PricingReportPage() {
  const { id } = useParams<{ id: string }>();

  const [doors, setDoors]               = useState<Door[]>([]);
  const [hardwareSets, setHardwareSets] = useState<HardwareSet[]>([]);
  const [projectName, setProjectName]   = useState('');
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    if (!id) return;

    async function load() {
      try {
        // Always fetch all three in parallel:
        // - door-schedule: ALL door rows (45) regardless of hw match
        // - hardware-merge: for hardware sets (matched only)
        // - project: for project name
        const [dsRes, mergeRes, projRes] = await Promise.all([
          fetch(`/api/projects/${id}/door-schedule`, { credentials: 'include' }),
          fetch(`/api/projects/${id}/hardware-merge`, { credentials: 'include' }),
          fetch(`/api/projects/${id}`,                { credentials: 'include' }),
        ]);
        const [dsJson, mergeJson, projJson] = await Promise.all([
          dsRes.ok    ? dsRes.json()    : null,
          mergeRes.ok ? mergeRes.json() : null,
          projRes.ok  ? projRes.json()  : null,
        ]);

        setProjectName(projJson?.data?.name ?? '');

        // Build hardware sets from the merged final JSON (most complete source)
        let sets: HardwareSet[] = [];
        const finalData: MergedHardwareSet[] | undefined = mergeJson?.data?.finalJson;
        if (finalData && finalData.length > 0) {
          const { hardwareSets: mergedSets } = transformFromFinalJson(finalData);
          sets = mergedSets;
        } else {
          // Fallback: load raw hardware PDF extraction
          const hwRes = await fetch(`/api/projects/${id}/hardware-pdf`, { credentials: 'include' });
          const hwJson = hwRes.ok ? await hwRes.json() : null;
          if (hwJson?.data?.extractedJson) sets = transformHardwareSets(hwJson.data.extractedJson);
        }

        // Doors always come from the raw door schedule so unmatched doors are included
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

  return (
    <div className="bg-[var(--bg)] rounded-md border border-[var(--border)] overflow-hidden">
      {/* Header */}
      <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-5 py-3 flex items-center gap-3">
        <DollarSign className="h-4 w-4 text-[var(--primary-text-muted)]" />
        <h2 className="text-sm font-semibold text-[var(--text)]">Pricing Report</h2>
        {!loading && (
          <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--primary-border)] text-[var(--primary-text)]">
            {doors.length} doors · {hardwareSets.length} sets
          </span>
        )}
      </div>

      {loading ? (
        <div className="p-10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-5 h-5 border-2 border-[var(--primary-action)] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[var(--text-faint)]">Loading project data…</p>
          </div>
        </div>
      ) : (
        <div className="p-5">
          <PricingReportConfig
            projectId={id}
            doors={doors}
            hardwareSets={hardwareSets}
            projectName={projectName}
          />
        </div>
      )}
    </div>
  );
}
