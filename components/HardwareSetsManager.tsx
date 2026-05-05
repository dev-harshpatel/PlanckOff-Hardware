'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { HardwareSet, Door, HardwareItem } from '../types';
import HardwareSetModal from './HardwareSetModal';
import UploadConfirmationModal from './UploadConfirmationModal';
import Tooltip from './Tooltip';
import { useAnnounce } from '../contexts/AnnouncementContext';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import ContextualProgressBar from './ContextualProgressBar';
import { getAssignedDoorMismatchMap } from '../utils/doorValidation';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
    Upload, Plus, Search, ChevronRight, ChevronDown, ChevronUp,
    Copy, Pencil, Trash2, AlertTriangle, AlertCircle, Package, X,
    Layers, DoorOpen, Info, Loader2, CheckCircle2, Wrench, Sparkles,
    RefreshCw, Ban,
} from 'lucide-react';

interface ActiveUploadTask {
    fileName: string;
    stage: string;
    progress: number;
}

interface HardwareSetsManagerProps {
    projectId: string;
    hardwareSets: HardwareSet[];
    doors: Door[];
    isLoading: boolean;
    onProcessUploads: (files: File[], mode: 'add' | 'overwrite') => void;
    onSaveSet: (set: HardwareSet) => void;
    onDeleteSet: (setId: string) => void;
    onBulkDeleteSets: (setIds: Set<string>) => void;
    onCreateVariant: (newSet: HardwareSet, doorIds: string[], sourceSetId: string) => void;
    activeTask?: ActiveUploadTask;
    onCancelTask?: () => void;
    canReupload?: boolean;
}

// Helper to format inches to Feet-Inches (e.g. 36 -> 3'-0")
const formatDimension = (inches: number): string => {
    if (!inches) return "0'-0\"";
    const feet = Math.floor(inches / 12);
    const remainingInches = inches % 12;
    return `${feet}'-${remainingInches}"`;
};

