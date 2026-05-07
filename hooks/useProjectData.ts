'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { HardwareSet, Door, Toast } from '../types';
import { ERRORS } from '@/constants/errors';
import type { TrashItem } from '@/lib/db/hardware';
import { transformHardwareSets, transformDoors, transformFromFinalJson } from '../utils/hardwareTransformers';
import { useSyncRef } from './useSyncRef';
import { useProjectRealtime } from './useProjectRealtime';
import { useProcessingWidget } from '@/contexts/ProcessingWidgetContext';

interface UseProjectDataOptions {
    projectId: string;
    addToast: (toast: Omit<Toast, 'id'>) => void;
    saveToFinalJsonRef: React.MutableRefObject<((sets: HardwareSet[], doors: Door[], trash?: TrashItem[]) => Promise<void>) | null>;
}

export function useProjectData({ projectId, addToast, saveToFinalJsonRef }: UseProjectDataOptions) {
    const { clearWidget } = useProcessingWidget();

    const [hardwareSets, setHardwareSets] = useState<HardwareSet[]>([]);
    const [doors, setDoors]               = useState<Door[]>([]);
    const [trashItems, setTrashItems]     = useState<TrashItem[]>([]);
    const hardwareSetsRef = useSyncRef(hardwareSets);
    const trashItemsRef   = useRef<TrashItem[]>([]);
    const doorsRef        = useSyncRef(doors);
    const [isDataLoading, setIsDataLoading]       = useState(true);
    const [isPollingForResult, setIsPollingForResult] = useState(false);
    const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isInitialMount     = useRef(true);

    // Tracks whether final_json was successfully loaded — when true, realtime
    // reloads of door_schedule_imports are ignored (final_json is the source).
    const hasFinalJsonRef = useRef(false);

    useEffect(() => {
        isInitialMount.current  = true;
        hasFinalJsonRef.current = false;
    }, [projectId]);

    useEffect(() => { trashItemsRef.current = trashItems; }, [trashItems]);

    const startPollingForResult = useCallback(() => {
        const key = `planckoff_proc_${projectId}`;
        setIsPollingForResult(true);
        setIsDataLoading(true);

        const poll = async () => {
            const ts = sessionStorage.getItem(key);
            if (!ts || Date.now() - Number(ts) > 5 * 60 * 1000) {
                sessionStorage.removeItem(key);
                if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                setIsPollingForResult(false);
                setIsDataLoading(false);
                addToast({ type: 'error', message: ERRORS.HARDWARE.TIMEOUT.message, details: ERRORS.HARDWARE.TIMEOUT.action });
                return;
            }
            try {
                const [hwRes, dsRes] = await Promise.all([
                    fetch(`/api/projects/${projectId}/hardware-pdf`,  { credentials: 'include' }),
                    fetch(`/api/projects/${projectId}/door-schedule`, { credentials: 'include' }),
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
    }, [projectId, addToast]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        let cancelled = false;

        async function loadProjectData() {
            try {
                const processingKey = `planckoff_proc_${projectId}`;

                setHardwareSets(prev => prev.length > 0 ? [] : prev);
                setDoors(prev => prev.length > 0 ? [] : prev);
                isInitialMount.current  = true;
                hasFinalJsonRef.current = false;

                if (sessionStorage.getItem(processingKey)) {
                    if (!cancelled) startPollingForResult();
                    return;
                }

                const [hwRes, dsRes, mergeRes] = await Promise.all([
                    fetch(`/api/projects/${projectId}/hardware-pdf`,    { credentials: 'include' }),
                    fetch(`/api/projects/${projectId}/door-schedule`,   { credentials: 'include' }),
                    fetch(`/api/projects/${projectId}/hardware-merge`,  { credentials: 'include' }),
                ]);

                if (cancelled) return;

                const hwJson    = hwRes.ok    ? await hwRes.json()    : null;
                const dsJson    = dsRes.ok    ? await dsRes.json()    : null;
                const mergeJson = mergeRes.ok ? await mergeRes.json() : null;

                if (Array.isArray(mergeJson?.data?.trashJson)) {
                    setTrashItems(mergeJson.data.trashJson);
                }

                // Pre-compute trashed sets and doors once — used in both branches.
                const trashedSetNames = new Set<string>(
                    (mergeJson?.data?.trashJson ?? [])
                        .filter((t: TrashItem) => t.type === 'set')
                        .map((t: TrashItem) => t.setName?.toLowerCase())
                        .filter(Boolean) as string[],
                );
                const trashedDoorTags = new Set<string>(
                    (mergeJson?.data?.trashJson ?? [])
                        .filter((t: TrashItem) => t.type === 'door')
                        .map((t: TrashItem) => t.doorData?.doorTag)
                        .filter(Boolean) as string[],
                );

                const pdfSets = hwJson?.data?.extractedJson
                    ? transformHardwareSets(hwJson.data.extractedJson)
                    : [];

                const finalRaw = Array.isArray(mergeJson?.data?.finalJson) && mergeJson.data.finalJson.length > 0
                    ? mergeJson.data.finalJson as Parameters<typeof transformFromFinalJson>[0]
                    : null;
                const finalData = finalRaw ? transformFromFinalJson(finalRaw) : null;

                let sets: typeof pdfSets;
                let loadedDoors: Door[];

                if (finalRaw && finalData && finalData.hardwareSets.length > 0) {
                    // ── Phase C: final_json is the single source of truth ─────────────
                    // Mark this so reloadDoorSchedule becomes a no-op.
                    hasFinalJsonRef.current = true;

                    // Sets: use final_json sets directly. Append any brand-new PDF sets
                    // that appeared after the last save (e.g. from a re-upload) so they
                    // show up without requiring a manual refresh.
                    const finalSetNames = new Set(finalData.hardwareSets.map(s => s.name.toLowerCase()));
                    const newPdfSets = pdfSets.filter(s =>
                        !finalSetNames.has(s.name.toLowerCase()) &&
                        !trashedSetNames.has(s.name.toLowerCase()),
                    );
                    const mergedSets = [
                        ...finalData.hardwareSets.filter(s => s.name !== '__unassigned__'),
                        ...newPdfSets,
                    ];
                    const seenIds = new Set<string>();
                    sets = mergedSets.filter(s => {
                        if (seenIds.has(s.id)) return false;
                        seenIds.add(s.id);
                        return true;
                    });

                    // Doors: read directly from final_json — no merge with door_schedule_imports.
                    // transformFromFinalJson already resolves all field values from sections,
                    // so user-edited fields are preserved exactly as saved.
                    const setsById = new Map(sets.map(s => [s.id, s]));
                    loadedDoors = finalData.doors
                        .filter(d => !trashedDoorTags.has(d.doorTag))
                        .map(d => ({
                            ...d,
                            // Resolve assignedHardwareSet against the final set list so IDs align.
                            assignedHardwareSet: d.assignedHardwareSet && d.assignedHardwareSet.name !== '__unassigned__'
                                ? (setsById.get(d.assignedHardwareSet.id) ?? d.assignedHardwareSet)
                                : undefined,
                        }))
                        .sort((a, b) => a.doorTag.localeCompare(b.doorTag, undefined, { numeric: true, sensitivity: 'base' }));

                } else {
                    // ── No final_json yet: build from extraction tables ────────────────
                    // This path only runs on first load (before final_json is seeded).
                    sets = pdfSets;

                    const rawDoors = dsJson?.data?.scheduleJson
                        ? transformDoors(
                              dsJson.data.scheduleJson as Parameters<typeof transformDoors>[0],
                              sets,
                          ).filter(d => !trashedDoorTags.has(d.doorTag))
                        : [];
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

                // Seed final_json on the very first load (when it doesn't exist yet).
                if (!finalRaw && sets.length > 0 && !cancelled) {
                    saveToFinalJsonRef.current?.(sets, loadedDoors).catch(() => {});
                }
            } catch {
                // Non-critical — UI shows empty state
            } finally {
                if (!cancelled && !sessionStorage.getItem(`planckoff_proc_${projectId}`)) {
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
    }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    const reloadDoorSchedule = useCallback(async () => {
        // When final_json is the source of truth, realtime changes to
        // door_schedule_imports should not overwrite state.
        if (hasFinalJsonRef.current) return;

        try {
            const res = await fetch(`/api/projects/${projectId}/door-schedule`, { credentials: 'include' });
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

            const currentDoorMap = new Map(doorsRef.current.map(d => [d.doorTag, d]));
            const overlaid = fromSheet.map(d => {
                const current = currentDoorMap.get(d.doorTag);
                if (!current) return d;
                return { ...d, ...current, sections: d.sections ?? current.sections };
            });

            const sheetTags    = new Set(fromSheet.map(d => d.doorTag));
            const manualDoors  = doorsRef.current.filter(
                d => !sheetTags.has(d.doorTag) && !trashedDoorTags.has(d.doorTag),
            );

            setDoors([...overlaid, ...manualDoors]);
        } catch {
            // Non-critical — stale data is better than a crash
        }
    }, [projectId]);

    useProjectRealtime({ projectId, onDoorScheduleChange: reloadDoorSchedule });

    return {
        hardwareSets,
        setHardwareSets,
        doors,
        setDoors,
        trashItems,
        setTrashItems,
        hardwareSetsRef,
        doorsRef,
        trashItemsRef,
        isDataLoading,
        isPollingForResult,
        isInitialMount,
        reloadDoorSchedule,
    };
}
