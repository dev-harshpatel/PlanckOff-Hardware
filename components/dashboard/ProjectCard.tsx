'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Project, ProjectStatus } from '../../types';
import { TeamMember } from '../../types';
import type { RoleName } from '@/types/auth';
import { getDueDateHighlight } from '@/utils/dashboardUtils';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil, Trash2, UserPlus, Calendar, Hash, Users } from 'lucide-react';
import { AssignDropdown } from './AssignDropdown';

const formatDate = (isoDate?: string): string => {
    if (!isoDate) return 'N/A';
    const date = new Date(isoDate + 'T00:00:00');
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

const STAT_COLORS: Record<string, { text: string; bg: string; dot: string }> = {
    Active:         { text: 'text-[var(--success-text)]', bg: 'bg-[var(--success-bg)]', dot: 'bg-[var(--success-dot)]' },
    'Under Review': { text: 'text-[var(--warning-text)]', bg: 'bg-[var(--warning-bg)]', dot: 'bg-[var(--warning-dot)]' },
    Submitted:      { text: 'text-[var(--primary-text)]', bg: 'bg-[var(--primary-bg)]', dot: 'bg-[var(--primary-action)]' },
    Client:         { text: 'text-teal-700',               bg: 'bg-teal-50',              dot: 'bg-teal-400' },
    'On Hold':      { text: 'text-[var(--text-muted)]',   bg: 'bg-[var(--bg-muted)]',   dot: 'bg-[var(--text-faint)]' },
    Archived:       { text: 'text-purple-700',             bg: 'bg-purple-50',            dot: 'bg-purple-400' },
};

export interface ProjectCardProps {
    project: Project;
    onSelect: () => void;
    onSave: (p: Project) => Promise<void> | void;
    onEdit: (project: Project) => void;
    onDelete: (id: string) => void;
    onAssignClient?: (clientId: string) => Promise<void>;
    onUnassignClient?: (clientId: string) => Promise<void>;
    userRole: RoleName;
    teamMembers: TeamMember[];
    draggable?: boolean;
    isDragging?: boolean;
    onDragStart?: (project: Project) => void;
    onDragEnd?: () => void;
}

export function ProjectCard({
    project,
    onSelect,
    onSave,
    onEdit,
    onDelete,
    onAssignClient,
    onUnassignClient,
    userRole,
    teamMembers,
    draggable = false,
    isDragging = false,
    onDragStart,
    onDragEnd,
}: ProjectCardProps) {
    const [showAssignMenu, setShowAssignMenu] = useState(false);
    const [showClientMenu, setShowClientMenu] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState('');
    const [isAssigning, setIsAssigning] = useState(false);
    const [isAssigningClient, setIsAssigningClient] = useState(false);
    const assignMenuRef = useRef<HTMLDivElement | null>(null);
    const assignBtnRef = useRef<HTMLButtonElement>(null);
    const clientBtnRef = useRef<HTMLButtonElement>(null);
    const suppressClickRef = useRef(false);

    const canDelete = userRole === 'Administrator' || userRole === 'Team Lead';
    const canAssign = userRole === 'Administrator' || userRole === 'Team Lead';
    const canEdit = userRole === 'Administrator' || userRole === 'Team Lead';

    const dueDateHighlight = userRole !== 'Client' ? getDueDateHighlight(project.dueDate, project.status, project.clientIds) : null;
    const cardHighlightClass = dueDateHighlight === 'red'
        ? 'bg-[var(--error-bg)] border-[var(--error-border)] hover:border-[var(--error-text)]'
        : dueDateHighlight === 'yellow'
            ? 'bg-[var(--warning-bg)] border-[var(--warning-border)] hover:border-[var(--warning-text)]'
            : 'bg-[var(--bg)] border-[var(--border)] hover:border-[var(--primary-border)]';

    const assignedMember = teamMembers.find(m => m.id === project.assignedTo);
    // Separate staff (estimator-assignable) from client members
    const staffMembers = teamMembers.filter(m => (m.role as string) !== 'Client');
    const clientMembers = teamMembers.filter(m => (m.role as string) === 'Client');
    // Clients who have access to this project
    const assignedClients = project.clientIds?.length
        ? teamMembers.filter(m => project.clientIds!.includes(m.id))
        : [];

    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            if (!assignMenuRef.current?.contains(event.target as Node)) {
                setShowAssignMenu(false);
                setShowClientMenu(false);
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

    const handleUnassignEstimator = async () => {
        try {
            setIsAssigning(true);
            const hasClient = (project.clientIds?.length ?? 0) > 0;
            // Pass assignedTo: '' so the db layer converts it to null (undefined is skipped)
            await onSave({
                ...project,
                assignedTo: '',
                status: hasClient ? project.status : 'Active',
            });
            setShowAssignMenu(false);
        } finally {
            setIsAssigning(false);
        }
    };

    const handleClientToggle = async (clientId: string) => {
        const isAssigned = project.clientIds?.includes(clientId) ?? false;
        const callback = isAssigned ? onUnassignClient : onAssignClient;
        if (!callback) return;
        try {
            setIsAssigningClient(true);
            await callback(clientId);
            setShowClientMenu(false);
        } finally {
            setIsAssigningClient(false);
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
                className={`rounded-md border hover:shadow-sm transition-all p-4 group relative cursor-pointer ${isDragging ? 'opacity-50 border-[var(--primary-ring)] shadow-sm bg-[var(--bg)]' : cardHighlightClass}`}
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
                {/* Status dot — top-right corner, fades on hover to reveal action buttons */}
                <div
                    className={`absolute top-3 right-3 w-2 h-2 rounded-full transition-opacity group-hover:opacity-0 ${statusStyle.dot}`}
                    title={project.status || 'Active'}
                />

                {/* Card header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-[var(--text)] text-sm leading-tight truncate">{project.name}</h4>
                        {project.client && userRole !== 'Estimator' && userRole !== 'Client' && (
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
                <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-subtle)]" ref={assignMenuRef}>
                    {userRole !== 'Client' && (<>
                    {canAssign && (
                        <div className="relative">
                            <button
                                ref={assignBtnRef}
                                onClick={(e) => { e.stopPropagation(); setShowClientMenu(false); setShowAssignMenu(!showAssignMenu); }}
                                disabled={isAssigning}
                                title="Assign estimator"
                                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors disabled:opacity-50 ${project.assignedTo ? 'text-[var(--primary-text-muted)] hover:bg-[var(--primary-bg)]' : 'text-[var(--text-faint)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-muted)]'}`}
                            >
                                {assignedMember ? (
                                    <>
                                        <div className="w-4 h-4 rounded-full bg-[var(--primary-bg-hover)] text-[var(--primary-text)] flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                                            {assignedMember.name.charAt(0)}
                                        </div>
                                        <span className="truncate max-w-[64px]">{assignedMember.name}</span>
                                    </>
                                ) : (
                                    <>
                                        <UserPlus className="w-3 h-3" />
                                        Assign
                                    </>
                                )}
                            </button>
                            {showAssignMenu && (
                                <AssignDropdown
                                    triggerRef={assignBtnRef}
                                    members={staffMembers}
                                    selectedId={project.assignedTo}
                                    onSelect={(id) => handleAssign(id)}
                                    onUnassign={project.assignedTo ? handleUnassignEstimator : undefined}
                                    isLoading={isAssigning}
                                    header="Assign To"
                                    searchPlaceholder="Search team members…"
                                />
                            )}
                        </div>
                    )}
                    {canAssign && onAssignClient && clientMembers.length > 0 && (
                        <div className="relative">
                            <button
                                ref={clientBtnRef}
                                onClick={(e) => { e.stopPropagation(); setShowAssignMenu(false); setShowClientMenu(!showClientMenu); }}
                                disabled={isAssigningClient}
                                title="Manage client access"
                                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors disabled:opacity-50 ${assignedClients.length > 0 ? 'text-blue-600 hover:bg-blue-50' : 'text-[var(--text-faint)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-muted)]'}`}
                            >
                                {assignedClients.length > 0 ? (
                                    <>
                                        <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                                            {assignedClients[0].name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="truncate max-w-[64px]">{assignedClients[0].name}</span>
                                        {assignedClients.length > 1 && (
                                            <span className="flex-shrink-0 text-[9px] font-bold bg-blue-100 text-blue-600 rounded-full px-1">
                                                +{assignedClients.length - 1}
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <Users className="w-3 h-3" />
                                        Clients
                                    </>
                                )}
                            </button>
                            {showClientMenu && (
                                <AssignDropdown
                                    triggerRef={clientBtnRef}
                                    members={clientMembers}
                                    selectedIds={project.clientIds ?? []}
                                    onSelect={handleClientToggle}
                                    isLoading={isAssigningClient}
                                    header="Client Access"
                                    searchPlaceholder="Search clients…"
                                />
                            )}
                        </div>
                    )}
                    </>)}
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
}
