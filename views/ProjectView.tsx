'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { HardwareSet, Door, Project, AppSettings, Toast, ElevationType, ValidationReport } from '../types';
import HardwareSetsManager from '../components/HardwareSetsManager';
import DoorScheduleManager from '../components/DoorScheduleManager';
import { generateReport } from '../utils/reportGenerator';
// process... imports removed from direct use, but types might be needed
import { ArrowLeft, BarChart2, Check, Loader2, AlertCircle, Columns2, PanelLeft, PanelRight, Upload, X, Minus, CheckCircle2, FileSpreadsheet, FileText, GitMerge, Trash2, NotebookPen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ElevationManager from '../components/ElevationManager';
import { captureTrainingExample } from '../services/mlOpsService';
import { transformHardwareSets, transformDoors, transformFromFinalJson } from '../utils/hardwareTransformers';
import type { MergedHardwareSet, MergedDoor, TrashItem } from '@/lib/db/hardware';
import UndoToast, { type UndoToastItem } from '../components/UndoToast';
import HardwareTrashModal from '../components/HardwareTrashModal';
import UploadConfirmationModal from '../components/UploadConfirmationModal';
import { type ProcessingTask } from '../components/ProcessingIndicator';
import ErrorModal from '../components/ErrorModal';
import ValidationReportModal from '../components/ValidationReportModal';
import ResizablePanels from '../components/ResizablePanels';
import { useBackgroundUpload, UploadTask } from '../contexts/BackgroundUploadContext';
import { type ProcessingLogEntry, useProcessingWidget } from '@/contexts/ProcessingWidgetContext';
import { useNavigationLoading } from '@/contexts/NavigationLoadingContext';
import { ProjectNotesPanel } from '../components/ProjectNotesPanel';
import { useProjectRealtime } from '../hooks/useProjectRealtime';


type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const parseLeafCount = (value?: string): number | undefined => {
    if (!value) return undefined;
    const raw = value.trim();
    if (!raw) return undefined;

    const numeric = parseInt(raw, 10);
    if (!isNaN(numeric)) return numeric;

    const normalized = raw.toLowerCase();
    if (['single', 'singles', 'single leaf', '1 leaf'].includes(normalized)) return 1;
    if (['double', 'pair', 'double leaf', '2 leaf', '2 leaves'].includes(normalized)) return 2;

    return undefined;
};

const parseDoorQuantity = (value?: string | number): number => {
    if (typeof value === 'number') return Number.isNaN(value) ? 1 : value;
    if (!value) return 1;

    const parsed = parseFloat(String(value).trim());
    return Number.isNaN(parsed) ? 1 : parsed;
};

const SaveStatusIndicator: React.FC<{ status: SaveStatus; onRetry: () => void }> = ({ status, onRetry }) => {
    switch (status) {
        case 'saving':
            return (
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving…
                </div>
            );
        case 'saved':
            return (
                <div className="flex items-center gap-1.5 text-xs text-green-600">
                    <Check className="h-3.5 w-3.5" />
                    Saved
                </div>
            );
        case 'error':
            return (
                <div className="flex items-center gap-1.5 text-xs text-red-600">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Save failed
                    <button onClick={onRetry} className="underline hover:text-red-800 ml-1">Retry</button>
                </div>
            );
        default:
            return <div className="h-5" />;
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
    const { startNavigation } = useNavigationLoading();
    const [hardwareSets, setHardwareSets] = useState<HardwareSet[]>(project.hardwareSets || []);
    const [doors, setDoors] = useState<Door[]>(project.doors || []);
    // Refs keep the latest sets/trash available inside callbacks without
    // causing them to be recreated on every render.
    const hardwareSetsRef = useRef<HardwareSet[]>(hardwareSets);
    const trashItemsRef = useRef<TrashItem[]>([]);
    const doorsRef = useRef<Door[]>(doors);
    const [viewMode, setViewMode] = useState<'split' | 'hardware' | 'doors'>('split');
    const [isDataLoading, setIsDataLoading] = useState(true);

    // Background Upload Context (used for progress widget display only)
    const { tasks } = useBackgroundUpload();
    const { widget, setWidget, clearWidget, registerExpandHandler, unregisterExpandHandler } = useProcessingWidget();
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
    const [isElevationManagerOpen, setIsElevationManagerOpen] = useState(false);
    const isInitialMount = useRef(true);

    // Trash state — deleted sets/doors held here; persisted to trash_json in DB
    const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
    const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
    const [isNotesOpen, setIsNotesOpen] = useState(false);

    // Undo toast queue — each pending delete gets an entry with a 6s countdown
    const [undoToasts, setUndoToasts] = useState<UndoToastItem[]>([]);
    // Block auto-save while any undo toast is still live
    const hasPendingUndoRef = useRef(false);

    // Validation Report State
    const [validationReport, setValidationReport] = useState<ValidationReport<any> | null>(null);
    const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
    const [validationReportTitle, setValidationReportTitle] = useState('');

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

    const doorScheduleInputRef = useRef<HTMLInputElement>(null);

    // Polling state — used when user navigates away mid-processing and comes back
    const [isPollingForResult, setIsPollingForResult] = useState(false);
    const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Reactive report generation
    const report = useMemo(() => generateReport(doors), [doors]);

    useEffect(() => {
        setSaveStatus('idle');
        isInitialMount.current = true;
        // State reset (hardwareSets / doors) is handled at the top of loadProjectData
        // using functional updates that bail out when already empty — doing it here
        // creates a second render where isInitialMount is already false, causing the
        // auto-save effect to fire with empty state and overwrite final_json in the DB.
    }, [project.id]);

    // Poll both raw tables after the user navigated away mid-processing and returns.
    // Resolves as soon as both hardware PDF and door schedule data are available.
    const startPollingForResult = useCallback(() => {
        const key = `planckoff_proc_${project.id}`;
        setIsPollingForResult(true);
        setIsDataLoading(true);

        const poll = async () => {
            const ts = sessionStorage.getItem(key);
            if (!ts || Date.now() - Number(ts) > 5 * 60 * 1000) {
                sessionStorage.removeItem(key);
                if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                setIsPollingForResult(false);
                setIsDataLoading(false);
                addToast({ type: 'error', message: 'File processing timed out. Please try uploading again.' });
                return;
            }
            try {
                const [hwRes, dsRes] = await Promise.all([
                    fetch(`/api/projects/${project.id}/hardware-pdf`, { credentials: 'include' }),
                    fetch(`/api/projects/${project.id}/door-schedule`, { credentials: 'include' }),
                ]);
                if (hwRes.ok && dsRes.ok) {
                    const hwJson = await hwRes.json() as { data?: { extractedJson?: unknown[] } };
                    const dsJson = await dsRes.json() as { data?: { scheduleJson?: unknown[] } };
                    if (hwJson.data?.extractedJson?.length && dsJson.data?.scheduleJson?.length) {
                        sessionStorage.removeItem(key);
                        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                        const hs = transformHardwareSets(hwJson.data.extractedJson as Parameters<typeof transformHardwareSets>[0]);
                        const ds = transformDoors(dsJson.data.scheduleJson as Parameters<typeof transformDoors>[0], hs);
                        if (hs.length > 0) { setHardwareSets(hs); isInitialMount.current = true; }
                        if (ds.length > 0) { setDoors(ds); isInitialMount.current = true; }
                        setIsPollingForResult(false);
                        setIsDataLoading(false);
                        clearWidget();
                        addToast({ type: 'success', message: 'File processing completed! Your project data is ready.' });
                    }
                }
            } catch {
                // network hiccup — keep polling
            }
        };

        poll();
        pollingIntervalRef.current = setInterval(poll, 3000);
    }, [project.id, addToast]); // eslint-disable-line react-hooks/exhaustive-deps

    // Fetch stored hardware PDF + door schedule from their raw tables.
    // Doors come from the Excel import (ALL doors, matched + unmatched).
    // Hardware sets come from the PDF extraction.
    // Final JSON is only used for trashJson and reports — never as the display source.
    useEffect(() => {
        let cancelled = false;

        async function loadProjectData() {
            try {
                const processingKey = `planckoff_proc_${project.id}`;

                // Clear state from a previous project before fetching new data.
                // Functional updates bail out (return same ref) when already empty,
                // so on a page refresh this causes zero re-renders and zero auto-saves.
                // On navigation A → B they do reset, but isInitialMount is true so the
                // auto-save effect skips that render.
                setHardwareSets(prev => prev.length > 0 ? [] : prev);
                setDoors(prev => prev.length > 0 ? [] : prev);
                isInitialMount.current = true;

                // If a combined upload is in-flight, wait for it instead of showing partial data.
                if (sessionStorage.getItem(processingKey)) {
                    if (!cancelled) startPollingForResult();
                    return;
                }

                // Fetch hardware sets (PDF), door schedule (Excel), and trash in parallel.
                const [hwRes, dsRes, mergeRes] = await Promise.all([
                    fetch(`/api/projects/${project.id}/hardware-pdf`, { credentials: 'include' }),
                    fetch(`/api/projects/${project.id}/door-schedule`, { credentials: 'include' }),
                    fetch(`/api/projects/${project.id}/hardware-merge`, { credentials: 'include' }),
                ]);

                if (cancelled) return;

                const hwJson = hwRes.ok ? await hwRes.json() : null;
                const dsJson = dsRes.ok ? await dsRes.json() : null;
                const mergeJson = mergeRes.ok ? await mergeRes.json() : null;

                // Restore trash items from final JSON metadata
                if (Array.isArray(mergeJson?.data?.trashJson)) {
                    setTrashItems(mergeJson.data.trashJson);
                }

                // PDF extraction sets — source of truth for items/hardware data.
                const pdfSets = hwJson?.data?.extractedJson
                    ? transformHardwareSets(hwJson.data.extractedJson)
                    : [];

                // Final JSON sets — authoritative for variants and manually-created sets.
                // transformFromFinalJson also restores the correct door→set assignments.
                const finalRaw = Array.isArray(mergeJson?.data?.finalJson) && mergeJson.data.finalJson.length > 0
                    ? mergeJson.data.finalJson as Parameters<typeof transformFromFinalJson>[0]
                    : null;
                const finalData = finalRaw ? transformFromFinalJson(finalRaw) : null;

                // Merge: use finalJson's set order as authoritative (it captures variant
                // positions). For each set, prefer the PDF version so item data stays
                // fresh; fall back to the finalJson version for variants/manual sets that
                // don't exist in the PDF extraction. Any brand-new PDF sets not yet in
                // finalJson are appended at the end.
                let sets: typeof pdfSets;
                if (finalData && finalData.hardwareSets.length > 0) {
                    const pdfSetsByName = new Map(pdfSets.map(s => [s.name.toLowerCase(), s]));
                    const setsFromFinal = finalData.hardwareSets
                    // '__unassigned__' is a sentinel used to persist orphan manual doors —
                    // it must never appear as a real hardware set in the UI.
                    .filter(s => s.name !== '__unassigned__')
                    .map(s => {
                        const pdfVersion = pdfSetsByName.get(s.name.toLowerCase());
                        if (pdfVersion) {
                            // Use fresh PDF item data but preserve all user-edited fields from
                            // the final JSON (prep, description/notes, doorTags, isManualEntry).
                            // These fields are set by the user via the Edit modal and must survive
                            // a refresh — the PDF extraction never has these edits.
                            return {
                                ...pdfVersion,
                                isManualEntry: s.isManualEntry,
                                prep: s.prep ?? pdfVersion.prep,
                                description: s.description || pdfVersion.description,
                                doorTags: s.doorTags ?? pdfVersion.doorTags,
                            };
                        }
                        return s;
                    });
                    const finalSetNames = new Set(finalData.hardwareSets.map(s => s.name.toLowerCase()));

                    // Exclude sets that the user has deleted — they live in trashJson but are
                    // absent from finalJson, so without this check they'd be re-added on every
                    // reload because hardware_pdf_extractions is never mutated on delete.
                    const trashedSetNames = new Set<string>(
                        (mergeJson?.data?.trashJson ?? [])
                            .filter((t: TrashItem) => t.type === 'set')
                            .map((t: TrashItem) => t.setName?.toLowerCase())
                            .filter(Boolean) as string[],
                    );

                    const newPdfOnlySets = pdfSets.filter(s =>
                        !finalSetNames.has(s.name.toLowerCase()) &&
                        !trashedSetNames.has(s.name.toLowerCase()),
                    );
                    const merged = [...setsFromFinal, ...newPdfOnlySets];
                    // Deduplicate by ID — guards against corrupted finalJson that
                    // may contain the same set twice (caused by the now-fixed stale
                    // closure bug writing deleted sets back to finalJson).
                    const seenIds = new Set<string>();
                    sets = merged.filter(s => {
                        if (seenIds.has(s.id)) return false;
                        seenIds.add(s.id);
                        return true;
                    });
                } else {
                    sets = pdfSets;
                }

                // Build a set of door tags that have been moved to trash so they are
                // excluded after a refresh (door_schedule_imports is never mutated on delete).
                const trashedDoorTags = new Set<string>(
                    (mergeJson?.data?.trashJson ?? [])
                        .filter((t: TrashItem) => t.type === 'door')
                        .map((t: TrashItem) => t.doorData?.doorTag)
                        .filter(Boolean) as string[],
                );

                // Raw doors from the Excel schedule (full section data, original assignments).
                const rawDoors = dsJson?.data?.scheduleJson
                    ? transformDoors(dsJson.data.scheduleJson, sets).filter(
                          d => !trashedDoorTags.has(d.doorTag),
                      )
                    : [];

                // Restore door→set assignments saved in finalJson (variants, AI merges).
                // The raw schedule always has the original Excel hwSet name — finalJson has
                // the authoritative assigned set (e.g. the variant set).
                // Also append manually-created doors that exist only in finalJson (never in Sheet JSON).
                let loadedDoors: typeof rawDoors;
                if (finalData && finalData.doors.length > 0) {
                    const setsById = new Map(sets.map(s => [s.id, s]));
                    const finalDoorMap = new Map(finalData.doors.map(d => [d.doorTag, d]));

                    // Overlay Final JSON data onto Sheet JSON doors.
                    // Final JSON wins for ALL fields — it is the user's last saved state and
                    // captures modal edits, AI assignments, and variant links.
                    // Sheet JSON is only the base; its sections are kept as a fallback in case
                    // Final JSON sections are absent (old entries before sections were persisted).
                    loadedDoors = rawDoors.map(raw => {
                        const fromFinal = finalDoorMap.get(raw.doorTag);
                        if (!fromFinal) return raw;
                        return {
                            ...raw,
                            ...fromFinal,
                            // Re-resolve set reference so PDF item data stays fresh.
                            assignedHardwareSet: fromFinal.assignedHardwareSet
                                ? (setsById.get(fromFinal.assignedHardwareSet.id) ?? fromFinal.assignedHardwareSet)
                                : raw.assignedHardwareSet,
                            // Prefer Sheet JSON sections as they carry the full raw Excel column
                            // data; Final JSON sections are only a fallback for manual-entry doors.
                            sections: raw.sections ?? fromFinal.sections,
                        };
                    });

                    // Append manually-added doors: they live only in Final JSON, not in Sheet JSON.
                    // Doors stored under '__unassigned__' sentinel have no real set — clear that ref.
                    const rawDoorTags = new Set(rawDoors.map(d => d.doorTag));
                    const manualDoors = finalData.doors
                        .filter(d => !rawDoorTags.has(d.doorTag) && !trashedDoorTags.has(d.doorTag))
                        .map(d => ({
                            ...d,
                            assignedHardwareSet:
                                d.assignedHardwareSet && d.assignedHardwareSet.name !== '__unassigned__'
                                    ? (setsById.get(d.assignedHardwareSet.id) ?? d.assignedHardwareSet)
                                    : undefined,
                        }));

                    loadedDoors = [...loadedDoors, ...manualDoors];
                } else {
                    loadedDoors = rawDoors;
                }

                if (cancelled) return;

                if (sets.length > 0) {
                    setHardwareSets(sets);
                    isInitialMount.current = true;
                }
                if (loadedDoors.length > 0) {
                    setDoors(loadedDoors);
                    isInitialMount.current = true;
                }

                // Only initialise finalJson when it doesn't exist yet (first upload)
                // AND there are hardware sets to write — an empty sets array would save []
                // which is indistinguishable from "never initialised", creating a permanent
                // loop that overwrites manual-door saves on every refresh.
                const hasFinalJson = Boolean(finalRaw);
                if (!hasFinalJson && sets.length > 0 && !cancelled) {
                    saveToFinalJson(sets, loadedDoors).catch(() => {});
                }
            } catch {
                // Non-critical — UI just shows empty state
            } finally {
                if (!cancelled && !sessionStorage.getItem(`planckoff_proc_${project.id}`)) {
                    setIsDataLoading(false);
                }
            }
        }

        loadProjectData();
        return () => {
            cancelled = true;
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        };
    }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Keep refs in sync so realtime callbacks never have a stale closure.
    useEffect(() => { hardwareSetsRef.current = hardwareSets; }, [hardwareSets]);
    useEffect(() => { trashItemsRef.current = trashItems; }, [trashItems]);
    useEffect(() => { doorsRef.current = doors; }, [doors]);

    // Reload only the door schedule from the DB and re-transform.
    // Called by the Supabase Realtime subscription whenever door_schedule_imports changes.
    const reloadDoorSchedule = useCallback(async () => {
        try {
            const res = await fetch(`/api/projects/${project.id}/door-schedule`, { credentials: 'include' });
            if (!res.ok) return;
            const json = await res.json() as { data?: { scheduleJson?: unknown[] } };
            if (!json?.data?.scheduleJson?.length) return;

            const trashedDoorTags = new Set<string>(
                trashItemsRef.current
                    .filter(t => t.type === 'door')
                    .map(t => t.doorData?.doorTag)
                    .filter(Boolean) as string[],
            );

            const fromSheet = transformDoors(
                json.data.scheduleJson as Parameters<typeof transformDoors>[0],
                hardwareSetsRef.current,
            ).filter(d => !trashedDoorTags.has(d.doorTag));

            // Re-apply in-memory state so all modal edits, variant links, and assignments
            // survive the Realtime reload triggered by a door schedule PATCH.
            // In-memory (doorsRef) is the user's last saved state; sheet data is the base.
            const currentDoorMap = new Map(doorsRef.current.map(d => [d.doorTag, d]));
            const overlaid = fromSheet.map(d => {
                const current = currentDoorMap.get(d.doorTag);
                if (!current) return d;
                return {
                    ...d,
                    ...current,
                    // Keep fresh sheet sections as the authoritative raw column data.
                    sections: d.sections ?? current.sections,
                };
            });

            // Re-append manually-added doors (not from sheet, not in trash).
            const sheetTags = new Set(fromSheet.map(d => d.doorTag));
            const manualDoors = doorsRef.current.filter(
                d => !sheetTags.has(d.doorTag) && !trashedDoorTags.has(d.doorTag),
            );

            setDoors([...overlaid, ...manualDoors]);
        } catch {
            // Non-critical — stale data is better than a crash
        }
    }, [project.id]);

    // Subscribe to Supabase Realtime so door edits appear instantly without a reload.
    useProjectRealtime({ projectId: project.id, onDoorScheduleChange: reloadDoorSchedule });

    // Convert current UI state back to MergedHardwareSet[] and PUT to final JSON
    const saveToFinalJson = useCallback(async (currentSets: HardwareSet[], currentDoors: Door[], currentTrash?: TrashItem[]): Promise<void> => {
        try {
            const finalJson: MergedHardwareSet[] = currentSets.map((set): MergedHardwareSet => {
                const matchedDoors = currentDoors.filter((d) => {
                    // If the door has been explicitly assigned (via AI merge or variant creation),
                    // use ID match only — name-based fallback would re-attach it to the original
                    // Excel set after a reload (sections.hardware['HARDWARE SET'] never changes).
                    if (d.assignedHardwareSet) {
                        return d.assignedHardwareSet.id === set.id;
                    }
                    // Unassigned doors (imported from Excel but not yet merged): match by name.
                    return d.providedHardwareSet?.toLowerCase() === set.name.toLowerCase();
                });

                const mergedDoors: MergedDoor[] = matchedDoors.map((d): MergedDoor => ({
                    doorTag: d.doorTag,
                    hwSet: d.providedHardwareSet ?? '',
                    matchedSetName: set.name,
                    isManualEntry: d.isManualEntry === true,
                    buildingArea: undefined,
                    doorLocation: d.location,
                    interiorExterior: d.interiorExterior,
                    quantity: d.quantity,
                    fireRating: d.fireRating,
                    leafCount: d.leafCountDisplay ?? (d.leafCount !== undefined ? String(d.leafCount) : undefined),
                    doorType: d.type,
                    doorElevationType: d.elevationTypeId,
                    doorWidth: d.width ? `${Math.floor(d.width / 12)}'-${d.width % 12}"` : undefined,
                    doorHeight: d.height ? `${Math.floor(d.height / 12)}'-${d.height % 12}"` : undefined,
                    thickness: d.thickness ? String(d.thickness) : undefined,
                    doorMaterial: d.doorMaterial,
                    frameMaterial: d.frameMaterial as string | undefined,
                    hardwarePrep: d.hardwarePrep,
                    excludeReason: d.excludeReason,
                    // sections may carry raw Excel column name keys — cast through unknown
                    sections: d.sections as unknown as MergedDoor['sections'],
                }));

                const doorCount = mergedDoors.reduce((sum, d) => {
                    const qty = parseInt(d.sections?.door?.['QUANTITY'] ?? String(d.quantity ?? 1)) || 1;
                    return sum + qty;
                }, 0);
                return {
                    setName: set.name,
                    isManualEntry: set.isManualEntry === true,
                    hardwareItems: set.items.map((item) => ({
                        qty: item.quantity,
                        item: item.name,
                        manufacturer: item.manufacturer ?? '',
                        description: item.description ?? '',
                        finish: item.finish ?? '',
                        multipliedQuantity: item.quantity * doorCount,
                    })),
                    notes: set.description ?? '',
                    doors: mergedDoors,
                    prep: set.prep,
                };
            });

            // Collect manual doors not matched to any hardware set — they would otherwise
            // be lost on refresh because saveToFinalJson only serializes matched doors.
            // Save them under a sentinel entry so transformFromFinalJson includes them in
            // its flat doors list, which loadProjectData then appends as manualDoors.
            const serializedDoorTags = new Set(finalJson.flatMap(s => s.doors.map(d => d.doorTag)));
            const orphanManualDoors = currentDoors.filter(
                d => d.isManualEntry === true && !serializedDoorTags.has(d.doorTag),
            );
            if (orphanManualDoors.length > 0) {
                finalJson.push({
                    setName: '__unassigned__',
                    isManualEntry: true,
                    hardwareItems: [],
                    notes: '',
                    doors: orphanManualDoors.map((d): MergedDoor => ({
                        doorTag: d.doorTag,
                        hwSet: d.providedHardwareSet ?? '',
                        matchedSetName: '',
                        isManualEntry: true,
                        buildingArea: undefined,
                        doorLocation: d.location,
                        interiorExterior: d.interiorExterior,
                        quantity: d.quantity,
                        fireRating: d.fireRating,
                        leafCount: d.leafCountDisplay ?? (d.leafCount !== undefined ? String(d.leafCount) : undefined),
                        doorType: d.type,
                        doorElevationType: d.elevationTypeId,
                        doorWidth: d.width ? `${Math.floor(d.width / 12)}'-${d.width % 12}"` : undefined,
                        doorHeight: d.height ? `${Math.floor(d.height / 12)}'-${d.height % 12}"` : undefined,
                        thickness: d.thickness ? String(d.thickness) : undefined,
                        doorMaterial: d.doorMaterial,
                        frameMaterial: d.frameMaterial as string | undefined,
                        hardwarePrep: d.hardwarePrep,
                        excludeReason: d.excludeReason,
                        sections: d.sections as unknown as MergedDoor['sections'],
                    })),
                });
            }

            await fetch(`/api/projects/${project.id}/hardware-merge`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ finalJson, trashJson: currentTrash }),
            });
        } catch (err) {
            console.warn('[saveToFinalJson] Failed to persist final JSON:', err);
        }
    }, [project.id]);

    // Sync the hardware-pdf extraction table with the current set list.
    // Called whenever a variant or manual set is added so that the PDF extraction
    // is always the superset — on reload pdfSets will include all sets and the
    // finalJson-order logic can sort them correctly.
    const saveToHardwarePdf = useCallback(async (currentSets: HardwareSet[]): Promise<void> => {
        try {
            const extractedJson = currentSets.map(set => ({
                setName: set.name,
                isManualEntry: set.isManualEntry === true,
                hardwareItems: set.items.map(item => ({
                    qty: item.quantity,
                    item: item.name,
                    manufacturer: item.manufacturer ?? '',
                    description: item.description ?? '',
                    finish: item.finish ?? '',
                    multipliedQuantity: item.multipliedQuantity,
                })),
                notes: set.description ?? '',
                prep: set.prep,
            }));
            await fetch(`/api/projects/${project.id}/hardware-pdf`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ extractedJson }),
            });
        } catch (err) {
            console.warn('[saveToHardwarePdf] Failed to persist hardware PDF extraction:', err);
        }
    }, [project.id]);

    const performSave = useCallback(() => {
        // Don't save while an undo toast is live — the data is still in flux
        if (hasPendingUndoRef.current) return;

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

            // Persist edits back to the final JSON (fire-and-forget)
            saveToFinalJson(hardwareSets, doors, trashItems).catch(() => {/* already logged inside */});

            setSaveStatus('saved');
            setTimeout(() => {
                setSaveStatus(currentStatus => currentStatus === 'saved' ? 'idle' : currentStatus);
            }, 2000);
        } catch (e) {
            console.error("Auto-save failed:", e);
            setSaveStatus('error');
        }
    }, [project, hardwareSets, doors, trashItems, onProjectUpdate, saveToFinalJson]);

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
    }, [hardwareSets, doors, trashItems]);

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

    // Combined upload (Excel + PDF together)
    const [isCombinedUploadOpen, setIsCombinedUploadOpen] = useState(false);
    const [isCombinedMinimized, setIsCombinedMinimized] = useState(false);
    const [combinedExcelFile, setCombinedExcelFile] = useState<File | null>(null);
    const [combinedPdfFile, setCombinedPdfFile] = useState<File | null>(null);
    const [isCombinedProcessing, setIsCombinedProcessing] = useState(false);
    const [combinedProgress, setCombinedProgress] = useState(0);
    const [combinedCurrentStep, setCombinedCurrentStep] = useState('');
    const [combinedLogs, setCombinedLogs] = useState<{ level: 'info' | 'success' | 'warn' | 'error'; msg: string }[]>([]);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const logsRef = useRef<ProcessingLogEntry[]>([]);
    const [isCombinedOverwriteOpen, setIsCombinedOverwriteOpen] = useState(false);
    const [isCombinedOverwriteChecking, setIsCombinedOverwriteChecking] = useState(false);

    const resetCombinedModal = () => {
        logsRef.current = [];
        setIsCombinedUploadOpen(false);
        setCombinedExcelFile(null);
        setCombinedPdfFile(null);
        setCombinedLogs([]);
        setCombinedProgress(0);
        setCombinedCurrentStep('');
        clearWidget();
    };

    const formatElapsed = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return m > 0 ? `${m}m ${sec.toString().padStart(2, '0')}s` : `${sec}s`;
    };

    // Register expand handler so AppShell's global pill can re-open the modal on this page.
    // When navigating back mid-processing, don't auto-reopen the modal — let loadProjectData
    // handle the loading/polling state. The user can click the global pill to expand manually.
    useEffect(() => {
        registerExpandHandler(() => {
            setIsCombinedUploadOpen(true);
            setIsCombinedMinimized(false);
            setWidget({ isMinimized: false });
        });
        return () => unregisterExpandHandler();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

            const json = await res.json() as { data?: { setCount: number; itemCount: number; durationMs: number; tier: number; warnings: string[]; masterQueued: number; masterSkipped: number; masterQueueWarning?: string | null }; error?: string };
            if (!res.ok) throw new Error(json.error ?? 'Upload failed.');

            updateProcessingTask(taskId, { stage: 'Saving to database…', progress: 85 });

            const { setCount, itemCount, tier, warnings, masterQueued, masterQueueWarning } = json.data!;

            // Reload hardware sets from DB into UI state
            updateProcessingTask(taskId, { stage: 'Loading hardware sets…', progress: 88 });
            const hwRes = await fetch(`/api/projects/${project.id}/hardware-pdf`, { credentials: 'include' });
            const hwJson = hwRes.ok ? await hwRes.json() : null;
            let loadedSets: HardwareSet[] = [];
            if (hwJson?.data?.extractedJson) {
                loadedSets = transformHardwareSets(hwJson.data.extractedJson);
                setHardwareSets(loadedSets);
                isInitialMount.current = true;
            }

            // Run merge for reports — also re-fetch door schedule to match with new hardware sets
            updateProcessingTask(taskId, { stage: 'Matching with door schedule…', progress: 92 });
            const mergeStats = await runHardwareMerge();

            if (mergeStats && loadedSets.length > 0) {
                // Re-fetch door schedule to re-match all doors (including unmatched) with new sets
                const dsFresh = await fetch(`/api/projects/${project.id}/door-schedule`, { credentials: 'include' });
                const dsFreshJson = dsFresh.ok ? await dsFresh.json() : null;
                if (dsFreshJson?.data?.scheduleJson) {
                    const freshDoors = transformDoors(dsFreshJson.data.scheduleJson, loadedSets);
                    setDoors(freshDoors);
                    isInitialMount.current = true;
                    saveToFinalJson(loadedSets, freshDoors).catch(() => {});
                } else {
                    // No door schedule yet — save with empty door list (no stale state)
                    saveToFinalJson(loadedSets, []).catch(() => {});
                }
            } else if (loadedSets.length > 0) {
                // No merge ran — fetch fresh doors from sheet to avoid stale state
                const dsFallback = await fetch(`/api/projects/${project.id}/door-schedule`, { credentials: 'include' });
                const dsFallbackJson = dsFallback.ok ? await dsFallback.json() : null;
                const fallbackDoors = dsFallbackJson?.data?.scheduleJson
                    ? transformDoors(dsFallbackJson.data.scheduleJson, loadedSets)
                    : [];
                if (fallbackDoors.length > 0) { setDoors(fallbackDoors); isInitialMount.current = true; }
                saveToFinalJson(loadedSets, fallbackDoors).catch(() => {});
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

            // Reload doors from DB into UI state
            updateProcessingTask(taskId, { stage: 'Loading door schedule…', progress: 85 });
            const dsRes = await fetch(`/api/projects/${project.id}/door-schedule`, { credentials: 'include' });
            const dsJson = dsRes.ok ? await dsRes.json() : null;
            let loadedDoors: Door[] = [];
            if (dsJson?.data?.scheduleJson) {
                loadedDoors = transformDoors(dsJson.data.scheduleJson, hardwareSets);
                setDoors(loadedDoors);
                isInitialMount.current = true;
            }

            // Run merge for reports — also re-fetch hardware sets to match with new door schedule
            updateProcessingTask(taskId, { stage: 'Matching with hardware sets…', progress: 92 });
            const mergeStats = await runHardwareMerge();

            if (mergeStats && dsJson?.data?.scheduleJson) {
                // Re-fetch hardware sets so the door→set matching uses the latest PDF data
                const hwFresh = await fetch(`/api/projects/${project.id}/hardware-pdf`, { credentials: 'include' });
                const hwFreshJson = hwFresh.ok ? await hwFresh.json() : null;
                const freshSets = hwFreshJson?.data?.extractedJson
                    ? transformHardwareSets(hwFreshJson.data.extractedJson)
                    : hardwareSets;
                const freshDoors = transformDoors(dsJson.data.scheduleJson, freshSets);
                if (hwFreshJson?.data?.extractedJson) { setHardwareSets(freshSets); isInitialMount.current = true; }
                setDoors(freshDoors);
                isInitialMount.current = true;
                saveToFinalJson(freshSets, freshDoors).catch(() => {});
            } else if (loadedDoors.length > 0) {
                // Fetch fresh PDF sets to avoid using stale state (which may contain old variants)
                const hwFallback = await fetch(`/api/projects/${project.id}/hardware-pdf`, { credentials: 'include' });
                const hwFallbackJson = hwFallback.ok ? await hwFallback.json() : null;
                const fallbackSets = hwFallbackJson?.data?.extractedJson
                    ? transformHardwareSets(hwFallbackJson.data.extractedJson)
                    : hardwareSets;
                saveToFinalJson(fallbackSets, loadedDoors).catch(() => {});
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

    // Overwrite check for combined upload — runs before processCombinedUpload
    const handleCombinedProcessClick = async () => {
        if (!combinedExcelFile || !combinedPdfFile) return;
        setIsCombinedOverwriteChecking(true);
        try {
            const [dsRes, pdfRes] = await Promise.all([
                fetch(`/api/projects/${project.id}/door-schedule`, { credentials: 'include' }),
                fetch(`/api/projects/${project.id}/hardware-pdf`, { credentials: 'include' }),
            ]);
            const dsJson = dsRes.ok ? await dsRes.json() : null;
            const pdfJson = pdfRes.ok ? await pdfRes.json() : null;
            const hasExisting = !!dsJson?.data || !!pdfJson?.data;
            if (hasExisting) {
                setIsCombinedOverwriteOpen(true);
            } else {
                processCombinedUpload(combinedExcelFile, combinedPdfFile);
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

    const addLog = useCallback((level: 'info' | 'success' | 'warn' | 'error', msg: string) => {
        const entry: ProcessingLogEntry = { level, msg };
        logsRef.current = [...logsRef.current, entry];
        setCombinedLogs(prev => [...prev, entry]);
        setWidget({ logs: logsRef.current });
    }, [setWidget]);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [combinedLogs]);

    const processCombinedUpload = async (excelFile: File, pdfFile: File) => {
        setIsCombinedProcessing(true);
        setCombinedProgress(0);
        setCombinedLogs([]);
        logsRef.current = [];
        sessionStorage.setItem(`planckoff_proc_${project.id}`, Date.now().toString());
        setWidget({
            isActive: true,
            isProcessing: true,
            progress: 0,
            step: '',
            elapsedSeconds: 0,
            projectId: project.id,
            projectPath: `/project/${project.id}`,
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

            step('Uploading files to server…', 15);

            const form = new FormData();
            form.append('excel', excelFile);
            form.append('pdf', pdfFile);

            // Simulate the long PDF AI step with timed log updates.
            // Use a local variable instead of a functional updater so addLog / setWidget
            // are never called from inside a React state updater (which runs during render).
            let simulatedProgress = 15;
            const pdfProgressTimer = setInterval(() => {
                if (simulatedProgress >= 70) { clearInterval(pdfProgressTimer); return; }
                simulatedProgress = Math.min(simulatedProgress + 3, 70);
                setCombinedProgress(simulatedProgress);
                setWidget({ progress: simulatedProgress });
                if (simulatedProgress === 21) { addLog('info', 'Parsing door schedule columns and rows…'); setCombinedCurrentStep('Parsing door schedule…'); }
                if (simulatedProgress === 30) { addLog('success', 'Door schedule processed.'); addLog('info', 'Sending hardware PDF to AI (Gemini)…'); setCombinedCurrentStep('AI reading hardware PDF…'); }
                if (simulatedProgress === 45) { addLog('info', 'AI extracting hardware sets and items…'); }
                if (simulatedProgress === 60) { addLog('info', 'AI processing hardware specifications…'); }
            }, 800);

            const res = await fetch(`/api/projects/${project.id}/process`, {
                method: 'POST',
                credentials: 'include',
                body: form,
            });

            clearInterval(pdfProgressTimer);

            // Safely parse — server may return plain-text 500 in edge cases
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
                throw new Error(`Server error (HTTP ${res.status}). The request may have timed out — please try again.`);
            }

            if (!res.ok) throw new Error(json?.error ?? `Server error (HTTP ${res.status}).`);

            const { setCount, matchedDoorCount, unmatchedDoorCount, unmatchedDoorCodes, pdfSetsWithNoDoors, rowCount, itemCount, warnings, masterQueueWarning } = json!.data!;

            addLog('success', `Door schedule: ${rowCount} door rows extracted from Excel.`);
            addLog('success', `Hardware PDF: ${setCount} sets, ${itemCount} items extracted by AI.`);
            if (masterQueueWarning) {
                addLog('warn', `Database queue: ${masterQueueWarning}`);
            }

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

            step('Saving final data to database…', 88);
            await new Promise(r => setTimeout(r, 150));
            addLog('success', 'Final JSON saved to database.');

            step('Populating project view…', 94);
            // Always load from raw tables — shows ALL doors (matched + unmatched)
            const [hwFresh, dsFresh] = await Promise.all([
                fetch(`/api/projects/${project.id}/hardware-pdf`, { credentials: 'include' }),
                fetch(`/api/projects/${project.id}/door-schedule`, { credentials: 'include' }),
            ]);
            const hwFreshJson = hwFresh.ok ? await hwFresh.json() : null;
            const dsFreshJson = dsFresh.ok ? await dsFresh.json() : null;
            const freshSets = hwFreshJson?.data?.extractedJson
                ? transformHardwareSets(hwFreshJson.data.extractedJson) : [];
            const freshDoors = dsFreshJson?.data?.scheduleJson
                ? transformDoors(dsFreshJson.data.scheduleJson, freshSets) : [];
            if (freshSets.length > 0) { setHardwareSets(freshSets); isInitialMount.current = true; }
            if (freshDoors.length > 0) { setDoors(freshDoors); isInitialMount.current = true; }
            saveToFinalJson(freshSets, freshDoors).catch(() => {});

            setCombinedProgress(100);
            setCombinedCurrentStep('Complete');
            addLog('success', `Done! ${freshDoors.length} doors loaded — ${matchedDoorCount} linked to sets, ${unmatchedDoorCount} unmatched.`);

            addToast({
                type: 'success',
                message: `Processed ${rowCount} doors and ${setCount} sets. ${matchedDoorCount} doors linked.`,
            });

            // Warnings are already shown in the logs panel — no need for ErrorModal

        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            addLog('error', `Failed: ${msg}`);
            setCombinedCurrentStep('Failed');
            setCombinedProgress(0);
            addToast({ type: 'error', message: `Processing failed: ${msg}` });
        } finally {
            setIsCombinedProcessing(false);
            sessionStorage.removeItem(`planckoff_proc_${project.id}`);
            clearWidget();
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

    // ── Assign All — runs the same server-side merge as the pipeline ─────────
    const handleAssignAll = async (): Promise<void> => {
        const mergeStats = await runHardwareMerge();
        if (!mergeStats) {
            addToast({ type: 'error', message: 'Assignment failed. Make sure both the hardware PDF and door schedule are uploaded.' });
            return;
        }

        // Re-fetch raw tables and re-transform so the UI reflects the merge result
        const [hwRes, dsRes] = await Promise.all([
            fetch(`/api/projects/${project.id}/hardware-pdf`, { credentials: 'include' }),
            fetch(`/api/projects/${project.id}/door-schedule`, { credentials: 'include' }),
        ]);
        const hwJson = hwRes.ok ? await hwRes.json() : null;
        const dsJson = dsRes.ok ? await dsRes.json() : null;

        const freshSets: HardwareSet[] = hwJson?.data?.extractedJson
            ? transformHardwareSets(hwJson.data.extractedJson)
            : hardwareSets;
        const freshDoors = dsJson?.data?.scheduleJson
            ? transformDoors(dsJson.data.scheduleJson, freshSets)
            : doors;

        setHardwareSets(freshSets);
        setDoors(freshDoors);
        isInitialMount.current = true;
        saveToFinalJson(freshSets, freshDoors).catch(() => {});

        const matched = mergeStats.matchedDoorCount;
        const unmatched = mergeStats.unmatchedDoorCount;
        addToast({
            type: 'success',
            message: `Assigned ${matched} door${matched !== 1 ? 's' : ''} to hardware sets.${unmatched > 0 ? ` ${unmatched} door${unmatched !== 1 ? 's' : ''} could not be matched.` : ''}`,
        });
    };

    // ── Undo-toast + trash helpers ────────────────────────────────────────────

    const pushUndoToast = useCallback((toast: UndoToastItem) => {
        hasPendingUndoRef.current = true;
        setUndoToasts(prev => [...prev, toast]);
    }, []);

    const dismissUndoToast = useCallback((id: string) => {
        setUndoToasts(prev => {
            const next = prev.filter(t => t.id !== id);
            if (next.length === 0) hasPendingUndoRef.current = false;
            return next;
        });
    }, []);

    const buildTrashItemForSet = useCallback((set: HardwareSet, currentDoors: Door[]): TrashItem => {
        const matchedDoors: MergedDoor[] = currentDoors
            .filter(d => d.assignedHardwareSet?.id === set.id || d.providedHardwareSet?.toLowerCase() === set.name.toLowerCase())
            .map(d => ({
                doorTag: d.doorTag,
                hwSet: d.providedHardwareSet ?? '',
                matchedSetName: set.name,
                doorLocation: d.location,
                interiorExterior: d.interiorExterior,
                quantity: d.quantity,
                fireRating: d.fireRating,
                leafCount: d.leafCountDisplay ?? (d.leafCount !== undefined ? String(d.leafCount) : undefined),
                doorType: d.type,
                doorElevationType: d.elevationTypeId,
                doorWidth: d.width ? `${Math.floor(d.width / 12)}'-${d.width % 12}"` : undefined,
                doorHeight: d.height ? `${Math.floor(d.height / 12)}'-${d.height % 12}"` : undefined,
                thickness: d.thickness ? String(d.thickness) : undefined,
                doorMaterial: d.doorMaterial,
                frameMaterial: d.frameMaterial as string | undefined,
                sections: d.sections as unknown as MergedDoor['sections'],
            }));

        return {
            id: `trash-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'set',
            setName: set.name,
            deletedAt: new Date().toISOString(),
            setData: {
                setName: set.name,
                notes: set.description ?? '',
                hardwareItems: set.items.map(item => ({
                    qty: item.quantity,
                    item: item.name,
                    manufacturer: item.manufacturer ?? '',
                    description: item.description ?? '',
                    finish: item.finish ?? '',
                })),
                doors: matchedDoors,
            },
        };
    }, []);

    const handleDeleteSet = useCallback((setId: string) => {
        const setToDelete = hardwareSets.find(s => s.id === setId);
        if (!setToDelete) return;

        // Capture snapshot before removing
        const trashItem = buildTrashItemForSet(setToDelete, doors);
        const doorsToRemove = doors.filter(d =>
            d.assignedHardwareSet?.id === setId ||
            d.providedHardwareSet?.toLowerCase() === setToDelete.name.toLowerCase()
        );

        // Immediately hide from UI
        setHardwareSets(prev => prev.filter(s => s.id !== setId));
        setDoors(prev => prev.filter(d => !doorsToRemove.some(dr => dr.id === d.id)));

        const label = `Set "${setToDelete.name}" deleted — moves to Trash in`;
        pushUndoToast({
            id: trashItem.id,
            label,
            onUndo: () => {
                setHardwareSets(prev => {
                    const idx = hardwareSets.findIndex(s => s.id === setId);
                    const next = [...prev];
                    next.splice(idx === -1 ? prev.length : idx, 0, setToDelete);
                    return next;
                });
                setDoors(prev => {
                    const sortedBack = [...prev, ...doorsToRemove].sort((a, b) => {
                        const ao = (a as Door & { scheduleOrder?: number }).scheduleOrder ?? Infinity;
                        const bo = (b as Door & { scheduleOrder?: number }).scheduleOrder ?? Infinity;
                        return ao - bo;
                    });
                    return sortedBack;
                });
            },
            onConfirm: () => {
                // Build newTrash explicitly before setState so we can pass it
                // directly to saveToFinalJson. Calling performSave() here would
                // use a stale closure (captured before setHardwareSets/setDoors
                // committed) and write the deleted set back to finalJson.
                const newTrash = [...trashItemsRef.current, trashItem];
                setTrashItems(newTrash);
                setTimeout(() => {
                    hasPendingUndoRef.current = false;
                    saveToFinalJson(hardwareSetsRef.current, doorsRef.current, newTrash).catch(() => {});
                }, 0);
            },
        });
    }, [hardwareSets, doors, buildTrashItemForSet, pushUndoToast, saveToFinalJson]);

    const handleBulkDeleteSets = useCallback((setIds: Set<string>) => {
        const setsToDelete = hardwareSets.filter(s => setIds.has(s.id));
        if (setsToDelete.length === 0) return;

        const trashEntries = setsToDelete.map(s => buildTrashItemForSet(s, doors));
        const doorsToRemove = doors.filter(d =>
            setsToDelete.some(s =>
                d.assignedHardwareSet?.id === s.id ||
                d.providedHardwareSet?.toLowerCase() === s.name.toLowerCase()
            )
        );

        setHardwareSets(prev => prev.filter(s => !setIds.has(s.id)));
        setDoors(prev => prev.filter(d => !doorsToRemove.some(dr => dr.id === d.id)));

        const batchId = `trash-bulk-${Date.now()}`;
        const label = `${setsToDelete.length} set${setsToDelete.length !== 1 ? 's' : ''} deleted — moves to Trash in`;
        pushUndoToast({
            id: batchId,
            label,
            onUndo: () => {
                setHardwareSets(prev => [...prev, ...setsToDelete]);
                setDoors(prev => [...prev, ...doorsToRemove]);
            },
            onConfirm: () => {
                const newTrash = [...trashItemsRef.current, ...trashEntries];
                setTrashItems(newTrash);
                setTimeout(() => {
                    hasPendingUndoRef.current = false;
                    saveToFinalJson(hardwareSetsRef.current, doorsRef.current, newTrash).catch(() => {});
                }, 0);
            },
        });
    }, [hardwareSets, doors, buildTrashItemForSet, pushUndoToast, saveToFinalJson]);

    // ── Trash restore / permanent delete ─────────────────────────────────────

    const handleRestoreFromTrash = useCallback((trashId: string) => {
        const item = trashItems.find(t => t.id === trashId);
        if (!item) return;

        if (item.type === 'set' && item.setData) {
            // Rebuild a HardwareSet from the stored MergedHardwareSet
            const restoredSet: HardwareSet = {
                id: `hs-restored-${Date.now()}`,
                name: item.setData.setName,
                description: item.setData.notes ?? '',
                division: 'Division 08',
                items: item.setData.hardwareItems.map((hi, idx) => ({
                    id: `item-restored-${Date.now()}-${idx}`,
                    name: hi.item,
                    quantity: hi.qty,
                    manufacturer: hi.manufacturer,
                    description: hi.description,
                    finish: hi.finish,
                    unitCost: 0,
                    totalCost: 0,
                })),
            };
            setHardwareSets(prev => [...prev, restoredSet]);

            // Restore matched doors, re-linked to the new set
            if (item.setData.doors.length > 0) {
                const restoredDoors: Door[] = item.setData.doors.map((md, idx) => ({
                    id: `door-restored-${Date.now()}-${idx}`,
                    doorTag: md.doorTag,
                    status: 'complete' as const,
                    assignedHardwareSet: restoredSet,
                    providedHardwareSet: md.hwSet,
                    location: md.doorLocation,
                    interiorExterior: md.interiorExterior,
                    quantity: parseDoorQuantity(md.quantity),
                    fireRating: md.fireRating,
                    leafCount: parseLeafCount(md.leafCount),
                    leafCountDisplay: md.leafCount,
                    type: md.doorType,
                    elevationTypeId: md.doorElevationType ?? md.doorType,
                    width: undefined,
                    height: undefined,
                    thickness: undefined,
                    doorMaterial: md.doorMaterial ?? '',
                    frameMaterial: md.frameMaterial as Door['frameMaterial'],
                    sections: md.sections as unknown as Door['sections'],
                }));
                setDoors(prev => [...prev, ...restoredDoors]);
            }
        } else if (item.type === 'door' && item.doorData) {
            const md = item.doorData;
            const matchedSet = hardwareSets.find(s => s.name.toLowerCase() === md.matchedSetName.toLowerCase()) ?? null;
            const restoredDoor: Door = {
                id: `door-restored-${Date.now()}`,
                doorTag: md.doorTag,
                status: matchedSet ? 'complete' as const : 'pending' as const,
                assignedHardwareSet: matchedSet ?? undefined,
                providedHardwareSet: md.hwSet,
                location: md.doorLocation,
                quantity: parseDoorQuantity(md.quantity),
                leafCount: parseLeafCount(md.leafCount),
                leafCountDisplay: md.leafCount,
                type: md.doorType,
                elevationTypeId: md.doorElevationType ?? md.doorType,
                width: undefined,
                height: undefined,
                thickness: undefined,
                doorMaterial: '',
                sections: md.sections as unknown as Door['sections'],
            };
            setDoors(prev => {
                const insertAt = item.originalIndex !== undefined
                    ? Math.min(item.originalIndex, prev.length)
                    : prev.length;
                const updated = [...prev];
                updated.splice(insertAt, 0, restoredDoor);
                return updated;
            });
        }

        setTrashItems(prev => prev.filter(t => t.id !== trashId));
        addToast({ type: 'success', message: `"${item.setName}" restored successfully.` });
    }, [trashItems, hardwareSets, addToast]);

    const handlePermanentDelete = useCallback((trashId: string) => {
        setTrashItems(prev => prev.filter(t => t.id !== trashId));
    }, []);

    const handleClearAllTrash = useCallback(() => {
        setTrashItems([]);
    }, []);

    const handleSplitSetAndReassign = useCallback((newSetData: HardwareSet, doorIds: string[], sourceSetId: string) => {
        const newSet: HardwareSet = {
            ...newSetData,
            id: `hs-variant-${Date.now()}`,
            parentSetId: sourceSetId,
        };

        // Snapshot the original door state for the doors we're about to reassign.
        // Stored in the closure so onUndo can restore exact pre-variant values.
        const originalDoorStates = doors.filter(d => doorIds.includes(d.id));

        let updatedSets: HardwareSet[] = [];
        setHardwareSets(prevSets => {
            const idx = prevSets.findIndex(s => s.id === sourceSetId);
            if (idx === -1) {
                updatedSets = [...prevSets, newSet];
            } else {
                updatedSets = [...prevSets];
                updatedSets.splice(idx + 1, 0, newSet);
            }
            return updatedSets;
        });
        setDoors(prevDoors =>
            prevDoors.map(door =>
                doorIds.includes(door.id)
                    ? { ...door, assignedHardwareSet: newSet, providedHardwareSet: newSet.name, status: 'complete' as const }
                    : door,
            ),
        );

        // Show undo toast — auto-save is blocked while the toast is live.
        pushUndoToast({
            id: `variant-${newSet.id}`,
            label: `Variant "${newSet.name}" created — undo available for`,
            onUndo: () => {
                // Atomically remove the variant set and restore the reassigned doors.
                setHardwareSets(prev => prev.filter(s => s.id !== newSet.id));
                setDoors(prevDoors =>
                    prevDoors.map(door => {
                        const original = originalDoorStates.find(od => od.id === door.id);
                        return original ?? door;
                    }),
                );
                // hasPendingUndoRef is cleared by dismissUndoToast; the debounce
                // will then fire and persist the reverted state automatically.
            },
            onConfirm: () => {
                // Persist to hardware-pdf now that the undo window has closed.
                saveToHardwarePdf(updatedSets).catch(() => {});
                setTimeout(() => {
                    hasPendingUndoRef.current = false;
                    // Use refs — performSave() would be stale here (captured before
                    // setHardwareSets/setDoors committed the variant).
                    saveToFinalJson(hardwareSetsRef.current, doorsRef.current, trashItemsRef.current).catch(() => {});
                }, 0);
            },
        });
    }, [doors, pushUndoToast, performSave, saveToHardwarePdf]);

    const handleDoorsUpdate = useCallback((updater: React.SetStateAction<Door[]>) => {
        setDoors(updater);
    }, []);

    // Called by DoorScheduleManager when user deletes door(s)
    // Instead of removing immediately + saving, we show an undo toast for 6s first.
    const handleDeleteDoors = useCallback((doorIdsToDelete: string[]) => {
        const doorsToDelete = doors.filter(d => doorIdsToDelete.includes(d.id));
        if (doorsToDelete.length === 0) return;

        const trashEntries: TrashItem[] = doorsToDelete.map(d => ({
            id: `trash-door-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'door' as const,
            setName: d.doorTag,
            deletedAt: new Date().toISOString(),
            originalIndex: doors.findIndex(door => door.id === d.id),
            doorData: {
                doorTag: d.doorTag,
                hwSet: d.providedHardwareSet ?? '',
                matchedSetName: d.assignedHardwareSet?.name ?? '',
                doorLocation: d.location,
                quantity: d.quantity,
                sections: d.sections as unknown as MergedDoor['sections'],
            },
        }));

        setDoors(prev => prev.filter(d => !doorIdsToDelete.includes(d.id)));

        const batchId = `trash-door-bulk-${Date.now()}`;
        const label = doorsToDelete.length === 1
            ? `Door "${doorsToDelete[0].doorTag}" deleted — moves to Trash in`
            : `${doorsToDelete.length} doors deleted — moves to Trash in`;

        pushUndoToast({
            id: batchId,
            label,
            onUndo: () => {
                setDoors(prev => [...prev, ...doorsToDelete]);
            },
            onConfirm: () => {
                const newTrash = [...trashItemsRef.current, ...trashEntries];
                setTrashItems(newTrash);
                setTimeout(() => {
                    hasPendingUndoRef.current = false;
                    saveToFinalJson(hardwareSetsRef.current, doorsRef.current, newTrash).catch(() => {});
                }, 0);
            },
        });
    }, [doors, pushUndoToast, saveToFinalJson]);

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
                            <Upload className="h-4 w-4" />
                            <span className="hidden md:inline">Process Files</span>
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
                                        onClick={() => { setIsCombinedMinimized(true); setWidget({ isMinimized: true }); }}
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
