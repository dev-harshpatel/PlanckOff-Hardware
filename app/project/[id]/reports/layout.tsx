'use client';

import React, { useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useProject } from '@/contexts/ProjectContext';
import { useNavigationLoading } from '@/contexts/NavigationLoadingContext';
import { RouteLoadingState } from '@/components/RouteLoadingState';
import { FileText, NotebookPen } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { ProjectNotesPanel } from '@/components/ProjectNotesPanel';

const ROUTE_TITLES: Record<string, string> = {
  'door-schedule': 'Door-Frame Reports',
  'hardware-set': 'Hardware Set Report',
  'submittal-package': 'Submittal Package',
  'pricing': 'Pricing Report',
};

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { projects, projectsHydrated } = useProject();
  const { startNavigation } = useNavigationLoading();
  const [isNotesOpen, setIsNotesOpen] = useState(false);

  const activeProject = projects.find((p) => p.id === id);

  if (!projectsHydrated) {
    return <RouteLoadingState title="Opening reports" message="Loading project data and report configuration." />;
  }

  if (!activeProject) return null;

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
                  <BreadcrumbLink
                    href={`/project/${id}`}
                    onClick={(event) => {
                      event.preventDefault();
                      const href = `/project/${id}`;
                      startNavigation(href);
                      router.push(href);
                    }}
                  >
                    Project
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {isSelector ? (
                    <BreadcrumbPage>Reports</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      href={`/project/${id}/reports`}
                      onClick={(event) => {
                        event.preventDefault();
                        const href = `/project/${id}/reports`;
                        startNavigation(href);
                        router.push(href);
                      }}
                    >
                      Reports
                    </BreadcrumbLink>
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
            {/* doors · sets badge hidden
            <span className="text-[var(--text-faint)]">·</span>
            <span className="text-[var(--text-muted)]">
              {activeProject.doors?.length ?? 0} doors · {activeProject.hardwareSets?.length ?? 0} sets
            </span>
            */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsNotesOpen(true)}
              className={`gap-1.5 ${isNotesOpen ? 'text-[var(--primary-text)]' : 'text-[var(--text-muted)]'}`}
              title="Project notes"
            >
              <NotebookPen className="h-4 w-4" />
              <span className="hidden md:inline">Notes</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[1920px] mx-auto px-6 py-6">
          {children}
        </div>
      </div>

      <ProjectNotesPanel
        projectId={id}
        isOpen={isNotesOpen}
        onClose={() => setIsNotesOpen(false)}
      />
    </div>
  );
}
