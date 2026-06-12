import { Project, ProjectStatus } from '../types';

export type ProjectStatusOverrides = Record<string, ProjectStatus>;

export const KANBAN_COLUMNS: {
    id: ProjectStatus;
    label: string;
    dot: string;
    countBg: string;
    countText: string;
}[] = [
    { id: 'Active',       label: 'Active',        dot: 'bg-[var(--success-dot)]',    countBg: 'bg-[var(--success-bg)]',  countText: 'text-[var(--success-text)]' },
    { id: 'Under Review', label: 'Under Review',  dot: 'bg-[var(--warning-dot)]',    countBg: 'bg-[var(--warning-bg)]',  countText: 'text-[var(--warning-text)]' },
    { id: 'Submitted',    label: 'Submitted',     dot: 'bg-[var(--primary-action)]', countBg: 'bg-[var(--primary-bg)]',  countText: 'text-[var(--primary-text)]' },
    { id: 'Client',       label: 'Client',        dot: 'bg-teal-400',                countBg: 'bg-teal-50',              countText: 'text-teal-700' },
];

export const getProjectStatus = (project: Project, overrides?: ProjectStatusOverrides): ProjectStatus => {
    return overrides?.[project.id] ?? project.status ?? 'Active';
};

export const applyProjectStatusOverrides = (projects: Project[], overrides: ProjectStatusOverrides): Project[] => {
    return projects.map(project => {
        const optimisticStatus = overrides[project.id];
        return optimisticStatus ? { ...project, status: optimisticStatus } : project;
    });
};

export const buildProjectStats = (projects: Project[]): Record<string, number> => {
    const counts: Record<string, number> = {};
    KANBAN_COLUMNS.forEach(col => { counts[col.id] = 0; });

    projects.forEach(project => {
        const status = getProjectStatus(project);
        if (counts[status] !== undefined) counts[status]++;
        else counts['Active']++;
    });

    return counts;
};

/**
 * Returns the due-date urgency level for a project card highlight.
 * - 'red'    → overdue or due today, and status is not Submitted
 * - 'yellow' → due tomorrow (regardless of status)
 * - null     → no highlight
 *
 * Projects assigned to a client are never highlighted — once handed off,
 * due-date urgency no longer applies and the card shows the normal colour.
 */
export function getDueDateHighlight(dueDate?: string, status?: string, clientIds?: string[]): 'red' | 'yellow' | null {
    if (!dueDate) return null;
    if (clientIds?.length) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const due = new Date(dueDate + 'T00:00:00');

    if (due.getTime() === tomorrow.getTime()) return 'yellow';
    if (due <= today && status !== 'Submitted') return 'red';

    return null;
}

export const filterProjectsByDashboardState = (
    projects: Project[],
    searchQuery: string,
    selectedMemberFilter: string,
    selectedStatusFilter: ProjectStatus | 'All',
): Project[] => {
    return projects.filter(project => {
        const matchesSearch =
            project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (project.client && project.client.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesMember =
            selectedMemberFilter === 'All Members' ||
            project.assignedTo === selectedMemberFilter ||
            (project.clientIds?.includes(selectedMemberFilter) ?? false);
        const currentStatus = getProjectStatus(project);
        const matchesStatus = selectedStatusFilter === 'All' || currentStatus === selectedStatusFilter;
        return matchesSearch && matchesMember && matchesStatus;
    });
};
