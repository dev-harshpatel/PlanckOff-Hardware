'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { HardwareSet, Door, Project, AppSettings, Toast, ElevationType, ValidationReport } from '../types';
import HardwareSetsManager from '../components/HardwareSetsManager';
import DoorScheduleManager from '../components/DoorScheduleManager';
import { generateReport } from '../utils/reportGenerator';
// process... imports removed from direct use, but types might be needed
import { CheckCircleIcon, ExclamationCircleIcon, ArrowLeftIcon, CameraIcon } from '../components/icons';
import ElevationManager from '../components/ElevationManager';
import ImageAnalysisModal from '../components/ImageAnalysisModal';
import { captureTrainingExample } from '../services/mlOpsService';
import { transformHardwareSets, transformDoors } from '../utils/hardwareTransformers';
import UploadConfirmationModal from '../components/UploadConfirmationModal';
import ProcessingIndicator, { type ProcessingTask } from '../components/ProcessingIndicator';
import ErrorModal from '../components/ErrorModal';
import ValidationReportModal from '../components/ValidationReportModal';
import ResizablePanels from '../components/ResizablePanels';
import { useBackgroundUpload, UploadTask } from '../contexts/BackgroundUploadContext';
import UploadProgressWidget from '../components/UploadProgressWidget';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const SaveStatusIndicator: React.FC<{ status: SaveStatus; onRetry: () => void }> = ({ status, onRetry }) => {
    switch (status) {
        case 'saving':
            return (
                <div className="flex items-center text-sm text-gray-500 animate-pulse">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                </div>
            );
        case 'saved':
            return (
                <div className="flex items-center text-sm text-green-600 font-semibold">
                    <CheckCircleIcon className="w-5 h-5 mr-1.5" />
                    All changes saved
                </div>
            );
        case 'error':
            return (
                <div className="flex items-center text-sm text-red-600 font-semibold">
                    <ExclamationCircleIcon className="w-5 h-5 mr-1.5" />
                    Save Failed.
                    <button onClick={onRetry} className="ml-2 underline hover:text-red-800">Retry</button>
                </div>
            );
        default:
            return <div className="h-6" />;
    }
};

interface ProjectViewProps {
    project: Project;
    onProjectUpdate: (updatedProject: Project) => void;
    appSettings: AppSettings;
    onBackToDashboard: () => void;
    addToast: (toast: Omit<Toast, 'id'>) => void;
}

