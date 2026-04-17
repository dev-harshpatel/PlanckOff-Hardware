'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import type { TeamMember } from '@/types';

// ssr: false — Dashboard imports components that use browser-only APIs (jsPDF, etc.)
const Dashboard = dynamic(() => import('@/views/Dashboard'), { ssr: false });

export default function HomePage() {
  const router = useRouter();
  const { projects, addProject, updateProject, deleteProject } = useProject();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    // Fire immediately — runs in parallel with AuthContext's /api/auth/me check.
    // If the session cookie isn't set yet the server returns 401; we silently ignore it.
    fetch('/api/team/members', { credentials: 'include' })
      .then(res => res.ok ? res.json() : { data: [] })
      .then((json: { data?: Array<{ id: string; name: string; email: string; role: string; status: string }> }) => {
        setTeamMembers((json.data ?? []).map(m => ({
          id: m.id,
          name: m.name,
          email: m.email,
          role: m.role as TeamMember['role'],
          status: (m.status === 'Active' ? 'Active' : 'Pending') as TeamMember['status'],
        })));
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dashboard
      projects={projects}
      onSelectProject={(id) => router.push(`/project/${id}`)}
      onAddNewProject={addProject}
      onProjectUpdate={updateProject}
      onDeleteProject={deleteProject}
      userRole={(user?.role ?? 'Estimator') as never}
      addToast={addToast}
      teamMembers={teamMembers}
    />
  );
}
