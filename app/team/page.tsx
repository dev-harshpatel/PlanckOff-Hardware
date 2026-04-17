'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/hooks/useRBAC';
import { InviteTeamMemberModal } from '@/components/team/InviteTeamMemberModal';
import type { RoleName } from '@/types/auth';
import type { UnifiedMember } from '@/lib/db/team';

// ---------------------------------------------------------------------------
// Role group config
// ---------------------------------------------------------------------------

const ROLE_GROUPS: { role: RoleName; label: string; icon: React.ReactNode }[] = [
  {
    role: 'Administrator',
    label: 'Administration',
    icon: (
      <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 10c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.249-8.25-3.286z" />
      </svg>
    ),
  },
  {
    role: 'Team Lead',
    label: 'Team Leads',
    icon: (
      <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
  {
    role: 'Estimator',
    label: 'Estimators',
    icon: (
      <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
];

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

function Avatar({ initials, role }: { initials: string; role: RoleName }) {
  const colors: Record<RoleName, string> = {
    Administrator: 'bg-purple-100 text-purple-700',
    'Team Lead': 'bg-blue-100 text-blue-700',
    Estimator: 'bg-green-100 text-green-700',
  };
  return (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${colors[role]}`}>
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
      <span className="flex items-center gap-1 text-xs font-semibold text-green-600 uppercase tracking-wide">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
        Active
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 uppercase tracking-wide">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
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
      // Silently ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleOpenInvite = (role?: RoleName) => {
    setModalDefaultRole(role);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* Page header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Team Management</h1>
            <p className="mt-1 text-sm text-gray-500">Manage roles, permissions, and team members.</p>
          </div>
          {canManageTeam && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleOpenInvite()}
                className="flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 transition shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Team Member
              </button>
            </div>
          )}
        </div>

        {/* Role group sections */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700" />
          </div>
        ) : (
          <div className="space-y-4">
            {ROLE_GROUPS.map(({ role, label, icon }) => {
              const groupMembers = members.filter((m) => m.role === role);
              return (
                <div
                  key={role}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
                >
                  {/* Group header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      {icon}
                      <span className="font-semibold text-gray-900">{label}</span>
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                        {groupMembers.length}
                      </span>
                    </div>
                    {canManageTeam && (
                      <button
                        onClick={() => handleOpenInvite(role)}
                        className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-green-700 transition"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Invite
                      </button>
                    )}
                  </div>

                  {/* Members list */}
                  {groupMembers.length === 0 ? (
                    <div className="px-6 py-8 text-center text-sm text-gray-400">
                      No {label.toLowerCase()} yet.
                    </div>
                  ) : (
                    <ul>
                      {groupMembers.map((member, idx) => {
                        const isCurrentUser = member.email === user?.email;
                        const isLast = idx === groupMembers.length - 1;
                        return (
                          <li
                            key={member.id}
                            className={`flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition ${!isLast ? 'border-b border-gray-100' : ''}`}
                          >
                            <Avatar initials={member.initials} role={member.role} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900 truncate">
                                  {member.name}
                                </span>
                                {isCurrentUser && (
                                  <span className="text-xs text-gray-400 font-normal">(You)</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                                </svg>
                                <span className="text-xs text-gray-500 truncate">{member.email}</span>
                              </div>
                            </div>
                            <StatusBadge status={member.status} />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invite modal */}
      <InviteTeamMemberModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultRole={modalDefaultRole}
        onSuccess={fetchMembers}
      />
    </div>
  );
}
