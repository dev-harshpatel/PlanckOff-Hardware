
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Door, HardwareSet, AppSettings, ElevationType, Toast } from '../types';
import { assignHardwareWithAI } from '../services/geminiService';
import { migrateDoorData } from '../utils/doorDataMigration';
import EnhancedDoorEditModal from './EnhancedDoorEditModal';
import ContextualProgressBar from './ContextualProgressBar';
import { useBackgroundUpload } from '../contexts/BackgroundUploadContext';
import ValidationReportModal from './ValidationReportModal';
import Tooltip from './Tooltip';
import { TableRowSkeleton } from './SkeletonLoader';
import {
    TableCellsIcon,
    MagnifyingGlassIcon,
    ArrowUpTrayIcon,
    ExclamationTriangleIcon,
    PlusIcon,
    TrashIcon,
    AdjustmentsHorizontalIcon,
    XCircleIcon
} from './icons';

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

const DEFAULT_CORE_COLUMNS: ColumnDef[] = [
    { key: 'doorTag', label: 'Tag', width: 'min-w-[80px]', type: 'text', isCore: true },
    { key: 'location', label: 'Location', width: 'min-w-[100px]', type: 'text', isCore: true },
    { key: 'quantity', label: 'Qty', width: 'w-16', type: 'number', align: 'center', isCore: true },
    { key: 'width', label: 'Width (Ft)', width: 'w-24', type: 'number', align: 'center', isCore: true },
    { key: 'height', label: 'Height (Ft)', width: 'w-24', type: 'number', align: 'center', isCore: true },
    { key: 'thickness', label: 'Thk', width: 'w-16', type: 'number', align: 'center', isCore: true },
    { key: 'fireRating', label: 'Rating', width: 'w-24', type: 'text', isCore: true },
    { key: 'doorMaterial', label: 'Door Mat', width: 'min-w-[80px]', type: 'text', isCore: true },
    { key: 'frameMaterial', label: 'Frame Mat', width: 'min-w-[80px]', type: 'text', isCore: true },
    { key: 'hardwarePrep', label: 'HW Prep', width: 'min-w-[120px]', type: 'text', isCore: true },
    { key: 'providedHardwareSet', label: 'Prov. Set', width: 'min-w-[100px]', type: 'text', isCore: true },
];


