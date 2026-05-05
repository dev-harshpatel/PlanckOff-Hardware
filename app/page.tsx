'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigationLoading } from '@/contexts/NavigationLoadingContext';
import { useToast } from '@/contexts/ToastContext';
import type { TeamMember } from '@/types';
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton';

// ssr: false — Dashboard imports components that use browser-only APIs (jsPDF, etc.)
// loading keeps DashboardSkeleton visible while the bundle resolves, preventing a white flash.
const Dashboard = dynamic(() => import('@/views/Dashboard'), {
  ssr: false,
  loading: () => <DashboardSkeleton />,
});

export default function HomePage() {
  const router = useRouter();
  const { projects, trash, projectsHydrated, addProject, updateProject, deleteProject, restoreProject, permDeleteProject } = useProject();
  const { user } = useAuth();
  const { startNavigation } = useNavigationLoading();
  const { addToast } = useToast();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoadingTeamMembers, setIsLoadingTeamMembers] = useState(true);

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
      .catch(() => {})
      .finally(() => setIsLoadingTeamMembers(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!projectsHydrated) {
    return <DashboardSkeleton />;
  }

  return (
    <Dashboard
      projects={projects}
      trash={trash}
      onSelectProject={(id) => {
        const href = `/project/${id}`;
        startNavigation(href);
        router.push(href);
      }}
      onAddNewProject={addProject}
      onProjectUpdate={updateProject}
      onDeleteProject={deleteProject}
      onRestoreProject={restoreProject}
      onPermDeleteProject={permDeleteProject}
      userRole={(user?.role ?? 'Estimator') as never}
      addToast={addToast}
      teamMembers={teamMembers}
      isLoadingTeamMembers={isLoadingTeamMembers}
    />
  );
}
