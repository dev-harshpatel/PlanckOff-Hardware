'use client';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Door, HardwareSet, ElevationType, Toast } from '../types';
import { ERRORS } from '@/constants/errors';
import { matchHardwareSet } from '../utils/hardwareMatcher';
import { migrateDoorData } from '../utils/doorDataMigration';
import { useBackgroundUpload } from '../contexts/BackgroundUploadContext';
import { ChevronUp, ChevronDown, ChevronsUpDown, GripVertical } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface ColumnDef {
    key: string;
    label: string;
    width: string;
    type: 'text' | 'number' | 'select';
    options?: string[];
    align?: 'left' | 'center' | 'right';
    isCore?: boolean;
}

export interface CustomColumn {
    id: string;
    label: string;
    type: 'text' | 'number';
}

export interface PersistedColumnPrefs {
    visibleColumns: string[];
    columnOrder: string[];
    customColumns: CustomColumn[];
}

export type StatusFilter = 'all' | 'pending' | 'complete';

export const formatDimension = (inches: number): string => {
    if (!inches) return "0'-0\"";
    const feet = Math.floor(inches / 12);
    const remainingInches = inches % 12;
    return `${feet}'-${remainingInches}"`;
};

export const ALL_AVAILABLE_COLUMNS: ColumnDef[] = [
    { key: 'doorTag',               label: 'Door Tag',                width: 'min-w-[90px]',  type: 'text',   isCore: true },
    { key: 'buildingTag',           label: 'Building Tag',            width: 'min-w-[100px]', type: 'text' },
    { key: 'buildingLocation',      label: 'Building Location',       width: 'min-w-[130px]', type: 'text' },
    { key: 'location',              label: 'Door Location',           width: 'min-w-[120px]', type: 'text',   isCore: true },
    { key: 'quantity',              label: 'Quantity',                width: 'w-20',          type: 'number', align: 'center', isCore: true },
    { key: 'handing',               label: 'Hand of Openings',        width: 'min-w-[120px]', type: 'text' },
    { key: 'operation',             label: 'Door Operation',          width: 'min-w-[120px]', type: 'text' },
    { key: 'leafCount',             label: 'Leaf Count',              width: 'w-20',          type: 'text', align: 'center' },
    { key: 'interiorExterior',      label: 'Interior/Exterior',       width: 'min-w-[120px]', type: 'text' },
    { key: 'excludeReason',         label: 'Exclude Reason',          width: 'min-w-[130px]', type: 'text' },
    { key: 'width',                 label: 'Width',                   width: 'w-20',          type: 'number', align: 'center', isCore: true },
    { key: 'height',                label: 'Height',                  width: 'w-20',          type: 'number', align: 'center', isCore: true },
    { key: 'thickness',             label: 'Thickness',               width: 'w-20',          type: 'number', align: 'center', isCore: true },
    { key: 'fireRating',            label: 'Fire Rating',             width: 'min-w-[100px]', type: 'text',   isCore: true },
    { key: 'doorMaterial',          label: 'Door Material',           width: 'min-w-[120px]', type: 'text',   isCore: true },
    { key: 'elevationTypeId',       label: 'Door Elevation Type',     width: 'min-w-[140px]', type: 'text' },
    { key: 'doorCore',              label: 'Door Core',               width: 'min-w-[100px]', type: 'text' },
    { key: 'doorFace',              label: 'Door Face',               width: 'min-w-[100px]', type: 'text' },
    { key: 'doorEdge',              label: 'Door Edge',               width: 'min-w-[100px]', type: 'text' },
    { key: 'doorGauge',             label: 'Door Guage',              width: 'min-w-[100px]', type: 'text' },
    { key: 'doorFinish',            label: 'Door Finish',             width: 'min-w-[100px]', type: 'text' },
    { key: 'stcRating',             label: 'STC Rating',              width: 'min-w-[90px]',  type: 'text' },
    { key: 'undercut',              label: 'Door Undercut',           width: 'min-w-[100px]', type: 'text' },
    { key: 'doorIncludeExclude',    label: 'Door Include/Exclude',    width: 'min-w-[140px]', type: 'text' },
    { key: 'frameMaterial',         label: 'Frame Material',          width: 'min-w-[120px]', type: 'text',   isCore: true },
    { key: 'wallType',              label: 'Wall Type',               width: 'min-w-[100px]', type: 'text' },
    { key: 'throatThickness',       label: 'Throat Thickness',        width: 'min-w-[120px]', type: 'text' },
    { key: 'frameAnchor',           label: 'Frame Anchor',            width: 'min-w-[110px]', type: 'text' },
    { key: 'baseAnchor',            label: 'Base Anchor',             width: 'min-w-[100px]', type: 'text' },
    { key: 'numberOfAnchors',       label: 'No of Anchor',            width: 'min-w-[100px]', type: 'text' },
    { key: 'frameProfile',          label: 'Frame Profile',           width: 'min-w-[110px]', type: 'text' },
    { key: 'frameElevationType',    label: 'Frame Elevation Type',    width: 'min-w-[150px]', type: 'text' },
    { key: 'frameAssembly',         label: 'Frame Assembly',          width: 'min-w-[120px]', type: 'text' },
    { key: 'frameGauge',            label: 'Frame Guage',             width: 'min-w-[100px]', type: 'text' },
    { key: 'frameFinish',           label: 'Frame Finish',            width: 'min-w-[100px]', type: 'text' },
    { key: 'prehung',               label: 'Prehung',                 width: 'min-w-[90px]',  type: 'text' },
    { key: 'frameHead',             label: 'Frame Head',              width: 'min-w-[100px]', type: 'text' },
    { key: 'casing',                label: 'Casing',                  width: 'min-w-[90px]',  type: 'text' },
    { key: 'frameIncludeExclude',   label: 'Frame Include/Exclude',   width: 'min-w-[150px]', type: 'text' },
    { key: 'providedHardwareSet',   label: 'Hardware Set',            width: 'min-w-[110px]', type: 'text',   isCore: true },
    { key: 'hardwareIncludeExclude',label: 'Hardware Include/Exclude',width: 'min-w-[160px]', type: 'text' },
];

