'use client';

import React from 'react';
import { Eye, Scissors, Trash2 } from 'lucide-react';
import {
  DOOR_FIELD_DEFS, FRAME_FIELD_DEFS,
  type DoorPricingGroup, type HardwarePricingGroup,
} from '@/utils/pricingGrouping';
import { PriceInput } from './PriceInput';
import type { PricingTab } from './PricingDetailModal';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

// ─── Shared table cell classes ────────────────────────────────────────────────

export const TH = 'px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] whitespace-nowrap shadow-[inset_0_-1px_0_0_var(--border)]';
export const TD = 'px-4 py-2.5 border-b border-[var(--border-subtle)] text-[var(--text-secondary)]';

// ─── Door / Frame row ─────────────────────────────────────────────────────────

export const DoorRow: React.FC<{
  group: DoorPricingGroup;
  idx: number;
  category: PricingTab;
  onPriceChange: (cat: PricingTab, key: string, val: string) => void;
  onView: () => void;
  onDeleteVariant?: (variantKey: string) => void;
}> = ({ group, idx, category, onPriceChange, onView, onDeleteVariant }) => {
  const even = idx % 2 === 0;
  const fieldDefs = category === 'door' ? DOOR_FIELD_DEFS : FRAME_FIELD_DEFS;
  const visibleFields = fieldDefs.filter(f => group.fields[f.key]);
  return (
    <tr className={even ? 'bg-[var(--bg)]' : 'bg-[var(--bg-subtle)]/40'}>
      <td className={TD} colSpan={2}>
        <div className="flex items-center gap-2">
          <div className="font-medium text-[var(--text)] flex-1">{group.description}</div>
          {group.isVariant && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Scissors className="w-2.5 h-2.5" />
                Variant
              </span>
              <button
                onClick={() => onDeleteVariant?.(group.variantKey!)}
                title="Dissolve variant (doors return to their base group)"
                className="p-0.5 rounded text-[var(--text-faint)] hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        {!group.isVariant && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {visibleFields.slice(0, 4).map(f => (
              <span key={f.key} className="text-[10px] px-1 py-px rounded bg-[var(--bg-muted)] text-[var(--text-faint)]">
                {f.label}: {group.fields[f.key]}
              </span>
            ))}
            {group.prep.map((p, i) => (
              <span key={`prep-${i}`} className="text-[10px] px-1.5 py-px rounded bg-[var(--primary-bg)] border border-[var(--primary-border)] text-[var(--primary-text-muted)]">
                Prep: {p}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className={`${TD} text-right font-mono w-px whitespace-nowrap`}>{group.totalQty}</td>
      <td className={`${TD} text-right w-px whitespace-nowrap`}>
        <PriceInput value={group.unitPrice} onChange={v => onPriceChange(category, group.key, v)} />
      </td>
      <td className={`${TD} text-right font-semibold text-[var(--text)] w-px whitespace-nowrap`}>{fmt.format(group.totalPrice)}</td>
      <td className={`${TD} text-center w-px whitespace-nowrap`}>
        <button
          onClick={onView}
          title={`View ${group.doors.length} door${group.doors.length !== 1 ? 's' : ''}`}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-[var(--bg-muted)] hover:bg-[var(--primary-bg)] text-[var(--text-muted)] hover:text-[var(--primary-text)] transition-colors"
        >
          <Eye className="w-3 h-3" />
          {group.doors.length}
        </button>
      </td>
    </tr>
  );
};

// ─── Hardware row ─────────────────────────────────────────────────────────────

export const HardwareRow: React.FC<{
  group: HardwarePricingGroup;
  idx: number;
  onPriceChange: (cat: PricingTab, key: string, val: string) => void;
  onView: () => void;
}> = ({ group, idx, onPriceChange, onView }) => {
  const even = idx % 2 === 0;
  const { item } = group;
  return (
    <tr className={even ? 'bg-[var(--bg)]' : 'bg-[var(--bg-subtle)]/40'}>
      <td className={`${TD} font-medium text-[var(--text)] max-w-[160px] truncate`} title={item.name}>{item.name || '—'}</td>
      <td className={`${TD} max-w-[200px] truncate`} title={item.description ?? ''}>{item.description || '—'}</td>
      <td className={`${TD} whitespace-nowrap`}>{item.manufacturer || '—'}</td>
      <td className={`${TD} whitespace-nowrap`}>{item.finish || '—'}</td>
      <td className={`${TD} text-right font-mono w-px whitespace-nowrap`}>{group.totalQty}</td>
      <td className={TD} title={group.doorMaterials.join(', ')}>{group.doorMaterials.join(', ') || '—'}</td>
      <td className={`${TD} text-right w-px whitespace-nowrap`}>
        <PriceInput value={group.unitPrice} onChange={v => onPriceChange('hardware', group.key, v)} />
      </td>
      <td className={`${TD} text-right font-semibold text-[var(--text)] w-px whitespace-nowrap`}>{fmt.format(group.totalPrice)}</td>
      <td className={`${TD} text-center w-px whitespace-nowrap`}>
        <button
          onClick={onView}
          title={`View ${group.sets.length} set${group.sets.length !== 1 ? 's' : ''}`}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-[var(--bg-muted)] hover:bg-[var(--primary-bg)] text-[var(--text-muted)] hover:text-[var(--primary-text)] transition-colors"
        >
          <Eye className="w-3 h-3" />
          {group.sets.length}
        </button>
      </td>
    </tr>
  );
};