const HardwareSetsManager: React.FC<HardwareSetsManagerProps> = (props) => {
    const { projectId, hardwareSets = [], doors = [], isLoading, onProcessUploads, onSaveSet, onDeleteSet, onBulkDeleteSets, onCreateVariant, activeTask, onCancelTask, canReupload = true } = props;

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

    // ── All existing logic preserved exactly ─────────────────────────────────

    const doorCounts = useMemo(() => {
        const counts = new Map<string, number>();
        if (Array.isArray(doors)) {
            doors.forEach(door => {
                if (door.assignedHardwareSet?.id && door.hardwareIncludeExclude?.toUpperCase() !== 'EXCLUDE') {
                    counts.set(door.assignedHardwareSet.id, (counts.get(door.assignedHardwareSet.id) || 0) + 1);
                }
            });
        }
        return counts;
    }, [doors]);

    // Sum of door.quantity (openings) per set — used for Total Qty calculation
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

    const SortIcon: React.FC<{ columnKey: 'name' | 'doors' | 'items' }> = ({ columnKey }) => {
        if (sortConfig?.key !== columnKey) return <ChevronDown className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-40" />;
        return sortConfig.direction === 'asc'
            ? <ChevronUp className="w-3 h-3 ml-1 text-white" />
            : <ChevronDown className="w-3 h-3 ml-1 text-white" />;
    };

    const handleFileSelect = (files: FileList | null) => {
        if (files && files.length > 0) { setSelectedFiles(Array.from(files)); setIsConfirmModalOpen(true); }
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
        onProcessUploads(selectedFiles, mode); setIsConfirmModalOpen(false); setSelectedFiles([]);
    };
    const handleCreateNew = () => { setSetToEdit(null); setVariantSource(null); setIsModalOpen(true); };
    const handleEdit = (set: HardwareSet) => { setSetToEdit(set); setVariantSource(null); setIsModalOpen(true); };
    const handleCreateVariant = (sourceSet: HardwareSet) => {
        setVariantSource(sourceSet); setVariantMode('all'); setSetToEdit(null); setIsModalOpen(true);
    };
    const handleCreateVariantFromSelection = (sourceSet: HardwareSet) => {
        if (!selectedDoors[sourceSet.id] || selectedDoors[sourceSet.id].size === 0) return;
        setVariantSource(sourceSet); setVariantMode('selection'); setSetToEdit(null); setIsModalOpen(true);
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
        setIsModalOpen(false); setVariantMode(null); setVariantSource(null);
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

    const getDoorConflicts = (set: HardwareSet, door: Door): Partial<Record<'fireRating' | 'dimensions' | 'doorMaterial', string>> => {
        const conflicts: Partial<Record<'fireRating' | 'dimensions' | 'doorMaterial', string>> = {};
        const setDesc = set.description.toLowerCase();
        const setItemsText = set.items.map(i => (i.name + i.description).toLowerCase()).join(' ');
        const isSetFireRated = setDesc.includes('fire') || setDesc.includes('rated') || setItemsText.includes('fire') || setItemsText.includes('rated') || setItemsText.includes('label');
        const doorRating = door.fireRating ? door.fireRating.toLowerCase().trim() : 'n/a';
        const isDoorRated = doorRating !== 'n/a' && doorRating !== '' && doorRating !== 'non-rated';
        if (isDoorRated && !isSetFireRated) conflicts.fireRating = `CRITICAL: Door is rated (${door.fireRating}), but hardware set is NOT fire-rated.`;
        if (!isDoorRated && isSetFireRated) conflicts.fireRating = `WARNING: Non-rated door assigned to fire-rated set (Over-spec).`;
        const hingeItems = set.items.filter(item => {
            const name = item.name.toLowerCase(); const desc = item.description.toLowerCase();
            return (name.includes('hinge') || desc.includes('hinge') || name.includes('butt') || desc.includes('butt')) && !name.includes('continuous') && !desc.includes('continuous');
        });
        if (hingeItems.length > 0) {
            const totalHinges = hingeItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
            if (door.height > 90 && totalHinges < 4) conflicts.dimensions = `CRITICAL: Door height ${formatDimension(door.height)} (> 90") usually requires 4 hinges, set has ${totalHinges}.`;
        }
        const doorMat = (door.doorMaterial || '').toLowerCase();
        if (setDesc.includes('wood door') && (doorMat.includes('hollow') || doorMat.includes('metal') || doorMat.includes('alum') || doorMat.includes('steel'))) conflicts.doorMaterial = `CONFLICT: Set specified for 'Wood Door', applied to '${door.doorMaterial}'.`;
        if ((setDesc.includes('aluminum door') || setDesc.includes('metal door') || setDesc.includes('steel door')) && doorMat.includes('wood')) conflicts.doorMaterial = `CONFLICT: Set specified for Metal/Aluminum, applied to '${door.doorMaterial}'.`;
        return conflicts;
    };

    const renderConflictIcon = (message: string, isCritical: boolean) => {
        if (isCritical) return <AlertCircle className="w-3 h-3 text-red-600 inline-block ml-1" />;
        return <AlertTriangle className="w-3 h-3 text-amber-500 inline-block ml-1" />;
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div
            className={`bg-[var(--bg)] rounded-xl shadow-sm border border-[var(--border)] relative flex flex-col h-full overflow-hidden transition-all duration-200 ${isDraggingOver ? 'ring-2 ring-[var(--primary-ring)] ring-offset-2' : ''}`}
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

            {/* Drag overlay */}
            {isDraggingOver && (
                <div className="absolute inset-0 bg-primary-50/95 flex flex-col items-center justify-center z-20 pointer-events-none rounded-xl border-2 border-dashed border-primary-400">
                    <Upload className="w-12 h-12 text-primary-500 mb-3" />
                    <p className="text-lg font-semibold text-primary-700">Drop to upload</p>
                    <p className="text-sm text-primary-500 mt-1">PDF, Excel, Word supported</p>
                </div>
            )}

            <ContextualProgressBar type="hardware-set" />

            {/* ── Panel Header ────────────────────────────────────────────── */}
            {activeTask ? (
                <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-5 py-3.5 flex-shrink-0">
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
            <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-5 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-[var(--primary-bg-hover)] p-2 rounded-lg">
                            <Package className="w-5 h-5 text-[var(--primary-text-muted)]" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-[var(--text)]">Hardware Sets</h2>
                            <p className="text-[var(--primary-text-muted)] text-xs mt-0.5">
                                {filteredAndSortedSets.length} {filteredAndSortedSets.length === 1 ? 'set' : 'sets'}
                                {' · '}
                                {filteredAndSortedSets.reduce((sum, s) => sum + s.items.length, 0)} items
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => canReupload && fileInputRef.current?.click()}
                            disabled={isLoading || !canReupload}
                            loading={!!activeTask}
                            loadingText="Processing..."
                            title={!canReupload ? 'Use "Process Files" to upload your first PDF and Excel together' : undefined}
                            className="gap-1.5"
                        >
                            <Upload className="w-3.5 h-3.5" />
                            Upload PDF
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleCreateNew}
                            className="gap-1.5"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Create New
                        </Button>
                    </div>
                </div>
            </div>
            )}

            {/* ── Search + Controls ────────────────────────────────────────── */}
            <div className="px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-faint)] pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search sets…"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-sm border border-[var(--border)] rounded-md bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)] focus:border-transparent"
                    />
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] shrink-0">
                    <button onClick={() => toggleAll(true)} className="hover:text-[var(--primary-text-muted)] transition-colors">Expand all</button>
                    <span className="text-[var(--text-faint)]">·</span>
                    <button onClick={() => toggleAll(false)} className="hover:text-[var(--primary-text-muted)] transition-colors">Collapse all</button>
                </div>
            </div>

            {/* ── Bulk action bar (appears on selection) ───────────────────── */}
            {selectedRows.size > 0 && (
                <div className="mx-5 mt-3 flex items-center justify-between bg-primary-50 border border-primary-200 rounded-lg px-4 py-2.5">
                    <div className="flex items-center gap-2 text-sm font-medium text-primary-900">
                        <span className="w-5 h-5 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center font-bold">{selectedRows.size}</span>
                        {selectedRows.size === 1 ? '1 set' : `${selectedRows.size} sets`} selected
                    </div>
                    <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setSelectedRows(new Set())} className="text-gray-500 h-7 px-2">
                            <X className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={handleBulkDelete} className="h-7 gap-1.5 text-xs">
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                        </Button>
                    </div>
                </div>
            )}

            {/* ── Table ────────────────────────────────────────────────────── */}
            <div className="flex-grow min-h-0 overflow-hidden mx-5 mb-5 mt-3 rounded-lg border border-[var(--border)]">
                <div className="h-full overflow-y-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-2.5 w-10">
                                    <input
                                        type="checkbox"
                                        className="rounded border-[var(--primary-border)] text-[var(--primary-action)] focus:ring-[var(--primary-ring)]"
                                        ref={el => { if (el) el.indeterminate = isIndeterminate; }}
                                        checked={isAllSelected}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th className="px-4 py-2.5 cursor-pointer group select-none text-xs font-semibold text-[var(--primary-text)] uppercase tracking-wide" onClick={() => handleSort('name')}>
                                    <div className="flex items-center">Set Name <SortIcon columnKey="name" /></div>
                                </th>
                                <th className="px-4 py-2.5 text-center cursor-pointer group select-none text-xs font-semibold text-[var(--primary-text)] uppercase tracking-wide" onClick={() => handleSort('doors')}>
                                    <div className="flex items-center justify-center">Doors <SortIcon columnKey="doors" /></div>
                                </th>
                                <th className="px-4 py-2.5 text-center cursor-pointer group select-none text-xs font-semibold text-[var(--primary-text)] uppercase tracking-wide" onClick={() => handleSort('items')}>
                                    <div className="flex items-center justify-center">Items <SortIcon columnKey="items" /></div>
                                </th>
                                <th className="px-4 py-2.5 text-right text-xs font-semibold text-[var(--primary-text)] uppercase tracking-wide">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-[var(--bg)] divide-y divide-[var(--border-subtle)]">

                            {/* Skeleton rows */}
                            {isLoading && Array.from({ length: 6 }).map((_, i) => (
                                <tr key={`sk-${i}`} className="border-b border-[var(--border-subtle)]">
                                    <td className="px-4 py-3"><Skeleton className="h-4 w-4 rounded" /></td>
                                    <td className="px-4 py-3"><Skeleton className="h-4 w-24 rounded" /></td>
                                    <td className="px-4 py-3 text-center"><Skeleton className="h-4 w-6 mx-auto rounded" /></td>
                                    <td className="px-4 py-3 text-center"><Skeleton className="h-4 w-6 mx-auto rounded" /></td>
                                    <td className="px-4 py-3" />
                                </tr>
                            ))}

                            {/* Empty state */}
                            {!isLoading && filteredAndSortedSets.length === 0 && (
                                <tr>
                                    <td colSpan={5}>
                                        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                                            <div className="w-14 h-14 rounded-full bg-[var(--bg-muted)] flex items-center justify-center mb-4">
                                                <Package className="w-7 h-7 text-[var(--text-faint)]" />
                                            </div>
                                            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-1">
                                                {searchQuery ? 'No sets match your search' : 'No hardware sets yet'}
                                            </h3>
                                            <p className="text-xs text-[var(--text-muted)] mb-5 max-w-xs">
                                                {searchQuery
                                                    ? `No results for "${searchQuery}". Try a different search.`
                                                    : 'Upload a Division 08 hardware schedule PDF to get started.'}
                                            </p>
                                            {!searchQuery && (
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => canReupload && fileInputRef.current?.click()}
                                                        disabled={!canReupload}
                                                        title={!canReupload ? 'Use "Process Files" to upload your first PDF and Excel together' : undefined}
                                                        className="gap-1.5"
                                                    >
                                                        <Upload className="w-3.5 h-3.5" />
                                                        Upload PDF
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={handleCreateNew} className="gap-1.5">
                                                        <Plus className="w-3.5 h-3.5" />
                                                        Create Manually
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {/* Data rows */}
                            {!isLoading && filteredAndSortedSets.map(set => {
                                const isExpanded = expandedRows.has(set.id);
                                const doorCount = doorCounts.get(set.id) || 0;
                                const hasZeroQtyItem = set.items.some(item => !item.quantity || item.quantity <= 0);
                                const assignedDoors = doors.filter(d => d.assignedHardwareSet?.id === set.id);
                                const assignedDoorMismatches = getAssignedDoorMismatchMap(assignedDoors);
                                const currentDoorSelection = selectedDoors[set.id] || new Set();
                                const isUnavailable = set.isAvailable === false;
                                const isManualEntry = set.isManualEntry === true;
                                const hasAnyConflicts = assignedDoors.some(d => {
                                    const setConflicts = getDoorConflicts(set, d);
                                    const groupConflicts = assignedDoorMismatches.get(d.id) ?? {};
                                    return Object.keys(setConflicts).length > 0 || Object.keys(groupConflicts).length > 0;
                                });
                                const isSelected = selectedRows.has(set.id);
                                const hasZeroDoors = doorCount === 0;
                                const allHwExcluded = assignedDoors.length > 0 &&
                                    assignedDoors.every(d => d.hardwareIncludeExclude?.toUpperCase() === 'EXCLUDE');

                                return (
                                    <React.Fragment key={set.id}>
                                        <tr className={`transition-colors ${allHwExcluded ? 'opacity-50' : ''} ${isUnavailable
                                            ? 'border-l-2 border-l-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30'
                                            : hasZeroDoors
                                                ? 'border-l-2 border-l-red-400 dark:border-l-red-800 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30'
                                                : isManualEntry
                                                    ? 'border-l-2 border-l-amber-300 bg-amber-50/80 hover:bg-amber-100'
                                                    : isSelected
                                                        ? 'bg-[var(--primary-bg)] hover:bg-[var(--primary-bg-hover)]'
                                                        : 'hover:bg-[var(--bg-subtle)]'
                                        }`}>
                                            <td className="px-4 py-3">
                                                <input type="checkbox" className="rounded border-gray-300 text-primary-600" checked={isSelected} onChange={() => toggleSelectRow(set.id)} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => toggleRow(set.id)} className="text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors flex-shrink-0">
                                                        {isExpanded
                                                            ? <ChevronDown className="w-4 h-4" />
                                                            : <ChevronRight className="w-4 h-4" />}
                                                    </button>
                                                    <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded ${isUnavailable ? 'bg-red-100 text-red-700 line-through' : 'bg-[var(--bg-muted)] text-[var(--text)]'}`}>
                                                        {set.name}
                                                    </span>
                                                    {isManualEntry && (
                                                        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700">
                                                            Manual
                                                        </span>
                                                    )}
                                                    {isUnavailable && <Badge variant="destructive" className="text-[10px] py-0 px-1.5">Unavailable</Badge>}
                                                    {allHwExcluded && (
                                                        <Badge variant="secondary" className="text-[10px] gap-1 py-0 px-1.5">
                                                            <Ban className="w-2.5 h-2.5" />
                                                            HW Excluded
                                                        </Badge>
                                                    )}
                                                    {hasZeroQtyItem && (
                                                        <Tooltip content="Set contains items with zero quantity">
                                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                                                        </Tooltip>
                                                    )}
                                                    {hasAnyConflicts && (
                                                        <Tooltip content="Conflict detected on one or more assigned doors. Expand to view.">
                                                            <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                                                        </Tooltip>
                                                    )}
                                                </div>
                                                {set.description && (
                                                    <p className="text-xs text-[var(--text-faint)] mt-0.5 ml-6 truncate max-w-[180px]">{set.description}</p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`text-sm font-medium ${hasZeroDoors ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-[var(--text-secondary)]'}`}>
                                                    {doorCount}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="text-sm font-medium text-[var(--text-secondary)]">{set.items.length}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Tooltip content="Create Variant (Reassigns All Doors)">
                                                        <Button size="icon" variant="ghost" onClick={() => handleCreateVariant(set)} className="h-7 w-7 text-[var(--text-faint)] hover:text-[var(--primary-text-muted)]">
                                                            <Copy className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </Tooltip>
                                                    <Tooltip content="Edit Hardware Set">
                                                        <Button size="icon" variant="ghost" onClick={() => handleEdit(set)} className="h-7 w-7 text-[var(--text-faint)] hover:text-[var(--primary-text-muted)]">
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </Tooltip>
                                                    <Tooltip content="Delete Hardware Set">
                                                        <Button size="icon" variant="ghost" onClick={() => onDeleteSet(set.id)} className="h-7 w-7 text-[var(--text-faint)] hover:text-red-600">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </Tooltip>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* ── Expanded row ──────────────────────────────────────── */}
                                        {isExpanded && (() => {
                                            const currentTab = activeTab[set.id] || 'components';
                                            const setActiveTabForSet = (tab: 'components' | 'doors' | 'details' | 'prep') =>
                                                setActiveTab(prev => ({ ...prev, [set.id]: tab }));

                                            return (
                                                <tr className="bg-[var(--bg-subtle)]">
                                                    <td colSpan={5} className="px-5 py-4">
                                                        <Tabs value={currentTab} onValueChange={(v) => setActiveTabForSet(v as 'components' | 'doors' | 'details' | 'prep')}>
                                                            <TabsList className="mb-3">
                                                                <TabsTrigger value="components" className="gap-1.5 text-xs">
                                                                    <Layers className="w-3.5 h-3.5" />
                                                                    Components
                                                                    <span className="ml-1 bg-[var(--primary-bg-hover)] text-[var(--primary-text)] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                                                        {set.items.reduce((a, i) => a + (i.quantity || 0), 0)}
                                                                    </span>
                                                                </TabsTrigger>
                                                                <TabsTrigger value="doors" className="gap-1.5 text-xs">
                                                                    <DoorOpen className="w-3.5 h-3.5" />
                                                                    Assigned Doors
                                                                    <span className="ml-1 bg-[var(--primary-bg-hover)] text-[var(--primary-text)] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                                                        {assignedDoors.length}
                                                                    </span>
                                                                    {hasAnyConflicts && <AlertCircle className="w-3.5 h-3.5 text-red-500 ml-0.5" />}
                                                                </TabsTrigger>
                                                                <TabsTrigger value="details" className="gap-1.5 text-xs">
                                                                    <Info className="w-3.5 h-3.5" />
                                                                    Details
                                                                </TabsTrigger>
                                                                <TabsTrigger value="prep" className="gap-1.5 text-xs">
                                                                    <Wrench className="w-3.5 h-3.5" />
                                                                    Hardware Prep
                                                                    {set.prep && (
                                                                        <span className="ml-1 bg-[var(--primary-bg-hover)] text-[var(--primary-text)] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                                                            ✓
                                                                        </span>
                                                                    )}
                                                                </TabsTrigger>
                                                            </TabsList>

                                                            {/* Components tab */}
                                                            <TabsContent value="components">
                                                                {set.items.length > 0 ? (
                                                                    <div className="rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--bg)]">
                                                                        <table className="w-full text-xs">
                                                                            <thead className="bg-[var(--bg-subtle)] border-b border-[var(--border)]">
                                                                                <tr>
                                                                                    <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)] uppercase tracking-wide w-12">Qty</th>
                                                                                    <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)] uppercase tracking-wide">Item</th>
                                                                                    <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)] uppercase tracking-wide">Manufacturer</th>
                                                                                    <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)] uppercase tracking-wide">Description</th>
                                                                                    <th className="px-3 py-2 text-right font-semibold text-[var(--text-muted)] uppercase tracking-wide">Finish</th>
                                                                                    <th className="px-3 py-2 text-right font-semibold text-[var(--text-muted)] uppercase tracking-wide">Total Qty</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-[var(--border-subtle)] max-h-72 overflow-y-auto">
                                                                                {set.items.map((item: HardwareItem) => {
                                                                                    const totalDoorQty = doorQuantityTotals.get(set.id) || 0;
                                                                                    const totalQty = totalDoorQty > 0 ? (item.quantity || 0) * totalDoorQty : null;
                                                                                    return (
                                                                                    <tr key={item.id} className="hover:bg-[var(--bg-subtle)] transition-colors">
                                                                                        <td className={`px-3 py-2 font-bold ${(!item.quantity || item.quantity <= 0) ? 'text-red-500' : 'text-[var(--primary-text-muted)]'}`}>
                                                                                            {item.quantity}×
                                                                                        </td>
                                                                                        <td className="px-3 py-2">
                                                                                            <span className="font-medium text-[var(--text)] block">{item.name}</span>
                                                                                        </td>
                                                                                        <td className="px-3 py-2 text-[var(--text-faint)]">
                                                                                            {item.manufacturer || '—'}
                                                                                        </td>
                                                                                        <td className="px-3 py-2 text-[var(--text-muted)]">{item.description}</td>
                                                                                        <td className="px-3 py-2 text-right">
                                                                                            <span className="font-mono text-xs bg-[var(--bg-muted)] text-[var(--text-secondary)] px-2 py-0.5 rounded">
                                                                                                {item.finish || '—'}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="px-3 py-2 text-right">
                                                                                            {totalQty !== null
                                                                                                ? <span className="font-mono text-xs font-semibold text-[var(--primary-text)] bg-[var(--primary-bg)] px-2 py-0.5 rounded">{totalQty}</span>
                                                                                                : <span className="text-[var(--text-faint)] text-xs">—</span>
                                                                                            }
                                                                                        </td>
                                                                                    </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-center py-8 text-[var(--text-faint)] text-sm">No components in this set</div>
                                                                )}
                                                            </TabsContent>

                                                            {/* Doors tab */}
                                                            <TabsContent value="doors">
                                                                {assignedDoors.length > 0 ? (
                                                                    <div>
                                                                        <div className="flex justify-between items-center mb-3">
                                                                            <p className="text-xs text-[var(--text-muted)]">
                                                                                {assignedDoors.length} {assignedDoors.length === 1 ? 'door' : 'doors'} assigned
                                                                            </p>
                                                                            {currentDoorSelection.size > 0 && (
                                                                                <Button size="sm" onClick={() => handleCreateVariantFromSelection(set)} className="gap-1.5 h-7 text-xs">
                                                                                    <Copy className="w-3 h-3" />
                                                                                    Create Variant ({currentDoorSelection.size})
                                                                                </Button>
                                                                            )}
                                                                        </div>
                                                                        <div className="rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--bg)]">
                                                                            <table className="w-full text-xs">
                                                                                <thead className="bg-[var(--bg-subtle)] border-b border-[var(--border)]">
                                                                                    <tr>
                                                                                        <th className="px-3 py-2 w-8">
                                                                                            <input type="checkbox" className="rounded border-[var(--border-strong)]"
                                                                                                checked={currentDoorSelection.size === assignedDoors.length && assignedDoors.length > 0}
                                                                                                onChange={(e) => handleToggleAllDoorsInSection(set.id, assignedDoors, e.target.checked)}
                                                                                            />
                                                                                        </th>
                                                                                        <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)] uppercase tracking-wide">Tag</th>
                                                                                        <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)] uppercase tracking-wide">Qty</th>
                                                                                        <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)] uppercase tracking-wide">Door Location</th>
                                                                                        <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)] uppercase tracking-wide">Rating</th>
                                                                                        <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)] uppercase tracking-wide">Leaf Count</th>
                                                                                        <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)] uppercase tracking-wide">W × H</th>
                                                                                        <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)] uppercase tracking-wide">Thk</th>
                                                                                        <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)] uppercase tracking-wide">Material</th>
                                                                                        <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)] uppercase tracking-wide">Int / Ext</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-[var(--border-subtle)]">
                                                                                    {assignedDoors.map(door => {
                                                                                        const conflicts = {
                                                                                            ...assignedDoorMismatches.get(door.id),
                                                                                            ...getDoorConflicts(set, door),
                                                                                        };
                                                                                        const getCellClass = (warning: string | undefined) => {
                                                                                            if (!warning) return '';
                                                                                            if (warning.includes('CRITICAL') || warning.includes('CONFLICT')) return 'bg-red-50 text-red-800 font-medium';
                                                                                            return 'bg-amber-50 text-amber-800 font-medium';
                                                                                        };
                                                                                        const isSelected = currentDoorSelection.has(door.id);
                                                                                        return (
                                                                                            <tr key={door.id} className={`transition-colors ${isSelected ? 'bg-[var(--primary-bg)]' : 'hover:bg-[var(--bg-subtle)]'}`}>
                                                                                                <td className="px-3 py-2">
                                                                                                    <input type="checkbox" className="rounded" checked={isSelected} onChange={() => handleToggleDoorSelection(set.id, door.id)} />
                                                                                                </td>
                                                                                                <td className="px-3 py-2 font-medium text-[var(--text)]">{door.doorTag}</td>
                                                                                                <td className="px-3 py-2 text-[var(--text-muted)] tabular-nums">{door.quantity ?? 1}</td>
                                                                                                <td className="px-3 py-2 text-[var(--text-muted)]">
                                                                                                    {door.location || '—'}
                                                                                                </td>
                                                                                                <td className={`px-3 py-2 ${getCellClass(conflicts.fireRating)}`} title={conflicts.fireRating}>
                                                                                                    {door.fireRating}{conflicts.fireRating && renderConflictIcon(conflicts.fireRating, conflicts.fireRating.includes('CRITICAL'))}
                                                                                                </td>
                                                                                                <td className={`px-3 py-2 text-[var(--text-muted)] tabular-nums ${getCellClass(conflicts.leafCount)}`} title={conflicts.leafCount}>
                                                                                                    {door.leafCountDisplay ?? (door.leafCount != null ? String(door.leafCount) : '—')}
                                                                                                    {conflicts.leafCount && renderConflictIcon(conflicts.leafCount, false)}
                                                                                                </td>
                                                                                                <td className={`px-3 py-2 ${getCellClass(conflicts.dimensions)}`} title={conflicts.dimensions}>
                                                                                                    {`${formatDimension(door.width)} × ${formatDimension(door.height)}`}{conflicts.dimensions && renderConflictIcon(conflicts.dimensions, conflicts.dimensions.includes('CRITICAL') || conflicts.dimensions.includes('CONFLICT'))}
                                                                                                </td>
                                                                                                <td className="px-3 py-2 text-[var(--text-muted)]">{`${door.thickness}"`}</td>
                                                                                                <td className={`px-3 py-2 ${getCellClass(conflicts.doorMaterial)}`} title={conflicts.doorMaterial}>
                                                                                                    {door.doorMaterial}{conflicts.doorMaterial && renderConflictIcon(conflicts.doorMaterial, true)}
                                                                                                </td>
                                                                                                <td className={`px-3 py-2 text-[var(--text-muted)] ${getCellClass(conflicts.interiorExterior)}`} title={conflicts.interiorExterior}>{door.interiorExterior || '—'}{conflicts.interiorExterior && renderConflictIcon(conflicts.interiorExterior, false)}</td>
                                                                                            </tr>
                                                                                        );
                                                                                    })}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-center py-8 text-[var(--text-faint)] text-sm">No doors assigned to this set</div>
                                                                )}
                                                            </TabsContent>

                                                            {/* Details tab */}
                                                            <TabsContent value="details">
                                                                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4 text-sm text-[var(--text-secondary)] space-y-2">
                                                                    <div><span className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wide">Description</span><p className="mt-1">{set.description || '—'}</p></div>
                                                                    <div><span className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wide">Division</span><p className="mt-1">{set.division || '—'}</p></div>
                                                                </div>
                                                            </TabsContent>

                                                            {/* Hardware Prep tab */}
                                                            <TabsContent value="prep">
                                                                {(() => {
                                                                    const isGenerating = prepGenerating.has(set.id);
                                                                    const prepError = prepErrors[set.id];
                                                                    const prep = set.prep;

                                                                    if (isGenerating) {
                                                                        return (
                                                                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                                                                <Loader2 className="w-8 h-8 text-[var(--primary-text-muted)] animate-spin mb-3" />
                                                                                <p className="text-sm font-medium text-[var(--text-secondary)]">Analyzing hardware components…</p>
                                                                                <p className="text-xs text-[var(--text-muted)] mt-1">Generating function string and prep detail</p>
                                                                            </div>
                                                                        );
                                                                    }

                                                                    if (!prep) {
                                                                        return (
                                                                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                                                                <div className="w-12 h-12 rounded-full bg-[var(--bg-muted)] flex items-center justify-center mb-4">
                                                                                    <Wrench className="w-6 h-6 text-[var(--text-faint)]" />
                                                                                </div>
                                                                                <h4 className="text-sm font-semibold text-[var(--text-secondary)] mb-1">No hardware prep generated yet</h4>
                                                                                <p className="text-xs text-[var(--text-muted)] mb-5 max-w-xs">
                                                                                    Prep is generated automatically during the upload pipeline. Use this button if it was missed.
                                                                                </p>
                                                                                {prepError && (
                                                                                    <div className="mb-4 px-4 py-2.5 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 text-xs text-red-700 dark:text-red-400 max-w-sm text-left">
                                                                                        <span className="font-semibold">Error: </span>{prepError}
                                                                                    </div>
                                                                                )}
                                                                                <Button
                                                                                    size="sm"
                                                                                    onClick={() => handleGeneratePrep(set)}
                                                                                    disabled={set.items.length === 0}
                                                                                    className="gap-1.5"
                                                                                >
                                                                                    <Sparkles className="w-3.5 h-3.5" />
                                                                                    Generate Hardware Prep
                                                                                </Button>
                                                                                {set.items.length === 0 && (
                                                                                    <p className="text-[10px] text-[var(--text-faint)] mt-2">Add components to this set first</p>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    }

                                                                    return (
                                                                        <div>
                                                                            {/* Header row */}
                                                                            <div className="flex items-center justify-between mb-3">
                                                                                <div className="flex items-center gap-2">
                                                                                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                                                                                    <span className="text-xs text-[var(--text-muted)]">Hardware prep generated</span>
                                                                                </div>
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    onClick={() => handleGeneratePrep(set)}
                                                                                    className="gap-1.5 h-7 text-xs"
                                                                                >
                                                                                    <RefreshCw className="w-3 h-3" />
                                                                                    Regenerate
                                                                                </Button>
                                                                            </div>

                                                                            {/* Function string — primary display */}
                                                                            <div className="mb-4 px-4 py-3.5 rounded-lg border border-[var(--primary-border)] bg-[var(--primary-bg)] flex items-center gap-3">
                                                                                <Wrench className="w-4 h-4 text-[var(--primary-text-muted)] flex-shrink-0" />
                                                                                <div>
                                                                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--primary-text-muted)] mb-0.5">Function</p>
                                                                                    <p className="text-sm font-semibold text-[var(--text)]">{prep || '—'}</p>
                                                                                </div>
                                                                            </div>

                                                                            {prepError && (
                                                                                <div className="mb-3 px-4 py-2.5 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 text-xs text-red-700 dark:text-red-400">
                                                                                    <span className="font-semibold">Regeneration failed: </span>{prepError}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </TabsContent>
                                                        </Tabs>
                                                    </td>
                                                </tr>
                                            );
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
