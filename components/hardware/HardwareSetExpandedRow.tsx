'use client';

import React from 'react';
import {
    Copy, AlertCircle, AlertTriangle, Layers, DoorOpen, Info, Loader2,
    CheckCircle2, Wrench, Sparkles, RefreshCw,
} from 'lucide-react';
import { HardwareSet, Door, HardwareItem } from '../../types';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { getDoorConflicts, formatDimension } from '../../utils/hardwareUtils';
import type { AssignedDoorConflictMap } from '../../utils/doorValidation';

const renderConflictIcon = (message: string, isCritical: boolean) => {
    if (isCritical) return <AlertCircle className="w-3 h-3 text-red-600 inline-block ml-1" />;
    return <AlertTriangle className="w-3 h-3 text-amber-500 inline-block ml-1" />;
};

interface HardwareSetExpandedRowProps {
    set: HardwareSet;
    currentTab: 'components' | 'doors' | 'details' | 'prep';
    setActiveTab: (tab: 'components' | 'doors' | 'details' | 'prep') => void;
    assignedDoors: Door[];
    assignedDoorMismatches: Map<string, AssignedDoorConflictMap>;
    currentDoorSelection: Set<string>;
    doorQuantityTotals: Map<string, number>;
    prepGenerating: Set<string>;
    prepErrors: Record<string, string>;
    hasAnyConflicts: boolean;
    handleCreateVariantFromSelection: (set: HardwareSet) => void;
    handleToggleDoorSelection: (setId: string, doorId: string) => void;
    handleToggleAllDoorsInSection: (setId: string, doors: Door[], select: boolean) => void;
    handleGeneratePrep: (set: HardwareSet) => Promise<void>;
}

export function HardwareSetExpandedRow({
    set,
    currentTab,
    setActiveTab,
    assignedDoors,
    assignedDoorMismatches,
    currentDoorSelection,
    doorQuantityTotals,
    prepGenerating,
    prepErrors,
    hasAnyConflicts,
    handleCreateVariantFromSelection,
    handleToggleDoorSelection,
    handleToggleAllDoorsInSection,
    handleGeneratePrep,
}: HardwareSetExpandedRowProps) {
    return (
        <tr className="bg-[var(--bg-subtle)]">
            <td colSpan={5} className="px-5 py-4">
                <Tabs value={currentTab} onValueChange={(v) => setActiveTab(v as 'components' | 'doors' | 'details' | 'prep')}>
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
}
