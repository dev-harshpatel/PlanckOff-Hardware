'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Project, ProjectStatus, NewProjectData, Toast, Role } from '../types';
import NewProjectModal from '../components/NewProjectModal';
import { TeamMember } from '../types';
import SelectDropdown from '@/components/ui/select-dropdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    Trash2,
    UserPlus,
    Calendar,
    Hash,
    LayoutGrid,
    List,
    FolderOpen,
    ChevronRight,
} from 'lucide-react';

interface DashboardProps {
    projects: Project[];
    onSelectProject: (projectId: string) => void;
    onAddNewProject: (projectData: NewProjectData, doorScheduleFile?: File, hardwareSetFile?: File) => Promise<void>;
    onProjectUpdate: (updatedProject: Project) => Promise<void> | void;
    onDeleteProject: (projectId: string) => void;
    userRole: Role;
    addToast: (toast: Omit<Toast, 'id'>) => void;
    teamMembers: TeamMember[];
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

const STAT_COLORS: Record<string, { text: string; bg: string; dot: string }> = {
    Active:         { text: 'text-[var(--success-text)]', bg: 'bg-[var(--success-bg)]', dot: 'bg-[var(--success-dot)]' },
    'Under Review': { text: 'text-[var(--warning-text)]', bg: 'bg-[var(--warning-bg)]', dot: 'bg-[var(--warning-dot)]' },
    Submitted:      { text: 'text-[var(--primary-text)]', bg: 'bg-[var(--primary-bg)]', dot: 'bg-[var(--primary-action)]' },
    'On Hold':      { text: 'text-[var(--text-muted)]',   bg: 'bg-[var(--bg-muted)]',   dot: 'bg-[var(--text-faint)]' },
    Archived:       { text: 'text-purple-700',             bg: 'bg-purple-50',            dot: 'bg-purple-400' },
};

const ProjectCard: React.FC<{
    project: Project;
    onSelect: () => void;
    onSave: (p: Project) => Promise<void> | void;
    onDelete: (id: string) => void;
    userRole: Role;
    teamMembers: TeamMember[];
}> = ({ project, onSelect, onSave, onDelete, userRole, teamMembers }) => {
    const [showAssignMenu, setShowAssignMenu] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState('');
    const [isAssigning, setIsAssigning] = useState(false);
    const assignMenuRef = useRef<HTMLDivElement | null>(null);

    const canDelete = userRole === Role.Administrator || userRole === Role.SeniorEstimator;
    const canAssign = userRole === Role.Administrator || userRole === Role.SeniorEstimator;

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

    return (
        <>
            <div className="bg-[var(--bg)] rounded-md border border-[var(--border)] hover:border-[var(--primary-border)] hover:shadow-sm transition-all p-4 group relative cursor-pointer" onClick={onSelect}>
                {/* Card header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-[var(--text)] text-sm leading-tight truncate">{project.name}</h4>
                        {project.client && (
                            <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{project.client}</p>
                        )}
                    </div>
                    {/* Hover actions */}
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" ref={assignMenuRef}>
                        {canAssign && (
                            <div className="relative">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setShowAssignMenu(!showAssignMenu); }}
                                    disabled={isAssigning}
                                    title="Assign"
                                    className={`p-1 rounded text-[var(--text-faint)] hover:text-[var(--primary-text-muted)] hover:bg-[var(--primary-bg)] transition-colors disabled:opacity-50 ${project.assignedTo ? 'text-[var(--primary-text-muted)]' : ''}`}
                                >
                                    <UserPlus className="w-3.5 h-3.5" />
                                </button>
                                {showAssignMenu && (
                                    <div className="absolute right-0 mt-1 w-52 bg-[var(--bg)] rounded-md shadow-lg z-50 border border-[var(--border)] py-1" onClick={(e) => e.stopPropagation()}>
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
                    {assignedMember ? (
                        <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-[var(--primary-bg-hover)] text-[var(--primary-text)] flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                                {assignedMember.name.charAt(0)}
                            </div>
                            <span className="text-xs text-[var(--text-muted)] truncate max-w-[100px]">{assignedMember.name}</span>
                        </div>
                    ) : (
                        <span className="text-xs text-[var(--text-faint)] italic">Unassigned</span>
                    )}
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                        {project.status || 'Active'}
                    </span>
                </div>
            </div>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete project</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete <span className="font-medium text-[var(--text)]">{project.name}</span>. Type <span className="font-medium text-[var(--text)]">confirm</span> to proceed.
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
                            Delete project
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};


const Dashboard: React.FC<DashboardProps> = ({ projects, onSelectProject, onAddNewProject, onProjectUpdate, onDeleteProject, userRole, addToast, teamMembers }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('All Members');

    const stats = useMemo(() => {
        const counts: Record<string, number> = {};
        KANBAN_COLUMNS.forEach(col => { counts[col.id] = 0; });
        projects.forEach(p => {
            const status = p.status || 'Active';
            if (counts[status] !== undefined) counts[status]++;
            else counts['Active']++;
        });
        return counts;
    }, [projects]);

    const filteredProjects = useMemo(() => {
        return projects.filter(project => {
            const matchesSearch =
                project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (project.client && project.client.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesMember = selectedMemberFilter === 'All Members' || project.assignedTo === selectedMemberFilter;
            return matchesSearch && matchesMember;
        });
    }, [projects, searchQuery, selectedMemberFilter]);

    const memberFilterOptions = useMemo(() => [
        { value: 'All Members', label: 'All Members' },
        ...teamMembers.map(m => ({ value: m.id, label: m.name })),
    ], [teamMembers]);

    const handleSaveNewProject = async (projectData: NewProjectData, doorScheduleFile?: File, hardwareSetFile?: File) => {
        setIsCreatingProject(true);
        try {
            await onAddNewProject(projectData, doorScheduleFile, hardwareSetFile);
            setIsModalOpen(false);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'An unknown error occurred.';
            addToast({ type: 'error', message: 'Project creation failed', details: message });
        } finally {
            setIsCreatingProject(false);
        }
    };

    const canCreate = userRole === Role.Administrator || userRole === Role.SeniorEstimator;

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
                        {canCreate && (
                            <Button
                                size="sm"
                                onClick={() => setIsModalOpen(true)}
                                className="gap-1.5"
                            >
                                <Plus className="w-4 h-4" />
                                New Project
                            </Button>
                        )}
                    </div>

                    {/* Stat pills */}
                    <div className="flex items-center gap-2 mt-4 flex-wrap">
                        {KANBAN_COLUMNS.map(col => {
                            const count = stats[col.id] ?? 0;
                            return (
                                <div key={col.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--primary-border)] bg-[var(--bg)]`}>
                                    <span className={`w-2 h-2 rounded-full ${col.dot} flex-shrink-0`} />
                                    <span className="text-xs text-[var(--text-muted)] font-medium">{col.label}</span>
                                    <span className={`text-xs font-bold ${col.countText}`}>{count}</span>
                                </div>
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
                            className="w-full"
                            triggerClassName="border-[var(--border)] bg-[var(--bg)] pl-9 pr-3 hover:bg-[var(--bg-subtle)] text-sm"
                            contentClassName="mt-1"
                        />
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                        <button className="p-1.5 rounded-md bg-[var(--primary-bg)] text-[var(--primary-text-muted)] border border-[var(--primary-border)]" title="Grid view">
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 rounded-md text-[var(--text-faint)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-muted)] transition-colors border border-transparent" title="List view">
                            <List className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Kanban board */}
                <div className="flex-grow overflow-x-auto overflow-y-hidden px-6 py-5">
                    <div className="flex gap-4 h-full min-w-[1200px]">
                        {KANBAN_COLUMNS.map(col => {
                            const colProjects = filteredProjects.filter(p => (p.status || 'Active') === col.id);
                            return (
                                <div key={col.id} className="flex-1 min-w-[240px] flex flex-col h-full rounded-md overflow-hidden border border-[var(--border)]">
                                    {/* Column header */}
                                    <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-4 py-2.5 flex items-center justify-between flex-shrink-0">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${col.dot} flex-shrink-0`} />
                                            <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">{col.label}</span>
                                        </div>
                                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${col.countBg} ${col.countText}`}>
                                            {colProjects.length}
                                        </span>
                                    </div>

                                    {/* Column cards (scrollable) */}
                                    <div className="flex-grow overflow-y-auto bg-[var(--bg-subtle)] p-2.5 space-y-2">
                                        {colProjects.length > 0 ? (
                                            colProjects.map(project => (
                                                <ProjectCard
                                                    key={project.id}
                                                    project={project}
                                                    onSelect={() => onSelectProject(project.id)}
                                                    onSave={onProjectUpdate}
                                                    onDelete={onDeleteProject}
                                                    userRole={userRole}
                                                    teamMembers={teamMembers}
                                                />
                                            ))
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-24 border border-dashed border-[var(--border)] rounded-md bg-[var(--bg)]/60 text-center">
                                                <span className="text-xs text-[var(--text-faint)]">No projects</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <NewProjectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveNewProject}
                isLoading={isCreatingProject}
                addToast={addToast}
                teamMembers={teamMembers}
            />
        </>
    );
};

export default Dashboard;
