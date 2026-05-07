'use client';

import React, { useMemo, useState } from 'react';
import { Project, ProjectStatus, NewProjectData, Toast } from '../types';
import NewProjectModal from '../components/projects/NewProjectModal';
import TrashBin from '../components/shared/TrashBin';
import { TeamMember } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { RoleName } from '@/types/auth';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Calendar, FolderOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { ERRORS } from '@/constants/errors';
import { useModalState } from '../hooks/useModalState';
import { useDashboardState } from '../hooks/useDashboardState';
import { ProjectCard } from '../components/dashboard/ProjectCard';
import { DashboardFilters } from '../components/dashboard/DashboardFilters';
import { KanbanColumn } from '../components/dashboard/KanbanColumn';
import {
    KANBAN_COLUMNS, buildProjectStats, filterProjectsByDashboardState,
} from '../utils/dashboardUtils';

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

const Dashboard: React.FC<DashboardProps> = ({ projects, trash, onSelectProject, onAddNewProject, onProjectUpdate, onDeleteProject, onRestoreProject, onPermDeleteProject, userRole, addToast, teamMembers, isLoadingTeamMembers = false }) => {
    const { isOpen: isModalOpen, item: editingProject, open: openProjectModal, close: closeProjectModal } = useModalState<Project>();
    const [isSavingProject, setIsSavingProject] = useState(false);
    const { isOpen: isTrashOpen, open: openTrash, close: closeTrash } = useModalState();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('All Members');
    const [selectedStatusFilter, setSelectedStatusFilter] = useState<ProjectStatus | 'All'>('All');
    const {
        draggedProjectId, setDraggedProjectId,
        dropTargetStatus, setDropTargetStatus,
        updatingProjectIds,
        effectiveProjects,
        handleProjectDropToStatus,
    } = useDashboardState({ projects, onProjectUpdate, addToast });
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [listDeleteTarget, setListDeleteTarget] = useState<Project | null>(null);
    const [listDeleteConfirmation, setListDeleteConfirmation] = useState('');

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
            closeProjectModal();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'An unknown error occurred.';
            addToast({ type: 'error', message: ERRORS.GENERAL.SAVE_FAILED.message, details: message });
        } finally {
            setIsSavingProject(false);
        }
    };

    const handleOpenCreate = () => {
        openProjectModal();
    };

    const handleOpenEdit = (project: Project) => {
        openProjectModal(project);
    };

    const canCreate = userRole === 'Administrator' || userRole === 'Team Lead';
    const canDragProjects = userRole === 'Administrator' || userRole === 'Team Lead';

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
                                onClick={() => openTrash()}
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

                <DashboardFilters
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    selectedMemberFilter={selectedMemberFilter}
                    onMemberFilterChange={setSelectedMemberFilter}
                    memberFilterOptions={memberFilterOptions}
                    isLoadingTeamMembers={isLoadingTeamMembers}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                />

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
                            {KANBAN_COLUMNS.map(col => (
                                <KanbanColumn
                                    key={col.id}
                                    col={col}
                                    colProjects={filteredProjects.filter(p => (p.status || 'Active') === col.id)}
                                    isDropTarget={dropTargetStatus === col.id}
                                    canDragProjects={canDragProjects}
                                    draggedProjectId={draggedProjectId}
                                    updatingProjectIds={updatingProjectIds}
                                    dropTargetStatus={dropTargetStatus}
                                    onSetDropTarget={setDropTargetStatus}
                                    onDropToStatus={handleProjectDropToStatus}
                                    onSelectProject={onSelectProject}
                                    onProjectUpdate={onProjectUpdate}
                                    onEditProject={handleOpenEdit}
                                    onDeleteProject={onDeleteProject}
                                    onDragStart={(p) => setDraggedProjectId(p.id)}
                                    onDragEnd={() => { setDraggedProjectId(null); setDropTargetStatus(null); }}
                                    userRole={userRole}
                                    teamMembers={teamMembers}
                                />
                            ))}
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
                onClose={closeProjectModal}
                onSave={handleSaveProject}
                isLoading={isSavingProject}
                addToast={addToast}
                teamMembers={teamMembers}
                projectToEdit={editingProject}
            />

            <TrashBin
                isOpen={isTrashOpen}
                trash={trash}
                onClose={closeTrash}
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
