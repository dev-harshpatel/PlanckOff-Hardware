'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProject } from '@/contexts/ProjectContext';
import { useNavigationLoading } from '@/contexts/NavigationLoadingContext';
import { RouteLoadingState } from '@/components/layout/RouteLoadingState';
import { ImagePlus, NotebookPen } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { ProjectNotesPanel } from '@/components/projects/ProjectNotesPanel';

export default function ElevationsLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { projects, projectsHydrated } = useProject();
  const { startNavigation } = useNavigationLoading();
  const [isNotesOpen, setIsNotesOpen] = useState(false);

  const activeProject = projects.find(p => p.id === id);

  if (!projectsHydrated) {
    return <RouteLoadingState title="Opening elevation upload" message="Loading project data." />;
  }

  if (!activeProject) return null;

  const navigateTo = (href: string) => {
    startNavigation(href);
    router.push(href);
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-[var(--bg-subtle)]">
      {/* Nav bar */}
      <div className="bg-[var(--bg)] border-b border-[var(--border)] flex-shrink-0">
        <div className="max-w-[1920px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ImagePlus className="h-4 w-4 text-[var(--primary-text-muted)]" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink
                    href={`/project/${id}`}
                    onClick={e => { e.preventDefault(); navigateTo(`/project/${id}`); }}
                  >
                    Project
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Upload Elevations</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <span className="font-medium text-[var(--text)]">{activeProject.name}</span>
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
        projectName={activeProject.name}
        isOpen={isNotesOpen}
        onClose={() => setIsNotesOpen(false)}
      />
    </div>
  );
}
