'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { HardwareSet, Door, Toast, ValidationReport } from '../types';
import { ERRORS } from '@/constants/errors';
import type { TrashItem } from '@/lib/db/hardware';
import { transformHardwareSets, transformDoors, transformFromFinalJson } from '../utils/hardwareTransformers';
import { autoCreateVariants } from '../utils/autoVariantUtils';
import { resolveAllSets } from '../utils/descriptionResolver';
import { type ProcessingTask } from '../components/shared/ProcessingIndicator';
import { type ProcessingLogEntry, useProcessingWidget } from '@/contexts/ProcessingWidgetContext';
import { useBackgroundUpload, UploadTask } from '../contexts/BackgroundUploadContext';

interface UseProjectUploadsOptions {
    projectId: string;
    hardwareSets: HardwareSet[];
    setHardwareSets: React.Dispatch<React.SetStateAction<HardwareSet[]>>;
    doors: Door[];
    setDoors: React.Dispatch<React.SetStateAction<Door[]>>;
    isInitialMount: React.MutableRefObject<boolean>;
    hasFinalJsonRef: React.MutableRefObject<boolean>;
    trashItemsRef: React.MutableRefObject<TrashItem[]>;
    addToast: (toast: Omit<Toast, 'id'>) => void;
    saveToFinalJson: (sets: HardwareSet[], doors: Door[], trash?: TrashItem[]) => Promise<void>;
}