const EXTENDED_CORE_COLUMNS: ColumnDef[] = [
    { key: 'buildingTag', label: 'Bldg Tag', width: 'min-w-[80px]', type: 'text' },
    { key: 'interiorExterior', label: 'Int/Ext', width: 'w-24', type: 'select', options: ['Interior', 'Exterior'] },
    { key: 'leafCount', label: 'Leaves', width: 'w-16', type: 'number', align: 'center' },
    { key: 'operation', label: 'Op.', width: 'w-20', type: 'text' },

    // Phase 19: Door Handing
    { key: 'handing', label: 'Handing', width: 'min-w-[80px]', type: 'select', options: ['LH', 'RH', 'LHR', 'RHR', 'LHRB', 'RHRB', 'N/A'] },

    // Phase 19: Structured Material Fields
    { key: 'doorCoreType', label: 'Core Type', width: 'min-w-[120px]', type: 'text' },
    { key: 'doorFaceType', label: 'Face Type', width: 'min-w-[120px]', type: 'text' },
    { key: 'doorFaceSpecies', label: 'Species', width: 'min-w-[100px]', type: 'text' },
    { key: 'doorFaceGrade', label: 'Grade', width: 'min-w-[80px]', type: 'select', options: ['Premium', 'Custom', 'Standard', 'Economy'] },

    // Phase 19: Finish System (keeping legacy doorFinish for compatibility)
    { key: 'doorFinish', label: 'Finish (Legacy)', width: 'min-w-[100px]', type: 'text' },
    { key: 'finishSystem.basePrep', label: 'Finish Base', width: 'min-w-[100px]', type: 'text' },
    { key: 'finishSystem.finishType', label: 'Finish Type', width: 'min-w-[100px]', type: 'text' },
    { key: 'finishSystem.manufacturer', label: 'Finish Mfr', width: 'min-w-[100px]', type: 'text' },

    // Phase 19: Enhanced Fire Rating
    { key: 'fireRatingLabel', label: 'Fire Label', width: 'min-w-[80px]', type: 'select', options: ['UL', 'WHI', 'Intertek', 'N/A'] },
    { key: 'undercut', label: 'Undercut', width: 'min-w-[70px]', type: 'number' },

    // Existing fields
    { key: 'stcRating', label: 'STC', width: 'w-16', type: 'text' },
    { key: 'doorFace', label: 'Dr Face (Legacy)', width: 'min-w-[80px]', type: 'text' },

    // Phase 19: Enhanced Frame Fields
    { key: 'frameGauge', label: 'Frm Gauge', width: 'min-w-[80px]', type: 'select', options: ['16 GA', '18 GA', '20 GA', '14 GA', '12 GA', 'N/A'] },
    { key: 'frameProfile', label: 'Frm Profile', width: 'min-w-[120px]', type: 'text' },
    { key: 'frameType', label: 'Frm Type', width: 'min-w-[80px]', type: 'text' },
    { key: 'wallType', label: 'Wall Type', width: 'min-w-[80px]', type: 'text' },
    { key: 'jambDepth', label: 'Jamb Dp', width: 'min-w-[60px]', type: 'text' },

    // Phase 19: Manufacturer Tracking
    { key: 'doorManufacturer', label: 'Dr Mfr', width: 'min-w-[100px]', type: 'text' },
    { key: 'frameManufacturer', label: 'Frm Mfr', width: 'min-w-[100px]', type: 'text' },

    { key: 'elevationTypeId', label: 'Elev Code', width: 'w-20', type: 'text' }, // Treated as text/select special case
];

const ALL_AVAILABLE_COLUMNS = [...DEFAULT_CORE_COLUMNS, ...EXTENDED_CORE_COLUMNS];

interface CustomColumn {
    id: string;
    label: string;
    type: 'text' | 'number';
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
    addToast: (toast: Omit<Toast, 'id'>) => void;
}

type StatusFilter = 'all' | 'pending' | 'complete' | 'error';

