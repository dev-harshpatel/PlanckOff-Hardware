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
    const [doors, setDoors] = useState<Door[]>([]);
    const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
    const hardwareSetsRef = useSyncRef(hardwareSets);
    const trashItemsRef = useRef<TrashItem[]>([]);
    const doorsRef = useSyncRef(doors);
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [isPollingForResult, setIsPollingForResult] = useState(false);
    const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isInitialMount = useRef(true);

    useEffect(() => {
        isInitialMount.current = true;
    }, [projectId]);

    // Keep trashItemsRef in sync
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
                    fetch(`/api/projects/${projectId}/hardware-pdf`, { credentials: 'include' }),
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
                isInitialMount.current = true;

                if (sessionStorage.getItem(processingKey)) {
                    if (!cancelled) startPollingForResult();
                    return;
                }

                const [hwRes, dsRes, mergeRes] = await Promise.all([
                    fetch(`/api/projects/${projectId}/hardware-pdf`, { credentials: 'include' }),
                    fetch(`/api/projects/${projectId}/door-schedule`, { credentials: 'include' }),
                    fetch(`/api/projects/${projectId}/hardware-merge`, { credentials: 'include' }),
                ]);

                if (cancelled) return;

                const hwJson = hwRes.ok ? await hwRes.json() : null;
                const dsJson = dsRes.ok ? await dsRes.json() : null;
                const mergeJson = mergeRes.ok ? await mergeRes.json() : null;

                if (Array.isArray(mergeJson?.data?.trashJson)) {
                    setTrashItems(mergeJson.data.trashJson);
                }

                const pdfSets = hwJson?.data?.extractedJson
                    ? transformHardwareSets(hwJson.data.extractedJson)
                    : [];

                const finalRaw = Array.isArray(mergeJson?.data?.finalJson) && mergeJson.data.finalJson.length > 0
                    ? mergeJson.data.finalJson as Parameters<typeof transformFromFinalJson>[0]
                    : null;
                const finalData = finalRaw ? transformFromFinalJson(finalRaw) : null;

                let sets: typeof pdfSets;
                if (finalData && finalData.hardwareSets.length > 0) {
                    const pdfSetsByName = new Map(pdfSets.map(s => [s.name.toLowerCase(), s]));
                    const setsFromFinal = finalData.hardwareSets
                        .filter(s => s.name !== '__unassigned__')
                        .map(s => {
                            const pdfVersion = pdfSetsByName.get(s.name.toLowerCase());
                            if (pdfVersion) {
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
                    const seenIds = new Set<string>();
                    sets = merged.filter(s => {
                        if (seenIds.has(s.id)) return false;
                        seenIds.add(s.id);
                        return true;
                    });
                } else {
                    sets = pdfSets;
                }

                const trashedDoorTags = new Set<string>(
                    (mergeJson?.data?.trashJson ?? [])
                        .filter((t: TrashItem) => t.type === 'door')
                        .map((t: TrashItem) => t.doorData?.doorTag)
                        .filter(Boolean) as string[],
                );

                const rawDoors = dsJson?.data?.scheduleJson
                    ? transformDoors(dsJson.data.scheduleJson, sets).filter(
                          d => !trashedDoorTags.has(d.doorTag),
                      )
                    : [];

                let loadedDoors: typeof rawDoors;
                if (finalData && finalData.doors.length > 0) {
                    const setsById = new Map(sets.map(s => [s.id, s]));
                    // Use the last occurrence per tag so multi-set duplicates from finalJson collapse to one.
                    const finalDoorMap = new Map(finalData.doors.map(d => [d.doorTag, d]));

                    loadedDoors = rawDoors.map(raw => {
                        const fromFinal = finalDoorMap.get(raw.doorTag);
                        if (!fromFinal) return raw;
                        return {
                            ...raw,
                            ...fromFinal,
                            // Keep the raw door's unique ID — spreading fromFinal would give every
                            // raw row with the same doorTag an identical door-final-* key.
                            id: raw.id,
                            assignedHardwareSet: fromFinal.assignedHardwareSet
                                ? (setsById.get(fromFinal.assignedHardwareSet.id) ?? fromFinal.assignedHardwareSet)
                                : raw.assignedHardwareSet,
                            sections: raw.sections ?? fromFinal.sections,
                        };
                    });

                    const rawDoorTags = new Set(rawDoors.map(d => d.doorTag));
                    // Deduplicate manual doors by tag — the same door can appear in multiple sets
                    // inside finalJson, which would otherwise add it to the list multiple times.
                    const seenManualTags = new Set<string>();
                    const manualDoors = finalData.doors
                        .filter(d => {
                            if (rawDoorTags.has(d.doorTag) || trashedDoorTags.has(d.doorTag)) return false;
                            const tag = d.doorTag.toLowerCase();
                            if (seenManualTags.has(tag)) return false;
                            seenManualTags.add(tag);
                            return true;
                        })
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

                const hasFinalJson = Boolean(finalRaw);
                if (!hasFinalJson && sets.length > 0 && !cancelled) {
                    saveToFinalJsonRef.current?.(sets, loadedDoors).catch(() => {});
                }
            } catch {
                // Non-critical — UI just shows empty state
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
                return {
                    ...d,
                    ...current,
                    sections: d.sections ?? current.sections,
                };
            });

            const sheetTags = new Set(fromSheet.map(d => d.doorTag));
            const manualDoors = doorsRef.current.filter(
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
