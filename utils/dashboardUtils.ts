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
    { id: 'On Hold',      label: 'On Hold',       dot: 'bg-[var(--text-faint)]',     countBg: 'bg-[var(--bg-muted)]',    countText: 'text-[var(--text-muted)]' },
    { id: 'Archived',     label: 'Archived',      dot: 'bg-purple-400',              countBg: 'bg-purple-50',            countText: 'text-purple-700' },
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
        const matchesMember = selectedMemberFilter === 'All Members' || project.assignedTo === selectedMemberFilter;
        const currentStatus = getProjectStatus(project);
        const matchesStatus = selectedStatusFilter === 'All' || currentStatus === selectedStatusFilter;
        return matchesSearch && matchesMember && matchesStatus;
    });
};
