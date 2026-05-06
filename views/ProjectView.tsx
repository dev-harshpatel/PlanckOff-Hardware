'use client';

import React, { useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { HardwareSet, Door, Project, AppSettings, Toast, ElevationType } from '../types';
import HardwareSetsManager from '../components/hardware/HardwareSetsManager';
import DoorScheduleManager from '../components/doorSchedule/DoorScheduleManager';
import { generateReport } from '../utils/reportGenerator';
import { ArrowLeft, BarChart2, Loader2, Columns2, PanelLeft, PanelRight, Upload, X, Minus, CheckCircle2, FileSpreadsheet, FileText, GitMerge, Trash2, NotebookPen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ElevationManager from '../components/elevation/ElevationManager';
import type { TrashItem } from '@/lib/db/hardware';
import UndoToast from '../components/shared/UndoToast';
import HardwareTrashModal from '../components/hardware/HardwareTrashModal';
import UploadConfirmationModal from '../components/upload/UploadConfirmationModal';
import ErrorModal from '../components/shared/ErrorModal';
import ValidationReportModal from '../components/reports/ValidationReportModal';
import ResizablePanels from '../components/layout/ResizablePanels';
import { useProcessingWidget } from '@/contexts/ProcessingWidgetContext';
import { useNavigationLoading } from '@/contexts/NavigationLoadingContext';
import { ProjectNotesPanel } from '../components/projects/ProjectNotesPanel';
import { SaveStatusIndicator } from '../components/shared/SaveStatusIndicator';
import { useProjectData } from '../hooks/useProjectData';
import { useProjectPersistence } from '../hooks/useProjectPersistence';
import { useProjectUploads } from '../hooks/useProjectUploads';
import { useTrashUndo } from '../hooks/useTrashUndo';


interface ProjectViewProps {
    project: Project;
    onProjectUpdate: (updatedProject: Project) => void;
    appSettings: AppSettings;
    onBackToDashboard: () => void;
    addToast: (toast: Omit<Toast, 'id'>) => void;
}

const ProjectView: React.FC<ProjectViewProps> = ({ project, onProjectUpdate, appSettings, onBackToDashboard, addToast }) => {
    const router = useRouter();
    const { startNavigation } = useNavigationLoading();
    const { widget } = useProcessingWidget();

    // Refs for cross-hook coordination
    const saveToFinalJsonRef = useRef<((sets: HardwareSet[], doors: Door[], trash?: TrashItem[]) => Promise<void>) | null>(null);
    const hasPendingUndoRef = useRef(false);
    const doorScheduleInputRef = useRef<HTMLInputElement>(null);

    // Local UI state
    const [viewMode, setViewMode] = useState<'split' | 'hardware' | 'doors'>('split');
    const [isElevationManagerOpen, setIsElevationManagerOpen] = useState(false);
    const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
    const [isNotesOpen, setIsNotesOpen] = useState(false);

    const {
        hardwareSets, setHardwareSets, doors, setDoors, trashItems, setTrashItems,
        hardwareSetsRef, doorsRef, trashItemsRef, isDataLoading, isPollingForResult,
        isInitialMount,
    } = useProjectData({ projectId: project.id, addToast, saveToFinalJsonRef });

    const { saveStatus, saveToFinalJson, saveToHardwarePdf, performSave } = useProjectPersistence({
        projectId: project.id, project, hardwareSets, doors, trashItems,
        onProjectUpdate, isInitialMount, hasPendingUndoRef,
    });

    // Assign synchronously so loadProjectData can call it on first-upload initialization
    saveToFinalJsonRef.current = saveToFinalJson;

    const {
        processingTasks, setProcessingTasks,
        hardwareUploadFiles, isHardwareUploadModalOpen, setIsHardwareUploadModalOpen, setHardwareUploadFiles,
        doorUploadFile, isDoorUploadModalOpen, setIsDoorUploadModalOpen, setDoorUploadFile,
        isCombinedUploadOpen, isCombinedMinimized, setIsCombinedUploadOpen,
        combinedExcelFile, combinedPdfFile, setCombinedExcelFile, setCombinedPdfFile,
        isCombinedProcessing, combinedProgress, combinedCurrentStep, combinedLogs, logsEndRef,
        isCombinedOverwriteOpen, setIsCombinedOverwriteOpen, isCombinedOverwriteChecking,
        uploadErrors, isErrorModalOpen, setIsErrorModalOpen,
        validationReport, isValidationModalOpen, setIsValidationModalOpen, validationReportTitle,
        resetCombinedModal, handleMinimizeCombinedModal,
        handleHardwareUploads, handleConfirmHardwareUpload,
        handleDoorScheduleUpload, handleConfirmDoorUpload,
        handleCombinedProcessClick, handleConfirmCombinedOverwrite,
        handleSaveSet, handleAssignAll, handleProvidedSetChange,
    } = useProjectUploads({
        projectId: project.id, hardwareSets, setHardwareSets, doors, setDoors,
        isInitialMount, addToast, saveToFinalJson,
    });

    const {
        undoToasts, dismissUndoToast,
        handleDeleteSet, handleBulkDeleteSets, handleRestoreFromTrash,
        handlePermanentDelete, handleClearAllTrash, handleSplitSetAndReassign,
        handleDoorsUpdate, handleDeleteDoors,
    } = useTrashUndo({
        hardwareSets, setHardwareSets, doors, setDoors, trashItems, setTrashItems,
        hardwareSetsRef, doorsRef, trashItemsRef, hasPendingUndoRef, addToast,
        saveToFinalJson, saveToHardwarePdf, performSave,
    });

    const persistElevationTypes = async (updatedTypes: ElevationType[]) => {
        try {
            await fetch(`/api/projects/${project.id}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ elevationTypes: updatedTypes }),
            });
        } catch {
            // Non-critical — local state is still updated
        }
    };

    const handleElevationUpdate = (updatedTypes: ElevationType[]) => {
        const updatedProject = { ...project, elevationTypes: updatedTypes };
        onProjectUpdate(updatedProject);
        void persistElevationTypes(updatedTypes);
    };

    const handleSingleElevationTypeUpdate = (updated: ElevationType) => {
        const current = project.elevationTypes ?? [];
        const exists = current.some(et => et.id === updated.id);
        const next = exists
            ? current.map(et => et.id === updated.id ? updated : et)
            : [...current, updated]; // new type created on-the-fly from ElevationTab
        onProjectUpdate({ ...project, elevationTypes: next });
        void persistElevationTypes(next);
    };

    // Reactive report generation
    const report = useMemo(() => generateReport(doors), [doors]);

    const formatElapsed = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return m > 0 ? `${m}m ${sec.toString().padStart(2, '0')}s` : `${sec}s`;
    };

    const hardwareActiveTask = processingTasks.find(t => t.type === 'hardware-pdf');
    const doorActiveTask = processingTasks.find(t => t.type === 'door-schedule');

    // Individual re-upload buttons are only enabled after the first combined upload completes.
    // If there's already data (loaded from DB on mount), they're also enabled immediately.
    const individualUploadsEnabled = !isDataLoading && !isPollingForResult && (hardwareSets.length > 0 || doors.length > 0);

    const hardwareSetsPanel = (
        <div className="h-full min-h-0 p-5 flex flex-col">
            <HardwareSetsManager
                projectId={project.id}
                hardwareSets={hardwareSets}
                doors={doors}
                isLoading={isDataLoading || isPollingForResult}
                onProcessUploads={handleHardwareUploads}
                onSaveSet={handleSaveSet}
                onDeleteSet={handleDeleteSet}
                onBulkDeleteSets={handleBulkDeleteSets}
                onCreateVariant={handleSplitSetAndReassign}
                activeTask={hardwareActiveTask}
                onCancelTask={hardwareActiveTask ? () => setProcessingTasks(prev => prev.filter(t => t.id !== hardwareActiveTask.id)) : undefined}
                canReupload={individualUploadsEnabled}
            />
        </div>
    );

    const doorSchedulePanel = (
        <div className="h-full min-h-0 p-5 flex flex-col">
            <DoorScheduleManager
                doors={doors}
                onDoorsUpdate={handleDoorsUpdate}
                hardwareSets={hardwareSets}
                isLoading={isDataLoading || isPollingForResult}
                onUploadClick={() => doorScheduleInputRef.current?.click()}
                appSettings={appSettings}
                onProvidedSetChange={handleProvidedSetChange}
                elevationTypes={project.elevationTypes || []}
                onManageElevations={() => setIsElevationManagerOpen(true)}
                onElevationTypeUpdate={handleSingleElevationTypeUpdate}
                projectId={project.id}
                addToast={addToast}
                activeTask={doorActiveTask}
                onCancelTask={doorActiveTask ? () => setProcessingTasks(prev => prev.filter(t => t.id !== doorActiveTask.id)) : undefined}
                canReupload={individualUploadsEnabled}
                onDeleteDoors={handleDeleteDoors}
                onAssignAll={handleAssignAll}
                onDoorSaved={performSave}
            />
        </div>
    );

    return (
        <main className="h-full min-h-0 flex flex-col overflow-hidden">
            {/* Top Navigation Bar */}
            <div className="bg-[var(--bg)] border-b border-[var(--border)] flex-shrink-0">
                <div className="px-4 h-12 flex items-center justify-between gap-4">

                    {/* Left — back + actions */}
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={onBackToDashboard} className="gap-1.5 text-[var(--text-muted)]">
                            <ArrowLeft className="h-4 w-4" />
                            <span className="hidden sm:inline">Dashboard</span>
                        </Button>

                        <div className="w-px h-4 bg-[var(--border)] mx-1" />

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                const href = `/project/${project.id}/reports`;
                                startNavigation(href);
                                router.push(href);
                            }}
                            className="gap-1.5 text-[var(--text-muted)]"
                        >
                            <BarChart2 className="h-4 w-4" />
                            <span className="hidden md:inline">Reports</span>
                        </Button>
                    </div>

                    {/* Centre — view mode segmented control */}
                    <div className="flex items-center bg-[var(--bg-muted)] rounded-lg p-0.5 gap-0.5">
                        <button
                            onClick={() => setViewMode('hardware')}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'hardware' ? 'bg-[var(--bg)] text-[var(--text)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
                        >
                            <PanelLeft className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Hardware</span>
                        </button>
                        <button
                            onClick={() => setViewMode('split')}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'split' ? 'bg-[var(--bg)] text-[var(--text)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
                        >
                            <Columns2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Split</span>
                        </button>
                        <button
                            onClick={() => setViewMode('doors')}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'doors' ? 'bg-[var(--bg)] text-[var(--text)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
                        >
                            <PanelRight className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Doors</span>
                        </button>
                    </div>

                    {/* Right — notes + trash + process files + save status */}
                    <div className="flex items-center gap-2 justify-end min-w-[90px]">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsNotesOpen(true)}
                            className={`gap-1.5 ${isNotesOpen ? 'text-[var(--primary-text)]' : 'text-[var(--text-muted)]'}`}
                            title="Project notes"
                        >
                            <NotebookPen className="h-4 w-4" />
                            <span className="hidden md:inline">Notes</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsTrashModalOpen(true)}
                            className="gap-1.5 text-[var(--text-muted)] relative"
                            title="View deleted items"
                        >
                            <Trash2 className="h-4 w-4" />
                            {trashItems.length > 0 && (
                                <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold leading-none">
                                    {trashItems.length > 9 ? '9+' : trashItems.length}
                                </span>
                            )}
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => setIsCombinedUploadOpen(true)}
                            className="gap-1.5"
                        >
                            {(isCombinedProcessing || isPollingForResult)
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Upload className="h-4 w-4" />
                            }
                            <span className="hidden md:inline">
                                {(isCombinedProcessing || isPollingForResult) ? 'Processing…' : 'Process Files'}
                            </span>
                        </Button>
                        <SaveStatusIndicator status={saveStatus} onRetry={performSave} />
                    </div>

                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {viewMode === 'hardware' && (
                    <div className="h-full min-h-0 w-full overflow-hidden bg-[var(--bg-subtle)] relative">
                        {hardwareSetsPanel}
                    </div>
                )}
                {viewMode === 'doors' && (
                    <div className="h-full min-h-0 w-full overflow-hidden bg-[var(--bg-subtle)] relative">
                        {doorSchedulePanel}
                    </div>
                )}
                {viewMode === 'split' && (
                    <div className="relative h-full min-h-0">
                        <ResizablePanels
                            defaultSplit={60}
                            minLeftWidth={40}
                            maxLeftWidth={80}
                            storageKey="planckoff-project-split"
                            leftPanel={hardwareSetsPanel}
                            rightPanel={doorSchedulePanel}
                        />
                    </div>
                )}
            </div>

            <input type="file" ref={doorScheduleInputRef} onChange={handleDoorScheduleUpload} className="hidden" accept=".csv,.xlsx" />

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

            <UploadConfirmationModal
                isOpen={isCombinedOverwriteOpen}
                onClose={() => setIsCombinedOverwriteOpen(false)}
                onConfirm={handleConfirmCombinedOverwrite}
                files={[...(combinedExcelFile ? [combinedExcelFile] : []), ...(combinedPdfFile ? [combinedPdfFile] : [])]}
                isLoading={false}
                title="Re-upload — Project Already Has Data"
                entityName="door schedule and hardware sets"
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
                    projectId={project.id}
                />
            )}

            {/* Undo toast — shown at bottom-center while a delete is pending */}
            <UndoToast items={undoToasts} onDismiss={dismissUndoToast} />

            {/* Trash modal */}
            <HardwareTrashModal
                isOpen={isTrashModalOpen}
                onClose={() => setIsTrashModalOpen(false)}
                trashItems={trashItems}
                onRestore={handleRestoreFromTrash}
                onPermanentDelete={handlePermanentDelete}
                onClearAll={handleClearAllTrash}
            />

            {/* Combined Upload Modal — full overlay (hidden when minimized) */}
            {isCombinedUploadOpen && !isCombinedMinimized && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <GitMerge className="h-4 w-4 text-[var(--text-muted)]" />
                                <h2 className="text-sm font-semibold text-[var(--text)]">
                                    Process Door Schedule &amp; Hardware PDF
                                </h2>
                                {isCombinedProcessing && (
                                    <span className="flex items-center gap-1 text-xs font-mono text-[var(--text-muted)] bg-[var(--bg-muted)] border border-[var(--border)] rounded px-2 py-0.5">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        {formatElapsed(widget.elapsedSeconds)}
                                    </span>
                                )}
                                {!isCombinedProcessing && widget.elapsedSeconds > 0 && (
                                    <span className="text-xs font-mono text-green-600 dark:text-green-400 bg-green-500/10 border border-green-500/20 rounded px-2 py-0.5">
                                        {formatElapsed(widget.elapsedSeconds)}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                {isCombinedProcessing && (
                                    <button
                                        onClick={handleMinimizeCombinedModal}
                                        className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
                                        aria-label="Minimize"
                                        title="Minimize — processing continues in background"
                                    >
                                        <Minus className="h-3.5 w-3.5" />
                                    </button>
                                )}
                                <button
                                    onClick={() => { if (!isCombinedProcessing) resetCombinedModal(); }}
                                    className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    disabled={isCombinedProcessing}
                                    aria-label="Close"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* File inputs — hidden once processing starts or logs are restored */}
                        {combinedLogs.length === 0 && (
                            <div className="px-5 py-4 flex flex-col gap-4 flex-shrink-0">
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
                                        <FileSpreadsheet className="h-3.5 w-3.5" />
                                        Door Schedule (.xlsx)
                                    </span>
                                    <input
                                        type="file"
                                        accept=".xlsx"
                                        disabled={isCombinedProcessing}
                                        onChange={(e) => setCombinedExcelFile(e.target.files?.[0] ?? null)}
                                        className="text-sm text-[var(--text-muted)] file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-[var(--bg-muted)] file:text-[var(--text-secondary)] hover:file:bg-[var(--bg-subtle)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    {combinedExcelFile && (
                                        <span className="text-xs text-[var(--text-muted)] truncate">{combinedExcelFile.name}</span>
                                    )}
                                </label>

                                <label className="flex flex-col gap-1.5">
                                    <span className="text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
                                        <FileText className="h-3.5 w-3.5" />
                                        Hardware PDF (.pdf)
                                    </span>
                                    <input
                                        type="file"
                                        accept=".pdf"
                                        disabled={isCombinedProcessing}
                                        onChange={(e) => setCombinedPdfFile(e.target.files?.[0] ?? null)}
                                        className="text-sm text-[var(--text-muted)] file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-[var(--bg-muted)] file:text-[var(--text-secondary)] hover:file:bg-[var(--bg-subtle)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    {combinedPdfFile && (
                                        <span className="text-xs text-[var(--text-muted)] truncate">{combinedPdfFile.name}</span>
                                    )}
                                </label>
                            </div>
                        )}

                        {/* Progress bar + step label (shown while processing) */}
                        {isCombinedProcessing && (
                            <div className="px-5 pt-3 pb-3 flex-shrink-0">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs text-[var(--text-muted)] truncate pr-2">{combinedCurrentStep}</span>
                                    <span className="text-xs text-[var(--text-faint)] tabular-nums flex-shrink-0">{combinedProgress}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-[var(--bg-muted)] rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                        style={{ width: `${combinedProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Logs panel (shown once processing starts or logs exist) */}
                        {combinedLogs.length > 0 && (
                            <div className="mx-5 mb-3 flex-1 min-h-0 overflow-y-auto bg-[var(--bg-muted)] border border-[var(--border)] rounded-lg p-3 font-mono text-xs space-y-1 max-h-52">
                                {combinedLogs.map((log, i) => (
                                    <div key={i} className={
                                        log.level === 'success' ? 'text-green-600 dark:text-green-400' :
                                        log.level === 'warn' ? 'text-amber-600 dark:text-amber-400' :
                                        log.level === 'error' ? 'text-red-600 dark:text-red-400' :
                                        'text-[var(--text-muted)]'
                                    }>
                                        {log.level === 'success' ? '✓ ' : log.level === 'warn' ? '⚠ ' : log.level === 'error' ? '✗ ' : '· '}
                                        {log.msg}
                                    </div>
                                ))}
                                <div ref={logsEndRef} />
                            </div>
                        )}

                        {/* Footer */}
                        <div className="px-5 py-4 border-t border-[var(--border)] flex items-center justify-end gap-2 flex-shrink-0">
                            {combinedProgress === 100 && !isCombinedProcessing ? (
                                <Button
                                    size="sm"
                                    onClick={resetCombinedModal}
                                    className="gap-1.5"
                                >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Done
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={resetCombinedModal}
                                        disabled={isCombinedProcessing}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleCombinedProcessClick}
                                        disabled={!combinedExcelFile || !combinedPdfFile || isCombinedProcessing || isCombinedOverwriteChecking}
                                        loading={isCombinedProcessing || isCombinedOverwriteChecking}
                                        loadingText={isCombinedProcessing ? 'Processing...' : 'Checking...'}
                                        className="gap-1.5"
                                    >
                                        {isCombinedProcessing ? (
                                            <>
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                Processing…
                                            </>
                                        ) : isCombinedOverwriteChecking ? (
                                            <>
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                Checking…
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="h-3.5 w-3.5" />
                                                Process
                                            </>
                                        )}
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Minimized floating widget — shown when modal is minimized during processing */}
            {/* Polling indicator — shown when user returned to project while server is still processing */}
            {isPollingForResult && !isCombinedUploadOpen && (
                <div className="fixed bottom-6 right-6 z-50">
                    <div className="flex items-center gap-3 bg-[var(--bg)] border border-[var(--border)] rounded-full shadow-lg px-4 py-2.5">
                        <Loader2 className="h-4 w-4 text-blue-500 animate-spin flex-shrink-0" />
                        <div className="flex flex-col items-start min-w-0">
                            <span className="text-xs font-medium text-[var(--text)]">Processing files…</span>
                            <span className="text-xs text-[var(--text-muted)]">Waiting for server</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Local floating pill hidden — global pill in AppShell handles all navigation contexts */}

            {/* Project Notes slide-in panel */}
            <ProjectNotesPanel
                projectId={project.id}
                isOpen={isNotesOpen}
                onClose={() => setIsNotesOpen(false)}
            />
        </main>
    );
};

export default ProjectView;