export function useProjectUploads({
    projectId,
    hardwareSets,
    setHardwareSets,
    doors,
    setDoors,
    isInitialMount,
    hasFinalJsonRef,
    trashItemsRef,
    addToast,
    saveToFinalJson,
}: UseProjectUploadsOptions) {
    const { setWidget, clearWidget, registerExpandHandler, unregisterExpandHandler } = useProcessingWidget();
    const { tasks } = useBackgroundUpload();
    const processedTaskIds = useRef<Set<string>>(new Set());

    // Validation Report State
    const [validationReport, setValidationReport] = useState<ValidationReport<unknown> | null>(null);
    const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
    const [validationReportTitle, setValidationReportTitle] = useState('');

    // Initialize processed tasks with already completed ones to avoid re-processing on mount
    useEffect(() => {
        tasks.forEach(t => {
            if (t.status === 'completed' || t.status === 'error') {
                processedTaskIds.current.add(t.id);
            }
        });
    }, []); // Run once on mount

    const handleTaskCompletion = useCallback((task: UploadTask) => {
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
                isInitialMount.current = true;
                addToast({ type: 'success', message: `Background Upload: Imported ${newSets.length} hardware sets.` });
            }
            if (report.errors.length > 0 || report.summary.errorCount > 0) {
                setValidationReport(report);
                setValidationReportTitle('Hardware Sets Upload Report');
                setIsValidationModalOpen(true);
            }
        } else if (task.type === 'door-schedule') {
            const newDoors: Door[] = report.data;
            if (newDoors.length > 0) {
                setDoors(currentDoors => [...currentDoors, ...newDoors]);
                isInitialMount.current = true;
                addToast({ type: 'success', message: `Background Upload: Imported ${newDoors.length} doors.` });
            }
            if (report.errors.length > 0 || report.summary.errorCount > 0) {
                setValidationReport(report);
                setValidationReportTitle('Door Schedule Upload Report');
                setIsValidationModalOpen(true);
            }
        }
    }, [addToast, setHardwareSets, setDoors, isInitialMount]);

    // Listen for new background upload completions
    useEffect(() => {
        const completedProjectTasks = tasks.filter(t =>
            (t.status === 'completed') &&
            t.projectId === projectId &&
            !processedTaskIds.current.has(t.id)
        );

        if (completedProjectTasks.length > 0) {
            completedProjectTasks.forEach(task => {
                processedTaskIds.current.add(task.id);
                handleTaskCompletion(task);
            });
        }
    }, [tasks, projectId, handleTaskCompletion]);

    // Processing indicator tasks (bottom-right widget)
    const [processingTasks, setProcessingTasks] = useState<ProcessingTask[]>([]);

    const addProcessingTask = (task: ProcessingTask) =>
        setProcessingTasks(prev => [...prev, task]);
    const updateProcessingTask = (id: string, patch: Partial<ProcessingTask>) =>
        setProcessingTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    const removeProcessingTask = (id: string) =>
        setProcessingTasks(prev => prev.filter(t => t.id !== id));

    // Upload confirm modals
    const [hardwareUploadFiles, setHardwareUploadFiles] = useState<File[]>([]);
    const [isHardwareUploadModalOpen, setIsHardwareUploadModalOpen] = useState(false);

    const [doorUploadFile, setDoorUploadFile] = useState<File | null>(null);
    const [isDoorUploadModalOpen, setIsDoorUploadModalOpen] = useState(false);

    // Combined upload
    const [isCombinedUploadOpen, setIsCombinedUploadOpen] = useState(false);
    const [isCombinedMinimized, setIsCombinedMinimized] = useState(false);
    const [combinedExcelFile, setCombinedExcelFile] = useState<File | null>(null);
    const [combinedPdfFile, setCombinedPdfFile] = useState<File | null>(null);
    const [isCombinedProcessing, setIsCombinedProcessing] = useState(false);
    const [combinedProgress, setCombinedProgress] = useState(0);
    const [combinedCurrentStep, setCombinedCurrentStep] = useState('');
    const [combinedLogs, setCombinedLogs] = useState<{ level: 'info' | 'success' | 'warn' | 'error'; msg: string }[]>([]);
    const [pipelineStep, setPipelineStep] = useState(-1);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const logsRef = useRef<ProcessingLogEntry[]>([]);
    const [combinedActiveDetail, setCombinedActiveDetail] = useState('');
    const [isCombinedOverwriteOpen, setIsCombinedOverwriteOpen] = useState(false);
    const [isCombinedOverwriteChecking, setIsCombinedOverwriteChecking] = useState(false);
    const cancelControllerRef = useRef<AbortController | null>(null);
    const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const stepAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Legacy upload errors
    const [uploadErrors, setUploadErrors] = useState<string[]>([]);
    const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);

    const resetCombinedModal = () => {
        logsRef.current = [];
        setIsCombinedUploadOpen(false);
        setCombinedExcelFile(null);
        setCombinedPdfFile(null);
        setCombinedLogs([]);
        setCombinedProgress(0);
        setCombinedCurrentStep('');
        setCombinedActiveDetail('');
        setPipelineStep(-1);
        clearWidget();
    };

    const handleMinimizeCombinedModal = () => {
        setIsCombinedMinimized(true);
        setWidget({ isMinimized: true });
    };

    // Register expand handler so AppShell's global pill can re-open the modal on this page.
    useEffect(() => {
        registerExpandHandler(() => {
            setIsCombinedUploadOpen(true);
            setIsCombinedMinimized(false);
            setWidget({ isMinimized: false });
        });
        return () => unregisterExpandHandler();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Returns the current trash with stale entries for live-set names removed.
    // Prevents duplicate trash accumulation across delete → re-upload → delete cycles.
    const trashWithoutLiveSets = useCallback((liveSets: HardwareSet[]): TrashItem[] => {
        const liveNames = new Set(liveSets.map(s => s.name.toLowerCase()));
        return trashItemsRef.current.filter(t =>
            t.type !== 'set' || !liveNames.has((t.setName ?? '').toLowerCase())
        );
    }, [trashItemsRef]);

    const addLog = useCallback((level: 'info' | 'success' | 'warn' | 'error', msg: string) => {
        const entry: ProcessingLogEntry = { level, msg };
        logsRef.current = [...logsRef.current, entry];
        setCombinedLogs(prev => [...prev, entry]);
        setWidget({ logs: logsRef.current });
    }, [setWidget]);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [combinedLogs]);

    const runHardwareMerge = async (): Promise<{ setCount: number; matchedDoorCount: number; unmatchedDoorCount: number; warnings: string[] } | null> => {
        try {
            const res = await fetch(`/api/projects/${projectId}/hardware-merge`, {
                method: 'POST',
                credentials: 'include',
            });
            const json = await res.json() as { data?: { setCount: number; matchedDoorCount: number; unmatchedDoorCount: number; warnings: string[] }; error?: string };
            if (!res.ok) {
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
            updateProcessingTask(taskId, { stage: 'AI is reading hardware sets…', progress: 30 });

            const form = new FormData();
            form.append('file', file);

            const res = await fetch(`/api/projects/${projectId}/hardware-pdf`, {
                method: 'POST',
                credentials: 'include',
                body: form,
            });

            const json = await res.json() as { data?: { setCount: number; itemCount: number; durationMs: number; tier: number; warnings: string[]; masterQueued: number; masterSkipped: number; masterQueueWarning?: string | null }; error?: string };
            if (!res.ok) throw new Error(json.error ?? ERRORS.HARDWARE.UPLOAD_FAILED.message);

            updateProcessingTask(taskId, { stage: 'Saving to database…', progress: 85 });

            const { setCount, itemCount, tier, warnings, masterQueued, masterQueueWarning } = json.data!;

            updateProcessingTask(taskId, { stage: 'Loading hardware sets…', progress: 88 });
            const hwRes = await fetch(`/api/projects/${projectId}/hardware-pdf`, { credentials: 'include' });
            const hwJson = hwRes.ok ? await hwRes.json() : null;
            let loadedSets: HardwareSet[] = [];
            if (hwJson?.data?.extractedJson) {
                loadedSets = transformHardwareSets(hwJson.data.extractedJson);
                setHardwareSets(loadedSets);
                isInitialMount.current = true;
            }

            updateProcessingTask(taskId, { stage: 'Matching with door schedule…', progress: 92 });
            const mergeStats = await runHardwareMerge();

            if (mergeStats && loadedSets.length > 0) {
                const dsFresh = await fetch(`/api/projects/${projectId}/door-schedule`, { credentials: 'include' });
                const dsFreshJson = dsFresh.ok ? await dsFresh.json() : null;
                if (dsFreshJson?.data?.scheduleJson) {
                    const freshDoors = transformDoors(dsFreshJson.data.scheduleJson, loadedSets);
                    const { sets: autoSets, doors: autoDoors } = autoCreateVariants(loadedSets, freshDoors);
                    const resolvedSets = resolveAllSets(autoSets, autoDoors);
                    hasFinalJsonRef.current = true;
                    setHardwareSets(resolvedSets);
                    setDoors(autoDoors);
                    isInitialMount.current = true;
                    saveToFinalJson(resolvedSets, autoDoors, trashWithoutLiveSets(resolvedSets)).catch(() => {});
                } else {
                    const { sets: autoSets, doors: autoDoors } = autoCreateVariants(loadedSets, []);
                    const resolvedSets = resolveAllSets(autoSets, autoDoors);
                    hasFinalJsonRef.current = true;
                    setHardwareSets(resolvedSets);
                    isInitialMount.current = true;
                    saveToFinalJson(resolvedSets, []).catch(() => {});
                }
            } else if (loadedSets.length > 0) {
                const dsFallback = await fetch(`/api/projects/${projectId}/door-schedule`, { credentials: 'include' });
                const dsFallbackJson = dsFallback.ok ? await dsFallback.json() : null;
                const fallbackDoors = dsFallbackJson?.data?.scheduleJson
                    ? transformDoors(dsFallbackJson.data.scheduleJson, loadedSets)
                    : [];
                const { sets: autoSets, doors: autoDoors } = autoCreateVariants(loadedSets, fallbackDoors);
                const resolvedSets = resolveAllSets(autoSets, autoDoors);
                hasFinalJsonRef.current = true;
                setHardwareSets(resolvedSets);
                if (autoDoors.length > 0) { setDoors(autoDoors); }
                isInitialMount.current = true;
                saveToFinalJson(resolvedSets, autoDoors).catch(() => {});
            }

            updateProcessingTask(taskId, { stage: 'Done!', progress: 100 });
            setTimeout(() => removeProcessingTask(taskId), 2000);

            const mergeNote = mergeStats
                ? ` · ${mergeStats.matchedDoorCount} door${mergeStats.matchedDoorCount !== 1 ? 's' : ''} linked across ${mergeStats.setCount} sets`
                : '';
            const masterNote = masterQueued > 0 ? ` · ${masterQueued} new item${masterQueued !== 1 ? 's' : ''} queued for review in Database` : '';
            addToast({ type: 'success', message: `Extracted ${setCount} hardware sets (${itemCount} items) from PDF${tier === 2 ? ' — used fallback text extraction' : ''}${mergeNote}${masterNote}.` });
            if (masterQueueWarning) {
                addToast({ type: 'warning', message: 'Hardware PDF imported, but queuing items for Database review failed.', details: masterQueueWarning });
            }
            if (warnings.length > 0) { setUploadErrors(warnings); setIsErrorModalOpen(true); }
        } catch (err) {
            removeProcessingTask(taskId);
            addToast({ type: 'error', message: ERRORS.HARDWARE.HARDWARE_PDF_FAILED.message, details: ERRORS.HARDWARE.HARDWARE_PDF_FAILED.action });
        }
    };

    const handleHardwareUploads = async (files: File[]) => {
        const pdfs = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
        if (pdfs.length === 0) {
            addToast({ type: 'error', message: ERRORS.HARDWARE.PDF_FILE_REQUIRED.message });
            return;
        }
        const file = pdfs[0];

        const [check, mergeCheck] = await Promise.all([
            fetch(`/api/projects/${projectId}/hardware-pdf`, { credentials: 'include' }),
            fetch(`/api/projects/${projectId}/hardware-merge`, { credentials: 'include' }),
        ]);
        const checkJson = check.ok ? await check.json() : null;
        const mergeJson = mergeCheck.ok ? await mergeCheck.json() : null;
        const hasExtracted = (checkJson?.data?.extractedJson?.length ?? 0) > 0;
        const hasFinalSets = ((mergeJson?.data?.finalJson ?? []) as Array<{ setName: string }>)
            .filter(s => s.setName !== '__unassigned__').length > 0;
        const hasExisting = hasExtracted || hasFinalSets;

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
            const res = await fetch(`/api/projects/${projectId}/door-schedule`, {
                method: 'POST',
                credentials: 'include',
                body: form,
            });

            const json = await res.json() as { data?: { rowCount: number; warnings: string[] }; error?: string };
            if (!res.ok) throw new Error(json.error ?? ERRORS.HARDWARE.UPLOAD_FAILED.message);

            updateProcessingTask(taskId, { stage: 'Saving…', progress: 80 });

            const { rowCount, warnings } = json.data!;

            updateProcessingTask(taskId, { stage: 'Loading door schedule…', progress: 85 });
            const dsRes = await fetch(`/api/projects/${projectId}/door-schedule`, { credentials: 'include' });
            const dsJson = dsRes.ok ? await dsRes.json() : null;
            let loadedDoors: Door[] = [];
            if (dsJson?.data?.scheduleJson) {
                loadedDoors = transformDoors(dsJson.data.scheduleJson, hardwareSets);
                setDoors(loadedDoors);
                isInitialMount.current = true;
            }

            updateProcessingTask(taskId, { stage: 'Matching with hardware sets…', progress: 92 });
            const mergeStats = await runHardwareMerge();

            if (mergeStats && dsJson?.data?.scheduleJson) {
                const hwFresh = await fetch(`/api/projects/${projectId}/hardware-pdf`, { credentials: 'include' });
                const hwFreshJson = hwFresh.ok ? await hwFresh.json() : null;
                const freshSets = hwFreshJson?.data?.extractedJson
                    ? transformHardwareSets(hwFreshJson.data.extractedJson)
                    : hardwareSets;
                const freshDoors = transformDoors(dsJson.data.scheduleJson, freshSets);
                const { sets: autoSets, doors: autoDoors } = autoCreateVariants(freshSets, freshDoors);
                const resolvedSets = resolveAllSets(autoSets, autoDoors);
                hasFinalJsonRef.current = true;
                setHardwareSets(resolvedSets);
                setDoors(autoDoors);
                isInitialMount.current = true;
                saveToFinalJson(resolvedSets, autoDoors, trashWithoutLiveSets(resolvedSets)).catch(() => {});
            } else if (loadedDoors.length > 0) {
                const hwFallback = await fetch(`/api/projects/${projectId}/hardware-pdf`, { credentials: 'include' });
                const hwFallbackJson = hwFallback.ok ? await hwFallback.json() : null;
                const fallbackSets = hwFallbackJson?.data?.extractedJson
                    ? transformHardwareSets(hwFallbackJson.data.extractedJson)
                    : hardwareSets;
                const { sets: autoSets, doors: autoDoors } = autoCreateVariants(fallbackSets, loadedDoors);
                const resolvedSets = resolveAllSets(autoSets, autoDoors);
                hasFinalJsonRef.current = true;
                setHardwareSets(resolvedSets);
                setDoors(autoDoors);
                isInitialMount.current = true;
                saveToFinalJson(resolvedSets, autoDoors, trashWithoutLiveSets(resolvedSets)).catch(() => {});
            }

            updateProcessingTask(taskId, { stage: 'Done!', progress: 100 });
            setTimeout(() => removeProcessingTask(taskId), 2000);

            const mergeNote = mergeStats
                ? ` · ${mergeStats.matchedDoorCount}/${rowCount} doors linked to hardware sets`
                : '';
            addToast({ type: 'success', message: `Imported ${rowCount} doors from schedule${mergeNote}.` });
            if (warnings.length > 0) { setUploadErrors(warnings); setIsErrorModalOpen(true); }
        } catch (err) {
            removeProcessingTask(taskId);
            addToast({ type: 'error', message: ERRORS.HARDWARE.DOOR_SCHEDULE_FAILED.message, details: ERRORS.HARDWARE.DOOR_SCHEDULE_FAILED.action });
        }
    };

    const handleDoorScheduleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        const [check, mergeCheck] = await Promise.all([
            fetch(`/api/projects/${projectId}/door-schedule`, { credentials: 'include' }),
            fetch(`/api/projects/${projectId}/hardware-merge`, { credentials: 'include' }),
        ]);
        const checkJson = check.ok ? await check.json() : null;
        const mergeJson = mergeCheck.ok ? await mergeCheck.json() : null;
        const hasSchedule = (checkJson?.data?.scheduleJson?.length ?? 0) > 0;
        const hasFinalDoors = ((mergeJson?.data?.finalJson ?? []) as Array<{ doors?: unknown[] }>)
            .some(s => Array.isArray(s.doors) && s.doors.length > 0);
        const hasExisting = hasSchedule || hasFinalDoors;

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

    // Like handleDoorScheduleUpload but accepts a File directly (used by single-file path from combined modal)
    const handleDoorScheduleFileDirect = async (file: File) => {
        const [check, mergeCheck] = await Promise.all([
            fetch(`/api/projects/${projectId}/door-schedule`, { credentials: 'include' }),
            fetch(`/api/projects/${projectId}/hardware-merge`, { credentials: 'include' }),
        ]);
        const checkJson = check.ok ? await check.json() : null;
        const mergeJson = mergeCheck.ok ? await mergeCheck.json() : null;
        const hasSchedule = (checkJson?.data?.scheduleJson?.length ?? 0) > 0;
        const hasFinalDoors = ((mergeJson?.data?.finalJson ?? []) as Array<{ doors?: unknown[] }>)
            .some(s => Array.isArray(s.doors) && s.doors.length > 0);

        if (hasSchedule || hasFinalDoors) {
            setDoorUploadFile(file);
            setIsDoorUploadModalOpen(true);
        } else {
            processDoorSchedule(file);
        }
    };

    const handleCombinedProcessClick = async () => {
        if (!combinedExcelFile && !combinedPdfFile) return;

        setIsCombinedOverwriteChecking(true);
        try {
            if (combinedExcelFile && combinedPdfFile) {
                // Both files — existing combined overwrite-check flow
                const mergeRes = await fetch(`/api/projects/${projectId}/hardware-merge`, { credentials: 'include' });
                const mergeJson = mergeRes.ok ? await mergeRes.json() : null;
                const hasExisting = (mergeJson?.data?.finalJson?.length ?? 0) > 0;
                if (hasExisting) {
                    setIsCombinedOverwriteOpen(true);
                } else {
                    processCombinedUpload(combinedExcelFile, combinedPdfFile);
                }
            } else if (combinedExcelFile) {
                // Single door-schedule file — close modal and process individually
                const file = combinedExcelFile;
                resetCombinedModal();
                await handleDoorScheduleFileDirect(file);
            } else if (combinedPdfFile) {
                // Single hardware PDF — close modal and process individually
                const file = combinedPdfFile;
                resetCombinedModal();
                await handleHardwareUploads([file]);
            }
        } finally {
            setIsCombinedOverwriteChecking(false);
        }
    };

    const handleConfirmCombinedOverwrite = () => {
        setIsCombinedOverwriteOpen(false);
        if (combinedExcelFile && combinedPdfFile) {
            processCombinedUpload(combinedExcelFile, combinedPdfFile);
        }
    };

    const processCombinedUpload = async (excelFile: File, pdfFile: File) => {
        setIsCombinedProcessing(true);
        setPipelineStep(0);
        setCombinedProgress(0);
        setCombinedLogs([]);
        logsRef.current = [];
        sessionStorage.setItem(`planckoff_proc_${projectId}`, Date.now().toString());
        cancelControllerRef.current = new AbortController();
        setWidget({
            isActive: true,
            isProcessing: true,
            progress: 0,
            step: '',
            elapsedSeconds: 0,
            projectId: projectId,
            projectPath: `/project/${projectId}`,
            logs: [],
        });

        const step = (msg: string, progress: number) => {
            setCombinedCurrentStep(msg);
            setCombinedProgress(progress);
            addLog('info', msg);
            setWidget({ step: msg, progress });
        };

        try {
            step(`Reading "${excelFile.name}" (${(excelFile.size / 1024).toFixed(0)} KB)…`, 5);
            await new Promise(r => setTimeout(r, 200));

            step(`Reading "${pdfFile.name}" (${(pdfFile.size / 1024).toFixed(0)} KB)…`, 10);
            await new Promise(r => setTimeout(r, 200));

            setPipelineStep(1);
            step('Uploading files to server…', 15);

            const form = new FormData();
            form.append('excel', excelFile);
            form.append('pdf', pdfFile);

            // Advance to the AI extraction step after a short delay — door schedule
            // parsing is fast (~1-2s), so this fires right as AI work begins.
            stepAdvanceTimerRef.current = setTimeout(() => {
                stepAdvanceTimerRef.current = null;
                setPipelineStep(2);
                const aiMsg = 'AI reading hardware PDF…';
                setCombinedCurrentStep(aiMsg);
                addLog('info', 'Door schedule parsed. Sending PDF to AI for hardware extraction…');
                setWidget({ step: aiMsg });
            }, 3000);

            // Honest 1-second heartbeat: progress crawls 0.4%/s (15→68% ceiling ≈ 132s max)
            // so the bar always moves and never freezes at an arbitrary stop point.
            let elapsedSeconds = 0;
            let crawlProgress = 15;
            progressTimerRef.current = setInterval(() => {
                elapsedSeconds++;
                crawlProgress = Math.min(crawlProgress + 0.4, 68);
                setCombinedProgress(Math.round(crawlProgress));
                setWidget({ progress: Math.round(crawlProgress) });
                setCombinedActiveDetail(`Working… ${elapsedSeconds}s`);
                if (elapsedSeconds === 15) addLog('info', 'AI scanning PDF layouts and table structures…');
                if (elapsedSeconds === 35) addLog('info', 'Identifying hardware sets and line items…');
                if (elapsedSeconds === 60) addLog('warn', 'Complex PDF — this can take up to 2 minutes…');
                if (elapsedSeconds === 90) addLog('warn', 'Almost there — finalising extraction…');
            }, 1000);

            const res = await fetch(`/api/projects/${projectId}/process`, {
                method: 'POST',
                credentials: 'include',
                body: form,
                signal: cancelControllerRef.current.signal,
            });

            if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
            if (stepAdvanceTimerRef.current) { clearTimeout(stepAdvanceTimerRef.current); stepAdvanceTimerRef.current = null; }
            setCombinedActiveDetail('');

            let json: {
                data?: {
                    setCount: number;
                    matchedDoorCount: number;
                    unmatchedDoorCount: number;
                    unmatchedDoorCodes: string[];
                    pdfSetsWithNoDoors: string[];
                    warnings: string[];
                    rowCount: number;
                    itemCount: number;
                    masterQueueWarning?: string | null;
                };
                error?: string;
            } | null = null;
            try {
                json = await res.json();
            } catch {
                throw new Error(ERRORS.HARDWARE.SERVER_ERROR.message);
            }

            if (!res.ok) throw new Error(json?.error ?? ERRORS.HARDWARE.SERVER_ERROR.message);

            const { setCount, matchedDoorCount, unmatchedDoorCount, unmatchedDoorCodes, pdfSetsWithNoDoors, rowCount, itemCount, warnings, masterQueueWarning } = json!.data!;

            addLog('success', `Door schedule: ${rowCount} door rows extracted from Excel.`);
            addLog('success', `Hardware PDF: ${setCount} sets, ${itemCount} items extracted by AI.`);
            if (masterQueueWarning) {
                addLog('warn', `Database queue: ${masterQueueWarning}`);
            }

            setPipelineStep(3);
            step('Matching doors to hardware sets…', 80);
            await new Promise(r => setTimeout(r, 150));

            addLog('success', `${matchedDoorCount} doors matched to hardware sets.`);
            if (unmatchedDoorCount > 0) {
                addLog('warn', `${unmatchedDoorCount} doors unmatched: ${unmatchedDoorCodes.slice(0, 5).join(', ')}${unmatchedDoorCodes.length > 5 ? '…' : ''}`);
            }
            if (pdfSetsWithNoDoors.length > 0) {
                addLog('warn', `${pdfSetsWithNoDoors.length} PDF set(s) have no matching doors.`);
            }
            warnings.forEach(w => addLog('warn', w));

            setPipelineStep(4);
            step('Saving final data to database…', 88);
            await new Promise(r => setTimeout(r, 150));
            addLog('success', 'Final JSON saved to database.');

            setPipelineStep(5);
            step('Populating project view…', 94);

            // Load the already-merged and dimension-resolved final_json from the server.
            // The server's merge step runs resolveAllMergedSets which handles all edge cases
            // (e.g. compound widths like "(3'-0\"+ 1'-8\")"). Loading from final_json avoids
            // a client-side re-resolution that would overwrite the server's correct values.
            const mergeFresh = await fetch(`/api/projects/${projectId}/hardware-merge`, { credentials: 'include' });
            const mergeFreshJson = mergeFresh.ok ? await mergeFresh.json() : null;
            const finalRaw = Array.isArray(mergeFreshJson?.data?.finalJson) && mergeFreshJson.data.finalJson.length > 0
                ? mergeFreshJson.data.finalJson : null;

            let resolvedSets: HardwareSet[];
            let autoDoors: Door[];
            let variantsCreated = 0;

            if (finalRaw) {
                const finalData = transformFromFinalJson(finalRaw);
                const filteredSets = finalData.hardwareSets.filter(s => s.name !== '__unassigned__');
                const autoResult = autoCreateVariants(filteredSets, finalData.doors);
                resolvedSets = autoResult.sets;
                autoDoors = autoResult.doors;
                variantsCreated = autoResult.variantsCreated;
            } else {
                // Fallback: re-build from raw extracted data if final_json isn't available yet
                const [hwFresh, dsFresh] = await Promise.all([
                    fetch(`/api/projects/${projectId}/hardware-pdf`, { credentials: 'include' }),
                    fetch(`/api/projects/${projectId}/door-schedule`, { credentials: 'include' }),
                ]);
                const hwFreshJson = hwFresh.ok ? await hwFresh.json() : null;
                const dsFreshJson = dsFresh.ok ? await dsFresh.json() : null;
                const freshSets = hwFreshJson?.data?.extractedJson
                    ? transformHardwareSets(hwFreshJson.data.extractedJson) : [];
                const freshDoors = dsFreshJson?.data?.scheduleJson
                    ? transformDoors(dsFreshJson.data.scheduleJson, freshSets) : [];
                const autoResult = autoCreateVariants(freshSets, freshDoors);
                resolvedSets = resolveAllSets(autoResult.sets, autoResult.doors);
                autoDoors = autoResult.doors;
                variantsCreated = autoResult.variantsCreated;
            }

            // Mark final_json as the source of truth BEFORE updating state.
            // This prevents the Supabase realtime handler (reloadDoorSchedule) from
            // overwriting variant door assignments with base-set assignments when it
            // fires in response to the door_schedule_imports write above.
            hasFinalJsonRef.current = true;

            if (resolvedSets.length > 0) { setHardwareSets(resolvedSets); isInitialMount.current = true; }
            if (autoDoors.length > 0) { setDoors(autoDoors); isInitialMount.current = true; }
            await saveToFinalJson(resolvedSets, autoDoors, trashWithoutLiveSets(resolvedSets));

            setPipelineStep(6);
            setCombinedProgress(100);
            setCombinedCurrentStep('Complete');
            const variantNote = variantsCreated > 0 ? ` ${variantsCreated} auto-variant${variantsCreated !== 1 ? 's' : ''} created.` : '';
            addLog('success', `Done! ${autoDoors.length} doors loaded — ${matchedDoorCount} linked to sets, ${unmatchedDoorCount} unmatched.${variantNote}`);

            addToast({
                type: 'success',
                message: `Processed ${rowCount} doors and ${setCount} sets. ${matchedDoorCount} doors linked.`,
            });

        } catch (err) {
            if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
            if (err instanceof Error && err.name === 'AbortError') {
                // User cancelled — reset to a fresh state so they can re-upload
                logsRef.current = [];
                setCombinedLogs([]);
                setCombinedProgress(0);
                setCombinedCurrentStep('');
                setPipelineStep(-1);
                setCombinedExcelFile(null);
                setCombinedPdfFile(null);
            } else {
                const msg = err instanceof Error ? err.message : 'Unknown error';
                addLog('error', `Failed: ${msg}`);
                setCombinedCurrentStep('Failed');
                setCombinedProgress(0);
                addToast({ type: 'error', message: ERRORS.HARDWARE.PROCESSING_FAILED.message, details: ERRORS.HARDWARE.PROCESSING_FAILED.action });
            }
        } finally {
            if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
            if (stepAdvanceTimerRef.current) { clearTimeout(stepAdvanceTimerRef.current); stepAdvanceTimerRef.current = null; }
            setCombinedActiveDetail('');
            setIsCombinedProcessing(false);
            cancelControllerRef.current = null;
            sessionStorage.removeItem(`planckoff_proc_${projectId}`);
            clearWidget();
        }
    };

    const handleCancelProcessing = useCallback(() => {
        if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
        cancelControllerRef.current?.abort();
    }, []);

    const handleSaveSet = (set: HardwareSet) => {
        const index = hardwareSets.findIndex(s => s.id === set.id);
        if (index > -1) {
            setHardwareSets(current => current.map(s => s.id === set.id ? set : s));
        } else {
            const newSet = { ...set, id: `hs-manual-${Date.now()}` };
            setHardwareSets(current => [...current, newSet]);
        }
    };

    const handleAssignAll = async (): Promise<void> => {
        const mergeStats = await runHardwareMerge();
        if (!mergeStats) {
            addToast({ type: 'error', message: ERRORS.HARDWARE.ASSIGNMENT_FAILED.message, details: ERRORS.HARDWARE.ASSIGNMENT_FAILED.action });
            return;
        }

        const [hwRes, dsRes] = await Promise.all([
            fetch(`/api/projects/${projectId}/hardware-pdf`, { credentials: 'include' }),
            fetch(`/api/projects/${projectId}/door-schedule`, { credentials: 'include' }),
        ]);
        const hwJson = hwRes.ok ? await hwRes.json() : null;
        const dsJson = dsRes.ok ? await dsRes.json() : null;

        const freshSets: HardwareSet[] = hwJson?.data?.extractedJson
            ? transformHardwareSets(hwJson.data.extractedJson)
            : hardwareSets;
        const freshDoors = dsJson?.data?.scheduleJson
            ? transformDoors(dsJson.data.scheduleJson, freshSets)
            : doors;

        const resolvedAssignSets = resolveAllSets(freshSets, freshDoors);
        setHardwareSets(resolvedAssignSets);
        setDoors(freshDoors);
        isInitialMount.current = true;
        saveToFinalJson(resolvedAssignSets, freshDoors, trashWithoutLiveSets(resolvedAssignSets)).catch(() => {});

        const matched = mergeStats.matchedDoorCount;
        const unmatched = mergeStats.unmatchedDoorCount;
        addToast({
            type: 'success',
            message: `Assigned ${matched} door${matched !== 1 ? 's' : ''} to hardware sets.${unmatched > 0 ? ` ${unmatched} door${unmatched !== 1 ? 's' : ''} could not be matched.` : ''}`,
        });
    };

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

        // Re-run resolver for any set whose door assignments just changed.
        const resolvedReassignSets = resolveAllSets(updatedHardwareSets, updatedDoors);
        setHardwareSets(resolvedReassignSets);
        setDoors(updatedDoors);
    };

    return {
        processingTasks,
        setProcessingTasks,
        hardwareUploadFiles,
        isHardwareUploadModalOpen,
        setIsHardwareUploadModalOpen,
        setHardwareUploadFiles,
        doorUploadFile,
        isDoorUploadModalOpen,
        setIsDoorUploadModalOpen,
        setDoorUploadFile,
        isCombinedUploadOpen,
        isCombinedMinimized,
        setIsCombinedUploadOpen,
        setIsCombinedMinimized,
        combinedExcelFile,
        combinedPdfFile,
        setCombinedExcelFile,
        setCombinedPdfFile,
        isCombinedProcessing,
        combinedProgress,
        combinedCurrentStep,
        combinedActiveDetail,
        combinedLogs,
        pipelineStep,
        logsEndRef,
        isCombinedOverwriteOpen,
        setIsCombinedOverwriteOpen,
        isCombinedOverwriteChecking,
        uploadErrors,
        isErrorModalOpen,
        setIsErrorModalOpen,
        validationReport,
        isValidationModalOpen,
        setIsValidationModalOpen,
        validationReportTitle,
        resetCombinedModal,
        handleMinimizeCombinedModal,
        handleCancelProcessing,
        handleHardwareUploads,
        handleConfirmHardwareUpload,
        handleDoorScheduleUpload,
        handleConfirmDoorUpload,
        handleCombinedProcessClick,
        handleConfirmCombinedOverwrite,
        handleSaveSet,
        handleAssignAll,
        handleProvidedSetChange,
    };
}
