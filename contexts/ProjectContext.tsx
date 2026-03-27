import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

import { Project, HardwareItem, AppSettings, NewProjectData, Door, HardwareSet } from '../types';
import { initialMasterInventory } from '../constants'; // Keep initial inventory as fallback/seed
import { processDoorScheduleFile, processHardwareSetFile } from '../services/fileUploadService';
import { useToast } from './ToastContext';
import { useAuth } from './AuthContext';

interface ProjectContextType {
    projects: Project[];
    masterInventory: HardwareItem[];
    trash: Project[];
    appSettings: AppSettings;
    addProject: (data: NewProjectData, doorFile?: File, hwFile?: File) => Promise<void>;
    updateProject: (project: Project) => void; // Note: Deep updates require more complex logic
    deleteProject: (id: string) => void;
    restoreProject: (id: string) => void;
    permDeleteProject: (id: string) => void;
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
    const { currentUser } = useAuth();

    // --- State ---
    const [projects, setProjects] = useState<Project[]>([]);
    const [masterInventory, setMasterInventory] = useState<HardwareItem[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('tve_master_inventory') || 'null') || initialMasterInventory;
        } catch { return initialMasterInventory; }
    });
    const [trash, setTrash] = useState<Project[]>([]); // Derived from DB deleted_at
    const [appSettings, setAppSettings] = useState<AppSettings>(() => {
        try {
            return JSON.parse(localStorage.getItem('tve_app_settings') || 'null') || DEFAULT_SETTINGS;
        } catch { return DEFAULT_SETTINGS; }
    });

    // --- Fetch Data ---
    const fetchProjects = useCallback(async () => {
        try {
            const storedProjects = localStorage.getItem('tve_projects');
            if (storedProjects) {
                const parsed: Project[] = JSON.parse(storedProjects);
                setProjects(parsed.filter(p => !p.deletedAt));
                setTrash(parsed.filter(p => p.deletedAt));
            } else {
                setProjects([]);
                setTrash([]);
            }
        } catch (error) {
            console.error("Failed to load projects from local storage", error);
            setProjects([]);
        }
    }, []);

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    // Helpers to persist
    const persistProjects = (allProjects: Project[]) => {
        localStorage.setItem('tve_projects', JSON.stringify(allProjects));
        fetchProjects(); // Refresh State
    };

    // --- Actions ---

    const saveSettings = (newSettings: AppSettings) => {
        setAppSettings(newSettings);
        localStorage.setItem('tve_app_settings', JSON.stringify(newSettings));
    };

    const addProject = async (projectData: NewProjectData, doorFile?: File, hwFile?: File) => {
        try {
            let doors: Door[] = [];
            let hwSets: HardwareSet[] = [];
            let doorCount = 0;
            let hwCount = 0;

            if (doorFile) {
                doors = await processDoorScheduleFile(doorFile, appSettings.geminiApiKey);
                doorCount = doors.length;
            }

            if (hwFile) {
                hwSets = await processHardwareSetFile(hwFile, appSettings.geminiApiKey);
                hwCount = hwSets.length;
            }

            const newProject: Project = {
                id: crypto.randomUUID(),
                ...projectData,
                lastModified: new Date().toISOString(),
                doors: doors,
                hardwareSets: hwSets,


            };

            const stored = localStorage.getItem('tve_projects');
            const currentProjects = stored ? JSON.parse(stored) : [];
            persistProjects([...currentProjects, newProject]);

            addToast({ type: 'success', message: `Project created with ${doorCount} doors and ${hwCount} sets.` });

        } catch (error: any) {
            console.error("Error creating project:", error);
            addToast({ type: 'error', message: `Failed to create project: ${error.message}` });
        }
    };

    const deleteProject = (id: string) => {
        const stored = localStorage.getItem('tve_projects');
        if (!stored) return;
        const allProjects: Project[] = JSON.parse(stored);
        const updated = allProjects.map(p =>
            p.id === id ? { ...p, deletedAt: new Date().toISOString() } : p
        );
        persistProjects(updated);
        addToast({ type: 'success', message: 'Project moved to trash.' });
    };

    const restoreProject = (id: string) => {
        const stored = localStorage.getItem('tve_projects');
        if (!stored) return;
        const allProjects: Project[] = JSON.parse(stored);
        const updated = allProjects.map(p =>
            p.id === id ? { ...p, deletedAt: undefined } : p
        );
        persistProjects(updated);
        addToast({ type: 'success', message: 'Project restored.' });
    };

    const permDeleteProject = (id: string) => {
        const stored = localStorage.getItem('tve_projects');
        if (!stored) return;
        const allProjects: Project[] = JSON.parse(stored);
        const updated = allProjects.filter(p => p.id !== id);
        persistProjects(updated);
        addToast({ type: 'success', message: 'Project permanently deleted.' });
    };

    const updateProject = (updatedProject: Project) => {
        const stored = localStorage.getItem('tve_projects');
        if (!stored) return;
        const allProjects: Project[] = JSON.parse(stored);
        const updatedList = allProjects.map(p =>
            p.id === updatedProject.id ? { ...updatedProject, lastModified: new Date().toISOString() } : p
        );
        persistProjects(updatedList);
        addToast({ type: 'success', message: 'Project updated.' });
    };

    // Inventory helpers (keep local for now)
    const updateInventory = (items: HardwareItem[]) => {
        setMasterInventory(items);
        localStorage.setItem('tve_master_inventory', JSON.stringify(items));
    };

    const addToInventory = useCallback((items: HardwareItem[]) => {
        setMasterInventory(prev => {
            const combined = [...prev, ...items];
            // Dedup logic omitted for brevity, assume simple append for now or keep existing logic
            return combined;
        });
    }, []);

    const overwriteInventory = (items: HardwareItem[]) => {
        setMasterInventory(items);
    };

    return (
        <ProjectContext.Provider value={{
            projects,
            masterInventory,
            trash,
            appSettings,
            addProject,
            updateProject,
            deleteProject,
            restoreProject,
            permDeleteProject,
            updateInventory,
            addToInventory,
            overwriteInventory,
            saveSettings
        }}>
            {children}
        </ProjectContext.Provider>
    );
};

export const useProject = () => {
    const context = useContext(ProjectContext);
    if (context === undefined) {
        throw new Error('useProject must be used within a ProjectProvider');
    }
    return context;
};
