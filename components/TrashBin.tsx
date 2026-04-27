'use client';

import React, { useState } from 'react';
import {
  Trash2, RotateCcw, X, Calendar, Hash, AlertTriangle,
  Clock, FolderOpen, Loader2,
} from 'lucide-react';
import { Project } from '../types';
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

interface TrashBinProps {
  isOpen: boolean;
  trash: Project[];
  onClose: () => void;
  onRestore: (id: string) => Promise<void> | void;
  onPermDelete: (id: string) => Promise<void> | void;
}

const TRASH_TTL_DAYS = 30;

function getDaysLeft(deletedAt: string): number {
  const deletedMs = new Date(deletedAt).getTime();
  const expiresMs = deletedMs + TRASH_TTL_DAYS * 24 * 60 * 60 * 1000;
  const remaining = Math.ceil((expiresMs - Date.now()) / (24 * 60 * 60 * 1000));
  return Math.max(0, remaining);
}

function formatDeletedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface CountdownBadgeProps { daysLeft: number }

const CountdownBadge: React.FC<CountdownBadgeProps> = ({ daysLeft }) => {
  let bg: string;
  let text: string;
  let dot: string;
  let label: string;

  if (daysLeft > 20) {
    bg = 'bg-green-500/10 border-green-400/30';
    text = 'text-green-600 dark:text-green-400';
    dot = 'bg-green-500';
    label = `${daysLeft}d left`;
  } else if (daysLeft > 10) {
    bg = 'bg-amber-500/10 border-amber-400/30';
    text = 'text-amber-600 dark:text-amber-400';
    dot = 'bg-amber-500';
    label = `${daysLeft}d left`;
  } else if (daysLeft > 5) {
    bg = 'bg-orange-500/10 border-orange-400/30';
    text = 'text-orange-600 dark:text-orange-400';
    dot = 'bg-orange-500';
    label = `${daysLeft}d left`;
  } else if (daysLeft > 0) {
    bg = 'bg-red-500/10 border-red-400/30';
    text = 'text-red-600 dark:text-red-400';
    dot = 'bg-red-500';
    label = `${daysLeft}d left`;
  } else {
    bg = 'bg-red-500/20 border-red-500/40';
    text = 'text-red-700 dark:text-red-300';
    dot = 'bg-red-600';
    label = 'Expiring soon';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${bg} ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
      {label}
    </span>
  );
};

const TrashBin: React.FC<TrashBinProps> = ({ isOpen, trash, onClose, onRestore, onPermDelete }) => {
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  if (!isOpen) return null;

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    try { await onRestore(id); } finally { setRestoringId(null); }
  };

  const handlePermDelete = (id: string, name: string) => {
    setPendingDelete({ id, name });
  };

  const confirmPermDelete = async () => {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setPendingDelete(null);
    setDeletingId(id);
    try { await onPermDelete(id); } finally { setDeletingId(null); }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer — slides in from the right */}
      <div className="fixed inset-y-0 right-0 z-50 flex flex-col w-full max-w-lg bg-[var(--bg)] border-l border-[var(--border)] shadow-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)] bg-[var(--primary-bg)] flex-shrink-0">
          <div className="p-1.5 rounded-lg bg-[var(--bg-muted)]">
            <Trash2 className="w-4 h-4 text-[var(--text-faint)]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-[var(--text)]">Trash</h2>
            <p className="text-xs text-[var(--text-faint)] mt-0.5">
              Projects are permanently deleted after {TRASH_TTL_DAYS} days.
            </p>
          </div>
          {trash.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-[var(--bg-muted)] border border-[var(--border)] text-xs font-bold text-[var(--text-muted)]">
              {trash.length}
            </span>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--text-faint)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning banner */}
        {trash.length > 0 && (
          <div className="flex items-start gap-2 px-5 py-3 bg-amber-500/8 border-b border-amber-400/20 flex-shrink-0">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
              Deleted projects are kept for <strong>{TRASH_TTL_DAYS} days</strong> then automatically and permanently removed. Restore a project to prevent deletion.
            </p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {trash.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
              <div className="w-14 h-14 rounded-full bg-[var(--bg-subtle)] border border-[var(--border)] flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-[var(--text-faint)]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Trash is empty</p>
                <p className="text-xs text-[var(--text-faint)] mt-1">Deleted projects will appear here.</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {trash.map(project => {
                const daysLeft = project.deletedAt ? getDaysLeft(project.deletedAt) : TRASH_TTL_DAYS;
                const isRestoring = restoringId === project.id;
                const isDeleting = deletingId === project.id;

                return (
                  <div key={project.id} className="px-5 py-4 hover:bg-[var(--bg-subtle)] transition-colors">
                    {/* Project name + badge */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FolderOpen className="w-4 h-4 text-[var(--text-faint)] flex-shrink-0" />
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-[var(--text)] truncate">{project.name}</h3>
                          {project.client && (
                            <p className="text-xs text-[var(--text-muted)] truncate">{project.client}</p>
                          )}
                        </div>
                      </div>
                      <CountdownBadge daysLeft={daysLeft} />
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-3 text-xs text-[var(--text-faint)] mb-3">
                      {project.deletedAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Deleted {formatDeletedDate(project.deletedAt)}
                        </span>
                      )}
                      {project.dueDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Due {project.dueDate}
                        </span>
                      )}
                      {project.projectNumber && (
                        <span className="flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          <span className="font-mono">{project.projectNumber}</span>
                        </span>
                      )}
                    </div>

                    {/* Status + actions */}
                    <div className="flex items-center justify-between">
                      {project.status && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--bg-muted)] border border-[var(--border)] text-[var(--text-muted)]">
                          {project.status}
                        </span>
                      )}
                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          onClick={() => handlePermDelete(project.id, project.name)}
                          disabled={isDeleting || isRestoring}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[var(--text-faint)] hover:text-red-500 border border-[var(--border)] hover:border-red-400/50 rounded-lg transition-colors disabled:opacity-40"
                          title="Permanently delete"
                        >
                          {isDeleting
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Trash2 className="w-3 h-3" />
                          }
                          Delete
                        </button>
                        <button
                          onClick={() => handleRestore(project.id)}
                          disabled={isRestoring || isDeleting}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[var(--primary-text)] bg-[var(--primary-bg)] hover:bg-[var(--primary-bg-hover)] border border-[var(--primary-border)] rounded-lg transition-colors disabled:opacity-40"
                          title="Restore project"
                        >
                          {isRestoring
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <RotateCcw className="w-3 h-3" />
                          }
                          Restore
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-[var(--text)]">&ldquo;{pendingDelete?.name}&rdquo;</span> will be permanently deleted and cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPermDelete}>Delete permanently</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TrashBin;
