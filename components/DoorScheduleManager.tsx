
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Door, HardwareSet, AppSettings, ElevationType, Toast } from '../types';
import { assignHardwareWithAI } from '../services/geminiService';
import { migrateDoorData } from '../utils/doorDataMigration';
import EnhancedDoorEditModal from './EnhancedDoorEditModal';
import ContextualProgressBar from './ContextualProgressBar';
import { useBackgroundUpload } from '../contexts/BackgroundUploadContext';
import ValidationReportModal from './ValidationReportModal';
import Tooltip from './Tooltip';
import {
    Table2, Search, Upload, AlertTriangle, Plus, Trash2,
    SlidersHorizontal, X, Loader2, Zap, Layers, ClipboardList,
    ChevronUp, ChevronDown, ChevronsUpDown, CheckCircle2, GripVertical, Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface ActiveUploadTask {
    fileName: string;
    stage: string;
    progress: number;
}

// Column Definition Helper
interface ColumnDef {
    key: string;
    label: string;
    width: string;
    type: 'text' | 'number' | 'select';
    options?: string[];
    align?: 'left' | 'center' | 'right';
    isCore?: boolean;
}

// All columns exactly matching the Excel sheet fields.
// Keys must match Door type properties and xlsxParser headerMappings.
const ALL_AVAILABLE_COLUMNS: ColumnDef[] = [
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

interface CustomColumn {
    id: string;
    label: string;
    type: 'text' | 'number';
}

interface PersistedColumnPrefs {
    visibleColumns: string[];
    columnOrder: string[];
    customColumns: CustomColumn[];
}


interface DoorScheduleManagerProps {
    doors: Door[];
    onDoorsUpdate: (updater: React.SetStateAction<Door[]>) => void;
    hardwareSets: HardwareSet[];
    isLoading: boolean;
    onUploadClick: () => void;
    appSettings: AppSettings;
    onProvidedSetChange?: (doorId: string, newSetName: string) => void;
    elevationTypes?: ElevationType[];
    onManageElevations?: () => void;
    onElevationTypeUpdate?: (updated: ElevationType) => void;
    projectId: string;
    addToast: (toast: Omit<Toast, 'id'>) => void;
    activeTask?: ActiveUploadTask;
    onCancelTask?: () => void;
    canReupload?: boolean;
    onDeleteDoors?: (doorIds: string[]) => void;
}

type StatusFilter = 'all' | 'pending' | 'complete' | 'error';

const ConfidenceIndicator: React.FC<{ confidence?: 'high' | 'medium' | 'low'; reason?: string }> = ({ confidence }) => {
    if (!confidence) return null;

    const config = {
        high: { color: 'bg-green-500' },
        medium: { color: 'bg-yellow-400' },
        low: { color: 'bg-red-500' }
    };

    const { color } = config[confidence];

    return (
        <span className={`block w-2.5 h-2.5 rounded-full ${color}`}></span>
    );
};

// Helper to format inches to Feet-Inches (e.g. 36 -> 3'-0")
const formatDimension = (inches: number): string => {
    if (!inches) return "0'-0\"";
    const feet = Math.floor(inches / 12);
    const remainingInches = inches % 12;
    return `${feet}'-${remainingInches}"`;
};

const DoorScheduleManager: React.FC<DoorScheduleManagerProps> = ({
    doors = [],
    onDoorsUpdate,
    hardwareSets,
    isLoading,
    onUploadClick,
    appSettings,
    onProvidedSetChange,
    elevationTypes = [],
    onManageElevations,
    onElevationTypeUpdate,
    projectId,
    addToast,
    activeTask,
    onCancelTask,
    canReupload = true,
    onDeleteDoors,
}) => {
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [doorMaterialFilter, setDoorMaterialFilter] = useState<string>('all');
    const [frameMaterialFilter, setFrameMaterialFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isAssigningBatch, setIsAssigningBatch] = useState(false);

    // Inline Editing State
    const [editingCell, setEditingCell] = useState<{ id: string, field: keyof Door } | null>(null);
    const [tempValue, setTempValue] = useState<string | number>('');
    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: keyof Door; direction: 'asc' | 'desc' } | null>(null);

    const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

    // Enhanced Edit Modal State (Phase 19)
    const [editModalDoor, setEditModalDoor] = useState<Door | null>(null);

    // Selection State
    // Column Management State
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

    // Background Context for errors
    const { tasks } = useBackgroundUpload();
    // Find last completed door task with error
    const lastErrorTask = useMemo(() => {
        // Sort by time descending
        return [...tasks]
            .filter(t => t.type === 'door-schedule' && (t.status === 'completed' || t.status === 'error'))
            .sort((a, b) => b.createdAt - a.createdAt)[0];
    }, [tasks]);

    const hasUploadErrors = lastErrorTask?.result && ((lastErrorTask.result.errors?.length ?? 0) > 0 || (lastErrorTask.result.warnings?.length ?? 0) > 0);
    const hasRowErrors = doors.some(d => d.status === 'error');

    // Memoized set of valid hardware names for O(1) validation checks during render
    const validSetNames = useMemo(() => {
        return new Set(hardwareSets.map(s => s.name.trim().toLowerCase()));
    }, [hardwareSets]);

    // Focus the input when editing starts
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

    // Close filter menu on outside click
    useEffect(() => {
        if (!isFilterMenuOpen) return;
        const handler = (e: MouseEvent) => {
            if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
                setIsFilterMenuOpen(false);
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
        }, {} as Record<'pending' | 'complete' | 'error', number>);
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

        // Filter by Status
        if (statusFilter !== 'all') {
            result = result.filter(door => door.status === statusFilter);
        }

        // Filter by Door Material
        if (doorMaterialFilter !== 'all') {
            result = result.filter(door => door.doorMaterial === doorMaterialFilter);
        }

        // Filter by Frame Material
        if (frameMaterialFilter !== 'all') {
            result = result.filter(door => door.frameMaterial === frameMaterialFilter);
        }

        // Filter by Search Query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(d => {
                // Check all standard columns
                const standardMatch = Object.entries(d).some(([key, val]) => {
                    if (key === 'customFields' || typeof val === 'object' || val === undefined || val === null) return false;
                    return String(val).toLowerCase().includes(query);
                });
                if (standardMatch) return true;

                // Check custom fields
                if (d.customFields) {
                    return Object.values(d.customFields).some(val => String(val).toLowerCase().includes(query));
                }
                return false;
            });
        }

        // Apply Sorting
        if (sortConfig) {
            result = [...result].sort((a, b) => {
                let aVal: any = a[sortConfig.key as keyof Door];
                let bVal: any = b[sortConfig.key as keyof Door];

                // Check custom fields if not found on main object (simple heuristic)
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

    const handleAssignHardware = async (doorId: string) => {
        const doorToUpdate = doors.find(d => d.id === doorId);
        if (!doorToUpdate) return;

        onDoorsUpdate(currentDoors => currentDoors.map(d => d.id === doorId ? { ...d, status: 'loading' } : d));

        try {
            const { assignedSet, confidence, reason } = await assignHardwareWithAI(doorToUpdate, hardwareSets, appSettings.model);
            onDoorsUpdate(currentDoors => currentDoors.map(d =>
                d.id === doorId
                    ? {
                        ...d,
                        status: 'complete',
                        assignedHardwareSet: assignedSet,
                        assignmentConfidence: confidence,
                        assignmentReason: reason,
                        errorMessage: undefined
                    }
                    : d
            ));
        } catch (error) {
            console.error("AI Assignment Error:", error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            onDoorsUpdate(currentDoors => currentDoors.map(d =>
                d.id === doorId
                    ? { ...d, status: 'error', errorMessage }
                    : d
            ));
        }
    };

    const handleAssignAll = async () => {
        const doorsToProcess = filteredAndSortedDoors.filter(door => {
            const isPendingOrError = door.status === 'pending' || door.status === 'error';
            if (!isPendingOrError) return false;

            // Exclude doors with validation failures that can't be assigned
            const providedLower = door.providedHardwareSet?.trim().toLowerCase() || '';
            const isInvalidRef = providedLower && !validSetNames.has(providedLower);
            const isMissingSet = !providedLower;
            return !(isInvalidRef || isMissingSet);
        });

        if (doorsToProcess.length === 0) return;

        setIsAssigningBatch(true);

        // Reduced Concurrency to 1 to prevent quota limits
        const CONCURRENCY_LIMIT = 1;
        const queue = [...doorsToProcess];

        const worker = async () => {
            while (queue.length > 0) {
                const door = queue.shift();
                if (door) {
                    await handleAssignHardware(door.id);
                    // Throttle requests: Wait 2 seconds between assignments
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        };

        const workers = Array(CONCURRENCY_LIMIT).fill(null).map(worker);
        await Promise.all(workers);

        setIsAssigningBatch(false);
    };

    // Manual Controls
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
            status: 'pending'
        };
        onDoorsUpdate(prev => [...prev, newDoor]);
        // Open enhanced edit modal for new door
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

    // Inline Edit Handlers
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

        // Special handling for Provided Hardware Set to trigger auto-creation/sync
        if (editingCell.field === 'providedHardwareSet') {
            if (onProvidedSetChange) {
                onProvidedSetChange(editingCell.id, String(tempValue));
            }
            // Also update the local door state immediately to reflect UI change,
            // though parent logic will likely overwrite it properly
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

        // Default update for other fields
        onDoorsUpdate(prev => prev.map(d => {
            if (d.id === editingCell.id) {
                let newVal = tempValue;
                const isCustom = editingCell.field.toString().startsWith('custom_');

                if (isCustom || !Object.keys(d).includes(editingCell.field as string)) {
                    // Update custom field
                    const currentCustom = d.customFields || {};
                    return {
                        ...d,
                        customFields: {
                            ...currentCustom,
                            [editingCell.field]: newVal
                        }
                    };
                }

                // Parse numbers for known numeric fields
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

    const FilterButton: React.FC<{
        filter: StatusFilter;
        label: string;
        count: number;
        tooltip: string;
    }> = ({ filter, label, count, tooltip }) => {
        const isActive = statusFilter === filter;
        const edgeRadiusClass =
            filter === 'all'
                ? 'rounded-l-md'
                : filter === 'error'
                    ? 'rounded-r-md'
                    : '';
        const dotColors: Record<StatusFilter, string> = {
            all:      '',
            pending:  'bg-amber-400',
            complete: 'bg-green-500',
            error:    'bg-red-500',
        };
        return (
            <button
                onClick={() => setStatusFilter(filter)}
                title={tooltip}
                className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${edgeRadiusClass} ${isActive ? 'bg-[var(--primary-bg)] text-[var(--primary-text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-subtle)]'}`}
            >
                {filter !== 'all' && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColors[filter]}`} />}
                {label}
                <span className={`text-[10px] font-bold tabular-nums ${isActive ? 'text-[var(--primary-text-muted)]' : 'text-[var(--text-faint)]'}`}>
                    {count}
                </span>
            </button>
        );
    };

    const renderCell = (door: Door, colKey: string, type: 'text' | 'number' | 'select' = 'text', options?: string[]) => {
        const isEditing = editingCell?.id === door.id && editingCell?.field === colKey;

        // Resolve Value - Support nested fields (e.g., finishSystem.basePrep)
        let value: any;
        if (colKey.includes('.')) {
            // Handle nested fields
            const parts = colKey.split('.');
            value = door;
            for (const part of parts) {
                value = value?.[part as keyof typeof value];
                if (value === undefined) break;
            }
        } else {
            value = door[colKey as keyof Door];
        }

        // If undefined in main object, check custom fields
        if (value === undefined && door.customFields) {
            value = door.customFields[colKey];
        }

        if (isEditing) {
            if (type === 'select' && options) {
                return (
                    <select
                        ref={inputRef as any}
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={handleKeyDown}
                        className="w-full p-1 text-sm border-2 border-[var(--primary-ring)] rounded focus:outline-none shadow-sm bg-[var(--bg)]"
                        autoFocus
                    >
                        <option value="">Select...</option>
                        {options.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
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

        // For thickness: prefer the raw string from sections (preserves Excel value like "1 3/4\"")
        // over the parsed numeric door.thickness (which would show "1.75").
        if (colKey === 'thickness') {
            const rawSec = (door.sections as unknown as { door?: Record<string, string | undefined> } | undefined)?.door;
            const rawThick = rawSec?.['THICKNESS'] ?? rawSec?.['DOOR THICKNESS'];
            if (rawThick) value = rawThick;
        }

        if (colKey === 'leafCount') {
            const rawSec = (door.sections as unknown as { door?: Record<string, string | undefined> } | undefined)?.door;
            value = door.leafCountDisplay ?? rawSec?.['LEAF COUNT'] ?? value;
        }

        let displayContent: React.ReactNode;
        if (value !== undefined && value !== null && value !== '') {
            if (typeof value === 'object') {
                displayContent = (value as HardwareSet).name || '[Object]';
            } else if (colKey === 'width' || colKey === 'height') {
                displayContent = formatDimension(value as number);
            } else {
                displayContent = value;
            }
        } else {
            if (colKey === 'width' || colKey === 'height') {
                displayContent = <span className="text-[var(--text-faint)] text-xs">0'-0"</span>;
            } else {
                displayContent = <span className="text-[var(--text-faint)] text-xs">—</span>;
            }
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

    // Columns in current drag order
    const orderedColumns = useMemo(() => {
        const colMap = new Map(ALL_AVAILABLE_COLUMNS.map(c => [c.key, c]));
        return columnOrder.map(key => colMap.get(key)).filter((c): c is ColumnDef => c !== undefined);
    }, [columnOrder]);

    // Drag-to-reorder handlers
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

    // Column Customizer Logic
    const toggleColumn = (key: string) => {
        setVisibleColumns(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const addCustomColumn = () => {
        if (!newColumnName.trim()) {
            addToast({ type: 'warning', message: 'Please enter a column name' });
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

    return (
        <div className="bg-[var(--bg)] rounded-xl shadow-sm border border-[var(--border)] relative flex flex-col h-full">
            {/* Column Customizer Dropdown */}
            {isColumnCustomizerOpen && (
                <div className="absolute top-14 right-4 z-50 w-80 bg-[var(--bg)] rounded-lg shadow-xl border border-[var(--border)] flex flex-col max-h-[480px] animate-scaleIn">
                    <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex justify-between items-center">
                        <h3 className="text-sm font-semibold text-[var(--text)]">Customize Columns</h3>
                        <button onClick={() => setIsColumnCustomizerOpen(false)} className="text-[var(--text-faint)] hover:text-[var(--text-muted)] p-0.5 rounded">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="New column name"
                                className="flex-1 text-sm px-2.5 py-1.5 border border-[var(--border-strong)] rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--primary-ring)]"
                                value={newColumnName}
                                onChange={e => setNewColumnName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addCustomColumn()}
                            />
                            <Button onClick={addCustomColumn} size="sm" className="h-8">Add</Button>
                        </div>
                    </div>
                    <div className="overflow-y-auto p-2 flex-1">
                        <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider px-2 py-1.5">Standard Columns</p>
                        {ALL_AVAILABLE_COLUMNS.map(col => (
                            <label key={col.key} className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-[var(--bg-subtle)] rounded cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={visibleColumns.has(col.key)}
                                    onChange={() => toggleColumn(col.key)}
                                    className="rounded text-[var(--primary-action)] focus:ring-[var(--primary-ring)] w-3.5 h-3.5"
                                />
                                <span className="text-sm text-[var(--text-secondary)]">{col.label}</span>
                            </label>
                        ))}
                        {customColumns.length > 0 && (
                            <>
                                <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider px-2 py-1.5 mt-2">Custom Columns</p>
                                {customColumns.map(col => (
                                    <div key={col.id} className="flex items-center justify-between px-2 py-1.5 hover:bg-[var(--bg-subtle)] rounded">
                                        <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                                            <input
                                                type="checkbox"
                                                checked={visibleColumns.has(col.id)}
                                                onChange={() => toggleColumn(col.id)}
                                                className="rounded text-[var(--primary-action)] focus:ring-[var(--primary-ring)] w-3.5 h-3.5"
                                            />
                                            <span className="text-sm text-[var(--text-secondary)]">{col.label}</span>
                                        </label>
                                        <button
                                            onClick={() => removeCustomColumn(col.id)}
                                            className="text-[var(--text-faint)] hover:text-red-500 p-1 rounded transition-colors"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            )}

            <ContextualProgressBar type="door-schedule" />

            {/* Header */}
            {activeTask ? (
                <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] rounded-t-xl px-5 py-3.5 flex-shrink-0">
                    <div className="flex items-center gap-2 mb-2.5">
                        {activeTask.progress >= 100 ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : (
                            <Loader2 className="w-4 h-4 text-[var(--primary-text-muted)] animate-spin flex-shrink-0" />
                        )}
                        <span className="text-sm font-medium text-[var(--text)] truncate flex-1">{activeTask.fileName}</span>
                        {onCancelTask && activeTask.progress < 100 && (
                            <button
                                onClick={onCancelTask}
                                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-[var(--text-muted)] hover:text-red-500 border border-[var(--border)] hover:border-red-400 rounded-md transition-colors flex-shrink-0"
                            >
                                <X className="w-3 h-3" />
                                Cancel
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-[var(--primary-text-muted)] truncate flex-1">{activeTask.stage}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <Progress value={activeTask.progress} className="w-24 h-1 bg-[var(--primary-bg-hover)]" />
                            <span className="text-[10px] text-[var(--text-faint)] w-7 text-right">{activeTask.progress}%</span>
                        </div>
                    </div>
                </div>
            ) : (
            <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] rounded-t-xl px-5 py-3 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-[var(--primary-bg-hover)] p-2 rounded-lg">
                            <Table2 className="w-4 h-4 text-[var(--primary-text-muted)]" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-[var(--text)]">Door Schedule</h2>
                            <p className="text-[var(--primary-text-muted)] text-xs mt-0.5">
                                {filteredAndSortedDoors.length} {filteredAndSortedDoors.length === 1 ? 'door' : 'doors'} · {statusCounts.complete || 0} assigned
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {onManageElevations && (
                            <Tooltip content="Manage Elevation Types">
                                <button
                                    onClick={onManageElevations}
                                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--primary-text)] hover:bg-[var(--primary-bg-hover)] border border-[var(--primary-border)] rounded-lg transition-colors bg-[var(--bg)]"
                                >
                                    <Layers className="w-3.5 h-3.5" />
                                </button>
                            </Tooltip>
                        )}
                        <Tooltip content={!canReupload ? 'Use "Process Files" to upload your first Excel and PDF together' : 'Upload a new door schedule file (Excel/PDF)'}>
                            <button
                                onClick={canReupload ? onUploadClick : undefined}
                                disabled={isLoading || isAssigningBatch || !canReupload}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] bg-[var(--bg)] hover:bg-[var(--primary-bg-hover)] border border-[var(--primary-border)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <Upload className="w-3.5 h-3.5" />
                                }
                                {isLoading ? 'Processing…' : 'Upload'}
                            </button>
                        </Tooltip>
                        <button
                            onClick={handleAddDoor}
                            disabled={isLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] bg-[var(--bg)] hover:bg-[var(--primary-bg-hover)] border border-[var(--primary-border)] rounded-lg transition-colors disabled:opacity-50"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Add Door
                        </button>
                        <Tooltip content="Automatically assign hardware sets to all pending doors">
                            <button
                                onClick={handleAssignAll}
                                disabled={isLoading || isAssigningBatch || filteredAndSortedDoors.length === 0}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[var(--primary-action)] hover:bg-[var(--primary-action-hover)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isAssigningBatch
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <Zap className="w-3.5 h-3.5" />
                                }
                                {isAssigningBatch ? 'Processing…' : 'Assign All'}
                            </button>
                        </Tooltip>
                    </div>
                </div>
            </div>
            )}

            {/* Compact single-row toolbar */}
            <div className="px-3 py-1.5 bg-[var(--bg)] border-b border-[var(--border-subtle)] flex items-center gap-2 flex-shrink-0">
                {/* Status segmented control */}
                <div className="flex items-center divide-x divide-[var(--border)] border border-[var(--border)] rounded-md overflow-hidden">
                    <FilterButton filter="all" label="All" count={doors.length} tooltip="Show all doors" />
                    <FilterButton filter="pending" label="Pending" count={statusCounts.pending || 0} tooltip="Show doors waiting for assignment" />
                    <FilterButton filter="complete" label="Complete" count={statusCounts.complete || 0} tooltip="Show doors with assigned hardware" />
                    <FilterButton filter="error" label="Error" count={statusCounts.error || 0} tooltip="Show doors that failed assignment" />
                </div>

                <div className="flex-1" />

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-faint)] pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search…"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-44 pl-8 pr-3 py-1.5 border border-[var(--border)] rounded-md bg-[var(--bg)] text-xs placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--primary-ring)] focus:border-[var(--primary-ring)]"
                    />
                </div>

                {/* Filters dropdown */}
                <div className="relative" ref={filterMenuRef}>
                    <button
                        onClick={() => setIsFilterMenuOpen(prev => !prev)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md text-xs font-medium transition-colors ${
                            (doorMaterialFilter !== 'all' || frameMaterialFilter !== 'all')
                                ? 'bg-[var(--primary-bg)] border-[var(--primary-border)] text-[var(--primary-text)]'
                                : isFilterMenuOpen
                                    ? 'bg-[var(--bg-muted)] border-[var(--border-strong)] text-[var(--text-secondary)]'
                                    : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]'
                        }`}
                    >
                        <Filter className="w-3.5 h-3.5" />
                        Filters
                        {(doorMaterialFilter !== 'all' || frameMaterialFilter !== 'all') && (
                            <span className="ml-0.5 bg-[var(--primary-action)] text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                                {(doorMaterialFilter !== 'all' ? 1 : 0) + (frameMaterialFilter !== 'all' ? 1 : 0)}
                            </span>
                        )}
                    </button>
                    {isFilterMenuOpen && (
                        <div className="absolute right-0 top-full mt-1 z-30 bg-[var(--bg)] border border-[var(--border)] rounded-lg shadow-lg p-3 w-56 flex flex-col gap-2.5">
                            <p className="text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-wider">Material Filters</p>
                            <div>
                                <label className="text-[10px] font-medium text-[var(--text-muted)] mb-1 block">Door Material</label>
                                <div className="relative">
                                    <select
                                        value={doorMaterialFilter}
                                        onChange={(e) => setDoorMaterialFilter(e.target.value)}
                                        className="w-full pl-2.5 pr-7 py-1.5 border border-[var(--border)] rounded-md bg-[var(--bg)] text-xs text-[var(--text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary-ring)] appearance-none"
                                    >
                                        <option value="all">All</option>
                                        {uniqueDoorMaterials.map(mat => (
                                            <option key={mat} value={mat}>{mat}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-faint)]" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-medium text-[var(--text-muted)] mb-1 block">Frame Material</label>
                                <div className="relative">
                                    <select
                                        value={frameMaterialFilter}
                                        onChange={(e) => setFrameMaterialFilter(e.target.value)}
                                        className="w-full pl-2.5 pr-7 py-1.5 border border-[var(--border)] rounded-md bg-[var(--bg)] text-xs text-[var(--text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary-ring)] appearance-none"
                                    >
                                        <option value="all">All</option>
                                        {uniqueFrameMaterials.map(mat => (
                                            <option key={mat} value={mat}>{mat}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-faint)]" />
                                </div>
                            </div>
                            {(doorMaterialFilter !== 'all' || frameMaterialFilter !== 'all') && (
                                <button
                                    onClick={() => { setDoorMaterialFilter('all'); setFrameMaterialFilter('all'); }}
                                    className="text-[10px] text-[var(--text-faint)] hover:text-[var(--text-secondary)] underline text-left transition-colors"
                                >
                                    Clear filters
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Columns */}
                <button
                    onClick={() => setIsColumnCustomizerOpen(!isColumnCustomizerOpen)}
                    className={`p-1.5 border rounded-md transition-colors ${isColumnCustomizerOpen ? 'bg-[var(--primary-bg)] border-[var(--primary-border)] text-[var(--primary-text)]' : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-secondary)]'}`}
                    title="Customize columns"
                >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>

                {/* Issues — only when there are issues */}
                {(hasRowErrors || hasUploadErrors) && (
                    <button
                        onClick={() => setReportModalOpen(true)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                        title="View Error Report"
                    >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Issues
                    </button>
                )}

                {/* Delete — only when rows are selected */}
                {selectedRows.size > 0 && (
                    <button
                        onClick={handleDeleteSelected}
                        disabled={isLoading}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete ({selectedRows.size})
                    </button>
                )}
            </div>

            {/* Active filter chips */}
            {(statusFilter !== 'all' || doorMaterialFilter !== 'all' || frameMaterialFilter !== 'all' || searchQuery.trim()) && (
                <div className="px-4 py-2 flex items-center gap-1.5 flex-wrap border-b border-[var(--border-subtle)] bg-[var(--bg)] flex-shrink-0">
                    <span className="text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-wider mr-1">Filters:</span>
                    {statusFilter !== 'all' && (() => {
                        const statusColors: Record<string, string> = {
                            pending: 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100',
                            complete: 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100',
                            error: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30',
                        };
                        return (
                            <button
                                onClick={() => setStatusFilter('all')}
                                className={`flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 text-xs rounded-full transition-colors ${statusColors[statusFilter] ?? 'bg-[var(--bg-muted)] text-[var(--text-secondary)] hover:bg-[var(--bg-emphasis)]'}`}
                            >
                                Status: <span className="font-medium capitalize">{statusFilter}</span>
                                <X className="w-3 h-3 ml-0.5" />
                            </button>
                        );
                    })()}
                    {doorMaterialFilter !== 'all' && (
                        <button
                            onClick={() => setDoorMaterialFilter('all')}
                            className="flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 bg-[var(--primary-bg)] text-[var(--primary-text)] border border-[var(--primary-border)] text-xs rounded-full hover:bg-[var(--primary-bg-hover)] transition-colors"
                        >
                            Door: <span className="font-medium">{doorMaterialFilter}</span>
                            <X className="w-3 h-3 ml-0.5" />
                        </button>
                    )}
                    {frameMaterialFilter !== 'all' && (
                        <button
                            onClick={() => setFrameMaterialFilter('all')}
                            className="flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 bg-[var(--primary-bg)] text-[var(--primary-text)] border border-[var(--primary-border)] text-xs rounded-full hover:bg-[var(--primary-bg-hover)] transition-colors"
                        >
                            Frame: <span className="font-medium">{frameMaterialFilter}</span>
                            <X className="w-3 h-3 ml-0.5" />
                        </button>
                    )}
                    {searchQuery.trim() && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 bg-[var(--primary-bg)] text-[var(--primary-text)] border border-[var(--primary-border)] text-xs rounded-full hover:bg-[var(--primary-bg-hover)] transition-colors"
                        >
                            Search: <span className="font-medium">"{searchQuery}"</span>
                            <X className="w-3 h-3 ml-0.5" />
                        </button>
                    )}
                    <button
                        onClick={() => { setDoorMaterialFilter('all'); setFrameMaterialFilter('all'); setSearchQuery(''); setStatusFilter('all'); }}
                        className="text-[10px] text-[var(--text-faint)] hover:text-[var(--text-secondary)] underline ml-1 transition-colors"
                    >
                        Clear all
                    </button>
                </div>
            )}

            {/* Table info bar */}
            <div className="px-4 py-2 flex justify-between items-center bg-[var(--bg)] border-b border-[var(--border-subtle)] flex-shrink-0">
                <span className="text-xs text-[var(--text-muted)]">
                    Showing <strong className="text-[var(--text-secondary)]">{filteredAndSortedDoors.length}</strong> doors
                </span>
                <span className="text-[10px] text-[var(--text-faint)]">Click any row to open the editor</span>
            </div>

            {/* Main Table */}
            <div className="flex-grow min-h-0 overflow-auto relative bg-[var(--bg)]">
                <table className="min-w-full text-sm text-left text-[var(--text-muted)]">
                    <thead className="text-xs text-[var(--primary-text)] bg-[var(--primary-bg)] sticky top-0 z-10 shadow-[0_1px_0_0_var(--primary-border)]">
                        <tr>
                            <th scope="col" className="w-10 px-3 py-2.5 border-b border-[var(--primary-border)]">
                                <input
                                    type="checkbox"
                                    onChange={toggleSelectAll}
                                    checked={filteredAndSortedDoors.length > 0 && selectedRows.size === filteredAndSortedDoors.length}
                                    className="rounded border-[var(--primary-border)] text-[var(--primary-action)] focus:ring-[var(--primary-ring)] h-3.5 w-3.5 cursor-pointer"
                                />
                            </th>

                            {orderedColumns.map(col => renderHeader(col))}
                            {customColumns.map(col => renderHeader(col))}

                            <th scope="col" className="px-2 py-2.5 border-b border-[var(--primary-border)] bg-[var(--primary-bg-hover)] min-w-[140px]">
                                <span className="text-xs font-semibold text-[var(--primary-text)] uppercase tracking-wide">Assigned Set</span>
                            </th>
                            <th scope="col" className="px-2 py-2.5 border-b border-[var(--primary-border)] text-center min-w-[80px]">
                                <span className="text-xs font-semibold text-[var(--primary-text)] uppercase tracking-wide">Action</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                        {isLoading && Array.from({ length: 10 }).map((_, i) => (
                            <tr key={`skeleton-${i}`} className="border-b border-[var(--border-subtle)]">
                                <td className="px-3 py-3"><Skeleton className="h-3.5 w-3.5 rounded" /></td>
                                {Array.from({ length: 11 }).map((_, j) => (
                                    <td key={j} className="px-2 py-2.5">
                                        <Skeleton className="h-4 w-full rounded" />
                                    </td>
                                ))}
                                <td className="px-2 py-2.5"><Skeleton className="h-5 w-20 rounded" /></td>
                                <td className="px-2 py-2.5 text-center"><Skeleton className="h-6 w-14 rounded mx-auto" /></td>
                            </tr>
                        ))}

                        {!isLoading && filteredAndSortedDoors.map((door) => {
                            const providedLower = door.providedHardwareSet?.trim().toLowerCase() || '';
                            const isMissingSet = !providedLower;
                            const isInvalidRef = providedLower && !validSetNames.has(providedLower);
                            const isValidationFailure = isMissingSet || isInvalidRef;

                            return (
                                <tr
                                    key={door.id}
                                    className={`transition-colors group cursor-pointer ${isValidationFailure
                                        ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 border-l-2 border-red-400 dark:border-red-800'
                                        : selectedRows.has(door.id)
                                            ? 'bg-[var(--primary-bg)] border-l-2 border-[var(--primary-ring)]'
                                            : 'hover:bg-[var(--bg-subtle)] border-l-2 border-transparent'
                                        }`}
                                    onClick={() => setEditModalDoor(door)}
                                    title="Click to edit door"
                                >
                                    <td className="px-3 py-2.5">
                                        <input
                                            type="checkbox"
                                            checked={selectedRows.has(door.id)}
                                            onChange={() => toggleRowSelection(door.id)}
                                            className="rounded border-[var(--border-strong)] text-[var(--primary-action)] focus:ring-[var(--primary-ring)] h-3.5 w-3.5 cursor-pointer"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </td>

                                    {orderedColumns.map(col => {
                                        if (!visibleColumns.has(col.key)) return null;

                                        if (col.key === 'elevationTypeId') {
                                            const rawValue = door.elevationTypeId;
                                            const matchedType = rawValue
                                                ? elevationTypes.find(t =>
                                                    t.id === rawValue || t.code === rawValue || t.name === rawValue,
                                                )
                                                : undefined;
                                            const displayValue = matchedType?.code ?? matchedType?.name ?? rawValue;

                                            return (
                                                <td key={col.key} className="px-2 py-2">
                                                    <div className="p-1 rounded min-h-[24px] flex items-center truncate text-[var(--text-secondary)]">
                                                        {displayValue || <span className="text-[var(--text-faint)] text-xs">—</span>}
                                                    </div>
                                                </td>
                                            );
                                        }

                                        if (col.key === 'providedHardwareSet') {
                                            return (
                                                <td key={col.key} className={`px-2 py-2 font-medium border-l border-[var(--border-subtle)] ${isInvalidRef ? 'text-red-700 font-bold' : 'text-[var(--text-secondary)]'}`}>
                                                    {renderCell(door, 'providedHardwareSet')}
                                                </td>
                                            );
                                        }

                                        const alignClass = col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left';
                                        const weightClass = col.key === 'doorTag' ? 'font-semibold text-[var(--text)]' : '';

                                        return (
                                            <td key={col.key} className={`px-2 py-2 ${alignClass} ${weightClass}`}>
                                                {renderCell(door, col.key, col.type, col.options)}
                                            </td>
                                        );
                                    })}

                                    {customColumns.map(col => {
                                        if (!visibleColumns.has(col.id)) return null;
                                        return (
                                            <td key={col.id} className="px-2 py-2">
                                                {renderCell(door, col.id, col.type)}
                                            </td>
                                        );
                                    })}

                                    {/* Assigned Set column */}
                                    <td className={`px-2 py-2 border-l border-[var(--border-subtle)] ${door.status === 'error' ? 'bg-red-50/50 dark:bg-red-900/10' : 'bg-[var(--primary-bg)]/20'}`}>
                                        {isInvalidRef ? (
                                            <Badge variant="destructive" className="text-[10px] gap-1">
                                                <AlertTriangle className="w-2.5 h-2.5" />
                                                Unknown Set
                                            </Badge>
                                        ) : isMissingSet ? (
                                            <Badge variant="warning" className="text-[10px]">
                                                Missing Set
                                            </Badge>
                                        ) : door.status === 'complete' && door.assignedHardwareSet ? (
                                            <div className="flex items-center justify-between gap-1">
                                                <span className="font-medium text-primary-700 text-xs truncate" title={(door.assignedHardwareSet as unknown as HardwareSet).name}>
                                                    {renderCell(door, 'assignedHardwareSet')}
                                                </span>
                                                <ConfidenceIndicator confidence={door.assignmentConfidence} reason={door.assignmentReason} />
                                            </div>
                                        ) : door.status === 'error' && door.errorMessage ? (
                                            <Badge variant="destructive" className="text-[10px] gap-1" title={door.errorMessage}>
                                                <AlertTriangle className="w-2.5 h-2.5" />
                                                Error
                                            </Badge>
                                        ) : (
                                            <span className="text-[var(--text-faint)] text-xs italic">Pending…</span>
                                        )}
                                    </td>

                                    {/* Action column */}
                                    <td className="px-2 py-2 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteRow(door.id); }}
                                                className="p-1.5 text-[var(--text-faint)] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                title="Delete Door"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleAssignHardware(door.id); }}
                                                disabled={door.status === 'loading' || isLoading || isAssigningBatch || isValidationFailure}
                                                title={isValidationFailure ? "Fix Provided Set first" : "Run AI to assign hardware set"}
                                                className={`flex items-center px-2 py-1 text-[10px] font-semibold text-white rounded transition-all ${door.status === 'loading' ? 'bg-[var(--primary-action)]/60 cursor-not-allowed' :
                                                    isValidationFailure ? 'bg-[var(--bg-emphasis)] cursor-not-allowed text-[var(--text-muted)]' :
                                                        door.status === 'complete' ? 'bg-green-500 hover:bg-green-600' :
                                                            door.status === 'error' ? 'bg-red-500 hover:bg-red-600' :
                                                                'bg-[var(--primary-action)] hover:bg-[var(--primary-action-hover)]'
                                                    } disabled:opacity-50`}
                                            >
                                                {door.status === 'loading'
                                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                                    : door.status === 'complete' ? 'Retry' : 'Assign'
                                                }
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}

                        {!isLoading && filteredAndSortedDoors.length === 0 && (
                            <tr>
                                <td colSpan={17} className="py-20">
                                    <div className="flex flex-col items-center justify-center text-center">
                                        <ClipboardList className="w-14 h-14 text-[var(--text-faint)] mb-4" />
                                        <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-1">
                                            {searchQuery || statusFilter !== 'all' || doorMaterialFilter !== 'all' || frameMaterialFilter !== 'all'
                                                ? "No Doors Match Your Filters"
                                                : "No Door Schedule Yet"}
                                        </h3>
                                        <p className="text-xs text-[var(--text-faint)] mb-5 max-w-xs">
                                            {searchQuery || statusFilter !== 'all' || doorMaterialFilter !== 'all' || frameMaterialFilter !== 'all'
                                                ? "Try adjusting your search query or filters to see more results."
                                                : "Upload a door schedule file to get started with hardware assignment."}
                                        </p>
                                        {!searchQuery && statusFilter === 'all' && doorMaterialFilter === 'all' && frameMaterialFilter === 'all' && (
                                            <Button
                                                onClick={canReupload ? onUploadClick : undefined}
                                                disabled={!canReupload}
                                                title={!canReupload ? 'Use "Process Files" to upload your first Excel and PDF together' : undefined}
                                                size="sm"
                                            >
                                                <Upload className="w-3.5 h-3.5 mr-1.5" />
                                                Upload Door Schedule
                                            </Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {hasUploadErrors && lastErrorTask && (
                <ValidationReportModal
                    isOpen={reportModalOpen}
                    onClose={() => setReportModalOpen(false)}
                    report={lastErrorTask.result!}
                    fileName={lastErrorTask.file.name}
                />
            )}

            {editModalDoor && (
                <EnhancedDoorEditModal
                    door={editModalDoor}
                    onSave={(updatedDoor) => {
                        const migratedDoor = migrateDoorData(updatedDoor);
                        onDoorsUpdate(prev => prev.map(d => d.id === migratedDoor.id ? migratedDoor : d));
                        setEditModalDoor(null);
                        addToast({
                            type: 'success',
                            message: `Door ${migratedDoor.doorTag} updated successfully`
                        });
                    }}
                    onCancel={() => setEditModalDoor(null)}
                    hardwareSets={hardwareSets}
                    elevationTypes={elevationTypes}
                    projectId={projectId}
                    onElevationTypeUpdate={onElevationTypeUpdate ?? (() => {})}
                />
            )}
        </div>
    );
};

export default DoorScheduleManager;
