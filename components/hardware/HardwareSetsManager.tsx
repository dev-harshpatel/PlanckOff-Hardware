'use client';

import React from 'react';
import { HardwareSet, Door } from '../../types';
import HardwareSetModal from './HardwareSetModal';
import UploadConfirmationModal from '../upload/UploadConfirmationModal';
import Tooltip from '../shared/Tooltip';
import ContextualProgressBar from '../shared/ContextualProgressBar';
import { useHardwareSetsManager } from '../../hooks/useHardwareSetsManager';
import { HardwareSetExpandedRow } from './HardwareSetExpandedRow';
import { getAssignedDoorMismatchMap, AssignedDoorConflictMap } from '../../utils/doorValidation';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
    Upload, Plus, Search, ChevronRight, ChevronDown, ChevronUp,
    Copy, Pencil, Trash2, AlertTriangle, AlertCircle, Package, X,
    Ban, Loader2, CheckCircle2,
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

const HardwareSetsManager: React.FC<HardwareSetsManagerProps> = (props) => {
    const {
        projectId, hardwareSets = [], doors = [], isLoading,
        onProcessUploads, onSaveSet, onDeleteSet, onBulkDeleteSets, onCreateVariant,
        activeTask, onCancelTask, canReupload = true,
    } = props;

    const [conflictsModal, setConflictsModal] = React.useState<{
        setName: string;
        assignedDoors: Door[];
        mismatches: Map<string, AssignedDoorConflictMap>;
        hardwareSet: (typeof hardwareSets)[0];
    } | null>(null);

    const {
        fileInputRef,
        isModalOpen, closeModal,
        isConfirmModalOpen, closeConfirmModal,
        selectedFiles,
        isDraggingOver,
        setToEdit,
        variantSource,
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
    } = useHardwareSetsManager({
        projectId, hardwareSets, doors, isLoading,
        onProcessUploads, onSaveSet, onDeleteSet, onBulkDeleteSets, onCreateVariant,
    });

    const SortIcon: React.FC<{ columnKey: 'name' | 'doors' | 'items' }> = ({ columnKey }) => {
        if (sortConfig?.key !== columnKey) return <ChevronDown className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-40" />;
        return sortConfig.direction === 'asc'
            ? <ChevronUp className="w-3 h-3 ml-1 text-white" />
            : <ChevronDown className="w-3 h-3 ml-1 text-white" />;
    };

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
                        <Button size="sm" variant="ghost" onClick={clearSelection} className="text-gray-500 h-7 px-2">
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
                                const assignedDoors = doors.filter(d =>
                                    d.assignedHardwareSet?.id === set.id &&
                                    d.hardwareIncludeExclude?.toUpperCase() !== 'EXCLUDE'
                                );
                                const assignedDoorMismatches = getAssignedDoorMismatchMap(assignedDoors);
                                const currentDoorSelection = selectedDoors[set.id] || new Set();
                                const isUnavailable = set.isAvailable === false;
                                const isManualEntry = set.isManualEntry === true;
                                const hasAnyConflicts = assignedDoors.some(d =>
                                    Object.keys(assignedDoorMismatches.get(d.id) ?? {}).length > 0
                                );
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
                                                        <Tooltip content="Conflict detected on one or more assigned doors. Click to view.">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setConflictsModal({ setName: set.name, assignedDoors, mismatches: assignedDoorMismatches, hardwareSet: set });
                                                                }}
                                                                className="p-0 bg-transparent border-none cursor-pointer flex-shrink-0 hover:opacity-75 transition-opacity"
                                                            >
                                                                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                                                            </button>
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
                                        {isExpanded && (
                                            <HardwareSetExpandedRow
                                                set={set}
                                                currentTab={activeTab[set.id] || 'components'}
                                                setActiveTab={(tab) => setActiveTab(prev => ({ ...prev, [set.id]: tab }))}
                                                assignedDoors={assignedDoors}
                                                assignedDoorMismatches={assignedDoorMismatches}
                                                currentDoorSelection={currentDoorSelection}
                                                doorQuantityTotals={doorQuantityTotals}
                                                prepGenerating={prepGenerating}
                                                prepErrors={prepErrors}
                                                hasAnyConflicts={hasAnyConflicts}
                                                handleCreateVariantFromSelection={handleCreateVariantFromSelection}
                                                handleToggleDoorSelection={handleToggleDoorSelection}
                                                handleToggleAllDoorsInSection={handleToggleAllDoorsInSection}
                                                handleGeneratePrep={handleGeneratePrep}
                                            />
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <HardwareSetModal
                isOpen={isModalOpen}
                onClose={closeModal}
                onSave={handleSaveAndClose}
                setToEdit={setToEdit}
                hardwareSets={hardwareSets}
                variantSource={variantSource}
            />
            <UploadConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={closeConfirmModal}
                onConfirm={handleConfirmUpload}
                files={selectedFiles}
                isLoading={isLoading}
            />

            {/* Door conflicts modal */}
            {conflictsModal && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
                    onClick={() => setConflictsModal(null)}
                >
                    <div
                        className="bg-[var(--bg)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[75vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] flex-shrink-0">
                            <h3 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-red-500" />
                                Door Conflicts — Set {conflictsModal.setName}
                            </h3>
                            <button
                                onClick={() => setConflictsModal(null)}
                                className="p-1 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 p-4 space-y-4">
                            {conflictsModal.assignedDoors.map(door => {
                                const groupConflicts = conflictsModal.mismatches.get(door.id) ?? {};
                                const entries = Object.entries(groupConflicts).filter(([, msg]) => !!msg);
                                if (entries.length === 0) return null;
                                return (
                                    <div key={door.id}>
                                        <p className="text-xs font-semibold text-[var(--text)] mb-1.5">
                                            Door {door.doorTag}{door.location ? ` · ${door.location}` : ''}
                                        </p>
                                        <div className="space-y-1.5">
                                            {entries.map(([field, message]) => (
                                                <div
                                                    key={field}
                                                    className="rounded-lg border p-3 bg-amber-500/10 border-amber-500/20 flex items-start gap-2"
                                                >
                                                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-amber-500 flex-shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-medium text-[var(--text)]">{message}</p>
                                                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono">{field}</p>
                                                    </div>
                                                    <span className="ml-auto flex-shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
                                                        Warning
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end flex-shrink-0">
                            <button
                                onClick={() => setConflictsModal(null)}
                                className="px-4 py-1.5 text-sm bg-[var(--bg-muted)] border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HardwareSetsManager;