const ProjectView: React.FC<ProjectViewProps> = ({ project, onProjectUpdate, appSettings, onBackToDashboard, addToast }) => {
    const router = useRouter();
    const [hardwareSets, setHardwareSets] = useState<HardwareSet[]>(project.hardwareSets || []);
    const [doors, setDoors] = useState<Door[]>(project.doors || []);
    const [viewMode, setViewMode] = useState<'split' | 'hardware' | 'doors'>('split');

    // Background Upload Context (used for progress widget display only)
    const { tasks } = useBackgroundUpload();
    const processedTaskIds = useRef<Set<string>>(new Set());

    // Initialize processed tasks with already completed ones to avoid re-processing on mount
    useEffect(() => {
        tasks.forEach(t => {
            if (t.status === 'completed' || t.status === 'error') {
                processedTaskIds.current.add(t.id);
            }
        });
    }, []); // Run once on mount (or when tasks initially load, but we want to be careful)

    // Listen for new completions
    useEffect(() => {
        const completedProjectTasks = tasks.filter(t =>
            (t.status === 'completed') &&
            t.projectId === project.id &&
            !processedTaskIds.current.has(t.id)
        );

        if (completedProjectTasks.length > 0) {
            completedProjectTasks.forEach(task => {
                processedTaskIds.current.add(task.id);
                handleTaskCompletion(task);
            });
        }
    }, [tasks, project.id]);

    const handleTaskCompletion = (task: UploadTask) => {
        if (!task.result) return;
        const report = task.result;

        if (task.type === 'hardware-set') {
            const newSets: HardwareSet[] = report.data;
            if (newSets.length > 0) {
                setHardwareSets(currentSets => {
                    const setMap = new Map(currentSets.map(s => [s.name, s]));
                    newSets.forEach(newSet => setMap.set(newSet.name, newSet));
                    return Array.from(setMap.values());
                });
                addToast({ type: 'success', message: `Background Upload: Imported ${newSets.length} hardware sets.` });
            }
            // Show Validation Report if needed
            if (report.errors.length > 0 || report.summary.errorCount > 0) {
                setValidationReport(report);
                setValidationReportTitle('Hardware Sets Upload Report');
                setIsValidationModalOpen(true);
            }
        } else if (task.type === 'door-schedule') {
            const newDoors: Door[] = report.data;
            if (newDoors.length > 0) {
                setDoors(currentDoors => [...currentDoors, ...newDoors]); // Append mode default
                addToast({ type: 'success', message: `Background Upload: Imported ${newDoors.length} doors.` });
            }
            if (report.errors.length > 0 || report.summary.errorCount > 0) {
                setValidationReport(report);
                setValidationReportTitle('Door Schedule Upload Report');
                setIsValidationModalOpen(true);
            }
        }
    };

    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [isImageAnalysisOpen, setIsImageAnalysisOpen] = useState(false);
    const [isElevationManagerOpen, setIsElevationManagerOpen] = useState(false);
    const isInitialMount = useRef(true);

    // Validation Report State
    const [validationReport, setValidationReport] = useState<ValidationReport<any> | null>(null);
    const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
    const [validationReportTitle, setValidationReportTitle] = useState('');

    const handleElevationUpdate = (updatedTypes: ElevationType[]) => {
        const updatedProject = { ...project, elevationTypes: updatedTypes };
        onProjectUpdate(updatedProject);
    };

    const doorScheduleInputRef = useRef<HTMLInputElement>(null);

    // Reactive report generation
    const report = useMemo(() => generateReport(doors), [doors]);

    useEffect(() => {
        setHardwareSets(project.hardwareSets ?? []);
        setDoors(project.doors ?? []);
        setSaveStatus('idle');
        isInitialMount.current = true;
    }, [project.id]);

    // Fetch stored hardware PDF + door schedule from new tables and populate UI state
    useEffect(() => {
        let cancelled = false;

        async function loadProjectData() {
            try {
                const [hwRes, dsRes] = await Promise.all([
                    fetch(`/api/projects/${project.id}/hardware-pdf`, { credentials: 'include' }),
                    fetch(`/api/projects/${project.id}/door-schedule`, { credentials: 'include' }),
                ]);

                if (cancelled) return;

                const hwJson = hwRes.ok ? await hwRes.json() : null;
                const dsJson = dsRes.ok ? await dsRes.json() : null;

                const sets = hwJson?.data?.extractedJson
                    ? transformHardwareSets(hwJson.data.extractedJson)
                    : [];

                const doors = dsJson?.data?.scheduleJson
                    ? transformDoors(dsJson.data.scheduleJson, sets)
                    : [];

                if (sets.length > 0) {
                    setHardwareSets(sets);
                    isInitialMount.current = true; // prevent auto-save on hydration
                }
                if (doors.length > 0) {
                    setDoors(doors);
                    isInitialMount.current = true;
                }
            } catch {
                // Non-critical — UI just shows empty state
            }
        }

        loadProjectData();
        return () => { cancelled = true; };
    }, [project.id]);

    const performSave = useCallback(() => {
        setSaveStatus('saving');
        try {
            const updatedProject = { ...project, hardwareSets, doors, lastModified: new Date().toISOString().split('T')[0] };
            onProjectUpdate(updatedProject);

            if (Array.isArray(doors)) {
                doors.forEach(door => {
                    if (door.status === 'complete' && door.assignedHardwareSet) {
                        captureTrainingExample(door, null);
                    }
                });
            }

            setSaveStatus('saved');
            setTimeout(() => {
                setSaveStatus(currentStatus => currentStatus === 'saved' ? 'idle' : currentStatus);
            }, 2000);
        } catch (e) {
            console.error("Auto-save failed:", e);
            setSaveStatus('error');
        }
    }, [project, hardwareSets, doors, onProjectUpdate]);

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        const handler = setTimeout(() => {
            performSave();
        }, 1000);
        return () => {
            clearTimeout(handler);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hardwareSets, doors]);

    // Processing indicator tasks (bottom-right widget)
    const [processingTasks, setProcessingTasks] = useState<ProcessingTask[]>([]);

    const addProcessingTask = (task: ProcessingTask) =>
        setProcessingTasks(prev => [...prev, task]);
    const updateProcessingTask = (id: string, patch: Partial<ProcessingTask>) =>
        setProcessingTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    const removeProcessingTask = (id: string) =>
        setProcessingTasks(prev => prev.filter(t => t.id !== id));

    // Upload confirm modals (shown only when existing data would be overwritten)
    const [hardwareUploadFiles, setHardwareUploadFiles] = useState<File[]>([]);
    const [isHardwareUploadModalOpen, setIsHardwareUploadModalOpen] = useState(false);

    const [doorUploadFile, setDoorUploadFile] = useState<File | null>(null);
    const [isDoorUploadModalOpen, setIsDoorUploadModalOpen] = useState(false);

    // Legacy errors
    const [uploadErrors, setUploadErrors] = useState<string[]>([]);
    const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);

    // ── Merge ─────────────────────────────────────────────────────────────────

    /**
     * Calls POST /api/projects/[id]/hardware-merge.
     * Returns merge stats on success; silently returns null if either source
     * data is missing (the other upload hasn't happened yet).
     */
    const runHardwareMerge = async (): Promise<{ setCount: number; matchedDoorCount: number; unmatchedDoorCount: number; warnings: string[] } | null> => {
        try {
            const res = await fetch(`/api/projects/${project.id}/hardware-merge`, {
                method: 'POST',
                credentials: 'include',
            });
            const json = await res.json() as { data?: { setCount: number; matchedDoorCount: number; unmatchedDoorCount: number; warnings: string[] }; error?: string };
            if (!res.ok) {
                // 422 = one of the source datasets is missing — that's expected
                // when only one of the two uploads has been done yet.
                if (res.status === 422) return null;
                console.warn('[merge] Merge failed:', json.error);
                return null;
            }
            return json.data ?? null;
        } catch (err) {
            console.warn('[merge] Could not reach merge endpoint:', err);
            return null;
        }
    };

    // ── Hardware PDF ──────────────────────────────────────────────────────────

    const processHardwarePdf = async (file: File) => {
        const taskId = `hw-${Date.now()}`;
        addProcessingTask({ id: taskId, fileName: file.name, type: 'hardware-pdf', stage: 'Uploading PDF…', progress: 10 });

        try {
            // Send raw PDF to server — no client-side text extraction needed.
            // The server sends it directly to OpenRouter (Gemini reads it natively).
            updateProcessingTask(taskId, { stage: 'AI is reading hardware sets…', progress: 30 });

            const form = new FormData();
            form.append('file', file);

            const res = await fetch(`/api/projects/${project.id}/hardware-pdf`, {
                method: 'POST',
                credentials: 'include',
                body: form,
            });

            const json = await res.json() as { data?: { setCount: number; itemCount: number; durationMs: number; tier: number; warnings: string[] }; error?: string };
            if (!res.ok) throw new Error(json.error ?? 'Upload failed.');

            updateProcessingTask(taskId, { stage: 'Saving to database…', progress: 85 });

            const { setCount, itemCount, tier, warnings } = json.data!;

            // 3. Reload hardware sets into UI
            const hwRes = await fetch(`/api/projects/${project.id}/hardware-pdf`, { credentials: 'include' });
            const hwJson = hwRes.ok ? await hwRes.json() : null;
            if (hwJson?.data?.extractedJson) {
                const sets = transformHardwareSets(hwJson.data.extractedJson);
                setHardwareSets(sets);
                isInitialMount.current = true;
                // Re-link doors to the freshly loaded sets
                setDoors(prev => transformDoors(
                    prev.map(d => ({ doorTag: d.doorTag, hwSet: d.providedHardwareSet ?? '', doorLocation: d.location, doorMaterial: d.doorMaterial, doorWidth: `${Math.floor(d.width / 12)}'-${d.width % 12}"`, doorHeight: `${Math.floor(d.height / 12)}'-${d.height % 12}"`, thickness: String(d.thickness) })),
                    sets,
                ));
            }

            // Run merge (no-op if door schedule not yet uploaded)
            updateProcessingTask(taskId, { stage: 'Merging with door schedule…', progress: 92 });
            const mergeStats = await runHardwareMerge();

            updateProcessingTask(taskId, { stage: 'Done!', progress: 100 });
            setTimeout(() => removeProcessingTask(taskId), 2000);

            const mergeNote = mergeStats
                ? ` · ${mergeStats.matchedDoorCount} door${mergeStats.matchedDoorCount !== 1 ? 's' : ''} linked across ${mergeStats.setCount} sets`
                : '';
            addToast({ type: 'success', message: `Extracted ${setCount} hardware sets (${itemCount} items) from PDF${tier === 2 ? ' — used fallback text extraction' : ''}${mergeNote}.` });
            if (warnings.length > 0) { setUploadErrors(warnings); setIsErrorModalOpen(true); }
        } catch (err) {
            removeProcessingTask(taskId);
            addToast({ type: 'error', message: `Hardware PDF failed: ${err instanceof Error ? err.message : 'Unknown error'}` });
        }
    };

    const handleHardwareUploads = async (files: File[]) => {
        const pdfs = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
        if (pdfs.length === 0) {
            addToast({ type: 'error', message: 'Please upload a PDF file for hardware sets.' });
            return;
        }
        const file = pdfs[0];

        // Check if existing data → show overwrite confirmation
        const check = await fetch(`/api/projects/${project.id}/hardware-pdf`, { credentials: 'include' });
        const checkJson = check.ok ? await check.json() : null;
        const hasExisting = !!checkJson?.data;

        if (hasExisting) {
            setHardwareUploadFiles([file]);
            setIsHardwareUploadModalOpen(true);
        } else {
            processHardwarePdf(file);
        }
    };

    const handleConfirmHardwareUpload = (_mode: 'add' | 'overwrite') => {
        const file = hardwareUploadFiles[0];
        setIsHardwareUploadModalOpen(false);
        setHardwareUploadFiles([]);
        if (file) processHardwarePdf(file);
    };

    // ── Door Schedule ─────────────────────────────────────────────────────────

    const processDoorSchedule = async (file: File) => {
        const taskId = `ds-${Date.now()}`;
        addProcessingTask({ id: taskId, fileName: file.name, type: 'door-schedule', stage: 'Parsing schedule…', progress: 20 });

        try {
            const form = new FormData();
            form.append('file', file);

            updateProcessingTask(taskId, { stage: 'Uploading…', progress: 40 });
            const res = await fetch(`/api/projects/${project.id}/door-schedule`, {
                method: 'POST',
                credentials: 'include',
                body: form,
            });

            const json = await res.json() as { data?: { rowCount: number; warnings: string[] }; error?: string };
            if (!res.ok) throw new Error(json.error ?? 'Upload failed.');

            updateProcessingTask(taskId, { stage: 'Saving…', progress: 80 });

            const { rowCount, warnings } = json.data!;

            // Reload doors into UI
            const dsRes = await fetch(`/api/projects/${project.id}/door-schedule`, { credentials: 'include' });
            const dsJson = dsRes.ok ? await dsRes.json() : null;
            if (dsJson?.data?.scheduleJson) {
                const newDoors = transformDoors(dsJson.data.scheduleJson, hardwareSets);
                setDoors(newDoors);
                isInitialMount.current = true;
            }

            // Run merge (no-op if hardware PDF not yet uploaded)
            updateProcessingTask(taskId, { stage: 'Merging with hardware sets…', progress: 92 });
            const mergeStats = await runHardwareMerge();

            updateProcessingTask(taskId, { stage: 'Done!', progress: 100 });
            setTimeout(() => removeProcessingTask(taskId), 2000);

            const mergeNote = mergeStats
                ? ` · ${mergeStats.matchedDoorCount}/${rowCount} doors linked to hardware sets`
                : '';
            addToast({ type: 'success', message: `Imported ${rowCount} doors from schedule${mergeNote}.` });
            if (warnings.length > 0) { setUploadErrors(warnings); setIsErrorModalOpen(true); }
        } catch (err) {
            removeProcessingTask(taskId);
            addToast({ type: 'error', message: `Door schedule failed: ${err instanceof Error ? err.message : 'Unknown error'}` });
        }
    };

    const handleDoorScheduleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        // Check if existing data → show overwrite confirmation
        const check = await fetch(`/api/projects/${project.id}/door-schedule`, { credentials: 'include' });
        const checkJson = check.ok ? await check.json() : null;
        const hasExisting = !!checkJson?.data;

        if (hasExisting) {
            setDoorUploadFile(file);
            setIsDoorUploadModalOpen(true);
        } else {
            processDoorSchedule(file);
        }
    };

    const handleConfirmDoorUpload = (_mode: 'add' | 'overwrite') => {
        const file = doorUploadFile;
        setIsDoorUploadModalOpen(false);
        setDoorUploadFile(null);
        if (file) processDoorSchedule(file);
    };

    const handleSaveSet = (set: HardwareSet) => {
        const index = hardwareSets.findIndex(s => s.id === set.id);
        if (index > -1) {
            setHardwareSets(current => current.map(s => s.id === set.id ? set : s));
        } else {
            const newSet = { ...set, id: `hs-manual-${Date.now()}` };
            setHardwareSets(current => [...current, newSet]);
        }
    };

    const handleDeleteSet = (setId: string) => {
        setHardwareSets(current => current.filter(s => s.id !== setId));
    };

    const handleBulkDeleteSets = (setIds: Set<string>) => {
        setHardwareSets(current => current.filter(s => !setIds.has(s.id)));
    };

    const handleSplitSetAndReassign = (newSetData: HardwareSet, doorIds: string[]) => {
        const newSet: HardwareSet = {
            ...newSetData,
            id: `hs-variant-${Date.now()}`,
        };
        setHardwareSets(prevSets => [...prevSets, newSet]);
        setDoors(prevDoors => {
            return prevDoors.map(door => {
                if (doorIds.includes(door.id)) {
                    return { ...door, assignedHardwareSet: newSet, providedHardwareSet: newSet.name, status: 'complete' };
                }
                return door;
            });
        });
    };

    const handleDoorsUpdate = useCallback((updater: React.SetStateAction<Door[]>) => {
        setDoors(updater);
    }, []);

    const handleProvidedSetChange = (doorId: string, newSetName: string) => {
        const trimmedName = newSetName.trim();
        let updatedHardwareSets = [...hardwareSets];
        let assignedSet: HardwareSet | undefined;

        if (trimmedName) {
            const existingSet = updatedHardwareSets.find(s => s.name.toLowerCase() === trimmedName.toLowerCase());
            if (existingSet) {
                assignedSet = existingSet;
            }
        }

        const updatedDoors = doors.map(d => {
            if (d.id === doorId) {
                return {
                    ...d,
                    providedHardwareSet: trimmedName,
                    assignedHardwareSet: assignedSet,
                    status: assignedSet ? 'complete' : 'pending',
                    assignmentConfidence: assignedSet ? 'high' : undefined,
                    assignmentReason: assignedSet ? 'Manual Entry (Auto-linked)' : undefined
                } as Door;
            }
            return d;
        });

        const currentDoor = doors.find(d => d.id === doorId);
        const oldSetName = currentDoor?.providedHardwareSet;
        if (oldSetName && oldSetName !== trimmedName) {
            const isStillUsed = updatedDoors.some(d => d.providedHardwareSet === oldSetName);
            if (!isStillUsed) {
                // optional cleanup
            }
        }

        setHardwareSets(updatedHardwareSets);
        setDoors(updatedDoors);
    };

    const hardwareSetsPanel = (
        <div className="h-full p-5">
            <HardwareSetsManager
                hardwareSets={hardwareSets}
                doors={doors}
                isLoading={false} // Loading handled by widget
                onProcessUploads={handleHardwareUploads}
                onSaveSet={handleSaveSet}
                onDeleteSet={handleDeleteSet}
                onBulkDeleteSets={handleBulkDeleteSets}
                onCreateVariant={handleSplitSetAndReassign}
            />
        </div>
    );

    const doorSchedulePanel = (
        <div className="h-full p-5">
            <DoorScheduleManager
                doors={doors}
                onDoorsUpdate={handleDoorsUpdate}
                hardwareSets={hardwareSets}
                isLoading={false} // Loading handled by widget
                onUploadClick={() => doorScheduleInputRef.current?.click()}
                appSettings={appSettings}
                onProvidedSetChange={handleProvidedSetChange}
                elevationTypes={project.elevationTypes || []}
                onManageElevations={() => setIsElevationManagerOpen(true)}
                addToast={addToast}
            />
        </div>
    );

    return (
        <main className="flex-grow flex flex-col overflow-hidden">
            {/* Top Navigation Bar */}
            <div className="bg-white border-b border-gray-200 flex-shrink-0">
                <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={onBackToDashboard} className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-primary-700 transition-colors">
                            <ArrowLeftIcon className="w-5 h-5" />
                            Back to Dashboard
                        </button>
                        <button onClick={() => setIsImageAnalysisOpen(true)} className="flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-800 transition-colors bg-primary-50 px-3 py-1.5 rounded-full border border-primary-200">
                            <CameraIcon className="w-4 h-4" />
                            Analyze Image
                        </button>
                        <button onClick={() => router.push(`/project/${project.id}/reports`)} className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Reports
                        </button>
                    </div>

                    <div className="bg-gray-100 p-1 rounded-lg border border-gray-200 flex items-center">
                        <button onClick={() => setViewMode('hardware')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'hardware' ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
                            Hardware Only
                        </button>
                        <button onClick={() => setViewMode('split')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'split' ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
                            Split View
                        </button>
                        <button onClick={() => setViewMode('doors')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'doors' ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
                            Doors Only
                        </button>
                    </div>

                    <div className="w-48 flex justify-end">
                        <SaveStatusIndicator status={saveStatus} onRetry={performSave} />
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-grow overflow-hidden">
                {viewMode === 'hardware' && (
                    <div className="h-full w-full overflow-hidden bg-gray-50 relative">
                        {hardwareSetsPanel}
                        <UploadProgressWidget />
                    </div>
                )}
                {viewMode === 'doors' && (
                    <div className="h-full w-full overflow-hidden bg-gray-50 relative">
                        {doorSchedulePanel}
                        <UploadProgressWidget />
                    </div>
                )}
                {viewMode === 'split' && (
                    <div className="relative h-full">
                        <ResizablePanels
                            defaultSplit={60}
                            minLeftWidth={40}
                            maxLeftWidth={80}
                            storageKey="planckoff-project-split"
                            leftPanel={hardwareSetsPanel}
                            rightPanel={doorSchedulePanel}
                        />
                        <UploadProgressWidget />
                    </div>
                )}
            </div>

            <input type="file" ref={doorScheduleInputRef} onChange={handleDoorScheduleUpload} className="hidden" accept=".csv,.xlsx" />

            <ImageAnalysisModal
                isOpen={isImageAnalysisOpen}
                onClose={() => setIsImageAnalysisOpen(false)}
                appSettings={appSettings}
                addToast={addToast}
            />

            <UploadConfirmationModal
                isOpen={isDoorUploadModalOpen}
                onClose={() => { setIsDoorUploadModalOpen(false); setDoorUploadFile(null); }}
                onConfirm={handleConfirmDoorUpload}
                files={doorUploadFile ? [doorUploadFile] : []}
                isLoading={processingTasks.some(t => t.type === 'door-schedule')}
                title="Confirm Door Schedule Upload"
                entityName="doors"
            />

            <UploadConfirmationModal
                isOpen={isHardwareUploadModalOpen}
                onClose={() => { setIsHardwareUploadModalOpen(false); setHardwareUploadFiles([]); }}
                onConfirm={handleConfirmHardwareUpload}
                files={hardwareUploadFiles}
                isLoading={processingTasks.some(t => t.type === 'hardware-pdf')}
                title="Confirm Hardware PDF Upload"
                entityName="hardware sets"
            />

            <ProcessingIndicator tasks={processingTasks} />

            <ErrorModal
                isOpen={isErrorModalOpen}
                onClose={() => setIsErrorModalOpen(false)}
                errors={uploadErrors}
                title="Upload Warnings & Errors"
            />

            <ValidationReportModal
                isOpen={isValidationModalOpen}
                onClose={() => setIsValidationModalOpen(false)}
                report={validationReport}
                title={validationReportTitle}
            />

            {isElevationManagerOpen && (
                <ElevationManager
                    elevationTypes={project.elevationTypes || []}
                    onUpdate={handleElevationUpdate}
                    onClose={() => setIsElevationManagerOpen(false)}
                />
            )}
        </main>
    );
};

export default ProjectView;
