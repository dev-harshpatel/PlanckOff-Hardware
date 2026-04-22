'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useProject } from '@/contexts/ProjectContext';
import { FileSpreadsheet } from 'lucide-react';

const DoorScheduleConfig = dynamic(() => import('@/components/DoorScheduleConfig'), { ssr: false });

export default function DoorScheduleReportPage() {
  const { id } = useParams<{ id: string }>();
  const { projects } = useProject();

  const activeProject = projects.find((p) => p.id === id);
  if (!activeProject) return null;

  const doors = activeProject.doors ?? [];
  const hardwareSets = activeProject.hardwareSets ?? [];

  return (
    <div className="bg-[var(--bg)] rounded-md border border-[var(--border)] overflow-hidden">
      <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-5 py-3 flex items-center gap-3">
        <FileSpreadsheet className="h-4 w-4 text-[var(--primary-text-muted)]" />
        <h2 className="text-sm font-semibold text-[var(--text)]">Door Schedule Report</h2>
        <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--primary-border)] text-[var(--primary-text)]">
          {doors.length} doors
        </span>
      </div>
      <div className="p-5">
        <DoorScheduleConfig
          doors={doors}
          hardwareSets={hardwareSets}
          projectName={activeProject.name}
        />
      </div>
    </div>
  );
}
