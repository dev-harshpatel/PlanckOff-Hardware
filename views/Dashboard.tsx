'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Project, ProjectStatus, NewProjectData, Toast } from '../types';
import NewProjectModal from '../components/NewProjectModal';
import TrashBin from '../components/TrashBin';
import { TeamMember } from '../types';
import SelectDropdown from '@/components/ui/select-dropdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { RoleName } from '@/types/auth';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Search,
    Filter,
    Plus,
    Pencil,
    Trash2,
    UserPlus,
    Calendar,
    Hash,
    LayoutGrid,
    List,
    FolderOpen,
} from 'lucide-react';

interface DashboardProps {
    projects: Project[];
    trash: Project[];
    onSelectProject: (projectId: string) => void;
    onAddNewProject: (projectData: NewProjectData, doorScheduleFile?: File, hardwareSetFile?: File) => Promise<void>;
    onProjectUpdate: (updatedProject: Project) => Promise<void> | void;
    onDeleteProject: (projectId: string) => void;
    onRestoreProject: (id: string) => Promise<void> | void;
    onPermDeleteProject: (id: string) => Promise<void> | void;
    userRole: RoleName;
    addToast: (toast: Omit<Toast, 'id'>) => void;
    teamMembers: TeamMember[];
    isLoadingTeamMembers?: boolean;
}