export const DOOR_SECTION_KEYS = new Set([
    'doorMaterial', 'elevationTypeId', 'doorCore', 'doorFace', 'doorEdge',
    'doorGauge', 'doorFinish', 'stcRating', 'undercut', 'doorIncludeExclude',
]);
export const FRAME_SECTION_KEYS = new Set([
    'frameMaterial', 'wallType', 'throatThickness', 'frameAnchor', 'baseAnchor',
    'numberOfAnchors', 'frameProfile', 'frameElevationType', 'frameAssembly',
    'frameGauge', 'frameFinish', 'prehung', 'frameHead', 'casing', 'frameIncludeExclude',
]);
export const HARDWARE_SECTION_KEYS = new Set([
    'providedHardwareSet', 'hardwareIncludeExclude',
]);

interface UseDoorTableStateParams {
    projectId: string;
    doors: Door[];
    onDoorsUpdate: (updater: React.SetStateAction<Door[]>) => void;
    onProvidedSetChange?: (doorId: string, newSetName: string) => void;
    addToast: (toast: Omit<Toast, 'id'>) => void;
    onDeleteDoors?: (doorIds: string[]) => void;
    onAssignAll: () => Promise<void>;
    hardwareSets: HardwareSet[];
    elevationTypes?: ElevationType[];
    onDoorSaved?: () => void;
}

