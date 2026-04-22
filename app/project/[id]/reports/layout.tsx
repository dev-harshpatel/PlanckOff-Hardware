'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useProject } from '@/contexts/ProjectContext';
import { FileText } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

const ROUTE_TITLES: Record<string, string> = {
  'door-schedule': 'Door Schedule Report',
  'hardware-set': 'Hardware Set Report',
  'submittal-package': 'Submittal Package',
};

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const { projects, projectsHydrated } = useProject();

  const activeProject = projects.find((p) => p.id === id);

  if (!projectsHydrated || !activeProject) return null;

  // Determine if we're on the selector page or a sub-page
  const segments = pathname.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  const isSelector = lastSegment === 'reports';
  const subTitle = ROUTE_TITLES[lastSegment];

  return (
    <div className="h-full min-h-0 flex flex-col bg-[var(--bg-subtle)]">
      {/* Shared nav bar */}
      <div className="bg-[var(--bg)] border-b border-[var(--border)] flex-shrink-0">
        <div className="max-w-[1920px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-4 w-4 text-[var(--primary-text-muted)]" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href={`/project/${id}`}>Project</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {isSelector ? (
                    <BreadcrumbPage>Reports</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={`/project/${id}/reports`}>Reports</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isSelector && (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{subTitle ?? 'Reports'}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="font-medium text-[var(--text)]">{activeProject.name}</span>
            <span className="text-[var(--text-faint)]">·</span>
            <span className="text-[var(--text-muted)]">
              {activeProject.doors?.length ?? 0} doors · {activeProject.hardwareSets?.length ?? 0} sets
            </span>
          </div>
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[1920px] mx-auto px-6 py-6">
          {children}
        </div>
      </div>
    </div>
  );
}
