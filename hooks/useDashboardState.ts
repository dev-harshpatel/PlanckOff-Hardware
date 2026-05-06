'use client';

import { useState, useMemo, useEffect } from 'react';
import { Project, ProjectStatus, Toast } from '../types';
import {
    ProjectStatusOverrides,
    applyProjectStatusOverrides,
    getProjectStatus,
} from '../utils/dashboardUtils';

interface UseDashboardStateOptions {
    projects: Project[];
    onProjectUpdate: (project: Project) => Promise<void> | void;
    addToast: (toast: Omit<Toast, 'id'>) => void;
}

export function useDashboardState({ projects, onProjectUpdate, addToast }: UseDashboardStateOptions) {
    const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
    const [dropTargetStatus, setDropTargetStatus] = useState<ProjectStatus | null>(null);
    const [optimisticStatuses, setOptimisticStatuses] = useState<ProjectStatusOverrides>({});
    const [updatingProjectIds, setUpdatingProjectIds] = useState<Set<string>>(new Set());

    const effectiveProjects = useMemo(
        () => applyProjectStatusOverrides(projects, optimisticStatuses),
        [projects, optimisticStatuses],
    );

    useEffect(() => {
        setOptimisticStatuses(current => {
            let changed = false;
            const next: ProjectStatusOverrides = {};

            Object.entries(current).forEach(([projectId, status]) => {
                const persistedProject = projects.find(project => project.id === projectId);
                if (!persistedProject) {
                    changed = true;
                    return;
                }

                const persistedStatus = persistedProject.status ?? 'Active';
                if (persistedStatus !== status) {
                    next[projectId] = status;
                } else {
                    changed = true;
                }
            });

            return changed ? next : current;
        });
    }, [projects]);

    const handleProjectDropToStatus = async (targetStatus: ProjectStatus) => {
        if (!draggedProjectId) return;

        const project = effectiveProjects.find(p => p.id === draggedProjectId);
        if (!project) {
            setDraggedProjectId(null);
            setDropTargetStatus(null);
            return;
        }

        if (updatingProjectIds.has(project.id)) return;

        const currentStatus = getProjectStatus(project);
        if (currentStatus === targetStatus) {
            setDraggedProjectId(null);
            setDropTargetStatus(null);
            return;
        }

        const previousStatus = currentStatus;

        setOptimisticStatuses(current => ({
            ...current,
            [project.id]: targetStatus,
        }));
        setUpdatingProjectIds(current => {
            const next = new Set(current);
            next.add(project.id);
            return next;
        });
        setDraggedProjectId(null);
        setDropTargetStatus(null);

        try {
            await onProjectUpdate({
                ...project,
                status: targetStatus,
            });
            addToast({
                type: 'success',
                message: `Project "${project.name}" moved to ${targetStatus}.`,
            });
        } catch (error) {
            const details = error instanceof Error ? error.message : 'Could not update project status.';
            addToast({
                type: 'error',
                message: `Failed to move "${project.name}"`,
                details,
            });
            setOptimisticStatuses(current => {
                const next = { ...current };
                if (previousStatus === (projects.find(p => p.id === project.id)?.status ?? 'Active')) {
                    delete next[project.id];
                } else {
                    next[project.id] = previousStatus;
                }
                return next;
            });
        } finally {
            setUpdatingProjectIds(current => {
                const next = new Set(current);
                next.delete(project.id);
                return next;
            });
        }
    };

    return {
        draggedProjectId,
        setDraggedProjectId,
        dropTargetStatus,
        setDropTargetStatus,
        updatingProjectIds,
        effectiveProjects,
        handleProjectDropToStatus,
    };
}
