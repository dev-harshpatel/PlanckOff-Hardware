'use client';
import React from 'react';
import { Door, HardwareSet, ElevationType } from '../../types';
import { ColumnDef, CustomColumn, DOOR_SECTION_KEYS, FRAME_SECTION_KEYS, HARDWARE_SECTION_KEYS } from '../../hooks/useDoorTableState';
import { ConfidenceIndicator } from './ConfidenceIndicator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Plus, Trash2, Loader2, Ban } from 'lucide-react';

interface DoorTableRowProps {
    door: Door;
    orderedColumns: ColumnDef[];
    customColumns: CustomColumn[];
    visibleColumns: Set<string>;
    selectedRows: Set<string>;
    toggleRowSelection: (id: string) => void;
    setEditModalDoor: (door: Door | null) => void;
    renderCell: (door: Door, colKey: string, type?: 'text' | 'number' | 'select', options?: string[]) => React.ReactNode;
    handleDeleteRow: (id: string) => void;
    handleAssignHardware: (doorId: string) => void;
    savingDoorId: string | null;
    isLoading: boolean;
    isAssigningBatch: boolean;
    validSetNames: Set<string>;
    elevationTypes: ElevationType[];
}

export function DoorTableRow({
    door,
    orderedColumns,
    customColumns,
    visibleColumns,
    selectedRows,
    toggleRowSelection,
    setEditModalDoor,
    renderCell,
    handleDeleteRow,
    handleAssignHardware,
    savingDoorId,
    isLoading,
    isAssigningBatch,
    validSetNames,
    elevationTypes,
}: DoorTableRowProps) {
    const providedLower = door.providedHardwareSet?.trim().toLowerCase() || '';
    const isMissingSet = !providedLower;
    const isInvalidRef = providedLower && !validSetNames.has(providedLower);
    const isManualEntry = door.isManualEntry === true;
    const isValidationFailure = !isManualEntry && (isMissingSet || isInvalidRef);
    const isSaving = savingDoorId === door.id;

    const isDoorSecExcluded  = door.doorIncludeExclude?.toUpperCase()     === 'EXCLUDE';
    const isFrameSecExcluded = door.frameIncludeExclude?.toUpperCase()    === 'EXCLUDE';
    const isHwSecExcluded    = door.hardwareIncludeExclude?.toUpperCase() === 'EXCLUDE';

    const cellExcludedCls = 'opacity-40 bg-[var(--bg-subtle)]';

    return (
        <tr
            key={door.id}
            className={`transition-colors group cursor-pointer ${isSaving ? 'opacity-50 pointer-events-none' : ''} ${isValidationFailure
                ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30'
                : isManualEntry
                    ? 'bg-amber-50/80 dark:bg-amber-900/10 hover:bg-amber-100 dark:hover:bg-amber-900/20'
                    : selectedRows.has(door.id)
                        ? 'bg-[var(--primary-bg)]'
                        : 'hover:bg-[var(--bg-subtle)]'
                }`}
            onClick={() => setEditModalDoor(door)}
            title="Click to edit door"
        >
            <td className={`px-3 py-2.5 border-l-2 ${
                isValidationFailure
                    ? 'border-l-red-400 dark:border-l-red-800'
                    : isManualEntry
                        ? 'border-l-amber-300 dark:border-l-amber-700'
                        : selectedRows.has(door.id)
                            ? 'border-l-[var(--primary-ring)]'
                            : 'border-l-transparent'
            }`}>
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
                        <td key={col.key} className={`px-2 py-2 ${isDoorSecExcluded ? cellExcludedCls : ''}`}>
                            <div className="p-1 rounded min-h-[24px] flex items-center truncate text-[var(--text-secondary)]">
                                {displayValue || <span className="text-[var(--text-faint)] text-xs">—</span>}
                            </div>
                        </td>
                    );
                }

                if (col.key === 'providedHardwareSet') {
                    const isExcludedCell = isHwSecExcluded;
                    return (
                        <td key={col.key} className={`px-2 py-2 font-medium border-l border-[var(--border-subtle)] ${isExcludedCell ? cellExcludedCls : isInvalidRef ? 'text-red-700 font-bold' : 'text-[var(--text-secondary)]'}`}>
                            {renderCell(door, 'providedHardwareSet')}
                        </td>
                    );
                }

                const isCellExcluded =
                    (isDoorSecExcluded  && DOOR_SECTION_KEYS.has(col.key))  ||
                    (isFrameSecExcluded && FRAME_SECTION_KEYS.has(col.key)) ||
                    (isHwSecExcluded    && HARDWARE_SECTION_KEYS.has(col.key));

                const alignClass = col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left';
                const weightClass = col.key === 'doorTag' ? 'font-semibold text-[var(--text)]' : '';

                return (
                    <td key={col.key} className={`px-2 py-2 ${alignClass} ${weightClass} ${isCellExcluded ? cellExcludedCls : ''}`}>
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

            <td className={`px-2 py-2 border-l border-[var(--border-subtle)] ${isHwSecExcluded ? cellExcludedCls : door.status === 'error' ? 'bg-red-50/50 dark:bg-red-900/10' : isManualEntry ? 'bg-amber-50/70 dark:bg-amber-900/10' : 'bg-[var(--primary-bg)]/20'}`}>
                {isHwSecExcluded ? (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                        <Ban className="w-2.5 h-2.5" />
                        HW Excluded
                    </Badge>
                ) : isManualEntry ? (
                    <Badge variant="secondary" className="text-[10px] gap-1 border-amber-300 bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700">
                        <Plus className="w-2.5 h-2.5" />
                        Manual
                    </Badge>
                ) : isInvalidRef ? (
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

            <td className="px-2 py-2 text-center">
                {isSaving ? (
                    <div className="flex items-center justify-center">
                        <Loader2 className="w-4 h-4 text-[var(--primary-text-muted)] animate-spin" />
                    </div>
                ) : (
                    <div className="flex items-center justify-center gap-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteRow(door.id); }}
                            className="p-1.5 text-[var(--text-faint)] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Delete Door"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <Button
                            onClick={(e) => { e.stopPropagation(); handleAssignHardware(door.id); }}
                            disabled={door.status === 'loading' || isLoading || isAssigningBatch || isValidationFailure}
                            loading={door.status === 'loading'}
                            title={isValidationFailure ? "Fix Provided Set first" : "Run AI to assign hardware set"}
                            size="sm"
                            className={`h-auto px-2 py-1 text-[10px] font-semibold text-white rounded transition-all ${door.status === 'loading' ? 'bg-[var(--primary-action)]/60 cursor-not-allowed' :
                                isValidationFailure ? 'bg-[var(--bg-emphasis)] cursor-not-allowed text-[var(--text-muted)]' :
                                    door.status === 'complete' ? 'bg-green-500 hover:bg-green-600' :
                                        door.status === 'error' ? 'bg-red-500 hover:bg-red-600' :
                                            'bg-[var(--primary-action)] hover:bg-[var(--primary-action-hover)]'
                                } disabled:opacity-50`}
                        >
                            {door.status === 'complete' ? 'Retry' : 'Assign'}
                        </Button>
                    </div>
                )}
            </td>
        </tr>
    );
}
