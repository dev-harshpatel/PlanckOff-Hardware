'use client';

import React from 'react';
import { Plus, X, ChevronDown, Layers } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import type { GroupLevel, DoorGroup } from './doorScheduleTypes';
import { GROUPING_FIELDS, GROUPING_SECTIONS } from './doorScheduleTypes';

// ─── Group field picker modal ─────────────────────────────────────────────────

const GroupFieldPickerModal: React.FC<{
    open: boolean;
    onClose: () => void;
    onSelect: (colId: string) => void;
    usedColIds: Set<string>;
    currentColId: string | null;
    multiSelect: boolean;
}> = ({ open, onClose, onSelect, usedColIds, currentColId, multiSelect }) => (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
        <DialogContent className="max-w-xs p-0">
            <DialogHeader className="px-5 pt-5 pb-3 border-b border-[var(--border)]">
                <DialogTitle className="text-sm">Group By Field</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                    {multiSelect
                        ? 'Pick one or more fields to split the report into separate tables.'
                        : 'Pick a field to replace this grouping level.'}
                </DialogDescription>
            </DialogHeader>
            <div className="px-4 py-3 space-y-4 max-h-[60vh] overflow-y-auto">
                {GROUPING_SECTIONS.map(([sectionLabel, fields]) => (
                    <div key={sectionLabel}>
                        <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider mb-1.5">
                            {sectionLabel}
                        </p>
                        <div className="space-y-0.5">
                            {fields.map(gf => {
                                const isUsed = usedColIds.has(gf.colId) && gf.colId !== currentColId;
                                const isActive = gf.colId === currentColId || (multiSelect && usedColIds.has(gf.colId));
                                return (
                                    <button
                                        key={gf.colId}
                                        disabled={isUsed && !multiSelect}
                                        onClick={() => (multiSelect || !isUsed) && onSelect(gf.colId)}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                                            isActive
                                                ? 'bg-[var(--primary-action)] text-white hover:bg-[var(--primary-action-hover)] cursor-pointer'
                                                : 'text-[var(--text)] hover:bg-[var(--primary-bg)] hover:text-[var(--primary-text)]'
                                        }`}
                                    >
                                        {gf.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
            {multiSelect && (
                <DialogFooter className="px-5 pb-4 pt-3 border-t border-[var(--border)]">
                    <button
                        onClick={onClose}
                        className="w-full py-2 rounded-lg text-xs font-semibold bg-[var(--primary-action)] text-white hover:opacity-90 transition-opacity"
                    >
                        Done
                    </button>
                </DialogFooter>
            )}
        </DialogContent>
    </Dialog>
);

// ─── DoorGroupingControls ─────────────────────────────────────────────────────

interface DoorGroupingControlsProps {
    groupLevels: GroupLevel[];
    groups: DoorGroup[];
    pickerOpen: boolean;
    pickerForLevelId: string | null;
    usedGroupColIds: Set<string>;
    openPicker: (levelId?: string | null) => void;
    removeGroupLevel: (id: string) => void;
    handlePickField: (colId: string) => void;
    onPickerClose: () => void;
    uniqueData: boolean;
    onUniqueDataChange: (val: boolean) => void;
    onPreviewReset: () => void;
}

export function DoorGroupingControls({
    groupLevels,
    groups,
    pickerOpen,
    pickerForLevelId,
    usedGroupColIds,
    openPicker,
    removeGroupLevel,
    handlePickField,
    onPickerClose,
    uniqueData,
    onUniqueDataChange,
    onPreviewReset,
}: DoorGroupingControlsProps) {
    return (
        <>
            <div>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                        <Layers className="w-3 h-3 text-[var(--text-faint)]" />
                        <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Group By</p>
                    </div>
                    <button
                        onClick={() => openPicker(null)}
                        disabled={groupLevels.length >= GROUPING_FIELDS.length}
                        className="flex items-center gap-0.5 text-[10px] font-medium text-[var(--primary-text)] hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                    >
                        <Plus className="w-3 h-3" />
                        Add
                    </button>
                </div>

                {groupLevels.length === 0 ? (
                    <button
                        onClick={() => openPicker(null)}
                        className="w-full text-[11px] text-[var(--text-faint)] py-3 text-center border border-dashed border-[var(--border)] rounded-lg hover:border-[var(--primary-border)] hover:text-[var(--primary-text)] transition-colors"
                    >
                        + Add grouping to split into tables
                    </button>
                ) : (
                    <div className="space-y-1.5">
                        {groupLevels.map((level, idx) => (
                            <div key={level.id} className="flex items-center gap-2">
                                <span className="flex-shrink-0 w-[18px] h-[18px] rounded-full bg-[var(--primary-action)] text-white text-[9px] font-bold flex items-center justify-center">
                                    {idx + 1}
                                </span>
                                {/* Clickable pill — opens picker to change field */}
                                <button
                                    onClick={() => openPicker(level.id)}
                                    className="flex-1 flex items-center justify-between gap-1 text-xs px-2.5 py-1.5 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] hover:border-[var(--primary-border)] hover:bg-[var(--primary-bg)] hover:text-[var(--primary-text)] transition-colors min-w-0 group"
                                >
                                    <span className="truncate font-medium">{level.label}</span>
                                    <ChevronDown className="w-3 h-3 text-[var(--text-faint)] group-hover:text-[var(--primary-text)] flex-shrink-0" />
                                </button>
                                <button
                                    onClick={() => removeGroupLevel(level.id)}
                                    className="p-1 text-[var(--text-faint)] hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 rounded transition-colors flex-shrink-0"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                        {/* Path summary */}
                        <div className="text-[10px] text-[var(--text-faint)] pt-1 pl-1 flex items-center flex-wrap gap-0.5">
                            {groupLevels.map((l, i) => (
                                <React.Fragment key={l.id}>
                                    {i > 0 && <span className="text-[var(--border-strong)] mx-0.5">›</span>}
                                    <span className="text-[var(--text-muted)] font-medium">{l.label}</span>
                                </React.Fragment>
                            ))}
                            <span className="ml-1.5 text-[var(--primary-text-muted)] font-semibold">→ {groups.length} table{groups.length !== 1 ? 's' : ''}</span>
                        </div>
                    </div>
                )}

                <div className="mt-3 border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--bg)]">
                    <label className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-[var(--primary-bg)] transition-colors group">
                        <input
                            type="checkbox"
                            checked={uniqueData}
                            onChange={e => { onUniqueDataChange(e.target.checked); onPreviewReset(); }}
                            className="w-3.5 h-3.5 rounded border-[var(--border-strong)] text-[var(--primary-action)] focus:ring-[var(--primary-ring)] cursor-pointer flex-shrink-0 mt-0.5"
                        />
                        <div className="min-w-0">
                            <span className="text-xs font-medium text-[var(--text-secondary)] group-hover:text-[var(--primary-text)] transition-colors">
                                Unique Data
                            </span>
                            <span className="text-[10px] text-[var(--text-faint)] block mt-0.5">
                                Merge rows with matching selected columns, combine door tags, and sum quantity.
                            </span>
                        </div>
                    </label>
                </div>
            </div>

            <GroupFieldPickerModal
                open={pickerOpen}
                onClose={onPickerClose}
                onSelect={handlePickField}
                usedColIds={usedGroupColIds}
                currentColId={pickerForLevelId ? (groupLevels.find(l => l.id === pickerForLevelId)?.colId ?? null) : null}
                multiSelect={pickerForLevelId === null}
            />
        </>
    );
}
