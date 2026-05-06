
import React from 'react';
import { Door, HardwareSet, AppSettings, ElevationType, Toast } from '../../types';
import { sumDoorQuantities } from '../../utils/doorUtils';
import EnhancedDoorEditModal from '../doors/EnhancedDoorEditModal';
import ContextualProgressBar from '../shared/ContextualProgressBar';
import ValidationReportModal from '../reports/ValidationReportModal';
import Tooltip from '../shared/Tooltip';
import { useDoorTableState, ALL_AVAILABLE_COLUMNS, StatusFilter } from '../../hooks/useDoorTableState';
import { DoorTableHeader } from '../doors/DoorTableHeader';
import { DoorTableRow } from '../doors/DoorTableRow';
import {
    Table2, Search, Upload, AlertTriangle, Plus, Trash2,
    SlidersHorizontal, X, Loader2, Zap, Layers, ClipboardList,
    CheckCircle2, Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


interface ActiveUploadTask {
    fileName: string;
    stage: string;
    progress: number;
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
    onAssignAll: () => Promise<void>;
    onDoorSaved?: () => void;
}

const DoorScheduleManager: React.FC<DoorScheduleManagerProps> = ({
    doors = [],
    onDoorsUpdate,
    hardwareSets,
    isLoading,
    onUploadClick,
    appSettings: _appSettings,
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
    onAssignAll,
    onDoorSaved,
}) => {
    const {
        statusFilter, setStatusFilter,
        doorMaterialFilter, setDoorMaterialFilter,
        frameMaterialFilter, setFrameMaterialFilter,
        searchQuery, setSearchQuery,
        isAssigningBatch,
        editModalDoor, setEditModalDoor,
        savingDoorId,
        visibleColumns,
        customColumns,
        isColumnCustomizerOpen, setIsColumnCustomizerOpen,
        newColumnName, setNewColumnName,
        selectedRows,
        reportModalOpen, setReportModalOpen,
        isFilterMenuOpen, setIsFilterMenuOpen,
        filterMenuRef,
        lastErrorTask,
        hasUploadErrors,
        hasRowErrors,
        statusCounts,
        uniqueDoorMaterials,
        uniqueFrameMaterials,
        filteredAndSortedDoors,
        orderedColumns,
        allSelectableColumnKeys,
        areAllColumnsSelected,
        handleAssignAll,
        handleAddDoor,
        handleDeleteSelected,
        handleDeleteRow,
        toggleSelectAll,
        toggleRowSelection,
        handleAssignHardware,
        toggleColumn,
        toggleAllColumns,
        addCustomColumn,
        removeCustomColumn,
        handleDoorSave,
        validSetNames,
        renderCell,
        renderHeader,
    } = useDoorTableState({
        projectId,
        doors,
        onDoorsUpdate,
        onProvidedSetChange,
        addToast,
        onDeleteDoors,
        onAssignAll,
        hardwareSets,
        elevationTypes,
        onDoorSaved,
    });

    const FilterButton: React.FC<{
        filter: StatusFilter;
        label: string;
        count: number;
        tooltip: string;
    }> = ({ filter, label, count, tooltip }) => {
        const isActive = statusFilter === filter;
        const edgeRadiusClass =
            filter === 'all'     ? 'rounded-l-md' :
            filter === 'complete' ? 'rounded-r-md' : '';
        const dotColors: Record<StatusFilter, string> = {
            all:      '',
            pending:  'bg-amber-400',
            complete: 'bg-green-500',
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
                        <label className="flex items-center gap-2.5 px-2 py-2 mb-1 hover:bg-[var(--bg-subtle)] rounded cursor-pointer border-b border-[var(--border-subtle)]">
                            <input
                                type="checkbox"
                                checked={areAllColumnsSelected}
                                onChange={toggleAllColumns}
                                className="rounded text-[var(--primary-action)] focus:ring-[var(--primary-ring)] w-3.5 h-3.5"
                            />
                            <span className="text-sm font-medium text-[var(--text)]">Select all columns</span>
                        </label>
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
                                {sumDoorQuantities(filteredAndSortedDoors)} {sumDoorQuantities(filteredAndSortedDoors) === 1 ? 'door' : 'doors'} · {statusCounts.complete || 0} assigned
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
                            <Button
                                onClick={canReupload ? onUploadClick : undefined}
                                disabled={isLoading || isAssigningBatch || !canReupload}
                                loading={!!activeTask}
                                loadingText="Processing..."
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-xs font-medium"
                            >
                                <Upload className="w-3.5 h-3.5" />
                                Upload
                            </Button>
                        </Tooltip>
                        <Button
                            onClick={handleAddDoor}
                            disabled={isLoading}
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs font-medium"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Add Door
                        </Button>
                        <Tooltip content="Automatically assign hardware sets to all pending doors">
                            <Button
                                onClick={handleAssignAll}
                                disabled={isLoading || isAssigningBatch || filteredAndSortedDoors.length === 0}
                                loading={isAssigningBatch}
                                loadingText="Processing..."
                                size="sm"
                                className="gap-1.5 text-xs font-semibold"
                            >
                                <Zap className="w-3.5 h-3.5" />
                                {isAssigningBatch ? 'Processing…' : 'Assign All'}
                            </Button>
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
                                <Select value={doorMaterialFilter} onValueChange={setDoorMaterialFilter}>
                                    <SelectTrigger className="h-7 text-xs px-2.5">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        {uniqueDoorMaterials.map(mat => (
                                            <SelectItem key={mat} value={mat}>{mat}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-[10px] font-medium text-[var(--text-muted)] mb-1 block">Frame Material</label>
                                <Select value={frameMaterialFilter} onValueChange={setFrameMaterialFilter}>
                                    <SelectTrigger className="h-7 text-xs px-2.5">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        {uniqueFrameMaterials.map(mat => (
                                            <SelectItem key={mat} value={mat}>{mat}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
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
                    Showing <strong className="text-[var(--text-secondary)]">{sumDoorQuantities(filteredAndSortedDoors)}</strong> doors
                </span>
                <span className="text-[10px] text-[var(--text-faint)]">Click any row to open the editor</span>
            </div>

            {/* Main Table */}
            <div className="flex-grow min-h-0 overflow-auto relative bg-[var(--bg)]">
                <table className="min-w-full text-sm text-left text-[var(--text-muted)]">
                    <DoorTableHeader
                        orderedColumns={orderedColumns}
                        customColumns={customColumns}
                        filteredAndSortedDoors={filteredAndSortedDoors}
                        selectedRows={selectedRows}
                        toggleSelectAll={toggleSelectAll}
                        renderHeader={renderHeader}
                    />
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

                        {!isLoading && filteredAndSortedDoors.map((door) => (
                            <DoorTableRow
                                key={door.id}
                                door={door}
                                orderedColumns={orderedColumns}
                                customColumns={customColumns}
                                visibleColumns={visibleColumns}
                                selectedRows={selectedRows}
                                toggleRowSelection={toggleRowSelection}
                                setEditModalDoor={setEditModalDoor}
                                renderCell={renderCell}
                                handleDeleteRow={handleDeleteRow}
                                handleAssignHardware={handleAssignHardware}
                                savingDoorId={savingDoorId}
                                isLoading={isLoading}
                                isAssigningBatch={isAssigningBatch}
                                validSetNames={validSetNames}
                                elevationTypes={elevationTypes}
                            />
                        ))}

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
                    title="Upload Validation Report"
                    fileName={lastErrorTask.file.name}
                />
            )}

            {editModalDoor && (
                <EnhancedDoorEditModal
                    door={editModalDoor}
                    onSave={handleDoorSave}
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
