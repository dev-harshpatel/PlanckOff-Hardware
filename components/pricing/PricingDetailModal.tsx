'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Tag, Scissors, X } from 'lucide-react';
import {
    buildDescription, extractDoorFields, extractFrameFields,
    type DoorPricingGroup, type HardwarePricingGroup,
    DOOR_FIELD_DEFS, FRAME_FIELD_DEFS,
} from '@/utils/pricingGrouping';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

export type PricingTab = 'door' | 'frame' | 'hardware' | 'proposal';

const TH = 'px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border-b border-[var(--border)]';
const TD = 'px-4 py-2.5 text-xs text-[var(--text-secondary)] border-b border-[var(--border-subtle)]';

export interface PricingDetailModalProps {
    group: DoorPricingGroup | HardwarePricingGroup | null;
    tab: PricingTab;
    onClose: () => void;
    onCreateVariant: ((doorIds: string[], label: string) => void) | null;
}

export function PricingDetailModal({ group, tab, onClose, onCreateVariant }: PricingDetailModalProps) {
    const isDoorFrame = tab === 'door' || tab === 'frame';
    const doorGroup = isDoorFrame ? (group as DoorPricingGroup) : null;
    const hwGroup   = !isDoorFrame ? (group as HardwarePricingGroup) : null;

    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
    const [showForm, setShowForm]     = useState(false);
    const [variantLabel, setVariantLabel] = useState('');
    const labelRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setCheckedIds(new Set()); setShowForm(false); setVariantLabel(''); }, [group]);
    useEffect(() => { if (showForm) setTimeout(() => labelRef.current?.focus(), 50); }, [showForm]);

    const toggleDoor = (doorId: string) => setCheckedIds(prev => {
        const next = new Set(prev);
        next.has(doorId) ? next.delete(doorId) : next.add(doorId);
        return next;
    });

    const allDoorIds = doorGroup?.doors.map(d => d.id) ?? [];
    const allChecked = allDoorIds.length > 0 && allDoorIds.every(id => checkedIds.has(id));

    const toggleAll = () => setCheckedIds(allChecked ? new Set() : new Set(allDoorIds));

    const handleConfirmVariant = () => {
        if (!variantLabel.trim() || checkedIds.size === 0 || !onCreateVariant) return;
        onCreateVariant(Array.from(checkedIds), variantLabel.trim());
        setCheckedIds(new Set());
        setShowForm(false);
        setVariantLabel('');
        onClose();
    };

    const canVariant = isDoorFrame && onCreateVariant && !doorGroup?.isVariant;

    return (
        <Dialog open={!!group} onOpenChange={open => { if (!open) onClose(); }}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-5 py-4 border-b border-[var(--border)] flex-shrink-0">
                    <DialogTitle className="text-sm font-semibold text-[var(--text)]">
                        {isDoorFrame
                            ? `${tab === 'door' ? 'Doors' : 'Frames'} in this group`
                            : `Sets using: ${hwGroup?.item.name ?? ''}`
                        }
                    </DialogTitle>
                    {isDoorFrame && doorGroup && (
                        <p className="text-xs text-[var(--text-faint)] mt-0.5">{doorGroup.description}</p>
                    )}
                </DialogHeader>

                <div className="flex-1 overflow-y-auto min-h-0">
                    <table className="min-w-full border-collapse text-xs">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-[var(--bg-subtle)]">
                                {isDoorFrame && canVariant && (
                                    <th className={`${TH} w-px`}>
                                        <input type="checkbox" checked={allChecked} onChange={toggleAll}
                                            className="w-3.5 h-3.5 rounded border-[var(--border-strong)] text-[var(--primary-action)] cursor-pointer" />
                                    </th>
                                )}
                                {isDoorFrame ? (
                                    <>
                                        <th className={TH}>Door Tag</th>
                                        <th className={TH}>Door Location</th>
                                        <th className={TH}>Fire Rating</th>
                                        {tab === 'frame' && (
                                            <>
                                                <th className={`${TH} w-px`}>Width</th>
                                                <th className={`${TH} w-px`}>Height</th>
                                            </>
                                        )}
                                        <th className={TH}>Description</th>
                                        <th className={`${TH} text-right w-px`}>Qty</th>
                                    </>
                                ) : (
                                    <>
                                        <th className={TH}>Set Name</th>
                                        <th className={`${TH} text-right`}>Multiplied Qty</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {isDoorFrame && doorGroup
                                ? doorGroup.doors.map((d, i) => (
                                    <tr key={d.id} className={`${i % 2 === 0 ? 'bg-[var(--bg)]' : 'bg-[var(--bg-subtle)]/40'} ${checkedIds.has(d.id) ? 'bg-[var(--primary-bg)]/30' : ''}`}>
                                        {canVariant && (
                                            <td className={`${TD} w-px`}>
                                                <input type="checkbox" checked={checkedIds.has(d.id)} onChange={() => toggleDoor(d.id)}
                                                    className="w-3.5 h-3.5 rounded border-[var(--border-strong)] text-[var(--primary-action)] cursor-pointer" />
                                            </td>
                                        )}
                                        <td className={`${TD} font-mono font-medium text-[var(--text)] w-px whitespace-nowrap`}>{d.doorTag}</td>
                                        <td className={`${TD} w-px whitespace-nowrap text-[var(--text-muted)]`}>{d.location ?? '—'}</td>
                                        <td className={`${TD} w-px whitespace-nowrap text-[var(--text-muted)]`}>{d.fireRating ?? '—'}</td>
                                        {tab === 'frame' && (() => {
                                            const sec = d.sections as unknown as Record<string, Record<string, string>> | undefined;
                                            const bi  = sec?.basic_information;
                                            const ds  = sec?.door;
                                            const rawW = bi?.['WIDTH'] ?? bi?.['DOOR WIDTH'] ?? ds?.['WIDTH'] ?? ds?.['DOOR WIDTH'] ?? '—';
                                            const rawH = bi?.['HEIGHT'] ?? bi?.['DOOR HEIGHT'] ?? ds?.['HEIGHT'] ?? ds?.['DOOR HEIGHT'] ?? '—';
                                            return (
                                                <>
                                                    <td className={`${TD} w-px whitespace-nowrap font-mono text-[var(--text-muted)]`}>{rawW || '—'}</td>
                                                    <td className={`${TD} w-px whitespace-nowrap font-mono text-[var(--text-muted)]`}>{rawH || '—'}</td>
                                                </>
                                            );
                                        })()}
                                        <td className={`${TD} text-[var(--text-muted)]`}>
                                            {tab === 'door'
                                                ? buildDescription(extractDoorFields(d), DOOR_FIELD_DEFS)
                                                : buildDescription(
                                                    Object.fromEntries(Object.entries(extractFrameFields(d)).filter(([k]) => !k.startsWith('_'))),
                                                    FRAME_FIELD_DEFS,
                                                )
                                            }
                                        </td>
                                        <td className={`${TD} text-right w-px whitespace-nowrap`}>{d.quantity ?? 1}</td>
                                    </tr>
                                ))
                                : hwGroup?.sets.map((s, i) => (
                                    <tr key={s.setId} className={i % 2 === 0 ? 'bg-[var(--bg)]' : 'bg-[var(--bg-subtle)]/40'}>
                                        <td className={`${TD} font-medium text-[var(--text)]`}>{s.setName}</td>
                                        <td className={`${TD} text-right`}>{s.multipliedQty}</td>
                                    </tr>
                                ))
                            }
                        </tbody>
                    </table>
                </div>

                <div className="px-5 py-3 border-t border-[var(--border)] bg-[var(--bg-subtle)] flex-shrink-0 space-y-2">
                    {showForm && (
                        <div className="flex items-center gap-2">
                            <Tag className="w-3.5 h-3.5 text-[var(--primary-text-muted)] flex-shrink-0" />
                            <input
                                ref={labelRef}
                                type="text"
                                value={variantLabel}
                                onChange={e => setVariantLabel(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleConfirmVariant()}
                                placeholder="Variant name…"
                                className="flex-1 px-2.5 py-1.5 text-xs border border-[var(--primary-border)] rounded-lg bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--primary-ring)] placeholder:text-[var(--text-faint)]"
                            />
                            <button
                                onClick={handleConfirmVariant}
                                disabled={!variantLabel.trim()}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--primary-action)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                            >
                                Create
                            </button>
                            <button onClick={() => { setShowForm(false); setVariantLabel(''); }}
                                className="p-1.5 rounded-lg text-[var(--text-faint)] hover:bg-[var(--bg-subtle)] transition-colors">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--text-faint)]">
                            {isDoorFrame && doorGroup
                                ? `${doorGroup.doors.length} door${doorGroup.doors.length !== 1 ? 's' : ''} · Total qty: ${doorGroup.totalQty}`
                                : hwGroup
                                    ? `${hwGroup.sets.length} set${hwGroup.sets.length !== 1 ? 's' : ''} · Total qty: ${hwGroup.totalQty}`
                                    : ''
                            }
                        </span>
                        {canVariant && checkedIds.size > 0 && !showForm && (
                            <button
                                onClick={() => setShowForm(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--primary-bg)] border border-[var(--primary-border)] text-[var(--primary-text)] hover:bg-[var(--primary-action)] hover:text-white hover:border-transparent transition-all"
                            >
                                <Scissors className="w-3 h-3" />
                                Split {checkedIds.size} door{checkedIds.size !== 1 ? 's' : ''} into variant
                            </button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