const LoadingSpinner: React.FC<{ inButton?: boolean }> = ({ inButton = true }) => {
    const size = inButton ? "h-5 w-5" : "h-8 w-8";
    return (
        <svg className={`animate-spin ${size} ${inButton ? 'text-white' : 'text-primary-600'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    );
};

const ConfidenceIndicator: React.FC<{ confidence?: 'high' | 'medium' | 'low'; reason?: string }> = ({ confidence, reason }) => {
    if (!confidence) return null;

    const config = {
        high: { color: 'bg-green-500', label: 'High Confidence' },
        medium: { color: 'bg-yellow-400', label: 'Medium Confidence' },
        low: { color: 'bg-red-500', label: 'Low Confidence' }
    };

    const { color, label } = config[confidence];
    const tooltipText = `${label}: ${reason || 'No reason provided'}`;

    return (
        <div className="relative group inline-block">
            <span className={`block w-2.5 h-2.5 rounded-full ${color}`}></span>
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max max-w-xs bg-gray-800 text-white text-xs rounded py-1 px-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {tooltipText}
            </div>
        </div>
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
    addToast
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
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(DEFAULT_CORE_COLUMNS.map(c => c.key)));
    const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
    const [isColumnCustomizerOpen, setIsColumnCustomizerOpen] = useState(false);
    const [newColumnName, setNewColumnName] = useState('');
    const [newColumnType, setNewColumnType] = useState<'text' | 'number'>('text');

    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [reportModalOpen, setReportModalOpen] = useState(false);

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

        // ... filters ...
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
            schedule: 'Manual',
            type: '',
            status: 'pending'
        };
        onDoorsUpdate(prev => [...prev, newDoor]);
        // Open enhanced edit modal for new door
        setEditModalDoor(newDoor);
    };

    const handleDeleteSelected = () => {
        if (selectedRows.size === 0) return;

        if (window.confirm(`Are you sure you want to delete ${selectedRows.size} selected doors?`)) {
            onDoorsUpdate(prev => prev.filter(d => !selectedRows.has(d.id)));
            setSelectedRows(new Set());
            addToast({ type: 'success', message: `Deleted ${selectedRows.size} doors.` });
        }
    };

    const handleDeleteRow = (id: string) => {
        if (window.confirm('Are you sure you want to delete this door?')) {
            onDoorsUpdate(prev => prev.filter(d => d.id !== id));
            if (selectedRows.has(id)) {
                const newSelected = new Set(selectedRows);
                newSelected.delete(id);
                setSelectedRows(newSelected);
            }
            addToast({ type: 'success', message: 'Door deleted.' });
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
                const isCustom = editingCell.field.toString().startsWith('custom_'); // Convention or check list

                // Parse numbers if applicable
                // Simplified check: if existing value is number, or column def says number
                // For now, relies on provided state

                // Logic for update
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
                if (['quantity', 'width', 'height', 'thickness', 'leafCount'].includes(editingCell.field as string)) {
                    newVal = parseFloat(newVal as string);
                    if (isNaN(newVal as number)) newVal = 0;
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
    }> = ({ filter, label, count, tooltip }) => (
        <button
            onClick={() => setStatusFilter(filter)}
            title={tooltip}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-2 ${statusFilter === filter
                ? 'bg-primary-600 text-white font-semibold shadow'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
        >
            {label}
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${statusFilter === filter ? 'bg-white text-primary-600' : 'bg-gray-400 text-white'
                }`}>
                {count}
            </span>
        </button>
    );

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
                // ... select render ...
                return (
                    <select
                        ref={inputRef as any}
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={handleKeyDown}
                        className="w-full p-1 text-sm border-2 border-blue-500 rounded focus:outline-none shadow-sm bg-white"
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
                    className="w-full p-1 text-sm border-2 border-blue-500 rounded focus:outline-none shadow-sm"
                    autoFocus
                />
            );
        }

        const isEditable = typeof value !== 'object'; // Simple check

        let displayContent: React.ReactNode;
        if (value !== undefined && value !== null && value !== '') {
            if (typeof value === 'object') {
                // Hardware Set
                displayContent = (value as HardwareSet).name || '[Object]';
            } else if (colKey === 'width' || colKey === 'height') {
                displayContent = formatDimension(value as number);
            } else {
                displayContent = value;
            }
        } else {
            if (colKey === 'width' || colKey === 'height') {
                displayContent = <span className="text-gray-400 text-xs">0'-0"</span>;
            } else {
                displayContent = <span className="text-gray-300 text-xs">-</span>;
            }
        }

        return (
            <div
                onClick={isEditable ? () => startEditing(door, colKey as keyof Door) : undefined}
                onKeyDown={isEditable ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        startEditing(door, colKey as keyof Door);
                    }
                } : undefined}
                tabIndex={isEditable ? 0 : undefined}
                role={isEditable ? 'button' : undefined}
                aria-label={isEditable ? `Edit ${String(colKey)}: ${value || 'Empty'}` : undefined}
                className={`${isEditable ? 'cursor-text hover:bg-gray-100 focus:ring-2 focus:ring-inset focus:ring-primary-500' : 'cursor-default'} p-1 rounded min-h-[24px] flex items-center transition-colors truncate outline-none`}
                title={isEditable ? `Edit ${String(colKey)}` : undefined}
            >
                {displayContent}
            </div>
        );
    };

    const SortIcon: React.FC<{ columnKey: keyof Door }> = ({ columnKey }) => {
        if (sortConfig?.key !== columnKey) {
            return <svg className="w-3 h-3 text-gray-500 opacity-0 group-hover:opacity-100" fill="currentColor" viewBox="0 0 20 20"><path d="M5 10l5-5 5 5H5z" /><path d="M5 14l5 5 5-5H5z" /></svg>;
        }
        return sortConfig.direction === 'asc' ? (
            <svg className="w-3 h-3 text-primary-600" fill="currentColor" viewBox="0 0 20 20"><path d="M5 14l5-5 5 5H5z" /></svg>
        ) : (
            <svg className="w-3 h-3 text-primary-600" fill="currentColor" viewBox="0 0 20 20"><path d="M5 6l5 5 5-5H5z" /></svg>
        );
    };

    const handleElevationChange = (doorId: string, typeId: string) => {
        onDoorsUpdate(prev => prev.map(d => d.id === doorId ? { ...d, elevationTypeId: typeId } : d));
    };

    const renderHeader = (col: ColumnDef | CustomColumn) => {
        const colKey = 'key' in col ? col.key : col.id;
        const isVisible = visibleColumns.has(colKey);
        if (!isVisible) return null;

        const label = col.label;
        const widthClass = 'width' in col ? col.width : 'min-w-[100px]';
        const align = 'align' in col ? col.align : 'left';

        return (
            <th key={colKey} scope="col" className={`px-2 py-3 border-b border-gray-200 ${widthClass} cursor-pointer hover:bg-gray-200 group select-none`} onClick={() => handleSort(colKey as keyof Door)} title={`Sort by ${label}`}>
                <div className={`flex items-center gap-1 ${align === 'center' ? 'justify-center' : 'justify-start'}`}>
                    <span className="truncate">{label}</span>
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
        // Keep modal open
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
        <div className="bg-white rounded-xl shadow-md relative flex flex-col h-full min-h-[600px] overflow-hidden">
            {/* Column Customizer Modal (Simple Overlay) */}
            {isColumnCustomizerOpen && (
                <div className="absolute top-16 right-6 z-50 w-80 bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col max-h-[80%] animate-scaleIn">
                    <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-lg">
                        <h3 className="font-bold text-gray-700">Customize Columns</h3>
                        <button onClick={() => setIsColumnCustomizerOpen(false)} className="text-gray-400 hover:text-gray-600"><XCircleIcon className="w-5 h-5" /></button>
                    </div>
                    <div className="p-3 border-b border-gray-100 bg-gray-50">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="New Column Name"
                                className="flex-1 text-sm p-1.5 border rounded"
                                value={newColumnName}
                                onChange={e => setNewColumnName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addCustomColumn()}
                            />
                            <button onClick={addCustomColumn} type="button" className="bg-primary-600 text-white px-3 text-sm rounded font-medium hover:bg-primary-700">Add</button>
                        </div>
                    </div>
                    <div className="overflow-y-auto p-2 flex-1">
                        <p className="text-xs font-bold text-gray-500 uppercase px-2 py-1">Standard Columns</p>
                        {ALL_AVAILABLE_COLUMNS.map(col => (
                            <label key={col.key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={visibleColumns.has(col.key)}
                                    onChange={() => toggleColumn(col.key)}
                                    className="rounded text-primary-600 focus:ring-primary-500"
                                />
                                <span className="text-sm text-gray-700">{col.label}</span>
                            </label>
                        ))}
                        {customColumns.length > 0 && (
                            <>
                                <p className="text-xs font-bold text-gray-500 uppercase px-2 py-1 mt-2">Custom Columns</p>
                                {customColumns.map(col => (
                                    <div key={col.id} className="flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 rounded">
                                        <label className="flex items-center gap-2 cursor-pointer flex-1">
                                            <input
                                                type="checkbox"
                                                checked={visibleColumns.has(col.id)}
                                                onChange={() => toggleColumn(col.id)}
                                                className="rounded text-primary-600 focus:ring-primary-500"
                                            />
                                            <span className="text-sm text-gray-700">{col.label}</span>
                                        </label>
                                        <button onClick={() => removeCustomColumn(col.id)} className="text-red-400 hover:text-red-600"><TrashIcon className="w-3 h-3" /></button>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            )}

            <ContextualProgressBar type="door-schedule" />

            {/* Enhanced Header with Gradient */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 border-b border-blue-800">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                            <TableCellsIcon className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Door Schedule</h2>
                            <p className="text-blue-100 text-sm mt-0.5">
                                {filteredAndSortedDoors.length} {filteredAndSortedDoors.length === 1 ? 'Door' : 'Doors'} • {statusCounts.complete || 0} Assigned
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {onManageElevations && (
                            <Tooltip content="Manage Elevation Types">
                                <button
                                    onClick={onManageElevations}
                                    className="flex items-center gap-2 px-3 py-2.5 bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white rounded-lg hover:bg-white/20 hover:scale-105 active:scale-95 text-sm font-medium transition-all shadow-lg hover:shadow-xl"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    Manage Elevations
                                </button>
                            </Tooltip>
                        )}
                        <Tooltip content="Upload a new door schedule file (Excel/PDF)">
                            <button
                                onClick={onUploadClick}
                                disabled={isLoading || isAssigningBatch}
                                className="px-4 py-2.5 bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white rounded-lg hover:bg-white/20 hover:scale-105 active:scale-95 text-sm font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait transition-all shadow-lg hover:shadow-xl"
                            >
                                {isLoading ? (
                                    <>
                                        <LoadingSpinner inButton={true} />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <ArrowUpTrayIcon className="w-5 h-5" />
                                        Upload Schedule
                                    </>
                                )}
                            </button>
                        </Tooltip>
                        <Tooltip content="Automatically assign hardware sets to all pending doors">
                            <button
                                onClick={handleAssignAll}
                                disabled={isLoading || isAssigningBatch || filteredAndSortedDoors.length === 0}
                                className="px-4 py-2.5 bg-white text-blue-700 rounded-lg hover:bg-blue-50 hover:scale-105 active:scale-95 text-sm font-semibold disabled:opacity-50 min-w-[140px] transition-all shadow-lg hover:shadow-xl"
                            >
                                {isAssigningBatch ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <LoadingSpinner inButton={false} />
                                        <span>Processing...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center gap-2">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        Assign All AI
                                    </div>
                                )}
                            </button>
                        </Tooltip>
                    </div>
                </div>
            </div>

            {/* Enhanced Toolbar: Filter & Search */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                {/* Status Filter Chips */}
                {/* Status & Actions Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-gray-600 uppercase tracking-wide mr-1">Status:</span>
                        <FilterButton filter="all" label="All" count={doors.length} tooltip="Show all doors" />
                        <FilterButton filter="pending" label="Pending" count={statusCounts.pending || 0} tooltip="Show doors waiting for assignment" />
                        <FilterButton filter="complete" label="Complete" count={statusCounts.complete || 0} tooltip="Show doors with assigned hardware" />
                        <FilterButton filter="error" label="Error" count={statusCounts.error || 0} tooltip="Show doors that failed assignment" />

                        <button
                            onClick={() => setReportModalOpen(true)}
                            disabled={!hasRowErrors && !hasUploadErrors}
                            className={`ml-2 px-3 py-1.5 text-sm rounded-md flex items-center gap-1.5 transition-colors shadow-sm border ${hasRowErrors || hasUploadErrors
                                ? 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200'
                                : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                                }`}
                            title={hasRowErrors || hasUploadErrors ? "View Error Report / Skipped Items" : "No issues found"}
                        >
                            <ExclamationTriangleIcon className="w-4 h-4" />
                            <span className="font-medium">Review Issues</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsColumnCustomizerOpen(!isColumnCustomizerOpen)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-sm font-medium transition-colors shadow-sm ${isColumnCustomizerOpen ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                        >
                            <AdjustmentsHorizontalIcon className="w-4 h-4" />
                            Columns
                        </button>

                        <button
                            onClick={handleAddDoor}
                            disabled={isLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 hover:text-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-medium transition-colors shadow-sm"
                        >
                            <PlusIcon className="w-4 h-4" />
                            Add Door
                        </button>

                        <button
                            onClick={handleDeleteSelected}
                            disabled={isLoading || selectedRows.size === 0}
                            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-sm font-medium transition-colors shadow-sm ${selectedRows.size > 0
                                ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100 focus:ring-red-500'
                                : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed' // Always visible style
                                }`}
                        >
                            <TrashIcon className="w-4 h-4" />
                            Delete {selectedRows.size > 0 ? `(${selectedRows.size})` : ''}
                        </button>
                    </div>
                </div>

                {/* Bottom Row: Advanced Filters and Search */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 w-full">
                    <div className="flex flex-wrap gap-3 w-full lg:w-auto">
                        {/* Door Material Filter */}
                        <div className="relative min-w-[150px] flex-grow lg:flex-grow-0" title="Filter by Door Material">
                            <select
                                value={doorMaterialFilter}
                                onChange={(e) => setDoorMaterialFilter(e.target.value)}
                                className="w-full pl-3 pr-8 py-1.5 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm appearance-none"
                            >
                                <option value="all">All Door Materials</option>
                                {uniqueDoorMaterials.map(mat => (
                                    <option key={mat} value={mat}>{mat}</option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>

                        {/* Frame Material Filter */}
                        <div className="relative min-w-[150px] flex-grow lg:flex-grow-0" title="Filter by Frame Material">
                            <select
                                value={frameMaterialFilter}
                                onChange={(e) => setFrameMaterialFilter(e.target.value)}
                                className="w-full pl-3 pr-8 py-1.5 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm appearance-none"
                            >
                                <option value="all">All Frame Materials</option>
                                {uniqueFrameMaterials.map(mat => (
                                    <option key={mat} value={mat}>{mat}</option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                    </div>

                    <div className="relative w-full lg:w-72" title="Search across all door properties">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search all columns..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="block w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        />
                    </div>
                </div>
            </div>

            <div className="mb-2 text-sm text-gray-500 flex justify-between">
                <span>Showing <strong>{filteredAndSortedDoors.length}</strong> doors</span>
                <span className="text-xs text-gray-400 italic">Click any cell to edit • Enter to save</span>
            </div>

            {/* Main Table */}
            <div className="flex-grow overflow-x-auto border border-gray-200 rounded-md relative bg-white">

                <table className="min-w-full text-sm text-left text-gray-600">
                    <thead className="text-sm text-gray-700 uppercase bg-gray-100 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th scope="col" className="w-10 px-3 py-3 text-left border-b border-gray-200 bg-gray-50">
                                <input
                                    type="checkbox"
                                    onChange={toggleSelectAll}
                                    checked={filteredAndSortedDoors.length > 0 && selectedRows.size === filteredAndSortedDoors.length}
                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4 cursor-pointer"
                                />
                            </th>

                            {/* Dynamic Columns */}
                            {ALL_AVAILABLE_COLUMNS.map(col => renderHeader(col))}
                            {customColumns.map(col => renderHeader(col))}

                            <th scope="col" className="px-3 py-3 border-b border-gray-200 bg-primary-50 text-primary-800 font-semibold min-w-[140px] shadow-inner">Assigned Set</th>
                            <th scope="col" className="px-3 py-3 border-b border-gray-200 text-center min-w-[80px]">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {isLoading && Array.from({ length: 10 }).map((_, i) => (
                            <TableRowSkeleton key={`skeleton-${i}`} columns={17} />
                        ))}
                        {!isLoading && filteredAndSortedDoors.map((door) => {
                            // Determine if this row has a critical data validation issue
                            const providedLower = door.providedHardwareSet?.trim().toLowerCase() || '';
                            // If a set is missing entirely, that's one issue.
                            const isMissingSet = !providedLower;
                            // If a set is provided but doesn't match any known hardware set, that's a critical invalid reference.
                            const isInvalidRef = providedLower && !validSetNames.has(providedLower);

                            // Strict validation: Any unknown reference or missing set flags the row.
                            const isValidationFailure = isMissingSet || isInvalidRef;

                            return (
                                <tr
                                    key={door.id}
                                    className={`transition-colors group cursor-pointer ${isValidationFailure ? 'bg-red-50 hover:bg-red-100 border-l-4 border-red-500' : selectedRows.has(door.id) ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'}`}
                                    onDoubleClick={() => setEditModalDoor(door)}
                                    title="Double-click to edit"
                                >
                                    <td className="px-3 py-3 border-b border-gray-100">
                                        <input
                                            type="checkbox"
                                            checked={selectedRows.has(door.id)}
                                            onChange={() => toggleRowSelection(door.id)}
                                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4 cursor-pointer"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </td>

                                    {/* Dynamic Row Rendering */}
                                    {ALL_AVAILABLE_COLUMNS.map(col => {
                                        if (!visibleColumns.has(col.key)) return null;
                                        // Special Handling for Elevation Type Select
                                        if (col.key === 'elevationTypeId') {
                                            return (
                                                <td key={col.key} className="px-2 py-2 border-b border-gray-100">
                                                    <select
                                                        value={door.elevationTypeId || ''}
                                                        onChange={(e) => handleElevationChange(door.id, e.target.value)}
                                                        className="w-full text-sm p-1 border-transparent bg-transparent hover:border-gray-300 rounded focus:border-primary-500 focus:ring-1 focus:ring-primary-500 cursor-pointer"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <option value="" className="text-gray-400">--</option>
                                                        {elevationTypes.map(t => (
                                                            <option key={t.id} value={t.id}>{t.code}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                            );
                                        }

                                        // Special Handling for Provided Set (Invalid Ref Logic)
                                        if (col.key === 'providedHardwareSet') {
                                            return (
                                                <td key={col.key} className={`px-2 py-2 font-medium border-l border-b border-gray-100 ${isInvalidRef ? 'text-red-700 font-bold' : 'text-gray-700'}`}>
                                                    {renderCell(door, 'providedHardwareSet')}
                                                </td>
                                            );
                                        }

                                        const alignClass = col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left';
                                        const weightClass = col.key === 'doorTag' ? 'font-medium text-gray-900' : '';

                                        return (
                                            <td key={col.key} className={`px-2 py-2 border-b border-gray-100 ${alignClass} ${weightClass}`}>
                                                {renderCell(door, col.key, col.type, col.options)}
                                            </td>
                                        );
                                    })}

                                    {customColumns.map(col => {
                                        if (!visibleColumns.has(col.id)) return null;
                                        return (
                                            <td key={col.id} className="px-2 py-2 border-b border-gray-100">
                                                {renderCell(door, col.id, col.type)}
                                            </td>
                                        );
                                    })}

                                    {/* Assigned Hardware Set Column - Fixed */}

                                    {/* Assigned Hardware Set Column */}
                                    <td className={`px-2 py-2 border-l border-gray-100 text-sm ${door.status === 'error' ? 'bg-red-50' : 'bg-primary-50/30'}`}>
                                        {isInvalidRef ? (
                                            <span className="font-bold text-red-600 italic block flex items-center gap-1" title="Hardware set not found in database">
                                                <ExclamationTriangleIcon className="w-4 h-4" />
                                                Unknown Set
                                            </span>
                                        ) : isMissingSet ? (
                                            <span className="font-bold text-amber-500 italic block" title="No hardware set specified">Missing Set</span>
                                        ) : door.status === 'complete' && door.assignedHardwareSet ? (
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-primary-700 block truncate" title={door.assignedHardwareSet.name}>{renderCell(door, 'assignedHardwareSet')}</span>
                                                <ConfidenceIndicator confidence={door.assignmentConfidence} reason={door.assignmentReason} />
                                            </div>
                                        ) : door.status === 'error' && door.errorMessage ? (
                                            <div className="flex items-center text-red-600" title={door.errorMessage}>
                                                <ExclamationTriangleIcon className="w-4 h-4 mr-1 flex-shrink-0" />
                                                <span className="truncate font-semibold">Error</span>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 italic">Pending...</span>
                                        )}
                                    </td>

                                    <td className="px-2 py-2 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteRow(door.id); }}
                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                title="Delete Door"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleAssignHardware(door.id)}
                                                disabled={door.status === 'loading' || isLoading || isAssigningBatch || isValidationFailure}
                                                title={isValidationFailure ? "Fix Provided Set first" : "Run AI to assign hardware set"}
                                                className={`w-full flex justify-center items-center px-2 py-1 text-xs font-medium text-white rounded shadow-sm transition-all ${door.status === 'loading' ? 'bg-primary-400 cursor-not-allowed' :
                                                    isValidationFailure ? 'bg-gray-300 cursor-not-allowed' :
                                                        door.status === 'complete' ? 'bg-green-500 hover:bg-green-600 opacity-80 hover:opacity-100' :
                                                            door.status === 'error' ? 'bg-red-500 hover:bg-red-600' :
                                                                'bg-primary-600 hover:bg-primary-700'
                                                    } disabled:opacity-50`}
                                            >
                                                {door.status === 'loading' ? <LoadingSpinner inButton /> : door.status === 'complete' ? 'Retry' : 'Assign'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {!isLoading && filteredAndSortedDoors.length === 0 && (
                            <tr>
                                <td colSpan={17} className="py-16">
                                    <div className="flex flex-col items-center justify-center text-center">
                                        {/* Empty State Illustration */}
                                        <div className="mb-6">
                                            <svg className="w-32 h-32 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                            </svg>
                                        </div>

                                        {/* Empty State Message */}
                                        <h3 className="text-xl font-semibold text-gray-700 mb-2">
                                            {searchQuery || statusFilter !== 'all' || doorMaterialFilter !== 'all' || frameMaterialFilter !== 'all'
                                                ? "No Doors Match Your Filters"
                                                : "No Door Schedule Yet"}
                                        </h3>
                                        <p className="text-gray-500 mb-6 max-w-md">
                                            {searchQuery || statusFilter !== 'all' || doorMaterialFilter !== 'all' || frameMaterialFilter !== 'all'
                                                ? "Try adjusting your search query or filters to see more results."
                                                : "Upload a door schedule file to get started with hardware assignment."}
                                        </p>

                                        {/* Call to Action */}
                                        {!searchQuery && statusFilter === 'all' && doorMaterialFilter === 'all' && frameMaterialFilter === 'all' && (
                                            <button
                                                onClick={onUploadClick}
                                                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
                                            >
                                                <ArrowUpTrayIcon className="w-5 h-5" />
                                                Upload Door Schedule
                                            </button>
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
                    report={lastErrorTask.result!} // We check basic existence before
                    fileName={lastErrorTask.file.name}
                />
            )}

            {/* Phase 19: Enhanced Door Edit Modal */}
            {editModalDoor && (
                <EnhancedDoorEditModal
                    door={editModalDoor}
                    onSave={(updatedDoor) => {
                        // Apply migration to auto-populate legacy fields
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
                />
            )}
        </div>
    );
};

export default DoorScheduleManager;
