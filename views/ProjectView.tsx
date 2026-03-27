import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { HardwareSet, Door, Project, AppSettings, Toast, ElevationType, ValidationReport } from '../types';
import HardwareSetsManager from '../components/HardwareSetsManager';
import DoorScheduleManager from '../components/DoorScheduleManager';
import { generateReport } from '../utils/reportGenerator';
// process... imports removed from direct use, but types might be needed
import { CheckCircleIcon, ExclamationCircleIcon, ArrowLeftIcon, CameraIcon } from '../components/icons';
import ElevationManager from '../components/ElevationManager';
import ImageAnalysisModal from '../components/ImageAnalysisModal';
import { captureTrainingExample } from '../services/mlOpsService';
import UploadConfirmationModal from '../components/UploadConfirmationModal';
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
    const navigate = useNavigate();
    const [hardwareSets, setHardwareSets] = useState<HardwareSet[]>(project.hardwareSets || []);
    const [doors, setDoors] = useState<Door[]>(project.doors || []);
    const [viewMode, setViewMode] = useState<'split' | 'hardware' | 'doors'>('split');

    // Background Upload Context
    const { queueUpload, tasks, isWorkerReady } = useBackgroundUpload();
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
        setHardwareSets(project.hardwareSets);
        setDoors(project.doors);
        setSaveStatus('idle');
        isInitialMount.current = true;
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

    // Upload States for Modals
    const [hardwareUploadFiles, setHardwareUploadFiles] = useState<File[]>([]);
    const [isHardwareUploadModalOpen, setIsHardwareUploadModalOpen] = useState(false);

    const [doorUploadFile, setDoorUploadFile] = useState<File | null>(null);
    const [isDoorUploadModalOpen, setIsDoorUploadModalOpen] = useState(false);
    // Legacy errors handling
    const [uploadErrors, setUploadErrors] = useState<string[]>([]);
    const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);


    const handleHardwareUploads = (files: File[], mode: 'add' | 'overwrite') => {
        if (files.length > 0) {
            setHardwareUploadFiles(files);
            setIsHardwareUploadModalOpen(true);
        }
    };

    const handleConfirmHardwareUpload = async (mode: 'add' | 'overwrite') => {
        setIsHardwareUploadModalOpen(false);
        if (hardwareUploadFiles.length === 0) return;

        const files = [...hardwareUploadFiles];
        setHardwareUploadFiles([]);

        // Queue tasks
        files.forEach(file => {
            queueUpload(file, 'hardware-set', appSettings.geminiApiKey, project.id);
        });

        addToast({ type: 'info', message: `Queued ${files.length} file(s) for background processing.` });

        // Note: 'overwrite' mode logic is tricky with async queue. 
        // For simplicity, background uploads assume 'merge/add'. 
        // If overwrite is strictly needed, we should clear current set here.
        if (mode === 'overwrite') {
            setHardwareSets([]); // Optimistic clear? Risk of data loss if upload fails.
            // Ideally, we'd wait. But for Phase 4 we prioritize background processing.
        }
    };

    const handleDoorScheduleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setDoorUploadFile(file);
        setIsDoorUploadModalOpen(true);
        e.target.value = '';
    };

    const handleConfirmDoorUpload = async (mode: 'add' | 'overwrite') => {
        setIsDoorUploadModalOpen(false);
        if (!doorUploadFile) return;

        const file = doorUploadFile;
        setDoorUploadFile(null);

        queueUpload(file, 'door-schedule', appSettings.geminiApiKey, project.id);
        addToast({ type: 'info', message: `Queued door schedule for background processing.` });

        if (mode === 'overwrite') {
            setDoors([]);
        }
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
                        <button onClick={() => navigate(`/project/${project.id}/reports`)} className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200">
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

            <input type="file" ref={doorScheduleInputRef} onChange={handleDoorScheduleUpload} className="hidden" accept=".csv,.xlsx,.pdf" />

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
                isLoading={false} // handled in background
                title="Confirm Door Schedule Upload"
                entityName="doors"
            />

            <UploadConfirmationModal
                isOpen={isHardwareUploadModalOpen}
                onClose={() => { setIsHardwareUploadModalOpen(false); setHardwareUploadFiles([]); }}
                onConfirm={handleConfirmHardwareUpload}
                files={hardwareUploadFiles}
                isLoading={false} // handled in background
                title="Confirm Hardware Sets Upload"
                entityName="hardware sets"
            />

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
