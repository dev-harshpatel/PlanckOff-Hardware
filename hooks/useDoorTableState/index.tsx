'use client';
import React, { useState, useMemo } from 'react';
import { Door, HardwareSet, ElevationType, Toast } from '../../types';
import { matchHardwareSet } from '../../utils/hardwareMatcher';
import { migrateDoorData } from '../../utils/doorDataMigration';
import { useBackgroundUpload } from '../../contexts/BackgroundUploadContext';
import { ChevronUp, ChevronDown, ChevronsUpDown, GripVertical } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFilterState } from './filterState';
import { useColumnVisibility } from './columnVisibility';
import { useRowSelection } from './rowSelection';
import { useCellEditState } from './cellEditState';
import { ALL_AVAILABLE_COLUMNS, formatDimension, ColumnDef, CustomColumn } from './columnDefinitions';

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
    projectId, doors, onDoorsUpdate, onProvidedSetChange, addToast,
    onDeleteDoors, onAssignAll, hardwareSets, elevationTypes = [], onDoorSaved,
}: UseDoorTableStateParams) {
    const [isAssigningBatch, setIsAssigningBatch] = useState(false);
    const [editModalDoor, setEditModalDoor] = useState<Door | null>(null);
    const [savingDoorId, setSavingDoorId] = useState<string | null>(null);

    const { tasks } = useBackgroundUpload();
    const lastErrorTask = useMemo(() =>
        [...tasks]
            .filter(t => t.type === 'door-schedule' && (t.status === 'completed' || t.status === 'error'))
            .sort((a, b) => b.createdAt - a.createdAt)[0],
    [tasks]);
    const hasUploadErrors = lastErrorTask?.result && ((lastErrorTask.result.errors?.length ?? 0) > 0 || (lastErrorTask.result.warnings?.length ?? 0) > 0);
    const hasRowErrors = doors.some(d => d.status === 'error');
    const validSetNames = useMemo(() => {
        const names = new Set<string>();
        for (const s of hardwareSets) {
            const full = s.name.trim().toLowerCase();
            names.add(full);
            // Also accept the code prefix so "P200" is valid when the set is named "P200 – Elevator Lobby"
            const sepIdx = full.search(/[\s\-–—_]/);
            if (sepIdx > 0) names.add(full.slice(0, sepIdx));
        }
        return names;
    }, [hardwareSets]);

    const filterState = useFilterState({ doors });
    const colVis = useColumnVisibility({ projectId, addToast });
    const rowSel = useRowSelection({ filteredAndSortedDoors: filterState.filteredAndSortedDoors });
    const editState = useCellEditState({ onDoorsUpdate, onProvidedSetChange });

    const handleAssignHardware = (doorId: string): void => {
        const doorToUpdate = doors.find(d => d.id === doorId);
        if (!doorToUpdate) return;
        const provided = doorToUpdate.providedHardwareSet?.trim() ?? '';
        const matchResult = matchHardwareSet(provided, hardwareSets);
        if (matchResult) {
            onDoorsUpdate(currentDoors => currentDoors.map(d => d.id === doorId
                ? { ...d, status: 'complete', assignedHardwareSet: matchResult.set, assignmentConfidence: matchResult.confidence, assignmentReason: matchResult.reason, errorMessage: undefined }
                : d));
        } else {
            onDoorsUpdate(currentDoors => currentDoors.map(d => d.id === doorId
                ? { ...d, status: 'error', errorMessage: `No hardware set matched "${provided}"` }
                : d));
        }
    };

    const handleAssignAll = async () => {
        setIsAssigningBatch(true);
        try { await onAssignAll(); } finally { setIsAssigningBatch(false); }
    };

    const handleAddDoor = () => {
        const newDoor: Door = {
            id: `manual-${Date.now()}`, doorTag: 'New Door', location: '',
            interiorExterior: 'Interior', quantity: 1, leafCount: 1, operation: 'Swing',
            fireRating: 'N/A', width: 36, height: 84, thickness: 1.75,
            doorMaterial: '', frameMaterial: '', hardwarePrep: '', type: '', status: 'pending', isManualEntry: true,
        };
        onDoorsUpdate(prev => [...prev, newDoor]);
        setEditModalDoor(newDoor);
    };

    const handleDeleteSelected = () => {
        if (rowSel.selectedRows.size === 0) return;
        const ids = Array.from(rowSel.selectedRows);
        if (onDeleteDoors) { onDeleteDoors(ids); } else { onDoorsUpdate(prev => prev.filter(d => !rowSel.selectedRows.has(d.id))); }
        rowSel.setSelectedRows(new Set());
    };

    const handleDeleteRow = (id: string) => {
        if (onDeleteDoors) { onDeleteDoors([id]); } else { onDoorsUpdate(prev => prev.filter(d => d.id !== id)); }
        if (rowSel.selectedRows.has(id)) {
            const newSelected = new Set(rowSel.selectedRows);
            newSelected.delete(id);
            rowSel.setSelectedRows(newSelected);
        }
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
                    const body: Record<string, unknown> = { doorTag: migratedDoor.doorTag, sections: migratedDoor.sections };
                    if (hwSetChanged) { body.hwSet = newHwSet; }
                    const res = await fetch(`/api/projects/${projectId}/door-schedule`, {
                        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
                    });
                    if (!res.ok) { const err = await res.json().catch(() => ({})); console.error('[DoorScheduleManager] Persist failed:', err); }
                    else { onDoorSaved?.(); }
                } catch (err) { console.error('[DoorScheduleManager] Persist fetch error:', err); }
            }
            addToast({ type: 'success', message: `Door ${migratedDoor.doorTag} updated successfully` });
        } finally { setSavingDoorId(null); }
    };

    const renderCell = (door: Door, colKey: string, type: 'text' | 'number' | 'select' = 'text', options?: string[]) => {
        const isEditing = editState.editingCell?.id === door.id && editState.editingCell?.field === colKey;
        let value: any;
        if (colKey.includes('.')) {
            const parts = colKey.split('.');
            value = door;
            for (const part of parts) { value = value?.[part as keyof typeof value]; if (value === undefined) break; }
        } else { value = door[colKey as keyof Door]; }
        if (value === undefined && door.customFields) { value = door.customFields[colKey]; }

        if (isEditing) {
            if (type === 'select' && options) {
                return (
                    <Select value={String(editState.tempValue) || '__none__'} onValueChange={(v) => {
                        const newVal = v === '__none__' ? '' : v;
                        editState.setTempValue(newVal);
                        if (!editState.editingCell) return;
                        onDoorsUpdate(prev => prev.map(d => {
                            if (d.id !== editState.editingCell!.id) return d;
                            const isCustom = editState.editingCell!.field.toString().startsWith('custom_');
                            if (isCustom || !Object.keys(d).includes(editState.editingCell!.field as string)) {
                                return { ...d, customFields: { ...(d.customFields || {}), [editState.editingCell!.field]: newVal } };
                            }
                            return { ...d, [editState.editingCell!.field]: newVal };
                        }));
                        editState.setEditingCell(null); editState.setTempValue('');
                    }}>
                        <SelectTrigger className="h-8 w-full text-sm border-2 border-[var(--primary-ring)]"><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__none__">Select...</SelectItem>
                            {options.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                        </SelectContent>
                    </Select>
                );
            }
            return (
                <input ref={editState.inputRef as any} type={type} value={editState.tempValue}
                    onChange={(e) => editState.setTempValue(e.target.value)}
                    onBlur={editState.saveEdit} onKeyDown={editState.handleKeyDown}
                    className="w-full p-1 text-sm border-2 border-[var(--primary-ring)] rounded focus:outline-none shadow-sm" autoFocus />
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
            if (typeof value === 'object') { displayContent = (value as HardwareSet).name || '[Object]'; }
            else if ((colKey === 'width' || colKey === 'height') && typeof value === 'number') { displayContent = formatDimension(value); }
            else { displayContent = value; }
        } else { displayContent = <span className="text-[var(--text-faint)] text-xs">—</span>; }

        return <div className="p-1 rounded min-h-[24px] flex items-center truncate text-[var(--text-secondary)]">{displayContent}</div>;
    };

    const SortIcon: React.FC<{ columnKey: keyof Door }> = ({ columnKey }) => {
        if (filterState.sortConfig?.key !== columnKey) return <ChevronsUpDown className="w-3 h-3 text-[var(--text-faint)] opacity-0 group-hover:opacity-100" />;
        return filterState.sortConfig.direction === 'asc'
            ? <ChevronUp className="w-3 h-3 text-[var(--primary-text-muted)]" />
            : <ChevronDown className="w-3 h-3 text-[var(--primary-text-muted)]" />;
    };

    const renderHeader = (col: ColumnDef | CustomColumn) => {
        const colKey = 'key' in col ? col.key : col.id;
        const isVisible = colVis.visibleColumns.has(colKey);
        if (!isVisible) return null;
        const label = col.label;
        const widthClass = 'width' in col ? col.width : 'min-w-[100px]';
        const align = 'align' in col ? col.align : 'left';
        const isStdCol = 'key' in col;
        const isDragOver = colVis.dragOverKey === colKey;
        return (
            <th key={colKey} scope="col" draggable={isStdCol}
                onDragStart={isStdCol ? (e) => colVis.handleColDragStart(e, colKey) : undefined}
                onDragOver={isStdCol ? (e) => colVis.handleColDragOver(e, colKey) : undefined}
                onDrop={isStdCol ? (e) => colVis.handleColDrop(e, colKey) : undefined}
                onDragEnd={isStdCol ? colVis.handleColDragEnd : undefined}
                onClick={() => filterState.handleSort(colKey as keyof Door)}
                className={`px-2 py-2.5 border-b border-[var(--primary-border)] ${widthClass} hover:bg-[var(--primary-bg-hover)] group select-none transition-colors
                    ${isStdCol ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
                    ${isDragOver ? 'border-l-2 border-[var(--primary-ring)] bg-[var(--primary-bg-hover)]' : 'border-l border-transparent'}`}
                title={isStdCol ? `Drag to reorder · Click to sort` : `Sort by ${label}`}
            >
                <div className={`flex items-center gap-1 ${align === 'center' ? 'justify-center' : 'justify-start'}`}>
                    {isStdCol && <GripVertical className="w-3 h-3 text-[var(--primary-border)] opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />}
                    <span className="truncate text-xs font-semibold text-[var(--primary-text)] uppercase tracking-wide">{label}</span>
                    <SortIcon columnKey={colKey as keyof Door} />
                </div>
            </th>
        );
    };

    return {
        ...filterState,    // 14 values
        ...colVis,         // 22 values
        ...rowSel,         // 8 values
        ...editState,      // 9 values
        // orchestrator-owned (16 values)
        isAssigningBatch, editModalDoor, setEditModalDoor, savingDoorId,
        lastErrorTask, hasUploadErrors, hasRowErrors, validSetNames,
        handleAssignHardware, handleAssignAll, handleAddDoor,
        handleDeleteSelected, handleDeleteRow, handleDoorSave,
        renderCell, renderHeader,
    };
}

// Barrel re-exports — required for call-site compatibility (directory-index resolution)
// consumers import from '../../hooks/useDoorTableState' which resolves to this index.tsx
export { ALL_AVAILABLE_COLUMNS, formatDimension, DOOR_SECTION_KEYS, FRAME_SECTION_KEYS, HARDWARE_SECTION_KEYS } from './columnDefinitions';
export type { ColumnDef, CustomColumn, PersistedColumnPrefs, StatusFilter } from './columnDefinitions';
// VER-03 N/A: no sub-file has a default export; there is no default export to re-export
// Per Phase 9 precedent (excelExportService), VER-03 is marked N/A when no default export exists.
