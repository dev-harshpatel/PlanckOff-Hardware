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

function StatusBadge({ status }: { status: 'Active' | 'Invited' }) {
  if (status === 'Active') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--success-text)] uppercase tracking-wide bg-[var(--success-bg)] border border-[var(--success-border)] px-2 py-0.5 rounded">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--success-bg)]0 flex-shrink-0" />
        Active
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--warning-text)] uppercase tracking-wide bg-[var(--warning-bg)] border border-[var(--warning-border)] px-2 py-0.5 rounded">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
      Invited
    </span>
  );
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
                            return (
                              <li key={member.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--bg-subtle)] transition-colors">
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
                                <StatusBadge status={member.status} />
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
