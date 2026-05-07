'use client';

import { useState, useCallback, useEffect } from 'react';
import { HardwareSet, Door, Project, Toast } from '../types';
import type { MergedHardwareSet, MergedDoor, TrashItem } from '@/lib/db/hardware';
import { captureTrainingExample } from '../services/mlOpsService';
import type { SaveStatus } from '../components/shared/SaveStatusIndicator';

interface UseProjectPersistenceOptions {
    projectId: string;
    project: Project;
    hardwareSets: HardwareSet[];
    doors: Door[];
    trashItems: TrashItem[];
    onProjectUpdate: (project: Project) => void;
    isInitialMount: React.MutableRefObject<boolean>;
    hasPendingUndoRef: React.MutableRefObject<boolean>;
}

export function useProjectPersistence({
    projectId,
    project,
    hardwareSets,
    doors,
    trashItems,
    onProjectUpdate,
    isInitialMount,
    hasPendingUndoRef,
}: UseProjectPersistenceOptions) {
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

    useEffect(() => {
        setSaveStatus('idle');
    }, [projectId]);

    const saveToFinalJson = useCallback(async (currentSets: HardwareSet[], currentDoors: Door[], currentTrash?: TrashItem[]): Promise<void> => {
        // Sync flat display fields back into sections.basic_information so that
        // transformFromFinalJson (which reads sections first) always sees the
        // user-edited values rather than the stale raw Excel strings.
        const syncedSections = (d: Door): MergedDoor['sections'] => ({
            ...(d.sections ?? {}),
            basic_information: {
                ...(d.sections?.basic_information ?? {}),
                ...(d.widthDisplay     !== undefined ? { 'WIDTH':     d.widthDisplay }     : {}),
                ...(d.heightDisplay    !== undefined ? { 'HEIGHT':    d.heightDisplay }    : {}),
                ...(d.thicknessDisplay !== undefined ? { 'THICKNESS': d.thicknessDisplay } : {}),
                ...(d.quantity         !== undefined ? { 'QUANTITY':  String(d.quantity) } : {}),
                ...(d.fireRating       !== undefined ? { 'FIRE RATING': d.fireRating }     : {}),
                ...(d.buildingTag      !== undefined ? { 'BUILDING TAG': d.buildingTag }   : {}),
                ...(d.buildingLocation !== undefined ? { 'BUILDING LOCATION': d.buildingLocation } : {}),
            },
        }) as unknown as MergedDoor['sections'];

        try {
            const finalJson: MergedHardwareSet[] = currentSets.map((set): MergedHardwareSet => {
                const matchedDoors = currentDoors.filter((d) =>
                    (d.providedHardwareSet ?? '').trim().toLowerCase() === set.name.trim().toLowerCase()
                );

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
                    sections: syncedSections(d),
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
                        sections: syncedSections(d),
                    })),
                });
            }

            await fetch(`/api/projects/${projectId}/hardware-merge`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ finalJson, trashJson: currentTrash }),
            });
        } catch (err) {
            console.warn('[saveToFinalJson] Failed to persist final JSON:', err);
        }
    }, [projectId]);

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
            await fetch(`/api/projects/${projectId}/hardware-pdf`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ extractedJson }),
            });
        } catch (err) {
            console.warn('[saveToHardwarePdf] Failed to persist hardware PDF extraction:', err);
        }
    }, [projectId]);

    const performSave = useCallback(() => {
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

    return { saveStatus, saveToFinalJson, saveToHardwarePdf, performSave };
}
