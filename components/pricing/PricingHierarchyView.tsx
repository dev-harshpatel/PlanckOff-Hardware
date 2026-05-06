'use client';

import React from 'react';
import type { FlatNode } from '@/hooks/usePricingFilters';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

const withProfit = (base: number, pctStr: string): number => {
  const p = parseFloat(pctStr);
  return isNaN(p) || p <= 0 ? base : base * (1 + p / 100);
};

interface PricingHierarchyViewProps {
  doorGroupCount: number;
  frameGroupCount: number;
  hardwareGroupCount: number;
  proposalDoorBase: number;
  proposalFrameBase: number;
  proposalHwBase: number;
  proposalDoorTotal: number;
  proposalFrameTotal: number;
  proposalHwTotal: number;
  doorAlloc: number;
  frameAlloc: number;
  hwAlloc: number;
  proposalBreakdown: { doors: FlatNode[]; frames: FlatNode[]; hardware: FlatNode[] };
  profitPct: { door: string; frame: string; hardware: string };
  handleProfitChange: (key: 'door' | 'frame' | 'hardware', val: string) => void;
  proposalGrandTotal: number;
  allocateExpenses: boolean;
  extraExpensesTotal: number;
}

export function PricingHierarchyView({
  doorGroupCount,
  frameGroupCount,
  hardwareGroupCount,
  proposalDoorBase,
  proposalFrameBase,
  proposalHwBase,
  proposalDoorTotal,
  proposalFrameTotal,
  proposalHwTotal,
  doorAlloc,
  frameAlloc,
  hwAlloc,
  proposalBreakdown,
  profitPct,
  handleProfitChange,
  proposalGrandTotal,
  allocateExpenses,
  extraExpensesTotal,
}: PricingHierarchyViewProps) {
  const rows = [
    { label: 'Doors',    key: 'door'     as const, count: doorGroupCount,     base: proposalDoorBase,  newTotal: proposalDoorTotal,  alloc: doorAlloc,  breakdown: proposalBreakdown.doors    },
    { label: 'Frames',   key: 'frame'    as const, count: frameGroupCount,    base: proposalFrameBase, newTotal: proposalFrameTotal, alloc: frameAlloc, breakdown: proposalBreakdown.frames   },
    { label: 'Hardware', key: 'hardware' as const, count: hardwareGroupCount, base: proposalHwBase,    newTotal: proposalHwTotal,    alloc: hwAlloc,    breakdown: proposalBreakdown.hardware },
  ];

  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="bg-[var(--bg-subtle)]">
          <th className="text-left  px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)]">Category</th>
          <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)]">Items</th>
          <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)]">Total</th>
          <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)] w-36">Profit %</th>
          <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)]">New Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.flatMap(({ label, key, count, base, newTotal, alloc, breakdown }, i) => [
          <tr key={label} className={i % 2 === 0 ? 'bg-[var(--bg)]' : 'bg-[var(--bg-subtle)]/40'}>
            <td className="px-4 py-2 font-medium text-[var(--text)] border border-[var(--border)]">{label}</td>
            <td className="px-4 py-2 text-right text-[var(--text-muted)] border border-[var(--border)]">{count}</td>
            <td className="px-4 py-2 text-right font-semibold text-[var(--text)] border border-[var(--border)]">{fmt.format(base)}</td>
            <td className="px-2 py-1.5 border border-[var(--border)]">
              <div className="flex items-center justify-end gap-1">
                <input
                  type="number"
                  min="0"
                  max="999"
                  step="0.1"
                  placeholder="0"
                  value={profitPct[key]}
                  onChange={e => handleProfitChange(key, e.target.value)}
                  className="w-16 text-right text-xs bg-[var(--bg-muted)] border border-[var(--border)] rounded px-2 py-1 text-[var(--text)] focus:outline-none focus:border-[var(--primary-action)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-[var(--text-faint)] text-xs font-medium select-none">%</span>
              </div>
            </td>
            <td className="px-4 py-2 text-right border border-[var(--border)]">
              <div className="font-semibold text-[var(--primary-text)]">{fmt.format(newTotal + alloc)}</div>
              {alloc > 0 && (
                <div className="text-[10px] text-[var(--text-faint)] mt-0.5">
                  {fmt.format(newTotal)} + {fmt.format(alloc)}
                </div>
              )}
            </td>
          </tr>,
          ...breakdown.map((sub, si) => (
            <tr key={`${key}-${si}-${sub.depth}-${sub.dimType}-${sub.label}`} className="bg-[var(--bg-subtle)]/60">
              <td className="pr-4 py-1.5 border border-[var(--border)]" style={{ paddingLeft: `${(sub.depth + 2) * 16}px` }}>
                <span className="flex items-center gap-1.5">
                  <span className="text-[var(--text-faint)] select-none">↳</span>
                  <span className="font-medium text-[var(--text-secondary)]">{sub.label}</span>
                  <span className="text-[9px] uppercase tracking-wide text-[var(--text-faint)] px-1 py-px rounded bg-[var(--bg-muted)]">{sub.dimType}</span>
                </span>
              </td>
              <td className="px-4 py-1.5 text-right text-[var(--text-faint)] border border-[var(--border)]">{sub.count}</td>
              <td className="px-4 py-1.5 text-right text-[var(--text-secondary)] border border-[var(--border)]">{fmt.format(sub.base)}</td>
              <td className="px-2 py-1.5 border border-[var(--border)]" />
              <td className="px-4 py-1.5 text-right text-[var(--text-secondary)] border border-[var(--border)]">{fmt.format(withProfit(sub.base, profitPct[key]))}</td>
            </tr>
          )),
        ])}
        <tr className="bg-[var(--primary-bg)]">
          <td className="px-4 py-3 font-bold text-[var(--primary-text)] border border-[var(--primary-border)]" colSpan={3}>Grand Total</td>
          <td className="px-4 py-3 border border-[var(--primary-border)]" />
          <td className="px-4 py-3 text-right border border-[var(--primary-border)]">
            <div className="font-bold text-[var(--primary-text)]">{fmt.format(proposalGrandTotal + (allocateExpenses ? extraExpensesTotal : 0))}</div>
            {allocateExpenses && extraExpensesTotal > 0 && (
              <div className="text-[10px] text-[var(--primary-text)] opacity-70 mt-0.5">
                {fmt.format(proposalGrandTotal)} + {fmt.format(extraExpensesTotal)} expenses
              </div>
            )}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
