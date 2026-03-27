

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { HardwareSet, Door, HardwareItem } from '../types';
import HardwareSetModal from './HardwareSetModal';
import UploadConfirmationModal from './UploadConfirmationModal';
import Tooltip from './Tooltip';
import { TableRowSkeleton } from './SkeletonLoader';
import { useAnnounce } from '../contexts/AnnouncementContext';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import {
    Squares2X2Icon,
    ExclamationTriangleIcon,
    MagnifyingGlassIcon,
    PencilSquareIcon,
    TrashIcon,
    ChevronRightIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    DocumentDuplicateIcon,
    ArrowUpTrayIcon,
    ExclamationCircleIcon,
    XCircleIcon
} from './icons';
import ContextualProgressBar from './ContextualProgressBar';

interface HardwareSetsManagerProps {
    hardwareSets: HardwareSet[];
    doors: Door[];
    isLoading: boolean;
    onProcessUploads: (files: File[], mode: 'add' | 'overwrite') => void;
    onSaveSet: (set: HardwareSet) => void;
    onDeleteSet: (setId: string) => void;
    onBulkDeleteSets: (setIds: Set<string>) => void;
    onCreateVariant: (newSet: HardwareSet, doorIds: string[]) => void;
}

const LoadingSpinner: React.FC<{ inButton?: boolean }> = ({ inButton = true }) => {
    const size = inButton ? "h-5 w-5" : "h-8 w-8";
    return (
        <svg className={`animate-spin ${size} ${inButton ? 'text-white' : 'text-primary-600'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    );
};

// Helper to format inches to Feet-Inches (e.g. 36 -> 3'-0")
const formatDimension = (inches: number): string => {
    if (!inches) return "0'-0\"";
    const feet = Math.floor(inches / 12);
    const remainingInches = inches % 12;
    return `${feet}'-${remainingInches}"`;
};

const HardwareSetsManager: React.FC<HardwareSetsManagerProps> = (props) => {
    const { hardwareSets, doors = [], isLoading, onProcessUploads, onSaveSet, onDeleteSet, onBulkDeleteSets, onCreateVariant } = props;

    // ... (lines 53-68 omitted for brevity, keeping existing state) ...
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [setToEdit, setSetToEdit] = useState<HardwareSet | null>(null);
    const [variantSource, setVariantSource] = useState<HardwareSet | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [selectedDoors, setSelectedDoors] = useState<Record<string, Set<string>>>({});
    const [variantMode, setVariantMode] = useState<'all' | 'selection' | null>(null);
    const [activeTab, setActiveTab] = useState<Record<string, 'components' | 'doors' | 'details'>>({});

    const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'doors' | 'items'; direction: 'asc' | 'desc' } | null>(null);

    const announce = useAnnounce();

    // Derived state for door counts per set
    const doorCounts = useMemo(() => {
        const counts = new Map<string, number>();
        if (Array.isArray(doors)) {
            doors.forEach(door => {
                if (door.assignedHardwareSet?.id) {
                    counts.set(door.assignedHardwareSet.id, (counts.get(door.assignedHardwareSet.id) || 0) + 1);
                }
            });
        }
        return counts;
    }, [doors]);

    const filteredAndSortedSets = useMemo(() => {
        let result = hardwareSets.filter(set =>
            set.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            set.description.toLowerCase().includes(searchQuery.toLowerCase())
        );

        if (sortConfig) {
            result = [...result].sort((a, b) => {
                if (sortConfig.key === 'name') {
                    return sortConfig.direction === 'asc'
                        ? a.name.localeCompare(b.name)
                        : b.name.localeCompare(a.name);
                } else if (sortConfig.key === 'doors') {
                    const countA = doorCounts.get(a.id) || 0;
                    const countB = doorCounts.get(b.id) || 0;
                    return sortConfig.direction === 'asc' ? countA - countB : countB - countA;
                } else if (sortConfig.key === 'items') {
                    const countA = a.items.length;
                    const countB = b.items.length;
                    return sortConfig.direction === 'asc' ? countA - countB : countB - countA;
                }
                return 0;
            });
        }

        return result;
    }, [hardwareSets, searchQuery, sortConfig, doorCounts]);

    useEffect(() => {
        const handler = setTimeout(() => {
            if (searchQuery) {
                announce(`Found ${filteredAndSortedSets.length} hardware sets matching "${searchQuery}"`, 'polite');
            }
        }, 1000);
        return () => clearTimeout(handler);
    }, [searchQuery, filteredAndSortedSets.length, announce]);

    const handleSort = (key: 'name' | 'doors' | 'items') => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const SortIcon: React.FC<{ columnKey: 'name' | 'doors' | 'items' }> = ({ columnKey }) => {
        if (sortConfig?.key !== columnKey) {
            return <div className="w-4 h-4 ml-1 inline-block opacity-0 group-hover:opacity-30"><ChevronDownIcon className="w-4 h-4" /></div>;
        }
        return sortConfig.direction === 'asc' ? (
            <ChevronUpIcon className="w-4 h-4 ml-1 inline-block text-primary-600" />
        ) : (
            <ChevronDownIcon className="w-4 h-4 ml-1 inline-block text-primary-600" />
        );
    };

    const handleFileSelect = (files: FileList | null) => {
        if (files && files.length > 0) {
            setSelectedFiles(Array.from(files));
            setIsConfirmModalOpen(true);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
        if (isLoading) return;
        handleFileSelect(e.dataTransfer.files);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isLoading) setIsDraggingOver(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
    };

    const handleConfirmUpload = (mode: 'add' | 'overwrite') => {
        onProcessUploads(selectedFiles, mode);
        setIsConfirmModalOpen(false);
        setSelectedFiles([]);
    };

    const handleCreateNew = () => {
        setSetToEdit(null);
        setVariantSource(null);
        setIsModalOpen(true);
    };

    const handleEdit = (set: HardwareSet) => {
        setSetToEdit(set);
        setVariantSource(null);
        setIsModalOpen(true);
    };

    const handleCreateVariant = (sourceSet: HardwareSet) => {
        setVariantSource(sourceSet);
        setVariantMode('all');
        setSetToEdit(null);
        setIsModalOpen(true);
    };

    const handleCreateVariantFromSelection = (sourceSet: HardwareSet) => {
        if (!selectedDoors[sourceSet.id] || selectedDoors[sourceSet.id].size === 0) {
            return; // Should be prevented by button state
        }
        setVariantSource(sourceSet);
        setVariantMode('selection');
        setSetToEdit(null);
        setIsModalOpen(true);
    };

    const handleSaveAndClose = (set: HardwareSet) => {
        if (variantSource && variantMode) {
            let doorIdsToReassign: string[] = [];
            if (variantMode === 'selection') {
                doorIdsToReassign = Array.from(selectedDoors[variantSource.id] || []);
            } else { // mode === 'all'
                doorIdsToReassign = doors
                    .filter(d => d.assignedHardwareSet?.id === variantSource.id)
                    .map(d => d.id);
            }
            if (doorIdsToReassign.length > 0) {
                onCreateVariant(set, doorIdsToReassign);
            } else {
                onSaveSet(set); // Just create the variant without reassignment if no doors are linked
            }
            // Clear selection after use
            setSelectedDoors(prev => ({ ...prev, [variantSource.id]: new Set() }));
        } else {
            onSaveSet(set);
        }
        setIsModalOpen(false);
        setVariantMode(null);
        setVariantSource(null);
    };

    const toggleRow = (id: string) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const toggleAll = (expand: boolean) => {
        if (expand) {
            setExpandedRows(new Set(filteredAndSortedSets.map(s => s.id)));
        } else {
            setExpandedRows(new Set());
        }
    };

    const toggleSelectRow = (id: string) => {
        setSelectedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedRows(new Set(filteredAndSortedSets.map(s => s.id)));
        } else {
            setSelectedRows(new Set());
        }
    };

    const handleBulkDelete = () => {
        if (selectedRows.size > 0 && confirm(`Are you sure you want to delete ${selectedRows.size} hardware sets? This action cannot be undone.`)) {
            onBulkDeleteSets(selectedRows);
            setSelectedRows(new Set());
        }
    };

    const handleToggleDoorSelection = (setId: string, doorId: string) => {
        setSelectedDoors(prev => {
            const newSelections = { ...prev };
            const setSelection = new Set(newSelections[setId] || []);
            if (setSelection.has(doorId)) {
                setSelection.delete(doorId);
            } else {
                setSelection.add(doorId);
            }
            newSelections[setId] = setSelection;
            return newSelections;
        });
    };

    const handleToggleAllDoorsInSection = (setId: string, doorsInSection: Door[], select: boolean) => {
        setSelectedDoors(prev => {
            const newSelections = { ...prev };
            if (select) {
                newSelections[setId] = new Set(doorsInSection.map(d => d.id));
            } else {
                newSelections[setId] = new Set();
            }
            return newSelections;
        });
    };

    const isAllSelected = selectedRows.size > 0 && selectedRows.size === filteredAndSortedSets.length;
    const isIndeterminate = selectedRows.size > 0 && selectedRows.size < filteredAndSortedSets.length;

    // --- CONFLICT DETECTION LOGIC ---
    const getDoorConflicts = (set: HardwareSet, door: Door): Partial<Record<keyof Door | 'general', string>> => {
        const conflicts: Partial<Record<keyof Door | 'general', string>> = {};

        // --- 1. Fire Rating Logic ---
        // Check set for fire rating indicators
        const setDesc = set.description.toLowerCase();
        const setItemsText = set.items.map(i => (i.name + i.description).toLowerCase()).join(' ');

        const isSetFireRated =
            setDesc.includes('fire') || setDesc.includes('rated') ||
            setItemsText.includes('fire') || setItemsText.includes('rated') || setItemsText.includes('label');

        const doorRating = door.fireRating ? door.fireRating.toLowerCase().trim() : 'n/a';
        const isDoorRated = doorRating !== 'n/a' && doorRating !== '' && doorRating !== 'non-rated';

        // Critical: Rated door with non-rated set
        if (isDoorRated && !isSetFireRated) {
            conflicts.fireRating = `CRITICAL: Door is rated (${door.fireRating}), but hardware set is NOT fire-rated.`;
        }
        // Warning: Non-rated door with rated set
        if (!isDoorRated && isSetFireRated) {
            conflicts.fireRating = `WARNING: Non-rated door assigned to fire-rated set (Over-spec).`;
        }

        // --- 2. Hinge Logic (Height check) ---
        // Filter for hinges, excluding continuous hinges which don't follow the 3/4 rule by count
        const hingeItems = set.items.filter(item => {
            const name = item.name.toLowerCase();
            const desc = item.description.toLowerCase();
            const isHinge = name.includes('hinge') || desc.includes('hinge') || name.includes('butt') || desc.includes('butt');
            const isContinuous = name.includes('continuous') || desc.includes('continuous');
            return isHinge && !isContinuous;
        });

        if (hingeItems.length > 0) {
            const totalHinges = hingeItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

            // Rule: >90 inches needs 4 hinges.
            if (door.height > 90 && totalHinges < 4) {
                conflicts.height = `CRITICAL: Door height ${formatDimension(door.height)} (> 90") usually requires 4 hinges, set has ${totalHinges}.`;
            }
        }

        // --- 3. Material Compatibility Logic ---
        const doorMat = (door.doorMaterial || '').toLowerCase();

        // Heuristic: Set specifies "Wood Door" but door is Metal
        if (setDesc.includes('wood door') && (doorMat.includes('hollow') || doorMat.includes('metal') || doorMat.includes('alum') || doorMat.includes('steel'))) {
            conflicts.doorMaterial = `CONFLICT: Set specified for 'Wood Door', applied to '${door.doorMaterial}'.`;
        }
        // Heuristic: Set specifies Metal/Aluminum but door is Wood
        if ((setDesc.includes('aluminum door') || setDesc.includes('metal door') || setDesc.includes('steel door')) && doorMat.includes('wood')) {
            conflicts.doorMaterial = `CONFLICT: Set specified for Metal/Aluminum, applied to '${door.doorMaterial}'.`;
        }

        return conflicts;
    };

    const renderConflictIcon = (message: string, isCritical: boolean) => {
        if (isCritical) {
            return <ExclamationCircleIcon className="w-3 h-3 text-red-600 inline-block ml-1" />;
        }
        return <ExclamationTriangleIcon className="w-3 h-3 text-amber-500 inline-block ml-1" />;
    };

    return (
        <div
            className={`bg-white rounded-xl shadow-md relative flex flex-col h-full min-h-[600px] transition-all duration-300 overflow-hidden ${isDraggingOver ? 'ring-4 ring-primary-400 ring-offset-2' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
        >
            <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
                accept=".pdf,.csv,.xlsx,.xls,.docx,.txt"
                multiple
            />
            {isDraggingOver && (
                <div className="absolute inset-0 bg-primary-50 bg-opacity-90 flex flex-col items-center justify-center z-20 pointer-events-none rounded-xl backdrop-blur-sm">
                    <ArrowUpTrayIcon className="w-20 h-20 text-primary-500 animate-bounce" />
                    <p className="mt-4 text-2xl font-bold text-primary-700">Drop files here</p>
                    <p className="text-sm text-primary-600 mt-1">PDF, Excel, Word supported</p>
                </div>
            )}

            <ContextualProgressBar type="hardware-set" />

            {/* Enhanced Header with Gradient */}
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-5 border-b border-primary-800">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                            <Squares2X2Icon className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Hardware Sets</h2>
                            <p className="text-primary-100 text-sm mt-0.5">
                                {filteredAndSortedSets.length} {filteredAndSortedSets.length === 1 ? 'Set' : 'Sets'} • {filteredAndSortedSets.reduce((sum, set) => sum + set.items.length, 0)} Total Items
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                            className="px-4 py-2.5 bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white rounded-lg hover:bg-white/20 text-sm font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait transition-all shadow-lg hover:shadow-xl"
                        >
                            {isLoading ? (
                                <>
                                    <LoadingSpinner inButton={true} />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <ArrowUpTrayIcon className="w-5 h-5" />
                                    Upload File
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleCreateNew}
                            className="px-4 py-2.5 bg-white text-primary-700 rounded-lg hover:bg-primary-50 text-sm font-semibold flex items-center gap-2 transition-all shadow-lg hover:shadow-xl"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Create New
                        </button>
                    </div>
                </div>
            </div>

            {/* Search and Controls */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center justify-between gap-4">
                    <div className="relative flex-grow max-w-md">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search sets by name or description..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="block w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all shadow-sm hover:shadow"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-sm text-gray-600">
                            <button onClick={() => toggleAll(true)} className="font-semibold text-primary-600 hover:text-primary-700 hover:underline transition-colors">Expand All</button>
                            <span className="mx-2 text-gray-300">•</span>
                            <button onClick={() => toggleAll(false)} className="font-semibold text-primary-600 hover:text-primary-700 hover:underline transition-colors">Collapse All</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Enhanced Bulk Selection Banner */}
            {selectedRows.size > 0 && (
                <div className="mx-6 mt-4 bg-gradient-to-r from-primary-50 to-blue-50 border-2 border-primary-200 rounded-lg p-3 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2">
                        <div className="bg-primary-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">
                            {selectedRows.size}
                        </div>
                        <span className="text-sm font-semibold text-primary-900">
                            {selectedRows.size} {selectedRows.size === 1 ? 'set' : 'sets'} selected
                        </span>
                    </div>
                    <button
                        onClick={handleBulkDelete}
                        className="flex items-center gap-2 px-3 py-1.5 text-red-600 hover:text-white hover:bg-red-600 rounded-lg transition-all font-medium text-sm border border-red-300 hover:border-red-600"
                        title="Delete Selected Sets"
                    >
                        <TrashIcon className="w-4 h-4" />
                        Delete Selected
                    </button>
                </div>
            )}

            {/* Enhanced Table Container */}
            <div className="flex-grow overflow-hidden mx-6 mb-6 mt-4 rounded-lg border border-gray-200 shadow-sm">
                <div className="h-full overflow-y-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100 sticky top-0 z-10 shadow-sm">
                            <tr className="border-b-2 border-gray-200">
                                <th className="p-3 w-10 text-center">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                        ref={el => { if (el) { el.indeterminate = isIndeterminate; } }}
                                        checked={isAllSelected}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th
                                    className="p-3 cursor-pointer hover:bg-gray-200 group select-none font-semibold text-gray-700 transition-colors"
                                    onClick={() => handleSort('name')}
                                >
                                    <div className="flex items-center">
                                        Set Name
                                        <SortIcon columnKey="name" />
                                    </div>
                                </th>
                                <th
                                    className="p-3 text-center cursor-pointer hover:bg-gray-200 group select-none font-semibold text-gray-700 transition-colors"
                                    onClick={() => handleSort('doors')}
                                >
                                    <div className="flex items-center justify-center">
                                        Doors
                                        <SortIcon columnKey="doors" />
                                    </div>
                                </th>
                                <th
                                    className="p-3 text-center cursor-pointer hover:bg-gray-200 group select-none font-semibold text-gray-700 transition-colors"
                                    onClick={() => handleSort('items')}
                                >
                                    <div className="flex items-center justify-center">
                                        Items
                                        <SortIcon columnKey="items" />
                                    </div>
                                </th>
                                <th className="p-3 text-right font-semibold text-gray-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && Array.from({ length: 6 }).map((_, i) => (
                                <TableRowSkeleton key={`skeleton-${i}`} columns={5} />
                            ))}
                            {!isLoading && filteredAndSortedSets.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-16">
                                        <div className="flex flex-col items-center justify-center text-center">
                                            {/* Empty State Illustration */}
                                            <div className="mb-6">
                                                <svg className="w-32 h-32 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                                </svg>
                                            </div>

                                            {/* Empty State Message */}
                                            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Hardware Sets Yet</h3>
                                            <p className="text-gray-500 mb-6 max-w-md">
                                                {searchQuery
                                                    ? "No hardware sets match your current search. Try adjusting your search query."
                                                    : "Get started by uploading a hardware set file or creating a new set manually."}
                                            </p>

                                            {/* Call to Action */}
                                            {!searchQuery && (
                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
                                                    >
                                                        <ArrowUpTrayIcon className="w-5 h-5" />
                                                        Upload Hardware Set
                                                    </button>
                                                    <button
                                                        onClick={handleCreateNew}
                                                        className="px-6 py-3 bg-white border-2 border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 font-semibold flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
                                                    >
                                                        <Squares2X2Icon className="w-5 h-5" />
                                                        Create New Set
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {!isLoading && filteredAndSortedSets.map(set => {
                                const isExpanded = expandedRows.has(set.id);
                                const doorCount = doorCounts.get(set.id) || 0;
                                const hasZeroQtyItem = set.items.some(item => !item.quantity || item.quantity <= 0);
                                const assignedDoors = doors.filter(d => d.assignedHardwareSet?.id === set.id);
                                const currentDoorSelection = selectedDoors[set.id] || new Set();
                                const isUnavailable = set.isAvailable === false;

                                const hasAnyConflicts = assignedDoors.some(d => Object.keys(getDoorConflicts(set, d)).length > 0);

                                // Conditional Styling based on isAvailable
                                const rowClasses = isUnavailable
                                    ? `border-b border-l-4 border-l-red-500 bg-red-50 ${selectedRows.has(set.id) ? 'bg-red-100' : 'hover:bg-red-100'} transition-colors duration-200`
                                    : `border-b ${selectedRows.has(set.id) ? 'bg-primary-50' : 'hover:bg-gray-50'} transition-colors duration-200`;

                                return (
                                    <React.Fragment key={set.id}>
                                        <tr className={rowClasses}>
                                            <td className="p-3 text-center"><input type="checkbox" className="rounded" checked={selectedRows.has(set.id)} onChange={() => toggleSelectRow(set.id)} /></td>
                                            <td className="p-3 font-semibold text-gray-800 flex items-center">
                                                <button onClick={() => toggleRow(set.id)} className="mr-2">
                                                    {isExpanded ? <ChevronDownIcon className="w-4 h-4 text-gray-500" /> : <ChevronRightIcon className="w-4 h-4 text-gray-500" />}
                                                </button>
                                                <span className={isUnavailable ? 'text-red-700 line-through decoration-red-500/50 decoration-2' : ''}>{set.name}</span>

                                                {isUnavailable && (
                                                    <span className="ml-2 px-2 py-0.5 text-xs font-bold uppercase bg-red-100 text-red-600 rounded border border-red-200">
                                                        Unavailable
                                                    </span>
                                                )}

                                                {hasZeroQtyItem && (
                                                    <div className="relative group ml-2">
                                                        <ExclamationTriangleIcon className="w-4 h-4 text-amber-500" />
                                                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 w-max max-w-xs bg-gray-800 text-white text-xs rounded py-1 px-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                            Warning: Set contains items with zero quantity.
                                                        </div>
                                                    </div>
                                                )}
                                                {hasAnyConflicts && (
                                                    <div className="relative group ml-2">
                                                        <ExclamationCircleIcon className="w-4 h-4 text-red-500" />
                                                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 w-max max-w-xs bg-gray-800 text-white text-xs rounded py-1 px-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                            Conflict detected: One or more assigned doors have mismatching specifications. Expand to view.
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3 text-center">{doorCount}</td>
                                            <td className="p-3 text-center">{set.items.length}</td>
                                            <td className="p-3 text-right">
                                                <div className="flex items-center justify-end gap-2 text-gray-500">
                                                    <Tooltip content="Create Variant (Reassigns All Doors)" shortcut="Ctrl+D">
                                                        <button onClick={() => handleCreateVariant(set)} aria-label="Create Variant" className="p-1.5 hover:bg-gray-200 hover:text-primary-600 hover:scale-110 active:scale-95 rounded-full transition-smooth">
                                                            <DocumentDuplicateIcon className="w-5 h-5" />
                                                        </button>
                                                    </Tooltip>
                                                    <Tooltip content="Edit Hardware Set" shortcut="Ctrl+E">
                                                        <button onClick={() => handleEdit(set)} aria-label={`Edit ${set.name}`} className="p-1.5 hover:bg-gray-200 hover:text-primary-600 hover:scale-110 active:scale-95 rounded-full transition-smooth">
                                                            <PencilSquareIcon className="w-5 h-5" />
                                                        </button>
                                                    </Tooltip>
                                                    <Tooltip content="Delete Hardware Set" shortcut="Del">
                                                        <button onClick={() => onDeleteSet(set.id)} aria-label={`Delete ${set.name}`} className="p-1.5 hover:bg-red-100 rounded-full text-gray-500 hover:text-red-600 hover:scale-110 active:scale-95 transition-smooth">
                                                            <TrashIcon className="w-5 h-5" />
                                                        </button>
                                                    </Tooltip>
                                                </div>
                                            </td>
                                        </tr>
                                        {isExpanded && (() => {
                                            const currentTab = activeTab[set.id] || 'components';
                                            const setActiveTabForSet = (tab: 'components' | 'doors' | 'details') => {
                                                setActiveTab(prev => ({ ...prev, [set.id]: tab }));
                                            };

                                            return (
                                                <tr className="bg-gradient-to-b from-gray-50 to-white">
                                                    <td colSpan={5} className="p-0">
                                                        {/* Tabbed Interface */}
                                                        <div className="border-t border-gray-200 animate-slideDown origin-top overflow-hidden">
                                                            {/* Tab Headers */}
                                                            <div className="flex border-b border-gray-200 bg-gray-100/50 px-12">
                                                                <button
                                                                    onClick={() => setActiveTabForSet('components')}
                                                                    className={`px-4 py-3 text-sm font-semibold transition-all relative ${currentTab === 'components'
                                                                        ? 'text-primary-700 border-b-2 border-primary-600 bg-white'
                                                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                                                        }`}
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                                        </svg>
                                                                        Components
                                                                        <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-primary-100 text-primary-700 font-bold">
                                                                            {set.items.reduce((acc, i) => acc + (i.quantity || 0), 0)}
                                                                        </span>
                                                                    </div>
                                                                </button>
                                                                <button
                                                                    onClick={() => setActiveTabForSet('doors')}
                                                                    className={`px-4 py-3 text-sm font-semibold transition-all relative ${currentTab === 'doors'
                                                                        ? 'text-primary-700 border-b-2 border-primary-600 bg-white'
                                                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                                                        }`}
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                                        </svg>
                                                                        Assigned Doors
                                                                        <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 font-bold">
                                                                            {assignedDoors.length}
                                                                        </span>
                                                                        {hasAnyConflicts && (
                                                                            <ExclamationCircleIcon className="w-4 h-4 text-red-500" />
                                                                        )}
                                                                    </div>
                                                                </button>
                                                                <button
                                                                    onClick={() => setActiveTabForSet('details')}
                                                                    className={`px-4 py-3 text-sm font-semibold transition-all relative ${currentTab === 'details'
                                                                        ? 'text-primary-700 border-b-2 border-primary-600 bg-white'
                                                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                                                        }`}
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                        </svg>
                                                                        Details
                                                                    </div>
                                                                </button>
                                                            </div>

                                                            {/* Tab Content */}
                                                            <div className="p-6 pl-12">
                                                                {/* Components Tab */}
                                                                {currentTab === 'components' && (
                                                                    <div className="animate-fadeIn">
                                                                        {set.items.length > 0 ? (
                                                                            <div className="border rounded-lg bg-white text-sm shadow-sm overflow-hidden">
                                                                                <div className="grid grid-cols-12 gap-x-4 p-3 font-bold text-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                                                                                    <div className="col-span-1">Qty</div>
                                                                                    <div className="col-span-5">Item / Manufacturer</div>
                                                                                    <div className="col-span-4">Description</div>
                                                                                    <div className="col-span-2 text-right">Finish</div>
                                                                                </div>
                                                                                <div className="max-h-80 overflow-y-auto">
                                                                                    {set.items.map((item: HardwareItem) => (
                                                                                        <div key={item.id} className="grid grid-cols-12 gap-x-4 p-3 border-b last:border-b-0 hover:bg-primary-50/30 items-center transition-colors">
                                                                                            <div className={`col-span-1 font-bold text-lg ${(!item.quantity || item.quantity <= 0) ? 'text-red-500' : 'text-primary-700'}`}>{item.quantity}×</div>
                                                                                            <div className="col-span-5">
                                                                                                <span className="font-semibold text-gray-900 block">{item.name}</span>
                                                                                                <span className="text-gray-500 text-xs">({item.manufacturer})</span>
                                                                                            </div>
                                                                                            <div className="col-span-4 text-gray-600">{item.description}</div>
                                                                                            <div className="col-span-2 text-right">
                                                                                                <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 font-semibold text-xs">{item.finish || 'N/A'}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="text-center py-12">
                                                                                <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                                                                </svg>
                                                                                <p className="text-gray-500 font-medium">No components in this set</p>
                                                                                <p className="text-gray-400 text-sm mt-1">Add hardware items to get started</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* Assigned Doors Tab */}
                                                                {currentTab === 'doors' && (
                                                                    <div className="animate-fadeIn">
                                                                        {assignedDoors.length > 0 ? (
                                                                            <div>
                                                                                <div className="flex justify-between items-center mb-4">
                                                                                    <p className="text-sm text-gray-600">
                                                                                        {assignedDoors.length} {assignedDoors.length === 1 ? 'door' : 'doors'} assigned to this set
                                                                                    </p>
                                                                                    {currentDoorSelection.size > 0 && (
                                                                                        <button
                                                                                            onClick={() => handleCreateVariantFromSelection(set)}
                                                                                            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-semibold flex items-center gap-2 shadow-sm hover:shadow transition-all"
                                                                                        >
                                                                                            <DocumentDuplicateIcon className="w-4 h-4" />
                                                                                            Create Variant ({currentDoorSelection.size})
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                                <div className="border rounded-lg bg-white text-xs overflow-hidden shadow-sm">
                                                                                    <table className="w-full">
                                                                                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                                                                                            <tr className="border-b">
                                                                                                <th className="p-3 w-8 text-center"><input type="checkbox" className="rounded border-gray-300"
                                                                                                    checked={currentDoorSelection.size === assignedDoors.length}
                                                                                                    onChange={(e) => handleToggleAllDoorsInSection(set.id, assignedDoors, e.target.checked)}
                                                                                                /></th>
                                                                                                <th className="p-3 text-left font-bold text-gray-700">Tag</th>
                                                                                                <th className="p-3 text-left font-bold text-gray-700">Rating</th>
                                                                                                <th className="p-3 text-left font-bold text-gray-700">W × H (Ft)</th>
                                                                                                <th className="p-3 text-left font-bold text-gray-700">Thk</th>
                                                                                                <th className="p-3 text-left font-bold text-gray-700">Material</th>
                                                                                                <th className="p-3 text-left font-bold text-gray-700">Frame</th>
                                                                                            </tr>
                                                                                        </thead>
                                                                                        <tbody>
                                                                                            {assignedDoors.map(door => {
                                                                                                const conflicts = getDoorConflicts(set, door);

                                                                                                const getCellClass = (warning: string | undefined) => {
                                                                                                    if (!warning) return 'text-gray-600';
                                                                                                    if (warning.includes('CRITICAL') || warning.includes('CONFLICT')) return 'bg-red-100 font-bold text-red-900 ring-inset ring-1 ring-red-200';
                                                                                                    return 'bg-amber-100 font-bold text-amber-900 ring-inset ring-1 ring-amber-200';
                                                                                                };

                                                                                                const isSelected = currentDoorSelection.has(door.id);
                                                                                                return (
                                                                                                    <tr key={door.id} className={`border-b last:border-b-0 ${isSelected ? 'bg-primary-100' : 'hover:bg-gray-50'}`}>
                                                                                                        <td className="p-2 text-center"><input type="checkbox" className="rounded"
                                                                                                            checked={isSelected}
                                                                                                            onChange={() => handleToggleDoorSelection(set.id, door.id)}
                                                                                                        /></td>
                                                                                                        <td className="p-2 font-medium text-gray-800">{door.doorTag}</td>
                                                                                                        <td className={`p-2 transition-colors rounded-sm ${getCellClass(conflicts.fireRating)}`} title={conflicts.fireRating}>
                                                                                                            {door.fireRating}
                                                                                                            {conflicts.fireRating && renderConflictIcon(conflicts.fireRating, conflicts.fireRating.includes('CRITICAL'))}
                                                                                                        </td>
                                                                                                        <td className={`p-2 transition-colors rounded-sm ${getCellClass(conflicts.height)}`} title={conflicts.height}>
                                                                                                            {`${formatDimension(door.width)} x ${formatDimension(door.height)}`}
                                                                                                            {conflicts.height && renderConflictIcon(conflicts.height, conflicts.height.includes('CRITICAL'))}
                                                                                                        </td>
                                                                                                        <td className="p-2 text-gray-600">{`${door.thickness}"`}</td>
                                                                                                        <td className={`p-2 transition-colors rounded-sm ${getCellClass(conflicts.doorMaterial)}`} title={conflicts.doorMaterial}>
                                                                                                            {door.doorMaterial}
                                                                                                            {conflicts.doorMaterial && renderConflictIcon(conflicts.doorMaterial, conflicts.doorMaterial.includes('CONFLICT'))}
                                                                                                        </td>
                                                                                                        <td className="p-2 text-gray-600">{door.frameMaterial}</td>
                                                                                                    </tr>
                                                                                                );
                                                                                            })}
                                                                                        </tbody>
                                                                                    </table>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="text-center py-12">
                                                                                <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                                                </svg>
                                                                                <p className="text-gray-500 font-medium">No doors assigned</p>
                                                                                <p className="text-gray-400 text-sm mt-1">Assign doors to this hardware set to see them here</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })()}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <HardwareSetModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveAndClose}
                setToEdit={setToEdit}
                hardwareSets={hardwareSets}
                variantSource={variantSource}
            />
            <UploadConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={handleConfirmUpload}
                files={selectedFiles}
                isLoading={isLoading}
            />
        </div>
    );
};

export default HardwareSetsManager;
