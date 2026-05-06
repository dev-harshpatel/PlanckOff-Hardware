'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Project, ProjectStatus } from '../../types';
import { TeamMember } from '../../types';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil, Trash2, UserPlus, Calendar, Hash } from 'lucide-react';

const formatDate = (isoDate?: string): string => {
    if (!isoDate) return 'N/A';
    const date = new Date(isoDate + 'T00:00:00');
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

const STAT_COLORS: Record<string, { text: string; bg: string; dot: string }> = {
    Active:         { text: 'text-[var(--success-text)]', bg: 'bg-[var(--success-bg)]', dot: 'bg-[var(--success-dot)]' },
    'Under Review': { text: 'text-[var(--warning-text)]', bg: 'bg-[var(--warning-bg)]', dot: 'bg-[var(--warning-dot)]' },
    Submitted:      { text: 'text-[var(--primary-text)]', bg: 'bg-[var(--primary-bg)]', dot: 'bg-[var(--primary-action)]' },
    'On Hold':      { text: 'text-[var(--text-muted)]',   bg: 'bg-[var(--bg-muted)]',   dot: 'bg-[var(--text-faint)]' },
    Archived:       { text: 'text-purple-700',             bg: 'bg-purple-50',            dot: 'bg-purple-400' },
};

export interface ProjectCardProps {
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
}

export function ProjectCard({
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
}: ProjectCardProps) {
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
}
