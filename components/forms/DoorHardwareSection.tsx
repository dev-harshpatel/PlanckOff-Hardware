import React from 'react';
import { Door, HardwareSet, HardwareItem } from '../../types';
import { PackageOpen } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { SectionHeader, ExcludedBanner, IncludeExcludeSelect } from './DoorFormSection';

export const inputCls = "w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--text)] bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)] focus:border-[var(--primary-ring)] placeholder:text-[var(--text-faint)] transition-colors";

interface DoorHardwareSectionProps {
    editedDoor: Door;
    hardwareSets: HardwareSet[];
    hwExcluded: boolean;
    matchedSet: HardwareSet | null;
    updateField: <K extends keyof Door>(field: K, value: Door[K]) => void;
}

export function DoorHardwareSection({ editedDoor, hardwareSets, hwExcluded, matchedSet, updateField }: DoorHardwareSectionProps) {
    return (
        <div className="space-y-1 max-w-2xl">

            {hwExcluded && <ExcludedBanner label="hardware" />}

            {/* Include / Exclude — always enabled */}
            <div className="pb-2">
                <label className="block text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1">Hardware Include / Exclude</label>
                <IncludeExcludeSelect
                    value={editedDoor.hardwareIncludeExclude ?? ''}
                    onChange={v => updateField('hardwareIncludeExclude', v || undefined)}
                />
            </div>

            {/* Assignment controls — disabled when excluded */}
            <SectionHeader>Assignment</SectionHeader>
            <div className={`grid grid-cols-2 gap-3 ${hwExcluded ? 'opacity-40 pointer-events-none' : ''}`}>
                <div>
                    <Label>Provided Hardware Set</Label>
                    <input type="text" className={inputCls}
                        disabled={hwExcluded}
                        value={editedDoor.providedHardwareSet || ''}
                        placeholder="e.g. Set 3.0, Set A…"
                        onChange={e => updateField('providedHardwareSet', e.target.value || undefined)} />
                </div>
                <div>
                    <Label>Assigned Hardware Set</Label>
                    <Select
                        disabled={hwExcluded}
                        value={editedDoor.assignedHardwareSet?.id || '__none__'}
                        onValueChange={v => {
                            const set = hardwareSets.find(s => s.id === v);
                            updateField('assignedHardwareSet', set);
                        }}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {hardwareSets.map(set => (
                                <SelectItem key={set.id} value={set.id}>{set.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Matched Hardware Set Items Table — hidden when excluded */}
            <div className={hwExcluded ? 'opacity-40 pointer-events-none' : ''}>
            <SectionHeader>Matched Hardware Set</SectionHeader>
            {matchedSet ? (
                <div className="border border-[var(--primary-border)] rounded-lg overflow-hidden">
                    {/* Set name banner */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--primary-bg)] border-b border-[var(--primary-border)]">
                        <div className="flex items-center gap-2">
                            <PackageOpen className="w-3.5 h-3.5 text-[var(--primary-text-muted)] flex-shrink-0" />
                            <span className="text-xs font-semibold text-[var(--primary-text)]">{matchedSet.name}</span>
                            {matchedSet.description && (
                                <span className="text-[10px] text-[var(--primary-text-muted)] truncate max-w-[200px]">{matchedSet.description}</span>
                            )}
                        </div>
                        <span className="text-[10px] font-medium text-[var(--primary-text-muted)] bg-[var(--primary-bg-hover)] px-2 py-0.5 rounded-full flex-shrink-0">
                            {matchedSet.items.length} item{matchedSet.items.length !== 1 ? 's' : ''}
                        </span>
                    </div>

                    {matchedSet.items.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-wider">
                                        <th className="px-3 py-2 text-center w-10">Qty</th>
                                        <th className="px-3 py-2 text-left">Item / Manufacturer</th>
                                        <th className="px-3 py-2 text-left">Description</th>
                                        <th className="px-3 py-2 text-left w-24">Finish</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-subtle)]">
                                    {matchedSet.items.map((item: HardwareItem, idx: number) => (
                                        <tr key={item.id || idx} className={idx % 2 === 0 ? 'bg-[var(--bg)]' : 'bg-[var(--bg-subtle)]/50'}>
                                            <td className="px-3 py-2.5 text-center font-semibold text-[var(--text-secondary)] tabular-nums">
                                                {item.quantity}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="font-medium text-[var(--text)] leading-snug">
                                                    {item.name || <span className="text-[var(--text-faint)] italic">—</span>}
                                                </div>
                                                {item.manufacturer && (
                                                    <div className="text-[10px] text-[var(--text-faint)] mt-0.5">{item.manufacturer}</div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 text-[var(--text-muted)] max-w-[220px]">
                                                <span className="line-clamp-2 leading-snug">
                                                    {item.description || <span className="text-[var(--text-faint)] italic">—</span>}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                {item.finish
                                                    ? <span className="inline-block px-2 py-0.5 bg-[var(--bg-muted)] text-[var(--text-muted)] rounded text-[10px] font-medium">{item.finish}</span>
                                                    : <span className="text-[var(--text-faint)]">—</span>
                                                }
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="px-4 py-6 text-center text-xs text-[var(--text-faint)]">
                            No items in this hardware set.
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex flex-col items-center gap-2 py-8 border border-dashed border-[var(--border)] rounded-lg bg-[var(--bg-subtle)]">
                    <PackageOpen className="w-8 h-8 text-[var(--text-faint)]" />
                    <p className="text-xs text-[var(--text-faint)] font-medium">No hardware set matched</p>
                    <p className="text-[10px] text-[var(--text-faint)] text-center max-w-[200px]">
                        Assign a set below or run <span className="font-semibold">Assign All</span> to auto-match.
                    </p>
                </div>
            )}
            </div>{/* end hwExcluded gate */}

            {/* Hardware Prep — sourced from the matched set's prep field */}
            {matchedSet?.prep && (
                <div className="pt-2">
                    <SectionHeader>Hardware Prep</SectionHeader>
                    <div className="px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] text-sm text-[var(--text-secondary)] leading-relaxed">
                        {matchedSet.prep}
                    </div>
                </div>
            )}

        </div>
    );
}
