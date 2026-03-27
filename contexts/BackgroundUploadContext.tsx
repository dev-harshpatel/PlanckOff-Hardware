import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { ValidationReport } from '../types';
import { saveTaskToDB, getTasksFromDB, deleteTaskFromDB } from '../utils/uploadPersistence';

export type UploadStatus = 'pending' | 'processing' | 'paused' | 'completed' | 'error';

export interface UploadTask {
    id: string;
    file: File;
    type: 'door-schedule' | 'hardware-set';
    status: UploadStatus;
    progress: number;
    stage: string;
    result?: ValidationReport<any>;
    partialData?: any[]; // Store accumulated chunks
    error?: string;
    createdAt: number;
    apiKey: string;
    projectId?: string;
}

interface BackgroundUploadContextType {
    tasks: UploadTask[];
    queueUpload: (file: File, type: 'door-schedule' | 'hardware-set', apiKey: string, projectId?: string) => string;
    cancelUpload: (id: string) => void;
    stopUpload: (id: string) => void;
    retryUpload: (id: string) => void;
    clearCompleted: () => void;
    isWorkerReady: boolean;
}

const BackgroundUploadContext = createContext<BackgroundUploadContextType | null>(null);

export const BackgroundUploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [tasks, setTasks] = useState<UploadTask[]>([]);
    const [isWorkerReady, setIsWorkerReady] = useState(false);
    const workerRef = useRef<Worker | null>(null);
    const processingRef = useRef<boolean>(false);

    // Initial Load
    useEffect(() => {
        // Init Worker
        try {
            workerRef.current = new Worker(new URL('../workers/upload.worker.ts', import.meta.url), { type: 'module' });
            setIsWorkerReady(true);

            workerRef.current.onmessage = (e) => {
                const { type, taskId, stage, percent, result, error, data } = e.data;
                handleWorkerMessage(type, taskId, { stage, percent, result, error, data });
            };

            workerRef.current.onerror = (e) => {
                console.error("Worker Global Error:", e);
                // If worker crashes, we might want to restart it
                processingRef.current = false;
            };
        } catch (e) {
            console.error("Failed to start worker", e);
        }

        // Init Tasks
        getTasksFromDB().then(loadedTasks => {
            // Filter out files that might be stale or handle lost processing state
            const sanitized = loadedTasks.map(t => {
                // If it was 'processing' when closed, revert to 'pending' so it restarts
                if (t.status === 'processing') return { ...t, status: 'pending', stage: 'Interrupted (Restarting)', progress: 0 };
                return t;
            });
            setTasks(sanitized);
        });

        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    // Queue Logic
    useEffect(() => {
        if (!isWorkerReady) return;
        if (processingRef.current) return;

        // Simple FIFO queue
        const nextTask = tasks.find(t => t.status === 'pending');
        if (nextTask) {
            startTask(nextTask);
        }
    }, [tasks, isWorkerReady]);

    const startTask = (task: UploadTask) => {
        if (!workerRef.current) return;
        processingRef.current = true;

        // Retrieve settings to pass to worker
        let settings = null;
        try {
            const settingsStr = localStorage.getItem('tve_app_settings');
            if (settingsStr) {
                settings = JSON.parse(settingsStr);
                console.log("DEBUG: Passing settings to worker:", settings);
            }
        } catch (e) {
            console.error("Failed to load settings for worker:", e);
        }

        // Optimistic update
        updateTaskStatus(task.id, 'processing', 0, 'Starting...');

        workerRef.current.postMessage({
            taskId: task.id,
            type: task.type,
            file: task.file,
            apiKey: task.apiKey,
            projectId: task.projectId,
            settings: settings // Pass settings
        });
    };

    const handleWorkerMessage = (type: string, taskId: string, payload: any) => {
        if (type === 'progress') {
            updateTaskStatus(taskId, 'processing', payload.percent, payload.stage);
        } else if (type === 'complete') {
            updateTaskStatus(taskId, 'completed', 100, 'Done', payload.result);
            processingRef.current = false;
        } else if (type === 'error') {
            updateTaskStatus(taskId, 'error', 0, payload.error || 'Unknown Error');
            processingRef.current = false;
        } else if (type === 'partial_data') {
            setTasks(prev => prev.map(t => {
                if (t.id === taskId) {
                    const current = t.partialData || [];
                    return { ...t, partialData: [...current, ...(payload.data || [])] };
                }
                return t;
            }));
        } else if (type === 'cancelled') {
            setTasks(prev => prev.filter(t => t.id !== taskId));
            processingRef.current = false;
        }
    };

    const updateTaskStatus = (id: string, status: UploadStatus, progress: number, stage: string, result?: any) => {
        setTasks(prev => {
            const next = prev.map(t => {
                if (t.id === id) {
                    const updated = { ...t, status, progress, stage, result: result || t.result, error: status === 'error' ? stage : undefined };
                    saveTaskToDB(updated);
                    return updated;
                }
                return t;
            });
            return next;
        });
    };

    const queueUpload = (file: File, type: 'door-schedule' | 'hardware-set', apiKey: string, projectId?: string) => {
        const id = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newTask: UploadTask = {
            id,
            file,
            type,
            status: 'pending',
            progress: 0,
            stage: 'Queued',
            createdAt: Date.now(),
            apiKey,
            projectId
        };
        setTasks(prev => [...prev, newTask]);
        saveTaskToDB(newTask);
        return id;
    };

    const stopUpload = (id: string) => {
        workerRef.current?.postMessage({ action: 'STOP', taskId: id });
        updateTaskStatus(id, 'processing', undefined as any, 'Stopping...');
    };

    const cancelUpload = (id: string) => {
        workerRef.current?.postMessage({ action: 'CANCEL', taskId: id });
        updateTaskStatus(id, 'error', 0, 'Cancelling...');
    };

    const retryUpload = (id: string) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'pending', progress: 0, stage: 'Retrying...', error: undefined } : t));
    };

    const clearCompleted = () => {
        const toDelete = tasks.filter(t => t.status === 'completed' || t.status === 'error');
        toDelete.forEach(t => deleteTaskFromDB(t.id));
        setTasks(prev => prev.filter(t => t.status !== 'completed' && t.status !== 'error'));
    };

    return (
        <BackgroundUploadContext.Provider value={{ tasks, queueUpload, cancelUpload, stopUpload, retryUpload, clearCompleted, isWorkerReady }}>
            {children}
        </BackgroundUploadContext.Provider>
    );
};

export const useBackgroundUpload = () => {
    const context = useContext(BackgroundUploadContext);
    if (!context) throw new Error("useBackgroundUpload must be used within BackgroundUploadProvider");
    return context;
};
