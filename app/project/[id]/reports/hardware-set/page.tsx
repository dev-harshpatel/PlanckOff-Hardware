'use client';

import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useProject } from '@/contexts/ProjectContext';
import { exportHardwareSet } from '@/services/reportExportService';
import type { HardwareSetExportConfig } from '@/components/HardwareSetConfig';
import { Settings2 } from 'lucide-react';

const HardwareSetConfig = dynamic(() => import('@/components/HardwareSetConfig'), { ssr: false });

export default function HardwareSetReportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { projects } = useProject();

  const activeProject = projects.find((p) => p.id === id);
  if (!activeProject) return null;

  const doors = activeProject.doors ?? [];
  const hardwareSets = activeProject.hardwareSets ?? [];

  const handleExport = (config: HardwareSetExportConfig) => {
    try {
      exportHardwareSet(doors, hardwareSets, config, activeProject.name);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  return (
    <div className="bg-[var(--bg)] rounded-md border border-[var(--border)] overflow-hidden">
      <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-5 py-3 flex items-center gap-3">
        <Settings2 className="h-4 w-4 text-[var(--primary-text-muted)]" />
        <h2 className="text-sm font-semibold text-[var(--text)]">Hardware Set Report</h2>
        <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--primary-border)] text-[var(--primary-text)]">
          {hardwareSets.length} sets
        </span>
      </div>
      <div className="p-5">
        <HardwareSetConfig
          doors={doors}
          hardwareSets={hardwareSets}
          projectName={activeProject.name}
          onBack={() => router.push(`/project/${id}/reports`)}
          onExport={handleExport}
        />
      </div>
    </div>
  );
}