export function useDoorTableState({
    projectId,
    doors,
    onDoorsUpdate,
    onProvidedSetChange,
    addToast,
    onDeleteDoors,
    onAssignAll,
    hardwareSets,
    elevationTypes = [],
    onDoorSaved,
}: UseDoorTableStateParams) {
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [doorMaterialFilter, setDoorMaterialFilter] = useState<string>('all');
    const [frameMaterialFilter, setFrameMaterialFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isAssigningBatch, setIsAssigningBatch] = useState(false);

    const [editingCell, setEditingCell] = useState<{ id: string, field: keyof Door } | null>(null);
    const [tempValue, setTempValue] = useState<string | number>('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Door; direction: 'asc' | 'desc' } | null>(null);

    const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

    const [editModalDoor, setEditModalDoor] = useState<Door | null>(null);
    const [savingDoorId, setSavingDoorId] = useState<string | null>(null);

    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(ALL_AVAILABLE_COLUMNS.filter(c => c.isCore).map(c => c.key)));
    const [columnOrder, setColumnOrder] = useState<string[]>(() => ALL_AVAILABLE_COLUMNS.map(c => c.key));
    const [dragOverKey, setDragOverKey] = useState<string | null>(null);
    const dragSourceKey = useRef<string | null>(null);
    const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
    const [isColumnCustomizerOpen, setIsColumnCustomizerOpen] = useState(false);
    const [newColumnName, setNewColumnName] = useState('');
    const [newColumnType, setNewColumnType] = useState<'text' | 'number'>('text');
    const [columnPrefsLoaded, setColumnPrefsLoaded] = useState(false);

    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const filterMenuRef = useRef<HTMLDivElement>(null);

    const { tasks } = useBackgroundUpload();
    const lastErrorTask = useMemo(() => {
        return [...tasks]
            .filter(t => t.type === 'door-schedule' && (t.status === 'completed' || t.status === 'error'))
            .sort((a, b) => b.createdAt - a.createdAt)[0];
    }, [tasks]);

    const hasUploadErrors = lastErrorTask?.result && ((lastErrorTask.result.errors?.length ?? 0) > 0 || (lastErrorTask.result.warnings?.length ?? 0) > 0);
    const hasRowErrors = doors.some(d => d.status === 'error');

    const validSetNames = useMemo(() => {
        return new Set(hardwareSets.map(s => s.name.trim().toLowerCase()));
    }, [hardwareSets]);

    useEffect(() => {
        if (editingCell && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editingCell]);

    useEffect(() => {
        const defaultVisible = ALL_AVAILABLE_COLUMNS.filter(c => c.isCore).map(c => c.key);
        const defaultOrder = ALL_AVAILABLE_COLUMNS.map(c => c.key);

        if (typeof window === 'undefined') {
            setVisibleColumns(new Set(defaultVisible));
            setColumnOrder(defaultOrder);
            setCustomColumns([]);
            setColumnPrefsLoaded(true);
            return;
        }

        const storageKey = `planckoff-door-columns-${projectId}`;

        try {
            const raw = window.localStorage.getItem(storageKey);
            if (!raw) {
                setVisibleColumns(new Set(defaultVisible));
                setColumnOrder(defaultOrder);
                setCustomColumns([]);
                setColumnPrefsLoaded(true);
                return;
            }

            const parsed = JSON.parse(raw) as Partial<PersistedColumnPrefs>;
            const parsedCustomColumns = Array.isArray(parsed.customColumns) ? parsed.customColumns : [];
            const allowedKeys = new Set([
                ...ALL_AVAILABLE_COLUMNS.map(c => c.key),
                ...parsedCustomColumns.map(c => c.id),
            ]);

            const parsedVisible = Array.isArray(parsed.visibleColumns)
                ? parsed.visibleColumns.filter((key): key is string => typeof key === 'string' && allowedKeys.has(key))
                : defaultVisible;

            const parsedOrder = Array.isArray(parsed.columnOrder)
                ? parsed.columnOrder.filter((key): key is string => typeof key === 'string' && ALL_AVAILABLE_COLUMNS.some(c => c.key === key))
                : defaultOrder;

            const missingStandardKeys = defaultOrder.filter(key => !parsedOrder.includes(key));

            setCustomColumns(parsedCustomColumns);
            setVisibleColumns(new Set(parsedVisible.length > 0 ? parsedVisible : defaultVisible));
            setColumnOrder([...parsedOrder, ...missingStandardKeys]);
        } catch {
            setVisibleColumns(new Set(defaultVisible));
            setColumnOrder(defaultOrder);
            setCustomColumns([]);
        } finally {
            setColumnPrefsLoaded(true);
        }
    }, [projectId]);

    useEffect(() => {
        if (!columnPrefsLoaded || typeof window === 'undefined') return;

        const storageKey = `planckoff-door-columns-${projectId}`;
        const payload: PersistedColumnPrefs = {
            visibleColumns: Array.from(visibleColumns),
            columnOrder,
            customColumns,
        };

        window.localStorage.setItem(storageKey, JSON.stringify(payload));
    }, [projectId, visibleColumns, columnOrder, customColumns, columnPrefsLoaded]);

    useEffect(() => {
        if (!isFilterMenuOpen) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Element;
            if (filterMenuRef.current && !filterMenuRef.current.contains(target)) {
                if (!target.closest?.('[data-radix-popper-content-wrapper]')) {
                    setIsFilterMenuOpen(false);
                }
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isFilterMenuOpen]);

    const statusCounts = useMemo(() => {
        if (!Array.isArray(doors)) return { pending: 0, complete: 0, error: 0 };
        return doors.reduce((acc, door) => {
            acc[door.status] = (acc[door.status] || 0) + 1;
            return acc;
        }, {} as Record<'pending' | 'complete', number>);
    }, [doors]);

    const uniqueDoorMaterials = useMemo(() => {
        if (!Array.isArray(doors)) return [];
        const materials = new Set(doors.map(d => d.doorMaterial).filter(m => m && m !== "Not Selected" && m.trim() !== ""));
        return Array.from(materials).sort();
    }, [doors]);

    const uniqueFrameMaterials = useMemo(() => {
        if (!Array.isArray(doors)) return [];
        const materials = new Set(doors.map(d => d.frameMaterial).filter(m => m && m !== "Not Selected" && m.trim() !== ""));
        return Array.from(materials).sort();
    }, [doors]);

    const handleSort = (key: keyof Door) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const filteredAndSortedDoors = useMemo(() => {
        let result = doors;

        if (statusFilter !== 'all') {
            result = result.filter(door => door.status === statusFilter);
        }

        if (doorMaterialFilter !== 'all') {
            result = result.filter(door => door.doorMaterial === doorMaterialFilter);
        }

        if (frameMaterialFilter !== 'all') {
            result = result.filter(door => door.frameMaterial === frameMaterialFilter);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(d => {
                const standardMatch = Object.entries(d).some(([key, val]) => {
                    if (key === 'customFields' || typeof val === 'object' || val === undefined || val === null) return false;
                    return String(val).toLowerCase().includes(query);
                });
                if (standardMatch) return true;

                if (d.customFields) {
                    return Object.values(d.customFields).some(val => String(val).toLowerCase().includes(query));
                }
                return false;
            });
        }

        if (sortConfig) {
            result = [...result].sort((a, b) => {
                let aVal: any = a[sortConfig.key as keyof Door];
                let bVal: any = b[sortConfig.key as keyof Door];

                if (aVal === undefined && a.customFields) aVal = a.customFields[sortConfig.key as string];
                if (bVal === undefined && b.customFields) bVal = b.customFields[sortConfig.key as string];

                if (aVal === undefined || aVal === null) return 1;
                if (bVal === undefined || bVal === null) return -1;

                if (typeof aVal === 'string' && typeof bVal === 'string') {
                    return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                }

                if (aVal < bVal) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aVal > bVal) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }

        return result;
    }, [doors, statusFilter, doorMaterialFilter, frameMaterialFilter, searchQuery, sortConfig]);

    const handleAssignHardware = (doorId: string): void => {
        const doorToUpdate = doors.find(d => d.id === doorId);
        if (!doorToUpdate) return;

        const provided = doorToUpdate.providedHardwareSet?.trim() ?? '';
        const matchResult = matchHardwareSet(provided, hardwareSets);

        if (matchResult) {
            onDoorsUpdate(currentDoors => currentDoors.map(d =>
                d.id === doorId
                    ? {
                        ...d,
                        status: 'complete',
                        assignedHardwareSet: matchResult.set,
                        assignmentConfidence: matchResult.confidence,
                        assignmentReason: matchResult.reason,
                        errorMessage: undefined,
                    }
                    : d
            ));
        } else {
            onDoorsUpdate(currentDoors => currentDoors.map(d =>
                d.id === doorId
                    ? { ...d, status: 'error', errorMessage: `No hardware set matched "${provided}"` }
                    : d
            ));
        }
    };

    const handleAssignAll = async () => {
        setIsAssigningBatch(true);
        try {
            await onAssignAll();
        } finally {
            setIsAssigningBatch(false);
        }
    };

    const handleAddDoor = () => {
        const newDoor: Door = {
            id: `manual-${Date.now()}`,
            doorTag: 'New Door',
            location: '',
            interiorExterior: 'Interior',
            quantity: 1,
            leafCount: 1,
            operation: 'Swing',
            fireRating: 'N/A',
            width: 36,
            height: 84,
            thickness: 1.75,
            doorMaterial: '',
            frameMaterial: '',
            hardwarePrep: '',
            type: '',
            status: 'pending',
            isManualEntry: true,
        };
        onDoorsUpdate(prev => [...prev, newDoor]);
        setEditModalDoor(newDoor);
    };

    const handleDeleteSelected = () => {
        if (selectedRows.size === 0) return;
        const ids = Array.from(selectedRows);
        if (onDeleteDoors) {
            onDeleteDoors(ids);
        } else {
            onDoorsUpdate(prev => prev.filter(d => !selectedRows.has(d.id)));
        }
        setSelectedRows(new Set());
    };

    const handleDeleteRow = (id: string) => {
        if (onDeleteDoors) {
            onDeleteDoors([id]);
        } else {
            onDoorsUpdate(prev => prev.filter(d => d.id !== id));
        }
        if (selectedRows.has(id)) {
            const newSelected = new Set(selectedRows);
            newSelected.delete(id);
            setSelectedRows(newSelected);
        }
    };

    const toggleSelectAll = () => {
        if (selectedRows.size === filteredAndSortedDoors.length) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(filteredAndSortedDoors.map(d => d.id)));
        }
    };

    const toggleRowSelection = (id: string) => {
        const next = new Set(selectedRows);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedRows(next);
    };

    const startEditing = (door: Door, field: keyof Door) => {
        setEditingCell({ id: door.id, field });
        setTempValue(door[field] as string | number || '');
    };

    const cancelEditing = () => {
        setEditingCell(null);
        setTempValue('');
    };

    const saveEdit = () => {
        if (!editingCell) return;

        if (editingCell.field === 'providedHardwareSet') {
            if (onProvidedSetChange) {
                onProvidedSetChange(editingCell.id, String(tempValue));
            }
            onDoorsUpdate(prev => prev.map(d => {
                if (d.id === editingCell.id) {
                    return { ...d, providedHardwareSet: String(tempValue) };
                }
                return d;
            }));
            setEditingCell(null);
            setTempValue('');
            return;
        }

        onDoorsUpdate(prev => prev.map(d => {
            if (d.id === editingCell.id) {
                let newVal = tempValue;
                const isCustom = editingCell.field.toString().startsWith('custom_');

                if (isCustom || !Object.keys(d).includes(editingCell.field as string)) {
                    const currentCustom = d.customFields || {};
                    return {
                        ...d,
                        customFields: {
                            ...currentCustom,
                            [editingCell.field]: newVal
                        }
                    };
                }

                if (['quantity', 'width', 'height', 'thickness'].includes(editingCell.field as string)) {
                    newVal = parseFloat(newVal as string);
                    if (isNaN(newVal as number)) newVal = 0;
                }

                if (editingCell.field === 'leafCount') {
                    return {
                        ...d,
                        leafCountDisplay: String(tempValue).trim() || undefined,
                        leafCount: (() => {
                            const raw = String(tempValue).trim().toLowerCase();
                            const numeric = parseFloat(String(tempValue));
                            if (!isNaN(numeric)) return numeric;
                            if (['single', 'singles', 'single leaf', '1 leaf'].includes(raw)) return 1;
                            if (['double', 'pair', 'double leaf', '2 leaf', '2 leaves'].includes(raw)) return 2;
                            return d.leafCount;
                        })(),
                    };
                }

                return {
                    ...d,
                    [editingCell.field]: newVal,
                };
            }
            return d;
        }));

        setEditingCell(null);
        setTempValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            saveEdit();
        } else if (e.key === 'Escape') {
            cancelEditing();
        }
    };

    const orderedColumns = useMemo(() => {
        const colMap = new Map(ALL_AVAILABLE_COLUMNS.map(c => [c.key, c]));
        return columnOrder.map(key => colMap.get(key)).filter((c): c is ColumnDef => c !== undefined);
    }, [columnOrder]);

    const handleColDragStart = (e: React.DragEvent<HTMLTableCellElement>, colKey: string) => {
        dragSourceKey.current = colKey;
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleColDragOver = (e: React.DragEvent<HTMLTableCellElement>, colKey: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragSourceKey.current && dragSourceKey.current !== colKey) {
            setDragOverKey(colKey);
        }
    };

    const handleColDrop = (e: React.DragEvent<HTMLTableCellElement>, targetKey: string) => {
        e.preventDefault();
        const sourceKey = dragSourceKey.current;
        if (!sourceKey || sourceKey === targetKey) { setDragOverKey(null); return; }
        setColumnOrder(prev => {
            const next = [...prev];
            const from = next.indexOf(sourceKey);
            const to = next.indexOf(targetKey);
            if (from === -1 || to === -1) return prev;
            next.splice(from, 1);
            next.splice(to, 0, sourceKey);
            return next;
        });
        dragSourceKey.current = null;
        setDragOverKey(null);
    };

    const handleColDragEnd = () => {
        dragSourceKey.current = null;
        setDragOverKey(null);
    };

    const toggleColumn = (key: string) => {
        setVisibleColumns(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const allSelectableColumnKeys = useMemo(
        () => [...ALL_AVAILABLE_COLUMNS.map(col => col.key), ...customColumns.map(col => col.id)],
        [customColumns]
    );

    const areAllColumnsSelected = allSelectableColumnKeys.length > 0
        && allSelectableColumnKeys.every(key => visibleColumns.has(key));

    const toggleAllColumns = () => {
        setVisibleColumns(() => (
            areAllColumnsSelected
                ? new Set()
                : new Set(allSelectableColumnKeys)
        ));
    };

    const addCustomColumn = () => {
        if (!newColumnName.trim()) {
            addToast({ type: 'warning', message: ERRORS.DOORS.COLUMN_NAME_REQUIRED.message });
            return;
        }
        const id = `custom_${Date.now()}`;
        const newCol: CustomColumn = { id, label: newColumnName, type: newColumnType };

        setCustomColumns(prev => [...prev, newCol]);
        setVisibleColumns(prev => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
        setNewColumnName('');
        addToast({ type: 'success', message: `Column "${newColumnName}" added` });
    };

    const removeCustomColumn = (id: string) => {
        setCustomColumns(prev => prev.filter(c => c.id !== id));
        setVisibleColumns(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    };

    const handleDoorSave = async (updatedDoor: Door) => {
        const migratedDoor = migrateDoorData(updatedDoor);

        const prevHwSet = (editModalDoor!.providedHardwareSet ?? '').trim();
        const newHwSet  = (migratedDoor.providedHardwareSet  ?? '').trim();
        const hwSetChanged = prevHwSet !== newHwSet;

        const originalId = editModalDoor!.id;
        onDoorsUpdate(prev => prev.map(d => d.id === originalId ? migratedDoor : d));
        setEditModalDoor(null);
        setSavingDoorId(originalId);

        try {
            if (migratedDoor.isManualEntry) {
                onDoorSaved?.();
            } else if (migratedDoor.sections) {
                try {
                    const body: Record<string, unknown> = {
                        doorTag:  migratedDoor.doorTag,
                        sections: migratedDoor.sections,
                    };
                    if (hwSetChanged) {
                        body.hwSet = newHwSet;
                    }

                    const res = await fetch(`/api/projects/${projectId}/door-schedule`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                    });
                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        console.error('[DoorScheduleManager] Persist failed:', err);
                    } else {
                        onDoorSaved?.();
                    }
                    if (res.ok && hwSetChanged) {
                        fetch(`/api/projects/${projectId}/hardware-merge`, {
                            method: 'POST',
                            credentials: 'include',
                        }).catch(err =>
                            console.error('[DoorScheduleManager] Re-merge failed:', err)
                        );
                    }
                } catch (err) {
                    console.error('[DoorScheduleManager] Persist fetch error:', err);
                }
            }
            addToast({
                type: 'success',
                message: `Door ${migratedDoor.doorTag} updated successfully`
            });
        } finally {
            setSavingDoorId(null);
        }
    };

    const renderCell = (door: Door, colKey: string, type: 'text' | 'number' | 'select' = 'text', options?: string[]) => {
        const isEditing = editingCell?.id === door.id && editingCell?.field === colKey;

        let value: any;
        if (colKey.includes('.')) {
            const parts = colKey.split('.');
            value = door;
            for (const part of parts) {
                value = value?.[part as keyof typeof value];
                if (value === undefined) break;
            }
        } else {
            value = door[colKey as keyof Door];
        }

        if (value === undefined && door.customFields) {
            value = door.customFields[colKey];
        }

        if (isEditing) {
            if (type === 'select' && options) {
                return (
                    <Select
                        value={String(tempValue) || '__none__'}
                        onValueChange={(v) => {
                            const newVal = v === '__none__' ? '' : v;
                            setTempValue(newVal);
                            if (!editingCell) return;
                            onDoorsUpdate(prev => prev.map(d => {
                                if (d.id !== editingCell.id) return d;
                                const isCustom = editingCell.field.toString().startsWith('custom_');
                                if (isCustom || !Object.keys(d).includes(editingCell.field as string)) {
                                    return { ...d, customFields: { ...(d.customFields || {}), [editingCell.field]: newVal } };
                                }
                                return { ...d, [editingCell.field]: newVal };
                            }));
                            setEditingCell(null);
                            setTempValue('');
                        }}
                    >
                        <SelectTrigger className="h-8 w-full text-sm border-2 border-[var(--primary-ring)]">
                            <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__none__">Select...</SelectItem>
                            {options.map(opt => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
            }
            return (
                <input
                    ref={inputRef as any}
                    type={type}
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={handleKeyDown}
                    className="w-full p-1 text-sm border-2 border-[var(--primary-ring)] rounded focus:outline-none shadow-sm"
                    autoFocus
                />
            );
        }

        const isEditable = typeof value !== 'object';

        if (colKey === 'thickness' && door.thicknessDisplay) value = door.thicknessDisplay;
        if (colKey === 'width'     && door.widthDisplay)     value = door.widthDisplay;
        if (colKey === 'height'    && door.heightDisplay)    value = door.heightDisplay;

        if (colKey === 'leafCount') {
            const rawSec = (door.sections as unknown as { door?: Record<string, string | undefined> } | undefined)?.door;
            value = door.leafCountDisplay ?? rawSec?.['LEAF COUNT'] ?? value;
        }

        let displayContent: React.ReactNode;
        if (value !== undefined && value !== null && value !== '') {
            if (typeof value === 'object') {
                displayContent = (value as HardwareSet).name || '[Object]';
            } else if ((colKey === 'width' || colKey === 'height') && typeof value === 'number') {
                displayContent = formatDimension(value);
            } else {
                displayContent = value;
            }
        } else {
            displayContent = <span className="text-[var(--text-faint)] text-xs">—</span>;
        }

        return (
            <div className="p-1 rounded min-h-[24px] flex items-center truncate text-[var(--text-secondary)]">
                {displayContent}
            </div>
        );
    };

    const SortIcon: React.FC<{ columnKey: keyof Door }> = ({ columnKey }) => {
        if (sortConfig?.key !== columnKey) {
            return <ChevronsUpDown className="w-3 h-3 text-[var(--text-faint)] opacity-0 group-hover:opacity-100" />;
        }
        return sortConfig.direction === 'asc'
            ? <ChevronUp className="w-3 h-3 text-[var(--primary-text-muted)]" />
            : <ChevronDown className="w-3 h-3 text-[var(--primary-text-muted)]" />;
    };

    const renderHeader = (col: ColumnDef | CustomColumn) => {
        const colKey = 'key' in col ? col.key : col.id;
        const isVisible = visibleColumns.has(colKey);
        if (!isVisible) return null;

        const label = col.label;
        const widthClass = 'width' in col ? col.width : 'min-w-[100px]';
        const align = 'align' in col ? col.align : 'left';
        const isStdCol = 'key' in col;
        const isDragOver = dragOverKey === colKey;

        return (
            <th
                key={colKey}
                scope="col"
                draggable={isStdCol}
                onDragStart={isStdCol ? (e) => handleColDragStart(e, colKey) : undefined}
                onDragOver={isStdCol ? (e) => handleColDragOver(e, colKey) : undefined}
                onDrop={isStdCol ? (e) => handleColDrop(e, colKey) : undefined}
                onDragEnd={isStdCol ? handleColDragEnd : undefined}
                onClick={() => handleSort(colKey as keyof Door)}
                className={`px-2 py-2.5 border-b border-[var(--primary-border)] ${widthClass} hover:bg-[var(--primary-bg-hover)] group select-none transition-colors
                    ${isStdCol ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
                    ${isDragOver ? 'border-l-2 border-[var(--primary-ring)] bg-[var(--primary-bg-hover)]' : 'border-l border-transparent'}`}
                title={isStdCol ? `Drag to reorder · Click to sort` : `Sort by ${label}`}
            >
                <div className={`flex items-center gap-1 ${align === 'center' ? 'justify-center' : 'justify-start'}`}>
                    {isStdCol && (
                        <GripVertical className="w-3 h-3 text-[var(--primary-border)] opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
                    )}
                    <span className="truncate text-xs font-semibold text-[var(--primary-text)] uppercase tracking-wide">{label}</span>
                    <SortIcon columnKey={colKey as keyof Door} />
                </div>
            </th>
        );
    };

    return {
        statusFilter, setStatusFilter,
        doorMaterialFilter, setDoorMaterialFilter,
        frameMaterialFilter, setFrameMaterialFilter,
        searchQuery, setSearchQuery,
        isAssigningBatch,
        editingCell,
        tempValue,
        sortConfig,
        inputRef,
        editModalDoor, setEditModalDoor,
        savingDoorId,
        visibleColumns, setVisibleColumns,
        columnOrder,
        dragOverKey,
        customColumns,
        isColumnCustomizerOpen, setIsColumnCustomizerOpen,
        newColumnName, setNewColumnName,
        newColumnType, setNewColumnType,
        columnPrefsLoaded,
        selectedRows,
        reportModalOpen, setReportModalOpen,
        isFilterMenuOpen, setIsFilterMenuOpen,
        filterMenuRef,
        lastErrorTask,
        hasUploadErrors,
        hasRowErrors,
        validSetNames,
        statusCounts,
        uniqueDoorMaterials,
        uniqueFrameMaterials,
        filteredAndSortedDoors,
        orderedColumns,
        allSelectableColumnKeys,
        areAllColumnsSelected,
        handleSort,
        handleAssignHardware,
        handleAssignAll,
        handleAddDoor,
        handleDeleteSelected,
        handleDeleteRow,
        toggleSelectAll,
        toggleRowSelection,
        startEditing,
        cancelEditing,
        saveEdit,
        handleKeyDown,
        handleColDragStart,
        handleColDragOver,
        handleColDrop,
        handleColDragEnd,
        toggleColumn,
        toggleAllColumns,
        addCustomColumn,
        removeCustomColumn,
        handleDoorSave,
        renderCell,
        renderHeader,
    };
}
