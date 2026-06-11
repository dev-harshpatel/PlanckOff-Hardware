'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import type { UnifiedMember } from '@/lib/db/team';
import type { Project } from '@/types';
import {
  Mail,
  Calendar,
  FolderOpen,
  X,
  Loader2,
  ShieldCheck,
  Users,
  UserCog,
  User,
  AlertCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Static config maps
// ---------------------------------------------------------------------------

const ROLE_CONFIG: Record<string, {
  label: string;
  headerGradient: string;
  avatarBg: string;
  badgeBg: string;
  badgeText: string;
  icon: React.ReactNode;
}> = {
  Administrator: {
    label: 'Administrator',
    headerGradient: 'from-purple-50 via-purple-50/60 to-transparent',
    avatarBg: 'bg-gradient-to-br from-purple-500 to-purple-700',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-700',
    icon: <ShieldCheck className="w-3 h-3" />,
  },
  'Team Lead': {
    label: 'Team Lead',
    headerGradient: 'from-[var(--primary-bg)] via-[var(--primary-bg)]/60 to-transparent',
    avatarBg: 'bg-gradient-to-br from-[var(--primary-action)] to-blue-600',
    badgeBg: 'bg-[var(--primary-bg-hover)]',
    badgeText: 'text-[var(--primary-text)]',
    icon: <UserCog className="w-3 h-3" />,
  },
  Estimator: {
    label: 'Estimator',
    headerGradient: 'from-emerald-50 via-emerald-50/60 to-transparent',
    avatarBg: 'bg-gradient-to-br from-emerald-500 to-green-700',
    badgeBg: 'bg-[var(--success-bg)]',
    badgeText: 'text-[var(--success-text)]',
    icon: <Users className="w-3 h-3" />,
  },
  Client: {
    label: 'Client',
    headerGradient: 'from-sky-50 via-sky-50/60 to-transparent',
    avatarBg: 'bg-gradient-to-br from-sky-400 to-blue-600',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
    icon: <User className="w-3 h-3" />,
  },
};

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  Active:   { bg: 'bg-[var(--success-bg)]',  text: 'text-[var(--success-text)]', dot: 'bg-[var(--success-dot)]' },
  Invited:  { bg: 'bg-[var(--warning-bg)]',  text: 'text-[var(--warning-text)]', dot: 'bg-amber-400' },
  Inactive: { bg: 'bg-[var(--bg-muted)]',    text: 'text-[var(--text-muted)]',   dot: 'bg-[var(--text-faint)]' },
};