const formatDate = (isoDate?: string): string => {
    if (!isoDate) return 'N/A';
    const date = new Date(isoDate + 'T00:00:00');
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

const KANBAN_COLUMNS: {
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

const STATUS_FILTERS: Array<{
    id: ProjectStatus | 'All';
    label: string;
    dot: string;
    countBg: string;
    countText: string;
}> = [
    ...KANBAN_COLUMNS,
    {
        id: 'All',
        label: 'All',
        dot: 'bg-[var(--text-secondary)]',
        countBg: 'bg-[var(--primary-bg)]',
        countText: 'text-[var(--primary-text)]',
    },
];

const STAT_COLORS: Record<string, { text: string; bg: string; dot: string }> = {
    Active:         { text: 'text-[var(--success-text)]', bg: 'bg-[var(--success-bg)]', dot: 'bg-[var(--success-dot)]' },
    'Under Review': { text: 'text-[var(--warning-text)]', bg: 'bg-[var(--warning-bg)]', dot: 'bg-[var(--warning-dot)]' },
    Submitted:      { text: 'text-[var(--primary-text)]', bg: 'bg-[var(--primary-bg)]', dot: 'bg-[var(--primary-action)]' },
    'On Hold':      { text: 'text-[var(--text-muted)]',   bg: 'bg-[var(--bg-muted)]',   dot: 'bg-[var(--text-faint)]' },
    Archived:       { text: 'text-purple-700',             bg: 'bg-purple-50',            dot: 'bg-purple-400' },
};

type ProjectStatusOverrides = Record<string, ProjectStatus>;

const getProjectStatus = (project: Project, overrides?: ProjectStatusOverrides): ProjectStatus => {
    return overrides?.[project.id] ?? project.status ?? 'Active';
};

const applyProjectStatusOverrides = (projects: Project[], overrides: ProjectStatusOverrides): Project[] => {
    return projects.map(project => {
        const optimisticStatus = overrides[project.id];
        return optimisticStatus ? { ...project, status: optimisticStatus } : project;
    });
};

const buildProjectStats = (projects: Project[]): Record<string, number> => {
    const counts: Record<string, number> = {};
    KANBAN_COLUMNS.forEach(col => { counts[col.id] = 0; });

    projects.forEach(project => {
        const status = getProjectStatus(project);
        if (counts[status] !== undefined) counts[status]++;
        else counts['Active']++;
    });

    return counts;
};

const filterProjectsByDashboardState = (
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

const ProjectCard: React.FC<{
    project: Project;
    onSelect: () => void;
    onSave: (p: Project) => Promise<void> | void;
    onEdit: (project: Project) => void;
    onDelete: (id: string) => void;
    userRole: RoleName;
    teamMembers: TeamMember[];
    draggable?: boolean;
    isDragging?: boolean;
    onDragStart?: (project: Project) => void;
    onDragEnd?: () => void;
}> = ({
    project,
    onSelect,
    onSave,
    onEdit,
    onDelete,
    userRole,
    teamMembers,
    draggable = false,
    isDragging = false,
    onDragStart,
    onDragEnd,
}) => {
    const [showAssignMenu, setShowAssignMenu] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState('');
    const [isAssigning, setIsAssigning] = useState(false);
    const assignMenuRef = useRef<HTMLDivElement | null>(null);
    const suppressClickRef = useRef(false);

    const canDelete = userRole === 'Administrator' || userRole === 'Team Lead';
    const canAssign = userRole === 'Administrator' || userRole === 'Team Lead';
    const canEdit = userRole === 'Administrator' || userRole === 'Team Lead';

    const assignedMember = teamMembers.find(m => m.id === project.assignedTo);

    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            if (!assignMenuRef.current?.contains(event.target as Node)) {
                setShowAssignMenu(false);
            }
        };
        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, []);

    const handleAssign = async (memberId: string) => {
        try {
            setIsAssigning(true);
            await onSave({ ...project, assignedTo: memberId || undefined });
            setShowAssignMenu(false);
        } finally {
            setIsAssigning(false);
        }
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setDeleteConfirmation('');
        setIsDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = () => {
        onDelete(project.id);
        setIsDeleteDialogOpen(false);
        setDeleteConfirmation('');
    };

    const statusStyle = STAT_COLORS[project.status || 'Active'] ?? STAT_COLORS['Active'];

    const handleCardClick = () => {
        if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
        }
        onSelect();
    };

    return (
        <>
            <div
                className={`bg-[var(--bg)] rounded-md border hover:border-[var(--primary-border)] hover:shadow-sm transition-all p-4 group relative cursor-pointer ${isDragging ? 'opacity-50 border-[var(--primary-ring)] shadow-sm' : 'border-[var(--border)]'}`}
                onClick={handleCardClick}
                draggable={draggable}
                onDragStart={(e) => {
                    if (!draggable) return;
                    suppressClickRef.current = true;
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', project.id);
                    onDragStart?.(project);
                }}
                onDragEnd={() => {
                    suppressClickRef.current = false;
                    onDragEnd?.();
                }}
            >
                {/* Card header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-[var(--text)] text-sm leading-tight truncate">{project.name}</h4>
                        {project.client && (
                            <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{project.client}</p>
                        )}
                    </div>
                    {/* Hover actions */}
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        {canEdit && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onEdit(project); }}
                                className="p-1 rounded text-[var(--text-faint)] hover:text-[var(--primary-text-muted)] hover:bg-[var(--primary-bg)] transition-colors"
                                title="Edit"
                            >
                                <Pencil className="w-3.5 h-3.5" />
                            </button>
                        )}
                        {canDelete && (
                            <button onClick={handleDeleteClick} className="p-1 rounded text-[var(--text-faint)] hover:text-[var(--error-text)] hover:bg-[var(--error-bg)] transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mb-3">
                    <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-[var(--text-faint)]" />
                        {formatDate(project.dueDate)}
                    </span>
                    {project.projectNumber && (
                        <span className="flex items-center gap-1">
                            <Hash className="w-3 h-3 text-[var(--text-faint)]" />
                            <span className="font-mono">{project.projectNumber}</span>
                        </span>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2 min-w-0" ref={assignMenuRef}>
                        {assignedMember ? (
                            <div className="flex items-center gap-1.5 min-w-0">
                                <div className="w-5 h-5 rounded-full bg-[var(--primary-bg-hover)] text-[var(--primary-text)] flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                                    {assignedMember.name.charAt(0)}
                                </div>
                                <span className="text-xs text-[var(--text-muted)] truncate max-w-[100px]">{assignedMember.name}</span>
                            </div>
                        ) : (
                            <span className="text-xs text-[var(--text-faint)] italic">Unassigned</span>
                        )}
                        {canAssign && (
                            <div className="relative">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setShowAssignMenu(!showAssignMenu); }}
                                    disabled={isAssigning}
                                    title="Assign"
                                    className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors disabled:opacity-50 ${project.assignedTo ? 'text-[var(--primary-text-muted)] hover:bg-[var(--primary-bg)]' : 'text-[var(--text-faint)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-muted)]'}`}
                                >
                                    <UserPlus className="w-3 h-3" />
                                    Assign
                                </button>
                                {showAssignMenu && (
                                    <div className="absolute left-0 bottom-full mb-1 w-52 bg-[var(--bg)] rounded-md shadow-lg z-50 border border-[var(--border)] py-1" onClick={(e) => e.stopPropagation()}>
                                        <div className="px-3 py-1.5 text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-wider bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)]">Assign To</div>
                                        {teamMembers.map(m => (
                                            <button
                                                key={m.id}
                                                onClick={() => handleAssign(m.id)}
                                                disabled={isAssigning}
                                                className={`block w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-subtle)] disabled:opacity-50 transition-colors ${project.assignedTo === m.id ? 'bg-[var(--primary-bg)] text-[var(--primary-text)] font-medium' : 'text-[var(--text-secondary)]'}`}
                                            >
                                                {m.name}
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => handleAssign('')}
                                            disabled={isAssigning}
                                            className="block w-full text-left px-3 py-2 text-sm text-[var(--error-text)] hover:bg-[var(--error-bg)] border-t border-[var(--border-subtle)] disabled:opacity-50 transition-colors"
                                        >
                                            Unassign
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                        {project.status || 'Active'}
                    </span>
                </div>
            </div>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Move project to trash</AlertDialogTitle>
                        <AlertDialogDescription>
                            <span className="font-medium text-[var(--text)]">{project.name}</span> will be moved to trash and <strong>automatically deleted after 30 days</strong>. You can restore it from the Trash before then.
                            <br /><br />
                            Type <span className="font-medium text-[var(--text)]">confirm</span> to proceed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor={`delete-confirm-${project.id}`}>Confirmation</Label>
                        <Input
                            id={`delete-confirm-${project.id}`}
                            value={deleteConfirmation}
                            onChange={(e) => setDeleteConfirmation(e.target.value)}
                            placeholder='Type "confirm"'
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeleteConfirmation('')}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} disabled={deleteConfirmation.trim().toLowerCase() !== 'confirm'}>
                            Move to Trash
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};


const Dashboard: React.FC<DashboardProps> = ({ projects, trash, onSelectProject, onAddNewProject, onProjectUpdate, onDeleteProject, onRestoreProject, onPermDeleteProject, userRole, addToast, teamMembers, isLoadingTeamMembers = false }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [isSavingProject, setIsSavingProject] = useState(false);
    const [isTrashOpen, setIsTrashOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('All Members');
    const [selectedStatusFilter, setSelectedStatusFilter] = useState<ProjectStatus | 'All'>('All');
    const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
    const [dropTargetStatus, setDropTargetStatus] = useState<ProjectStatus | null>(null);
    const [optimisticStatuses, setOptimisticStatuses] = useState<ProjectStatusOverrides>({});
    const [updatingProjectIds, setUpdatingProjectIds] = useState<Set<string>>(new Set());
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [listDeleteTarget, setListDeleteTarget] = useState<Project | null>(null);
    const [listDeleteConfirmation, setListDeleteConfirmation] = useState('');

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

    const stats = useMemo(() => buildProjectStats(effectiveProjects), [effectiveProjects]);

    const filteredProjects = useMemo(() => {
        return filterProjectsByDashboardState(
            effectiveProjects,
            searchQuery,
            selectedMemberFilter,
            selectedStatusFilter,
        );
    }, [effectiveProjects, searchQuery, selectedMemberFilter, selectedStatusFilter]);

    const filteredProjectCount = filteredProjects.length;

    const selectedFilterMeta = STATUS_FILTERS.find(filter => filter.id === selectedStatusFilter) ?? STATUS_FILTERS[0];

    const sectionTitle = selectedStatusFilter === 'All'
        ? 'All Projects'
        : `${selectedStatusFilter} Projects`;

    const sectionDescription = selectedStatusFilter === 'All'
        ? 'Current status across all projects'
        : `Showing all ${selectedStatusFilter.toLowerCase()} projects in a single view`;

    const memberFilterOptions = useMemo(() => [
        { value: 'All Members', label: 'All Members' },
        ...teamMembers.map(m => ({ value: m.id, label: m.name })),
    ], [teamMembers]);

    const handleSaveProject = async (projectData: NewProjectData, doorScheduleFile?: File, hardwareSetFile?: File) => {
        setIsSavingProject(true);
        try {
            if (editingProject) {
                await onProjectUpdate({
                    ...editingProject,
                    name: projectData.name,
                    description: projectData.description,
                    client: projectData.client ?? '',
                    location: projectData.location ?? '',
                    country: projectData.country,
                    province: projectData.province,
                    dueDate: projectData.dueDate,
                    status: projectData.status,
                    projectNumber: projectData.projectNumber,
                    assignedTo: projectData.assignedTo,
                });
                addToast({ type: 'success', message: `Project "${projectData.name}" updated.` });
            } else {
                await onAddNewProject(projectData, doorScheduleFile, hardwareSetFile);
            }
            setIsModalOpen(false);
            setEditingProject(null);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'An unknown error occurred.';
            addToast({ type: 'error', message: editingProject ? 'Project update failed' : 'Project creation failed', details: message });
        } finally {
            setIsSavingProject(false);
        }
    };

    const handleOpenCreate = () => {
        setEditingProject(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (project: Project) => {
        setEditingProject(project);
        setIsModalOpen(true);
    };

    const canCreate = userRole === 'Administrator' || userRole === 'Team Lead';
    const canDragProjects = userRole === 'Administrator' || userRole === 'Team Lead';

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

    return (
        <>
            <div className="flex flex-col h-full bg-[var(--bg-subtle)]">

                {/* Page header */}
                <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-6 py-4 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-md bg-[var(--primary-bg-hover)] flex items-center justify-center">
                                <FolderOpen className="w-4 h-4 text-[var(--primary-text-muted)]" />
                            </div>
                            <div>
                                <h1 className="text-base font-semibold text-[var(--text)] leading-tight">Projects Dashboard</h1>
                                <p className="text-xs text-[var(--primary-text-muted)]">Manage your estimates and proposals</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsTrashOpen(true)}
                                className="relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-subtle)] transition-colors"
                                title="Trash"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                Trash
                                {trash.length > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                                        {trash.length}
                                    </span>
                                )}
                            </button>
                            {canCreate && (
                                <Button
                                    size="sm"
                                    onClick={handleOpenCreate}
                                    className="gap-1.5"
                                >
                                    <Plus className="w-4 h-4" />
                                    New Project
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Stat pills */}
                    <div className="flex items-center gap-2 mt-4 flex-wrap">
                        {STATUS_FILTERS.map(col => {
                            const count = col.id === 'All' ? projects.length : (stats[col.id] ?? 0);
                            const isActive = selectedStatusFilter === col.id;
                            return (
                                <button
                                    key={col.id}
                                    type="button"
                                    onClick={() => setSelectedStatusFilter(col.id)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-colors ${isActive
                                        ? 'border-[var(--primary-ring)] bg-[var(--bg)] shadow-sm'
                                        : 'border-[var(--primary-border)] bg-[var(--bg)] hover:bg-[var(--bg-subtle)]'
                                    }`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${col.dot} flex-shrink-0`} />
                                    <span className="text-xs text-[var(--text-muted)] font-medium">{col.label}</span>
                                    <span className={`text-xs font-bold ${col.countText}`}>{count}</span>
                                </button>
                            );
                        })}
                        <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--primary-border)] bg-[var(--bg)]">
                            <span className="text-xs text-[var(--text-muted)] font-medium">Total</span>
                            <span className="text-xs font-bold text-[var(--text)]">{projects.length}</span>
                        </div>
                    </div>
                </div>

                {/* Filter bar */}
                <div className="bg-[var(--bg)] border-b border-[var(--border)] px-6 py-3 flex items-center gap-3 flex-shrink-0">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-faint)] pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search projects or clients…"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)] focus:border-[var(--primary-ring)] bg-[var(--bg)] text-[var(--text)] placeholder:text-[var(--text-faint)]"
                        />
                    </div>
                    <div className="relative min-w-[200px]">
                        <Filter className="absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
                        <SelectDropdown
                            value={selectedMemberFilter}
                            onChange={setSelectedMemberFilter}
                            options={memberFilterOptions}
                            disabled={isLoadingTeamMembers}
                            className="w-full"
                            triggerClassName="border-[var(--border)] bg-[var(--bg)] pl-9 pr-3 hover:bg-[var(--bg-subtle)] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            contentClassName="mt-1"
                        />
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md border transition-colors ${viewMode === 'grid' ? 'bg-[var(--primary-bg)] text-[var(--primary-text-muted)] border-[var(--primary-border)]' : 'text-[var(--text-faint)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-muted)] border-transparent'}`}
                            title="Grid view"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md border transition-colors ${viewMode === 'list' ? 'bg-[var(--primary-bg)] text-[var(--primary-text-muted)] border-[var(--primary-border)]' : 'text-[var(--text-faint)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-muted)] border-transparent'}`}
                            title="List view"
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Projects content */}
                <div className="flex-grow overflow-x-auto overflow-y-hidden px-6 py-5">
                    {viewMode === 'list' ? (
                        /* ── List view (flat table across all statuses) ── */
                        <div className="h-full overflow-y-auto">
                            {filteredProjects.length > 0 ? (
                                <div className="rounded-md border border-[var(--border)] overflow-hidden bg-[var(--bg)]">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-[var(--bg-subtle)] border-b border-[var(--border)]">
                                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">Project</th>
                                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">Client</th>
                                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">Status</th>
                                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">Due Date</th>
                                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">Project #</th>
                                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">Assigned To</th>
                                                <th className="px-4 py-2.5" />
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--border-subtle)]">
                                            {filteredProjects.map(project => {
                                                const statusStyle = STAT_COLORS[project.status || 'Active'] ?? STAT_COLORS['Active'];
                                                const col = KANBAN_COLUMNS.find(c => c.id === (project.status || 'Active'));
                                                const assignedMember = teamMembers.find(m => m.id === project.assignedTo);
                                                const canEdit = userRole === 'Administrator' || userRole === 'Team Lead';
                                                const canDelete = userRole === 'Administrator' || userRole === 'Team Lead';
                                                return (
                                                    <tr
                                                        key={project.id}
                                                        onClick={() => onSelectProject(project.id)}
                                                        className="hover:bg-[var(--bg-subtle)] cursor-pointer group transition-colors"
                                                    >
                                                        <td className="px-4 py-3">
                                                            <span className="font-medium text-[var(--text)] text-sm">{project.name}</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-[var(--text-muted)] text-sm">{project.client || '—'}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                                                                <span className={`w-1.5 h-1.5 rounded-full ${col?.dot ?? statusStyle.dot}`} />
                                                                {project.status || 'Active'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-[var(--text-muted)] text-sm whitespace-nowrap">
                                                            <span className="flex items-center gap-1">
                                                                <Calendar className="w-3 h-3 text-[var(--text-faint)]" />
                                                                {formatDate(project.dueDate)}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-[var(--text-muted)] font-mono text-xs">{project.projectNumber || '—'}</td>
                                                        <td className="px-4 py-3 text-[var(--text-muted)] text-sm">
                                                            {assignedMember ? (
                                                                <span className="flex items-center gap-1.5">
                                                                    <span className="w-5 h-5 rounded-full bg-[var(--primary-bg-hover)] text-[var(--primary-text)] flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                                                                        {assignedMember.name.charAt(0)}
                                                                    </span>
                                                                    {assignedMember.name}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[var(--text-faint)] italic">Unassigned</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                                                                {canEdit && (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleOpenEdit(project); }}
                                                                        className="p-1 rounded text-[var(--text-faint)] hover:text-[var(--primary-text-muted)] hover:bg-[var(--primary-bg)] transition-colors"
                                                                        title="Edit"
                                                                    >
                                                                        <Pencil className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                                {canDelete && (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setListDeleteConfirmation(''); setListDeleteTarget(project); }}
                                                                        className="p-1 rounded text-[var(--text-faint)] hover:text-[var(--error-text)] hover:bg-[var(--error-bg)] transition-colors"
                                                                        title="Delete"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center min-h-[240px] border border-dashed border-[var(--border)] rounded-xl bg-[var(--bg)] text-center px-6">
                                    <h3 className="text-base font-semibold text-[var(--text)]">No projects found</h3>
                                    <p className="text-sm text-[var(--text-muted)] mt-1">Try changing the filters or search text.</p>
                                </div>
                            )}
                        </div>
                    ) : selectedStatusFilter === 'All' ? (
                        /* ── Kanban view (All statuses) ── */
                        <div className="flex gap-4 h-full min-w-[1200px]">
                            {KANBAN_COLUMNS.map(col => {
                                const colProjects = filteredProjects.filter(p => (p.status || 'Active') === col.id);
                                const isDropTarget = dropTargetStatus === col.id;
                                return (
                                    <div key={col.id} className="flex-1 min-w-[240px] flex flex-col h-full rounded-md overflow-hidden border border-[var(--border)]">
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
                                                    setDropTargetStatus(col.id);
                                                }
                                            }}
                                            onDragLeave={(e) => {
                                                if (!canDragProjects) return;
                                                const nextTarget = e.relatedTarget as Node | null;
                                                if (!e.currentTarget.contains(nextTarget)) {
                                                    setDropTargetStatus(current => current === col.id ? null : current);
                                                }
                                            }}
                                            onDrop={(e) => {
                                                if (!canDragProjects) return;
                                                e.preventDefault();
                                                void handleProjectDropToStatus(col.id);
                                            }}
                                        >
                                            {colProjects.length > 0 ? (
                                                colProjects.map(project => (
                                                    <ProjectCard
                                                        key={project.id}
                                                        project={project}
                                                        onSelect={() => onSelectProject(project.id)}
                                                        onSave={onProjectUpdate}
                                                        onEdit={handleOpenEdit}
                                                        onDelete={onDeleteProject}
                                                        userRole={userRole}
                                                        teamMembers={teamMembers}
                                                        draggable={canDragProjects && !updatingProjectIds.has(project.id)}
                                                        isDragging={draggedProjectId === project.id || updatingProjectIds.has(project.id)}
                                                        onDragStart={(dragProject) => setDraggedProjectId(dragProject.id)}
                                                        onDragEnd={() => {
                                                            setDraggedProjectId(null);
                                                            setDropTargetStatus(null);
                                                        }}
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
                            })}
                        </div>
                    ) : (
                        /* ── Grid view (single status filter) ── */
                        <div className="h-full overflow-y-auto">
                            <div className="flex items-center justify-between mb-5">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedFilterMeta.countBg}`}>
                                        <span className={`w-2.5 h-2.5 rounded-full ${selectedFilterMeta.dot}`} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-[var(--text)]">{sectionTitle}</h2>
                                        <p className="text-sm text-[var(--text-muted)]">{sectionDescription}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg)]">
                                    <span className="text-xs text-[var(--text-muted)] font-medium">Showing</span>
                                    <span className={`text-xs font-bold ${selectedFilterMeta.countText}`}>{filteredProjectCount}</span>
                                </div>
                            </div>

                            {filteredProjects.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {filteredProjects.map(project => (
                                        <ProjectCard
                                            key={project.id}
                                            project={project}
                                            onSelect={() => onSelectProject(project.id)}
                                            onSave={onProjectUpdate}
                                            onEdit={handleOpenEdit}
                                            onDelete={onDeleteProject}
                                            userRole={userRole}
                                            teamMembers={teamMembers}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center min-h-[240px] border border-dashed border-[var(--border)] rounded-xl bg-[var(--bg)] text-center px-6">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${selectedFilterMeta.countBg}`}>
                                        <span className={`w-3 h-3 rounded-full ${selectedFilterMeta.dot}`} />
                                    </div>
                                    <h3 className="text-base font-semibold text-[var(--text)]">No {selectedStatusFilter.toLowerCase()} projects found</h3>
                                    <p className="text-sm text-[var(--text-muted)] mt-1">
                                        Try changing the member filter or search text to widen the results.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <NewProjectModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingProject(null); }}
                onSave={handleSaveProject}
                isLoading={isSavingProject}
                addToast={addToast}
                teamMembers={teamMembers}
                projectToEdit={editingProject}
            />

            <TrashBin
                isOpen={isTrashOpen}
                trash={trash}
                onClose={() => setIsTrashOpen(false)}
                onRestore={onRestoreProject}
                onPermDelete={onPermDeleteProject}
            />

            <AlertDialog open={listDeleteTarget !== null} onOpenChange={open => { if (!open) { setListDeleteTarget(null); setListDeleteConfirmation(''); } }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Move project to trash</AlertDialogTitle>
                        <AlertDialogDescription>
                            <span className="font-medium text-[var(--text)]">{listDeleteTarget?.name}</span> will be moved to trash and <strong>automatically deleted after 30 days</strong>. You can restore it from the Trash before then.
                            <br /><br />
                            Type <span className="font-medium text-[var(--text)]">confirm</span> to proceed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="list-delete-confirm">Confirmation</Label>
                        <Input
                            id="list-delete-confirm"
                            value={listDeleteConfirmation}
                            onChange={(e) => setListDeleteConfirmation(e.target.value)}
                            placeholder='Type "confirm"'
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => { setListDeleteTarget(null); setListDeleteConfirmation(''); }}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => { if (listDeleteTarget) { onDeleteProject(listDeleteTarget.id); setListDeleteTarget(null); setListDeleteConfirmation(''); } }}
                            disabled={listDeleteConfirmation.trim().toLowerCase() !== 'confirm'}
                        >
                            Move to Trash
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default Dashboard;
