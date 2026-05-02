'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Project, HardwareItem, AppSettings, NewProjectData } from '../types';
import { initialMasterInventory } from '@/constants/inventory';
import { useToast } from './ToastContext';
import { useAuth } from './AuthContext';

interface ProjectContextType {
  projects: Project[];
  projectsHydrated: boolean;
  masterInventory: HardwareItem[];
  trash: Project[];
  appSettings: AppSettings;
  addProject: (data: NewProjectData, doorFile?: File, hwFile?: File) => Promise<void>;
  updateProject: (project: Project) => void;
  deleteProject: (id: string) => void;
  restoreProject: (id: string) => void;
  permDeleteProject: (id: string) => void;
  fetchTrashed: () => Promise<void>;
  updateInventory: (items: HardwareItem[]) => void;
  addToInventory: (items: HardwareItem[]) => void;
  overwriteInventory: (items: HardwareItem[]) => void;
  saveSettings: (settings: AppSettings) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const DEFAULT_SETTINGS: AppSettings = {
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  geminiApiKey: '',
};

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { addToast } = useToast();
  const { user: currentUser, isAuthenticated } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsHydrated, setProjectsHydrated] = useState(false);
  const [trash, setTrash] = useState<Project[]>([]);
  const [masterInventory, setMasterInventory] = useState<HardwareItem[]>(() => {
    if (typeof window === 'undefined') return initialMasterInventory;
    try {
      return JSON.parse(localStorage.getItem('tve_master_inventory') || 'null') || initialMasterInventory;
    } catch { return initialMasterInventory; }
  });
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
      return JSON.parse(localStorage.getItem('tve_app_settings') || 'null') || DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });

  // ---------------------------------------------------------------------------
  // Fetch projects from API
  // ---------------------------------------------------------------------------
  const fetchProjects = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetch('/api/projects', { credentials: 'include' });
      if (res.ok) {
        const json = (await res.json()) as { data: Project[] };
        setProjects(json.data ?? []);
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setProjectsHydrated(true);
    }
  }, [isAuthenticated]);

  const fetchTrashed = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetch('/api/projects/trash', { credentials: 'include' });
      if (res.ok) {
        const json = (await res.json()) as { data: Project[] };
        setTrash(json.data ?? []);
      }
    } catch {
      // Non-critical
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchProjects();
    fetchTrashed();
  }, [fetchProjects, fetchTrashed]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const addProject = async (projectData: NewProjectData, _doorFile?: File, _hwFile?: File) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(projectData),
      });

      const json = (await res.json()) as { data?: Project; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to create project.');

      await fetchProjects();
      addToast({ type: 'success', message: `Project "${json.data!.name}" created.` });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addToast({ type: 'error', message: `Failed to create project: ${message}` });
      throw error;
    }
  };

  const updateProject = async (updatedProject: Project) => {
    try {
      // Strip large domain arrays before sending to the project metadata API —
      // the API only persists metadata columns (name, status, etc.) and ignores
      // hardwareSets/doors/elevationTypes. Sending them causes oversized payloads.
      const { hardwareSets: _hs, doors: _d, elevationTypes: _et, ...metaPayload } = updatedProject;
      const res = await fetch(`/api/projects/${updatedProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(metaPayload),
      });
      const json = (await res.json()) as { data?: Project; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to update project.');

      // The DB layer (lib/db/projects.ts) only persists metadata columns — it does not
      // read/write doors, hardwareSets, or elevationTypes. Merging json.data directly
      // would strip all domain data. Always preserve those fields from updatedProject.
      const merged: Project = {
        ...(json.data ?? updatedProject),
        doors:          updatedProject.doors,
        hardwareSets:   updatedProject.hardwareSets,
        elevationTypes: updatedProject.elevationTypes,
      };

      setProjects(prev => prev.map(p => p.id === updatedProject.id ? merged : p));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addToast({ type: 'error', message: `Failed to update project: ${message}` });
    }
  };

  const deleteProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete project.');
      // Move the project from active list to trash optimistically
      const trashed = projects.find(p => p.id === id);
      setProjects(prev => prev.filter(p => p.id !== id));
      if (trashed) {
        setTrash(prev => [{ ...trashed, deletedAt: new Date().toISOString() }, ...prev]);
      }
      addToast({ type: 'success', message: 'Project moved to trash. It will be permanently deleted in 30 days.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addToast({ type: 'error', message });
    }
  };

  const restoreProjectFn = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}?restore=true`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to restore project.');
      setTrash(prev => prev.filter(p => p.id !== id));
      await fetchProjects();
      addToast({ type: 'success', message: 'Project restored successfully.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addToast({ type: 'error', message });
    }
  };

  const permDeleteProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}?hard=true`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to permanently delete project.');
      setTrash(prev => prev.filter(p => p.id !== id));
      addToast({ type: 'success', message: 'Project permanently deleted.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addToast({ type: 'error', message });
    }
  };

  // Inventory — keep in localStorage for now (Phase 1.3 will migrate this)
  const updateInventory = (items: HardwareItem[]) => {
    setMasterInventory(items);
    localStorage.setItem('tve_master_inventory', JSON.stringify(items));
  };

  const addToInventory = useCallback((items: HardwareItem[]) => {
    setMasterInventory(prev => [...prev, ...items]);
  }, []);

  const overwriteInventory = (items: HardwareItem[]) => setMasterInventory(items);

  const saveSettings = (newSettings: AppSettings) => {
    setAppSettings(newSettings);
    localStorage.setItem('tve_app_settings', JSON.stringify(newSettings));
  };

  return (
    <ProjectContext.Provider value={{
      projects,
      projectsHydrated,
      masterInventory,
      trash,
      appSettings,
      addProject,
      updateProject,
      deleteProject,
      restoreProject: restoreProjectFn,
      permDeleteProject,
      fetchTrashed,
      updateInventory,
      addToInventory,
      overwriteInventory,
      saveSettings,
    }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within a ProjectProvider');
  return ctx;
};