const PROJECT_STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  Active:         { bg: 'bg-[var(--success-bg)]',  text: 'text-[var(--success-text)]', dot: 'bg-[var(--success-dot)]' },
  'Under Review': { bg: 'bg-[var(--warning-bg)]',  text: 'text-[var(--warning-text)]', dot: 'bg-amber-400' },
  Submitted:      { bg: 'bg-[var(--primary-bg)]',  text: 'text-[var(--primary-text)]', dot: 'bg-[var(--primary-action)]' },
  'On Hold':      { bg: 'bg-[var(--bg-muted)]',    text: 'text-[var(--text-muted)]',   dot: 'bg-[var(--text-faint)]' },
  Archived:       { bg: 'bg-purple-50',             text: 'text-purple-700',            dot: 'bg-purple-400' },
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MemberDetailsModalProps {
  member: UnifiedMember | null;
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MemberDetailsModal({ member, isOpen, onClose }: MemberDetailsModalProps) {
  const [projects, setProjects]   = useState<Project[]>([]);
  const [loading, setLoading]     = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const showProjects = member?.role === 'Client' || member?.role === 'Estimator';

  const fetchProjects = useCallback(async () => {
    if (!member || !showProjects) return;
    setLoading(true);
    setFetchError(null);
    try {
      const res  = await fetch(`/api/team/members/${member.id}/projects`, { credentials: 'include' });
      const json = await res.json() as { data?: Project[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to load projects.');
      setProjects(json.data ?? []);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load projects.');
    } finally {
      setLoading(false);
    }
  }, [member, showProjects]);

  useEffect(() => {
    if (isOpen && member) {
      setProjects([]);
      setFetchError(null);
      fetchProjects();
    }
  }, [isOpen, member, fetchProjects]);

  const handleUnassign = async (projectId: string) => {
    if (!member) return;
    setRemovingId(projectId);
    try {
      const res  = await fetch(`/api/team/members/${member.id}/projects/${projectId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to unassign.');
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch {
      // error is transient — just re-enable the button
    } finally {
      setRemovingId(null);
    }
  };

  if (!member) return null;

  const role     = ROLE_CONFIG[member.role] ?? ROLE_CONFIG['Estimator'];
  const status   = STATUS_CONFIG[member.status] ?? STATUS_CONFIG['Active'];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="p-0 gap-0 max-w-lg rounded-2xl overflow-hidden">
        <DialogTitle className="sr-only">{member.name} — Member Details</DialogTitle>

        {/* ── Header ── */}
        <div className={`relative bg-gradient-to-b ${role.headerGradient} px-6 pt-6 pb-5`}>
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-[var(--text-faint)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className={`w-16 h-16 rounded-2xl ${role.avatarBg} flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 shadow-lg`}>
              {member.initials}
            </div>

            {/* Name / email / badges */}
            <div className="flex-1 min-w-0 pt-0.5">
              <h2 className="text-xl font-bold text-[var(--text)] leading-tight truncate">{member.name}</h2>
              <div className="flex items-center gap-1.5 mt-1">
                <Mail className="w-3.5 h-3.5 text-[var(--text-faint)] flex-shrink-0" />
                <span className="text-sm text-[var(--text-muted)] truncate">{member.email}</span>
              </div>

              {/* Role + Status row */}
              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${role.badgeBg} ${role.badgeText}`}>
                  {role.icon}
                  {role.label}
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${status.bg} ${status.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                  {member.status}
                </span>
              </div>
            </div>
          </div>

          {/* Meta strip */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[var(--border-subtle)]">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <Calendar className="w-3.5 h-3.5 text-[var(--text-faint)]" />
              <span>Joined {formatDate(member.createdAt)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-faint)]" />
              <span className="capitalize">{member.source === 'admin' ? 'Admin account' : 'Team member'}</span>
            </div>
          </div>
        </div>

        {/* ── Projects section ── */}
        <div className="px-6 py-5">
          {showProjects ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-[var(--text-faint)]" />
                  <h3 className="text-sm font-semibold text-[var(--text)]">Assigned Projects</h3>
                  {!loading && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--bg-muted)] text-[10px] font-bold text-[var(--text-muted)]">
                      {projects.length}
                    </span>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-[var(--text-faint)]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Loading projects…</span>
                </div>
              ) : fetchError ? (
                <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-[var(--error-bg)] text-[var(--error-text)]">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs">{fetchError}</span>
                </div>
              ) : projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-10 h-10 rounded-xl bg-[var(--bg-muted)] flex items-center justify-center mb-2">
                    <FolderOpen className="w-5 h-5 text-[var(--text-faint)]" />
                  </div>
                  <p className="text-sm font-medium text-[var(--text-faint)]">No projects assigned</p>
                  <p className="text-xs text-[var(--text-faint)] mt-0.5">Assign projects from the dashboard.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
                  {projects.map((project) => {
                    const ps = PROJECT_STATUS_CONFIG[project.status ?? 'Active'] ?? PROJECT_STATUS_CONFIG['Active'];
                    const isRemoving = removingId === project.id;
                    return (
                      <div
                        key={project.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--bg-subtle)] transition-colors group"
                      >
                        {/* Project icon */}
                        <div className="w-7 h-7 rounded-lg bg-[var(--bg-muted)] flex items-center justify-center flex-shrink-0">
                          <FolderOpen className="w-3.5 h-3.5 text-[var(--text-faint)]" />
                        </div>

                        {/* Name */}
                        <span className="flex-1 text-sm font-medium text-[var(--text)] truncate">{project.name}</span>

                        {/* Status badge */}
                        <span className={`flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${ps.bg} ${ps.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${ps.dot}`} />
                          {project.status ?? 'Active'}
                        </span>

                        {/* Unassign button */}
                        <button
                          onClick={() => handleUnassign(project.id)}
                          disabled={isRemoving}
                          title="Remove project access"
                          className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[var(--text-faint)] hover:text-[var(--error-text)] hover:bg-[var(--error-bg)] opacity-0 group-hover:opacity-100 disabled:opacity-50 transition-all"
                        >
                          {isRemoving
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <X className="w-3 h-3" />
                          }
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-[var(--bg-muted)] border border-[var(--border-subtle)]">
              <ShieldCheck className="w-4 h-4 text-[var(--text-faint)] flex-shrink-0" />
              <p className="text-xs text-[var(--text-muted)]">
                {member.role === 'Administrator' || member.role === 'Team Lead'
                  ? `${role.label}s have access to all projects.`
                  : 'No project assignment for this role.'}
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-subtle)] transition-colors"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
