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

const ClientDashboard = dynamic(() => import('@/views/ClientDashboard'), {
  ssr: false,
  loading: () => <DashboardSkeleton />,
});

export default function HomePage() {
  const router = useRouter();
  const { projects, trash, projectsHydrated, addProject, updateProject, deleteProject, restoreProject, permDeleteProject } = useProject();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { startNavigation } = useNavigationLoading();
  const { addToast } = useToast();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoadingTeamMembers, setIsLoadingTeamMembers] = useState(true);

  useEffect(() => {
    // Wait for auth to resolve before making role-gated requests.
    // On first render user is null (auth loading) — firing early causes a 403 for Client.
    if (isAuthLoading) return;

    // Client users have no access to /api/team/members.
    if (user?.role === 'Client') {
      setIsLoadingTeamMembers(false);
      return;
    }

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
  }, [isAuthLoading, user?.role]);

  if (!projectsHydrated) {
    return <DashboardSkeleton />;
  }

  const handleSelectProject = (id: string) => {
    const href = `/project/${id}`;
    startNavigation(href);
    router.push(href);
  };

  if (user?.role === 'Client') {
    return (
      <ClientDashboard
        projects={projects}
        onSelectProject={handleSelectProject}
      />
    );
  }

  return (
    <Dashboard
      projects={projects}
      trash={trash}
      onSelectProject={handleSelectProject}
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
