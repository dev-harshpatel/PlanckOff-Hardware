'use client';

import React from 'react';
import { Project, ProjectStatus } from '../../types';
import { TeamMember } from '../../types';
import type { RoleName } from '@/types/auth';
import { ProjectCard } from './ProjectCard';

export interface KanbanColumnConfig {
    id: ProjectStatus;
    label: string;
    dot: string;
    countBg: string;
    countText: string;
}

export interface KanbanColumnProps {
    col: KanbanColumnConfig;
    colProjects: Project[];
    isDropTarget: boolean;
    canDragProjects: boolean;
    draggedProjectId: string | null;
    updatingProjectIds: Set<string>;
    dropTargetStatus: ProjectStatus | null;
    onSetDropTarget: (status: ProjectStatus | null) => void;
    onDropToStatus: (status: ProjectStatus) => Promise<void>;
    onSelectProject: (id: string) => void;
    onProjectUpdate: (project: Project) => Promise<void> | void;
    onEditProject: (project: Project) => void;
    onDeleteProject: (id: string) => void;
    onDragStart: (project: Project) => void;
    onDragEnd: () => void;
    userRole: RoleName;
    teamMembers: TeamMember[];
}

export function KanbanColumn({
    col,
    colProjects,
    isDropTarget,
    canDragProjects,
    draggedProjectId,
    updatingProjectIds,
    dropTargetStatus,
    onSetDropTarget,
    onDropToStatus,
    onSelectProject,
    onProjectUpdate,
    onEditProject,
    onDeleteProject,
    onDragStart,
    onDragEnd,
    userRole,
    teamMembers,
}: KanbanColumnProps) {
    return (
        <div className="flex-1 min-w-[240px] flex flex-col h-full rounded-md overflow-hidden border border-[var(--border)]">
            <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-4 py-2.5 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dot} flex-shrink-0`} />
                    <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">{col.label}</span>
                </div>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${col.countBg} ${col.countText}`}>
                    {colProjects.length}
                </span>
            </div>

            <div
                className={`flex-grow overflow-y-auto bg-[var(--bg-subtle)] p-2.5 space-y-2 transition-colors ${isDropTarget ? 'bg-[var(--primary-bg)]/70' : ''}`}
                onDragOver={(e) => {
                    if (!canDragProjects || !draggedProjectId) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dropTargetStatus !== col.id) {
                        onSetDropTarget(col.id);
                    }
                }}
                onDragLeave={(e) => {
                    if (!canDragProjects) return;
                    const nextTarget = e.relatedTarget as Node | null;
                    if (!e.currentTarget.contains(nextTarget)) {
                        onSetDropTarget(dropTargetStatus === col.id ? null : dropTargetStatus);
                    }
                }}
                onDrop={(e) => {
                    if (!canDragProjects) return;
                    e.preventDefault();
                    void onDropToStatus(col.id);
                }}
            >
                {colProjects.length > 0 ? (
                    colProjects.map(project => (
                        <ProjectCard
                            key={project.id}
                            project={project}
                            onSelect={() => onSelectProject(project.id)}
                            onSave={onProjectUpdate}
                            onEdit={onEditProject}
                            onDelete={onDeleteProject}
                            userRole={userRole}
                            teamMembers={teamMembers}
                            draggable={canDragProjects && !updatingProjectIds.has(project.id)}
                            isDragging={draggedProjectId === project.id || updatingProjectIds.has(project.id)}
                            onDragStart={onDragStart}
                            onDragEnd={onDragEnd}
                        />
                    ))
                ) : (
                    <div className={`flex flex-col items-center justify-center h-24 border border-dashed rounded-md text-center transition-colors ${isDropTarget ? 'border-[var(--primary-border)] bg-[var(--bg)]' : 'border-[var(--border)] bg-[var(--bg)]/60'}`}>
                        <span className="text-xs text-[var(--text-faint)]">No projects</span>
                    </div>
                )}
            </div>
        </div>
    );
}
