'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/hooks/useRBAC';
import { InviteTeamMemberModal } from '@/components/team/InviteTeamMemberModal';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { RoleName } from '@/types/auth';
import type { UnifiedMember } from '@/lib/db/team';
import {
  Shield,
  Star,
  Users,
  User,
  Mail,
  Plus,
  Loader2,
  RotateCcw,
  Copy,
  Check,
  Clock,
  AlertCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Role group config
// ---------------------------------------------------------------------------

const ROLE_GROUPS: { role: RoleName; label: string; icon: React.ReactNode; iconBg: string }[] = [
  {
    role: 'Administrator',
    label: 'Administrators',
    icon: <Shield className="w-4 h-4 text-purple-600" />,
    iconBg: 'bg-purple-100',
  },
  {
    role: 'Team Lead',
    label: 'Team Leads',
    icon: <Star className="w-4 h-4 text-[var(--primary-text-muted)]" />,
    iconBg: 'bg-[var(--primary-bg-hover)]',
  },
  {
    role: 'Estimator',
    label: 'Estimators',
    icon: <Users className="w-4 h-4 text-green-600" />,
    iconBg: 'bg-[var(--success-bg)]',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ExpiryInfo {
  label: string;
  isExpired: boolean;
}

function getExpiryInfo(expiresAt: string | null): ExpiryInfo {
  if (!expiresAt) return { label: '', isExpired: false };
  const now = Date.now();
  const exp = new Date(expiresAt).getTime();
  if (exp <= now) return { label: 'Expired', isExpired: true };
  const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
  if (diffDays === 1) return { label: 'Expires today', isExpired: false };
  return { label: `Expires in ${diffDays}d`, isExpired: false };
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

function Avatar({ initials, role }: { initials: string; role: RoleName }) {
  const colors: Record<RoleName, string> = {
    Administrator: 'bg-purple-100 text-purple-700',
    'Team Lead':   'bg-[var(--primary-bg-hover)] text-[var(--primary-text)]',
    Estimator:     'bg-[var(--success-bg)] text-[var(--success-text)]',
  };
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${colors[role]}`}>
      {initials}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status, expiresAt }: { status: 'Active' | 'Invited'; expiresAt: string | null }) {
  if (status === 'Active') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--success-text)] uppercase tracking-wide bg-[var(--success-bg)] border border-[var(--success-border)] px-2 py-0.5 rounded">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--success-bg)]0 flex-shrink-0" />
        Active
      </span>
    );
  }

  const { label, isExpired } = getExpiryInfo(expiresAt);

  return (
    <div className="flex items-center gap-1.5">
      <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--warning-text)] uppercase tracking-wide bg-[var(--warning-bg)] border border-[var(--warning-border)] px-2 py-0.5 rounded">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
        Invited
      </span>
      {label && (
        <span className={`flex items-center gap-0.5 text-[10px] font-medium ${isExpired ? 'text-red-500 dark:text-red-400' : 'text-[var(--text-faint)]'}`}>
          {isExpired
            ? <AlertCircle className="w-2.5 h-2.5" />
            : <Clock className="w-2.5 h-2.5" />
          }
          {label}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resend feedback type
// ---------------------------------------------------------------------------

interface ResendFeedback {
  emailSent: boolean;
  inviteLink?: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TeamPage() {
  const { user } = useAuth();
  const { canManageTeam } = useRBAC();

  const [members, setMembers] = useState<UnifiedMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaultRole, setModalDefaultRole] = useState<RoleName | undefined>();

  // Per-member resend state
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendFeedback, setResendFeedback] = useState<Record<string, ResendFeedback>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/team/members', { credentials: 'include' });
      if (res.ok) {
        const json = (await res.json()) as { data: UnifiedMember[] };
        setMembers(json.data ?? []);
      }
    } catch {
      // silently ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const handleOpenInvite = (role?: RoleName) => {
    setModalDefaultRole(role);
    setModalOpen(true);
  };

  const handleResendInvite = async (member: UnifiedMember) => {
    setResendingId(member.id);
    // Clear any previous feedback for this member
    setResendFeedback(prev => {
      const next = { ...prev };
      delete next[member.id];
      return next;
    });

    try {
      const res  = await fetch(`/api/team/members/${member.id}/resend-invite`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json() as {
        success?: boolean;
        emailSent?: boolean;
        inviteLink?: string;
        error?: string;
      };

      if (!res.ok) throw new Error(json.error ?? 'Resend failed.');

      const feedback: ResendFeedback = {
        emailSent: json.emailSent ?? false,
        inviteLink: json.inviteLink,
      };
      setResendFeedback(prev => ({ ...prev, [member.id]: feedback }));

      // Refresh member list so the new expiry date is reflected
      await fetchMembers();

      // Auto-clear success feedback after 6 seconds (unless there's a link to copy)
      if (json.emailSent) {
        setTimeout(() => {
          setResendFeedback(prev => {
            const next = { ...prev };
            delete next[member.id];
            return next;
          });
        }, 6000);
      }
    } catch {
      setResendFeedback(prev => ({
        ...prev,
        [member.id]: { emailSent: false },
      }));
    } finally {
      setResendingId(null);
    }
  };

  const handleCopyLink = async (memberId: string, link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(memberId);
      setTimeout(() => setCopiedId(c => (c === memberId ? null : c)), 2500);
    } catch {
      // clipboard access denied — do nothing
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-subtle)]">

      {/* Page header */}
      <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-[var(--primary-bg-hover)] flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4 text-[var(--primary-text-muted)]" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-[var(--text)] leading-tight">Team Management</h1>
            <p className="text-xs text-[var(--primary-text-muted)]">Manage roles, permissions, and team members</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--primary-border)] bg-[var(--bg)]">
              <span className="text-xs text-[var(--text-muted)] font-medium">Members</span>
              <span className="text-xs font-bold text-[var(--primary-text)]">{members.length}</span>
            </div>
            {canManageTeam && (
              <Button
                size="sm"
                onClick={() => handleOpenInvite()}
                className="gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add Member
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-grow overflow-y-auto px-6 py-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          </div>
        ) : (
          <div className="max-w-3xl">
            <Tabs defaultValue="Administrator">
              {/* Tab list */}
              <TabsList className="bg-[var(--bg)] border border-[var(--border)] p-0.5 h-auto gap-0.5 mb-4">
                {ROLE_GROUPS.map(({ role, label, icon, iconBg }) => {
                  const count = members.filter(m => m.role === role).length;
                  return (
                    <TabsTrigger
                      key={role}
                      value={role}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium data-[state=active]:bg-[var(--primary-bg)] data-[state=active]:text-[var(--primary-text)] data-[state=active]:shadow-none rounded-sm"
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                        {icon}
                      </div>
                      {label}
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--bg-muted)] text-[10px] font-bold text-[var(--text-muted)] data-[state=active]:bg-[var(--primary-bg-hover)] data-[state=active]:text-[var(--primary-text)]">
                        {count}
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {/* Tab panels */}
              {ROLE_GROUPS.map(({ role, label, icon, iconBg }) => {
                const groupMembers = members.filter(m => m.role === role);
                return (
                  <TabsContent key={role} value={role} className="mt-0">
                    <div className="bg-[var(--bg)] rounded-md border border-[var(--border)] overflow-hidden">
                      {/* Panel header */}
                      <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-5 py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                            {icon}
                          </div>
                          <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">{label}</span>
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--bg)] border border-[var(--primary-border)] text-[10px] font-bold text-[var(--primary-text)]">
                            {groupMembers.length}
                          </span>
                        </div>
                        {canManageTeam && (
                          <button
                            onClick={() => handleOpenInvite(role)}
                            className="flex items-center gap-1 text-xs font-medium text-[var(--primary-text-muted)] hover:text-[var(--primary-text)] transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Invite
                          </button>
                        )}
                      </div>

                      {/* Members list */}
                      {groupMembers.length === 0 ? (
                        <div className="px-5 py-12 text-center">
                          <User className="w-6 h-6 mx-auto mb-2 text-[var(--text-faint)]" />
                          <p className="text-sm text-[var(--text-faint)]">No {label.toLowerCase()} yet.</p>
                          {canManageTeam && (
                            <button
                              onClick={() => handleOpenInvite(role)}
                              className="mt-2 text-xs text-[var(--primary-text-muted)] hover:underline"
                            >
                              Invite one →
                            </button>
                          )}
                        </div>
                      ) : (
                        <ul className="divide-y divide-[var(--border-subtle)]">
                          {groupMembers.map(member => {
                            const isCurrentUser = member.email === user?.email;
                            const isResending   = resendingId === member.id;
                            const feedback      = resendFeedback[member.id];
                            const isCopied      = copiedId === member.id;
                            const showResend    = canManageTeam && member.status === 'Invited' && member.source === 'team_member';

                            return (
                              <li key={member.id} className="px-5 py-3.5 hover:bg-[var(--bg-subtle)] transition-colors">
                                <div className="flex items-center gap-4">
                                  <Avatar initials={member.initials} role={member.role} />

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-sm font-semibold text-[var(--text)] truncate">{member.name}</span>
                                      {isCurrentUser && (
                                        <span className="text-[10px] text-[var(--text-faint)] font-normal">(You)</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <Mail className="w-3 h-3 text-[var(--text-faint)] flex-shrink-0" />
                                      <span className="text-xs text-[var(--text-muted)] truncate">{member.email}</span>
                                    </div>
                                  </div>

                                  {/* Status + resend controls */}
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <StatusBadge status={member.status} expiresAt={member.inviteExpiresAt} />

                                    {showResend && (
                                      <button
                                        onClick={() => handleResendInvite(member)}
                                        disabled={isResending}
                                        title="Resend invitation email"
                                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--primary-text)] hover:border-[var(--primary-border)] hover:bg-[var(--primary-bg-hover)] disabled:opacity-50 disabled:pointer-events-none transition-colors"
                                      >
                                        {isResending
                                          ? <Loader2 className="w-3 h-3 animate-spin" />
                                          : <RotateCcw className="w-3 h-3" />
                                        }
                                        {isResending ? 'Sending…' : 'Resend'}
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Feedback row — shown below the member row */}
                                {feedback && (
                                  <div className="mt-2 ml-[52px]">
                                    {feedback.emailSent ? (
                                      <p className="text-xs text-[var(--success-text)] flex items-center gap-1">
                                        <Check className="w-3 h-3" />
                                        Invitation email sent successfully.
                                      </p>
                                    ) : (
                                      <div className="flex items-start gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-400/30">
                                        <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                                        <div className="min-w-0">
                                          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                            Email delivery failed. Share this link manually:
                                          </p>
                                          {feedback.inviteLink && (
                                            <div className="flex items-center gap-2 mt-1">
                                              <span className="text-[10px] text-[var(--text-muted)] font-mono truncate max-w-[280px]">
                                                {feedback.inviteLink}
                                              </span>
                                              <button
                                                onClick={() => handleCopyLink(member.id, feedback.inviteLink!)}
                                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors flex-shrink-0"
                                              >
                                                {isCopied
                                                  ? <><Check className="w-2.5 h-2.5 text-[var(--success-text)]" /> Copied</>
                                                  : <><Copy className="w-2.5 h-2.5" /> Copy</>
                                                }
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </div>
        )}
      </div>

      <InviteTeamMemberModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultRole={modalDefaultRole}
        onSuccess={fetchMembers}
      />
    </div>
  );
}
