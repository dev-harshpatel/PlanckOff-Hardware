'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Project, HardwareItem, AppSettings, NewProjectData } from '../types';
import { initialMasterInventory } from '@/constants/inventory';
import { ERRORS } from '@/constants/errors';
import { useToast } from './ToastContext';
import { useAuth } from './AuthContext';
import { isOwnWrite, markPendingWrite } from '@/lib/realtime/dedupSet';

interface ProjectContextType {
  projects: Project[];
  projectsHydrated: boolean;
  masterInventory: HardwareItem[];
  trash: Project[];
  appSettings: AppSettings;
  addProject: (data: NewProjectData, doorFile?: File, hwFile?: File) => Promise<void>;
  updateProject: (project: Project) => void;
  updateProjectFromRealtime: (payload: { eventType?: string; new?: Record<string, unknown>; old?: Record<string, unknown> }) => void;
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

/**
 * Client-side mirror of lib/db/projects.ts toProject(). Maps a snake_case
 * Supabase Realtime row payload to the camelCase Project domain type.
 * Kept in sync with the server-side helper — both must update if the
 * projects table schema changes.
 */
function projectRowToProject(row: Record<string, unknown>): Project {
  return {
    id:             row.id as string,
    name:           (row.name as string) ?? '',
    client:         (row.client as string) ?? '',
    location:       (row.location as string) ?? '',
    country:        (row.country as string) ?? undefined,
    province:       (row.province as string) ?? undefined,
    description:    (row.description as string) ?? '',
    projectNumber:  (row.project_number as string) ?? '',
    status:         ((row.status as Project['status']) ?? 'Active'),
    dueDate:        (row.due_date as string) ?? undefined,
    assignedTo:     (row.assigned_to as string) ?? undefined,
    createdAt:      new Date(row.created_at as string),
    updatedAt:      new Date(row.updated_at as string),
    lastModified:   row.updated_at as string,
    elevationTypes: (row.elevation_types as Project['elevationTypes']) ?? [],
    deletedAt:      (row.deleted_at as string) ?? undefined,
  };
}

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
    // Client users cannot access the trash endpoint — skip the fetch to avoid 403 noise.
    if (currentUser?.role !== 'Client') {
      fetchTrashed();
    }
  }, [fetchProjects, fetchTrashed, currentUser?.role]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Optimistic append: mirrors deleteProject's optimistic filter pattern.
   * After POST succeeds, appends the server-confirmed project directly to local
   * state instead of re-fetching the entire list. The Realtime INSERT echo handler
   * in updateProjectFromRealtime will find the project already present via
   * `prev.find(p => p.id === id)` and short-circuit correctly.
   */
  const addProject = useCallback(async (projectData: NewProjectData, _doorFile?: File, _hwFile?: File) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(projectData),
      });

      const json = (await res.json()) as { data?: Project; error?: string };
      if (!res.ok) throw new Error(json.error ?? ERRORS.GENERAL.SAVE_FAILED.message);

      if (json.data) {
        setProjects(prev => [json.data!, ...prev]);
      }
      addToast({ type: 'success', message: `Project "${json.data!.name}" created.` });
    } catch (error: unknown) {
      addToast({ type: 'error', message: ERRORS.GENERAL.SAVE_FAILED.message, details: ERRORS.GENERAL.SAVE_FAILED.action });
      throw error;
    }
  }, [addToast]);

  const updateProject = useCallback(async (updatedProject: Project) => {
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
      if (!res.ok) throw new Error(json.error ?? ERRORS.GENERAL.SAVE_FAILED.message);

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

      // Mark our own write so the Realtime echo is skipped (lib/realtime/dedupSet).
      const rawUpdatedAt = (json.data as { updatedAt?: Date | string } | undefined)?.updatedAt;
      const updatedAtStr = rawUpdatedAt instanceof Date
        ? rawUpdatedAt.toISOString()
        : typeof rawUpdatedAt === 'string'
          ? rawUpdatedAt
          : undefined;
      if (updatedAtStr) {
        markPendingWrite('projects', updatedProject.id, updatedAtStr);
      }
    } catch {
      addToast({ type: 'error', message: ERRORS.GENERAL.SAVE_FAILED.message, details: ERRORS.GENERAL.SAVE_FAILED.action });
    }
  }, [addToast]);

  const updateProjectFromRealtime = useCallback(
    (payload: { eventType?: string; new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
      // DELETE: remove from list.
      if (payload.eventType === 'DELETE') {
        const oldId = payload.old?.id;
        if (typeof oldId === 'string') {
          setProjects(prev => prev.filter(p => p.id !== oldId));
        }
        return;
      }

      const row = payload.new ?? {};
      const id = typeof row.id === 'string' ? row.id : '';
      const updatedAt = typeof row.updated_at === 'string' ? row.updated_at : '';
      if (!id) return;

      // Skip echoes of our own writes.
      if (updatedAt && isOwnWrite('projects', id, updatedAt)) return;

      const incoming = projectRowToProject(row);

      setProjects(prev => {
        const existing = prev.find(p => p.id === id);
        if (!existing) {
          // INSERT: append to list. New project from another tab.
          return [...prev, incoming];
        }
        // UPDATE: preserve domain arrays (hardwareSets, doors, elevationTypes) from the
        // local entry — the Realtime payload only carries metadata columns.
        return prev.map(p =>
          p.id === id
            ? {
                ...incoming,
                hardwareSets:   existing.hardwareSets,
                doors:          existing.doors,
                elevationTypes: incoming.elevationTypes ?? existing.elevationTypes,
              }
            : p,
        );
      });
    },
    [],
  );

  const deleteProject = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(ERRORS.GENERAL.SAVE_FAILED.message);
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
  }, [projects, addToast]);

  /**
   * Optimistic restore: mirrors deleteProject's optimistic filter pattern.
   * After DELETE ?restore=true succeeds, removes from local trash state and
   * prepends the restored project (minus deletedAt) to active projects directly,
   * instead of re-fetching the entire list via fetchProjects().
   */
  const restoreProjectFn = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}?restore=true`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(ERRORS.GENERAL.SAVE_FAILED.message);
      const restored = trash.find(p => p.id === id);
      setTrash(prev => prev.filter(p => p.id !== id));
      if (restored) {
        // Strip deletedAt before re-adding to active list
        const { deletedAt: _del, ...activeProject } = restored;
        setProjects(prev => [activeProject as Project, ...prev]);
      }
      addToast({ type: 'success', message: 'Project restored successfully.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addToast({ type: 'error', message });
    }
  }, [trash, addToast]);

  const permDeleteProject = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}?hard=true`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(ERRORS.GENERAL.SAVE_FAILED.message);
      setTrash(prev => prev.filter(p => p.id !== id));
      addToast({ type: 'success', message: 'Project permanently deleted.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addToast({ type: 'error', message });
    }
  }, [addToast]);

  // Inventory — keep in localStorage for now (Phase 1.3 will migrate this)
  const updateInventory = useCallback((items: HardwareItem[]) => {
    setMasterInventory(items);
    localStorage.setItem('tve_master_inventory', JSON.stringify(items));
  }, []);

  const addToInventory = useCallback((items: HardwareItem[]) => {
    setMasterInventory(prev => [...prev, ...items]);
  }, []);

  const overwriteInventory = useCallback((items: HardwareItem[]) => setMasterInventory(items), []);

  const saveSettings = useCallback((newSettings: AppSettings) => {
    setAppSettings(newSettings);
    localStorage.setItem('tve_app_settings', JSON.stringify(newSettings));
  }, []);

  const contextValue = useMemo<ProjectContextType>(() => ({
    projects,
    projectsHydrated,
    masterInventory,
    trash,
    appSettings,
    addProject,
    updateProject,
    updateProjectFromRealtime,
    deleteProject,
    restoreProject: restoreProjectFn,
    permDeleteProject,
    fetchTrashed,
    updateInventory,
    addToInventory,
    overwriteInventory,
    saveSettings,
  }), [
    projects, projectsHydrated, masterInventory, trash, appSettings,
    addProject, updateProject, updateProjectFromRealtime,
    deleteProject, restoreProjectFn, permDeleteProject, fetchTrashed,
    updateInventory, addToInventory, overwriteInventory, saveSettings,
  ]);

  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within a ProjectProvider');
  return ctx;
};
