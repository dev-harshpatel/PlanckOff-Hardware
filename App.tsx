import React, { useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import { Toast, Role } from './types';
import Header from './components/Header';
import Dashboard from './views/Dashboard';
import ProjectView from './views/ProjectView';
import DatabaseView from './views/DatabaseView';
import ReportsViewWrapper from './views/ReportsViewWrapper';
import TeamManagement from './views/TeamManagement';
import SettingsModal from './components/SettingsModal';
import ToastContainer from './components/ToastContainer';
import UserAuthDashboard from './components/UserAuthDashboard';
import UploadProgressWidget from './components/UploadProgressWidget';
import KeyboardShortcutsHelpModal from './components/KeyboardShortcutsHelpModal';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';


// Context Imports
// Context Imports
import { ToastProvider, useToast } from './contexts/ToastContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProjectProvider, useProject } from './contexts/ProjectContext';
import { BackgroundUploadProvider } from './contexts/BackgroundUploadContext';
import { AnnouncementProvider } from './contexts/AnnouncementContext';

// Helper wrapper to extract ID from params and use Context
const ProjectViewerWithParams: React.FC<{
  onNavigate: (page: string) => void;
}> = ({ onNavigate }) => {
  const { id } = useParams();
  const { projects, updateProject, appSettings } = useProject();
  const { addToast } = useToast();

  const activeProject = projects.find(p => p.id === id);

  if (!activeProject) {
    return <Navigate to="/" replace />;
  }

  return <ProjectView project={activeProject} onProjectUpdate={updateProject} appSettings={appSettings} onBackToDashboard={() => onNavigate('dashboard')} addToast={addToast} />;
};

const AppContent: React.FC = () => {
  // Use Context Hooks
  const {
    projects, masterInventory, trash, appSettings,
    addProject, updateProject, deleteProject, restoreProject, permDeleteProject,
    updateInventory, addToInventory, overwriteInventory, saveSettings
  } = useProject();

  const { currentUser, isAuthenticated, login, inviteUser, teamMembers } = useAuth();
  const { toasts, addToast, removeToast } = useToast();

  const navigate = useNavigate();
  const location = useLocation();
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isHelpOpen, setIsHelpOpen] = React.useState(false);

  // Global Shortcuts
  useKeyboardShortcuts([
    {
      combo: 'shift+?',
      handler: () => setIsHelpOpen(true),
      global: true,
      description: 'Open Keyboard Shortcuts Help'
    }
  ]);

  const handleSelectProject = (projectId: string) => {
    navigate(`/project/${projectId}`);
  };

  const handleNavigate = (page: string) => {
    if (page === 'dashboard') navigate('/');
    else navigate(`/${page}`);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <UserAuthDashboard initialTab="auth" />
      </div>
    );
  }

  // Derive current page for Header from location
  const getCurrentPage = () => {
    const path = location.pathname;
    if (path === '/' || path.startsWith('/dashboard')) return 'dashboard';
    if (path.startsWith('/project')) return 'project';
    if (path.startsWith('/database')) return 'database';
    return 'dashboard';
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
      <Header
        currentPage={getCurrentPage()}
        onNavigate={handleNavigate}
        projectName={location.pathname.startsWith('/project/') ? projects.find(p => p.id === location.pathname.split('/')[2])?.name : undefined}
        onOpenSettings={() => setIsSettingsOpen(true)}
        userRole={currentUser?.role || Role.Estimator}
      />

      <Routes>
        <Route path="/" element={
          <Dashboard
            projects={projects}
            onSelectProject={handleSelectProject}
            onAddNewProject={addProject}
            onProjectUpdate={updateProject}
            onDeleteProject={deleteProject}
            userRole={currentUser?.role || Role.Estimator}
            addToast={addToast}
            teamMembers={teamMembers}
          />
        } />
        <Route path="/project/:id" element={<ProjectViewerWithParams onNavigate={handleNavigate} />} />
        <Route path="/project/:id/reports" element={<ReportsViewWrapper />} />
        <Route path="/database" element={
          <DatabaseView
            inventory={masterInventory}
            userRole={currentUser?.role || Role.Estimator}
            onUpdateInventory={updateInventory}
            onAddToInventory={addToInventory}
            onOverwriteInventory={overwriteInventory}
            addToast={addToast}
          />
        } />
        <Route path="/team" element={
          <TeamManagement
            teamMembers={teamMembers}
            onInviteUser={(email, role, id) => inviteUser(email, role)}
          />
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={appSettings}
        onSave={saveSettings}
        trashProjects={trash}
        onRestoreProject={restoreProject}
        onPermanentDeleteProject={permDeleteProject}
        userRole={currentUser?.role || Role.Estimator}
      />

      <KeyboardShortcutsHelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
      <footer className="text-center p-4 text-gray-500 text-sm">
        <p>Powered by The Value Engineering. Crafted for accuracy.</p>
        <div className="mt-2 text-xs">
          User: {currentUser?.name} ({currentUser?.role})
        </div>
      </footer>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <ProjectProvider>
          <BackgroundUploadProvider>
            <AnnouncementProvider>
              <BrowserRouter>
                <AppContent />
              </BrowserRouter>
            </AnnouncementProvider>
          </BackgroundUploadProvider>
        </ProjectProvider>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
