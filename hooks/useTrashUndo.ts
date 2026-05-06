'use client';

import { useState, useCallback } from 'react';
import { HardwareSet, Door, Toast } from '../types';
import type { MergedDoor, TrashItem } from '@/lib/db/hardware';
import { type UndoToastItem } from '../components/shared/UndoToast';
import { parseDoorQuantity, parseLeafCount } from '../utils/doorUtils';

interface UseTrashUndoOptions {
    hardwareSets: HardwareSet[];
    setHardwareSets: React.Dispatch<React.SetStateAction<HardwareSet[]>>;
    doors: Door[];
    setDoors: React.Dispatch<React.SetStateAction<Door[]>>;
    trashItems: TrashItem[];
    setTrashItems: React.Dispatch<React.SetStateAction<TrashItem[]>>;
    hardwareSetsRef: React.MutableRefObject<HardwareSet[]>;
    doorsRef: React.MutableRefObject<Door[]>;
    trashItemsRef: React.MutableRefObject<TrashItem[]>;
    hasPendingUndoRef: React.MutableRefObject<boolean>;
    addToast: (toast: Omit<Toast, 'id'>) => void;
    saveToFinalJson: (sets: HardwareSet[], doors: Door[], trash?: TrashItem[]) => Promise<void>;
    saveToHardwarePdf: (sets: HardwareSet[]) => Promise<void>;
    performSave: () => void;
}

export function useTrashUndo({
    hardwareSets,
    setHardwareSets,
    doors,
    setDoors,
    trashItems,
    setTrashItems,
    hardwareSetsRef,
    doorsRef,
    trashItemsRef,
    hasPendingUndoRef,
    addToast,
    saveToFinalJson,
    saveToHardwarePdf,
    performSave,
}: UseTrashUndoOptions) {
    const [undoToasts, setUndoToasts] = useState<UndoToastItem[]>([]);

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

        const trashItem = buildTrashItemForSet(setToDelete, doors);
        const doorsToRemove = doors.filter(d =>
            d.assignedHardwareSet?.id === setId ||
            d.providedHardwareSet?.toLowerCase() === setToDelete.name.toLowerCase()
        );

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

    const handleRestoreFromTrash = useCallback((trashId: string) => {
        const item = trashItems.find(t => t.id === trashId);
        if (!item) return;

        if (item.type === 'set' && item.setData) {
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

        pushUndoToast({
            id: `variant-${newSet.id}`,
            label: `Variant "${newSet.name}" created — undo available for`,
            onUndo: () => {
                setHardwareSets(prev => prev.filter(s => s.id !== newSet.id));
                setDoors(prevDoors =>
                    prevDoors.map(door => {
                        const original = originalDoorStates.find(od => od.id === door.id);
                        return original ?? door;
                    }),
                );
            },
            onConfirm: () => {
                saveToHardwarePdf(updatedSets).catch(() => {});
                setTimeout(() => {
                    hasPendingUndoRef.current = false;
                    saveToFinalJson(hardwareSetsRef.current, doorsRef.current, trashItemsRef.current).catch(() => {});
                }, 0);
            },
        });
    }, [doors, pushUndoToast, performSave, saveToHardwarePdf]);

    const handleDoorsUpdate = useCallback((updater: React.SetStateAction<Door[]>) => {
        setDoors(updater);
    }, []);

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

    return {
        undoToasts,
        dismissUndoToast,
        handleDeleteSet,
        handleBulkDeleteSets,
        handleRestoreFromTrash,
        handlePermanentDelete,
        handleClearAllTrash,
        handleSplitSetAndReassign,
        handleDoorsUpdate,
        handleDeleteDoors,
    };
}
