import React, { useState, useMemo, useRef, useEffect } from 'react';
import { HardwareSet, Door } from '../types';
import { useAnnounce } from '../contexts/AnnouncementContext';
import { useModalState } from '../hooks/useModalState';
import { getDoorConflicts } from '../utils/hardwareUtils';
import { getAssignedDoorMismatchMap } from '../utils/doorValidation';

interface UseHardwareSetsManagerParams {
    projectId: string;
    hardwareSets: HardwareSet[];
    doors: Door[];
    isLoading: boolean;
    onProcessUploads: (files: File[], mode: 'add' | 'overwrite') => void;
    onSaveSet: (set: HardwareSet) => void;
    onDeleteSet: (setId: string) => void;
    onBulkDeleteSets: (setIds: Set<string>) => void;
    onCreateVariant: (newSet: HardwareSet, doorIds: string[], sourceSetId: string) => void;
}

export function useHardwareSetsManager({
    projectId,
    hardwareSets,
    doors,
    isLoading,
    onProcessUploads,
    onSaveSet,
    onBulkDeleteSets,
    onCreateVariant,
}: UseHardwareSetsManagerParams) {
    const { isOpen: isModalOpen, open: openModal, close: closeModal } = useModalState();
    const { isOpen: isConfirmModalOpen, open: openConfirmModal, close: closeConfirmModal } = useModalState();
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
    const [activeTab, setActiveTab] = useState<Record<string, 'components' | 'doors' | 'details' | 'prep'>>({});
    const [prepGenerating, setPrepGenerating] = useState<Set<string>>(new Set());
    const [prepErrors, setPrepErrors] = useState<Record<string, string>>({});
    const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'doors' | 'items'; direction: 'asc' | 'desc' } | null>(null);

    // Locks in the PDF sequence the first time a non-empty set list arrives.
    // Subsequent deletes / restores use this order so sets always snap back
    // to their original PDF position rather than drifting to the end.
    const pdfOrderRef = useRef<Map<string, number>>(new Map());

    useEffect(() => {
        if (hardwareSets.length === 0) return;
        // Re-capture whenever the set names change (new upload / re-process).
        // Using set names (not ids) as the stable key because ids can be
        // regenerated on re-upload while the name stays the same.
        const currentNames = hardwareSets.map(s => s.name).join('|');
        const capturedNames = Array.from(pdfOrderRef.current.keys()).join('|');
        if (capturedNames !== currentNames) {
            const order = new Map<string, number>();
            hardwareSets.forEach((set, idx) => order.set(set.name, idx));
            pdfOrderRef.current = order;
        }
    }, [hardwareSets]);

    const announce = useAnnounce();

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

    const doorQuantityTotals = useMemo(() => {
        const totals = new Map<string, number>();
        if (Array.isArray(doors)) {
            doors.forEach(door => {
                if (door.assignedHardwareSet?.id) {
                    const id = door.assignedHardwareSet.id;
                    totals.set(id, (totals.get(id) || 0) + (door.quantity || 1));
                }
            });
        }
        return totals;
    }, [doors]);

    const filteredAndSortedSets = useMemo(() => {
        let result = hardwareSets.filter(set =>
            set.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            set.description.toLowerCase().includes(searchQuery.toLowerCase())
        );
        if (sortConfig) {
            result = [...result].sort((a, b) => {
                if (sortConfig.key === 'name') {
                    return sortConfig.direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
                } else if (sortConfig.key === 'doors') {
                    const countA = doorCounts.get(a.id) || 0;
                    const countB = doorCounts.get(b.id) || 0;
                    return sortConfig.direction === 'asc' ? countA - countB : countB - countA;
                } else if (sortConfig.key === 'items') {
                    return sortConfig.direction === 'asc' ? a.items.length - b.items.length : b.items.length - a.items.length;
                }
                return 0;
            });
        } else {
            // Default: preserve PDF sequence using captured order (stable across deletes/restores).
            // For sets not yet in pdfOrderRef (e.g. a variant just created this render cycle
            // before the useEffect has a chance to update the ref), fall back to the set's
            // actual position in the incoming hardwareSets array so it renders in the right
            // spot immediately rather than jumping to the bottom.
            result = [...result].sort((a, b) => {
                const ia = pdfOrderRef.current.has(a.name)
                    ? pdfOrderRef.current.get(a.name)!
                    : hardwareSets.findIndex(s => s.id === a.id);
                const ib = pdfOrderRef.current.has(b.name)
                    ? pdfOrderRef.current.get(b.name)!
                    : hardwareSets.findIndex(s => s.id === b.id);
                return ia - ib;
            });
        }
        return result;
    }, [hardwareSets, searchQuery, sortConfig, doorCounts]);

    useEffect(() => {
        const handler = setTimeout(() => {
            if (searchQuery) announce(`Found ${filteredAndSortedSets.length} hardware sets matching "${searchQuery}"`, 'polite');
        }, 1000);
        return () => clearTimeout(handler);
    }, [searchQuery, filteredAndSortedSets.length, announce]);

    const handleSort = (key: 'name' | 'doors' | 'items') => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const handleFileSelect = (files: FileList | null) => {
        if (files && files.length > 0) { setSelectedFiles(Array.from(files)); openConfirmModal(); }
    };
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false);
        if (!isLoading) handleFileSelect(e.dataTransfer.files);
    };
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault(); e.stopPropagation(); if (!isLoading) setIsDraggingOver(true);
    };
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false);
    };
    const handleConfirmUpload = (mode: 'add' | 'overwrite') => {
        onProcessUploads(selectedFiles, mode); closeConfirmModal(); setSelectedFiles([]);
    };
    const handleCreateNew = () => { setSetToEdit(null); setVariantSource(null); openModal(); };
    const handleEdit = (set: HardwareSet) => { setSetToEdit(set); setVariantSource(null); openModal(); };
    const handleCreateVariant = (sourceSet: HardwareSet) => {
        setVariantSource(sourceSet); setVariantMode('all'); setSetToEdit(null); openModal();
    };
    const handleCreateVariantFromSelection = (sourceSet: HardwareSet) => {
        if (!selectedDoors[sourceSet.id] || selectedDoors[sourceSet.id].size === 0) return;
        setVariantSource(sourceSet); setVariantMode('selection'); setSetToEdit(null); openModal();
    };
    const handleSaveAndClose = (set: HardwareSet) => {
        if (variantSource && variantMode) {
            let doorIdsToReassign: string[] = [];
            if (variantMode === 'selection') {
                doorIdsToReassign = Array.from(selectedDoors[variantSource.id] || []);
            } else {
                doorIdsToReassign = doors.filter(d => d.assignedHardwareSet?.id === variantSource.id).map(d => d.id);
            }
            if (doorIdsToReassign.length > 0) onCreateVariant(set, doorIdsToReassign, variantSource.id);
            else onSaveSet(set);
            setSelectedDoors(prev => ({ ...prev, [variantSource.id]: new Set() }));
        } else {
            onSaveSet(set);
        }
        closeModal(); setVariantMode(null); setVariantSource(null);
    };
    const toggleRow = (id: string) => {
        setExpandedRows(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
    };
    const toggleAll = (expand: boolean) => {
        setExpandedRows(expand ? new Set(filteredAndSortedSets.map(s => s.id)) : new Set());
    };
    const toggleSelectRow = (id: string) => {
        setSelectedRows(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
    };
    const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedRows(e.target.checked ? new Set(filteredAndSortedSets.map(s => s.id)) : new Set());
    };
    const clearSelection = () => setSelectedRows(new Set());
    const handleBulkDelete = () => {
        if (selectedRows.size > 0 && confirm(`Are you sure you want to delete ${selectedRows.size} hardware sets? This action cannot be undone.`)) {
            onBulkDeleteSets(selectedRows); setSelectedRows(new Set());
        }
    };
    const handleToggleDoorSelection = (setId: string, doorId: string) => {
        setSelectedDoors(prev => {
            const n = { ...prev }; const s = new Set(n[setId] || []);
            s.has(doorId) ? s.delete(doorId) : s.add(doorId); n[setId] = s; return n;
        });
    };
    const handleToggleAllDoorsInSection = (setId: string, doorsInSection: Door[], select: boolean) => {
        setSelectedDoors(prev => {
            const n = { ...prev };
            n[setId] = select ? new Set(doorsInSection.map(d => d.id)) : new Set(); return n;
        });
    };

    const handleGeneratePrep = async (set: HardwareSet) => {
        setPrepGenerating(prev => new Set(prev).add(set.id));
        setPrepErrors(prev => { const n = { ...prev }; delete n[set.id]; return n; });

        try {
            const res = await fetch(`/api/projects/${projectId}/hardware-set-prep`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ setName: set.name }),
            });

            let json: { prep?: string; error?: string };
            try {
                json = (await res.json()) as { prep?: string; error?: string };
            } catch {
                throw new Error('Server returned an invalid response. Please try again.');
            }

            if (!res.ok) {
                throw new Error(json.error ?? 'Prep generation failed.');
            }

            if (!json.prep) {
                throw new Error('Server did not return prep data.');
            }

            // Update only the prep field in local state — does not trigger onProjectUpdate
            // because we update in-place without re-saving the full set to the project API.
            onSaveSet({ ...set, prep: json.prep });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error occurred';
            setPrepErrors(prev => ({ ...prev, [set.id]: message }));
        } finally {
            setPrepGenerating(prev => { const s = new Set(prev); s.delete(set.id); return s; });
        }
    };

    const isAllSelected = selectedRows.size > 0 && selectedRows.size === filteredAndSortedSets.length;
    const isIndeterminate = selectedRows.size > 0 && selectedRows.size < filteredAndSortedSets.length;

    const getSetMeta = (set: HardwareSet) => {
        const assignedDoors = doors.filter(d => d.assignedHardwareSet?.id === set.id);
        const assignedDoorMismatches = getAssignedDoorMismatchMap(assignedDoors);
        const hasAnyConflicts = assignedDoors.some(d => {
            const setConflicts = getDoorConflicts(set, d);
            const groupConflicts = assignedDoorMismatches.get(d.id) ?? {};
            return Object.keys(setConflicts).length > 0 || Object.keys(groupConflicts).length > 0;
        });
        return { assignedDoors, assignedDoorMismatches, hasAnyConflicts };
    };

    return {
        fileInputRef,
        isModalOpen, openModal, closeModal,
        isConfirmModalOpen, openConfirmModal, closeConfirmModal,
        selectedFiles,
        isDraggingOver,
        setToEdit,
        variantSource,
        variantMode,
        searchQuery, setSearchQuery,
        expandedRows,
        selectedRows,
        selectedDoors,
        activeTab, setActiveTab,
        prepGenerating,
        prepErrors,
        sortConfig,
        doorCounts,
        doorQuantityTotals,
        filteredAndSortedSets,
        isAllSelected,
        isIndeterminate,
        handleSort,
        handleFileSelect,
        handleDrop,
        handleDragOver,
        handleDragLeave,
        handleConfirmUpload,
        handleCreateNew,
        handleEdit,
        handleCreateVariant,
        handleCreateVariantFromSelection,
        handleSaveAndClose,
        toggleRow,
        toggleAll,
        toggleSelectRow,
        toggleSelectAll,
        clearSelection,
        handleBulkDelete,
        handleToggleDoorSelection,
        handleToggleAllDoorsInSection,
        handleGeneratePrep,
        getSetMeta,
    };
}
