'use client';

/**
 * ProposalTab — extracted from PricingReportConfig.tsx (Phase 11, PRICING-01).
 *
 * Cohesion exception: this file is ~380-410 lines, which exceeds the general
 * 300-line file-size guideline. Per Phase 11 REQUIREMENTS.md PRICING-01, the
 * ProposalTab block is a single cohesive JSX unit (~354 lines named in the
 * requirement) — no partial extraction is permitted. This file exists at one
 * level to keep the cohesion contract; further splitting would extract
 * individual tables, violating REQUIREMENTS.md's split-quality constraint.
 *
 * The component is purely presentational. It owns no state, calls no hooks,
 * and receives all proposal data as props from PricingReportConfig.
 */

import React from 'react';
import { X } from 'lucide-react';
import type { DoorPricingGroup, HardwarePricingGroup } from '@/utils/pricingGrouping';
import type { FlatNode } from '@/hooks/usePricingFilters';
import { MultiFilterSelect } from './MultiFilterSelect';
import { PricingHierarchyView } from './PricingHierarchyView';

// Module-level USD currency formatter — duplicated from PricingReportConfig.tsx line 27 per
// Phase 11 RESEARCH Pitfall 1 (avoids cross-module import for a pure 1-line constant).
const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

export interface ProposalTabProps {
  // Project header
  projectName: string;

  // From usePricingFilters
  doorGroups: DoorPricingGroup[];
  frameGroups: DoorPricingGroup[];
  hardwareGroups: HardwarePricingGroup[];
  proposalFilters: { material: string[]; floor: string[]; building: string[] };
  proposalMaterials: string[];
  proposalFloors: string[];
  proposalBuildings: string[];
  proposalDoorBase: number;
  proposalFrameBase: number;
  proposalHwBase: number;
  proposalBreakdown: { doors: FlatNode[]; frames: FlatNode[]; hardware: FlatNode[] };
  hwSetList: Array<{ name: string; doorCount: number }>;
  setProposalFilter: (key: 'material' | 'floor' | 'building', value: string[]) => void;

  // From usePricingProposal
  hiddenProposalTables: Set<'doors' | 'frames' | 'hardware'>;
  toggleProposalTable: (key: 'doors' | 'frames' | 'hardware') => void;
  profitPct: { door: string; frame: string; hardware: string };
  allocateExpenses: boolean;
  taxRows: Array<{ id: string; description: string; taxPct: string }>;
  remarks: string;
  extraExpenses: Array<{ id: string; delivery: string; totalPrice: string }>;
  handleProfitChange: (key: 'door' | 'frame' | 'hardware', val: string) => void;
  handleAllocateChange: (val: boolean) => void;
  handleAddTaxRow: () => void;
  handleTaxRowChange: (id: string, field: 'description' | 'taxPct', val: string) => void;
  handleRemoveTaxRow: (id: string) => void;
  handleRemarksChange: (val: string) => void;
  handleAddExpense: () => void;
  handleExpenseChange: (id: string, field: 'delivery' | 'totalPrice', val: string) => void;
  handleRemoveExpense: (id: string) => void;
  proposalDoorTotal: number;
  proposalFrameTotal: number;
  proposalHwTotal: number;
  extraExpensesTotal: number;
  proposalGrandTotal: number;
  taxSubtotal: number;
  totalAfterTax: number;
  doorAlloc: number;
  frameAlloc: number;
  hwAlloc: number;
}

export const ProposalTab: React.FC<ProposalTabProps> = ({
  projectName,
  doorGroups,
  frameGroups,
  hardwareGroups,
  proposalFilters,
  proposalMaterials,
  proposalFloors,
  proposalBuildings,
  proposalDoorBase,
  proposalFrameBase,
  proposalHwBase,
  proposalBreakdown,
  hwSetList,
  setProposalFilter,
  hiddenProposalTables,
  toggleProposalTable,
  profitPct,
  allocateExpenses,
  taxRows,
  remarks,
  extraExpenses,
  handleProfitChange,
  handleAllocateChange,
  handleAddTaxRow,
  handleTaxRowChange,
  handleRemoveTaxRow,
  handleRemarksChange,
  handleAddExpense,
  handleExpenseChange,
  handleRemoveExpense,
  proposalDoorTotal,
  proposalFrameTotal,
  proposalHwTotal,
  extraExpensesTotal,
  proposalGrandTotal,
  taxSubtotal,
  totalAfterTax,
  doorAlloc,
  frameAlloc,
  hwAlloc,
}) => {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-6 space-y-6">
      {/* Header + filters row */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-faint)] mb-1">Proposal</p>
          <h3 className="text-lg font-bold text-[var(--text)]">{projectName || 'Untitled Project'}</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Prepared on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MultiFilterSelect label="Material" selected={proposalFilters.material} options={proposalMaterials} onChange={v => setProposalFilter('material', v)} />
          <MultiFilterSelect label="Floor"    selected={proposalFilters.floor}    options={proposalFloors}    onChange={v => setProposalFilter('floor',    v)} />
          <MultiFilterSelect label="Building" selected={proposalFilters.building} options={proposalBuildings} onChange={v => setProposalFilter('building', v)} />
        </div>
      </div>

      {/* Summary table */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] mb-2">Pricing Summary</p>
        <PricingHierarchyView
          doorGroupCount={doorGroups.length}
          frameGroupCount={frameGroups.length}
          hardwareGroupCount={hardwareGroups.length}
          proposalDoorBase={proposalDoorBase}
          proposalFrameBase={proposalFrameBase}
          proposalHwBase={proposalHwBase}
          proposalDoorTotal={proposalDoorTotal}
          proposalFrameTotal={proposalFrameTotal}
          proposalHwTotal={proposalHwTotal}
          doorAlloc={doorAlloc}
          frameAlloc={frameAlloc}
          hwAlloc={hwAlloc}
          proposalBreakdown={proposalBreakdown}
          profitPct={profitPct}
          handleProfitChange={handleProfitChange}
          proposalGrandTotal={proposalGrandTotal}
          allocateExpenses={allocateExpenses}
          extraExpensesTotal={extraExpensesTotal}
        />
      </div>

      {/* Door detail table */}
      {hiddenProposalTables.has('doors') ? (
        <div className="flex items-center gap-2 border border-dashed border-[var(--border)] rounded px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] flex-1">Doors — hidden</span>
          <button onClick={() => toggleProposalTable('doors')} className="text-xs text-[var(--primary-text-muted)] hover:text-[var(--primary-text)] transition-colors">Restore</button>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Doors</p>
            <button
              onClick={() => toggleProposalTable('doors')}
              title="Remove from proposal"
              className="p-0.5 rounded text-[var(--text-faint)] hover:text-red-500 dark:hover:text-red-400 hover:bg-[var(--error-bg)] transition-colors"
            >
              <X size={13} />
            </button>
          </div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[var(--bg-subtle)]">
                <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)]">Description</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)] w-24">Total Qty</th>
              </tr>
            </thead>
            <tbody>
              {doorGroups.length === 0 ? (
                <tr><td colSpan={2} className="px-4 py-3 text-center text-[var(--text-faint)] border border-[var(--border)]">No door groups</td></tr>
              ) : doorGroups.map((g, i) => (
                <tr key={g.key} className={i % 2 === 0 ? 'bg-[var(--bg)]' : 'bg-[var(--bg-subtle)]/40'}>
                  <td className="px-4 py-2 text-[var(--text)] border border-[var(--border)]">{g.description}</td>
                  <td className="px-4 py-2 text-right font-semibold text-[var(--text)] border border-[var(--border)]">{g.totalQty}</td>
                </tr>
              ))}
              <tr className="bg-[var(--bg-subtle)]">
                <td className="px-4 py-2.5 font-bold text-[var(--text)] border border-[var(--border)]">Total</td>
                <td className="px-4 py-2.5 text-right font-bold text-[var(--text)] border border-[var(--border)]">
                  {doorGroups.reduce((s, g) => s + g.totalQty, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Frame detail table */}
      {hiddenProposalTables.has('frames') ? (
        <div className="flex items-center gap-2 border border-dashed border-[var(--border)] rounded px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] flex-1">Frames — hidden</span>
          <button onClick={() => toggleProposalTable('frames')} className="text-xs text-[var(--primary-text-muted)] hover:text-[var(--primary-text)] transition-colors">Restore</button>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Frames</p>
            <button
              onClick={() => toggleProposalTable('frames')}
              title="Remove from proposal"
              className="p-0.5 rounded text-[var(--text-faint)] hover:text-red-500 dark:hover:text-red-400 hover:bg-[var(--error-bg)] transition-colors"
            >
              <X size={13} />
            </button>
          </div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[var(--bg-subtle)]">
                <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)]">Description</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)] w-24">Total Qty</th>
              </tr>
            </thead>
            <tbody>
              {frameGroups.length === 0 ? (
                <tr><td colSpan={2} className="px-4 py-3 text-center text-[var(--text-faint)] border border-[var(--border)]">No frame groups</td></tr>
              ) : frameGroups.map((g, i) => (
                <tr key={g.key} className={i % 2 === 0 ? 'bg-[var(--bg)]' : 'bg-[var(--bg-subtle)]/40'}>
                  <td className="px-4 py-2 text-[var(--text)] border border-[var(--border)]">{g.description}</td>
                  <td className="px-4 py-2 text-right font-semibold text-[var(--text)] border border-[var(--border)]">{g.totalQty}</td>
                </tr>
              ))}
              <tr className="bg-[var(--bg-subtle)]">
                <td className="px-4 py-2.5 font-bold text-[var(--text)] border border-[var(--border)]">Total</td>
                <td className="px-4 py-2.5 text-right font-bold text-[var(--text)] border border-[var(--border)]">
                  {frameGroups.reduce((s, g) => s + g.totalQty, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Hardware detail table */}
      {hiddenProposalTables.has('hardware') ? (
        <div className="flex items-center gap-2 border border-dashed border-[var(--border)] rounded px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] flex-1">Hardware — hidden</span>
          <button onClick={() => toggleProposalTable('hardware')} className="text-xs text-[var(--primary-text-muted)] hover:text-[var(--primary-text)] transition-colors">Restore</button>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Hardware</p>
            <button
              onClick={() => toggleProposalTable('hardware')}
              title="Remove from proposal"
              className="p-0.5 rounded text-[var(--text-faint)] hover:text-red-500 dark:hover:text-red-400 hover:bg-[var(--error-bg)] transition-colors"
            >
              <X size={13} />
            </button>
          </div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[var(--bg-subtle)]">
                <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)]">Hardware Set</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)] w-32">Doors Used In</th>
              </tr>
            </thead>
            <tbody>
              {hwSetList.length === 0 ? (
                <tr><td colSpan={2} className="px-4 py-3 text-center text-[var(--text-faint)] border border-[var(--border)]">No hardware sets</td></tr>
              ) : hwSetList.map((s, i) => (
                <tr key={s.name} className={i % 2 === 0 ? 'bg-[var(--bg)]' : 'bg-[var(--bg-subtle)]/40'}>
                  <td className="px-4 py-2 text-[var(--text)] border border-[var(--border)]">{s.name}</td>
                  <td className="px-4 py-2 text-right font-semibold text-[var(--text)] border border-[var(--border)]">{s.doorCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Extra Expenses */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Extra Expenses</p>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allocateExpenses}
              onChange={e => handleAllocateChange(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-[var(--border-strong)] text-[var(--primary-action)] focus:ring-[var(--primary-ring)] cursor-pointer"
            />
            <span className="text-[10px] text-[var(--text-secondary)]">Split across categories</span>
          </label>
        </div>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-[var(--bg-subtle)]">
              <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)]">Delivery</th>
              <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)]">Total Price</th>
              <th className="w-8 border border-[var(--border)]" />
            </tr>
          </thead>
          <tbody>
            {extraExpenses.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-3 text-center text-[var(--text-faint)] border border-[var(--border)]">No extra expenses added</td>
              </tr>
            ) : extraExpenses.map((expense, i) => (
              <tr key={expense.id} className={i % 2 === 0 ? 'bg-[var(--bg)]' : 'bg-[var(--bg-subtle)]/40'}>
                <td className="px-3 py-1.5 border border-[var(--border)]">
                  <input
                    type="text"
                    placeholder="Description"
                    value={expense.delivery}
                    onChange={e => handleExpenseChange(expense.id, 'delivery', e.target.value)}
                    className="w-full bg-transparent text-xs text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none"
                  />
                </td>
                <td className="px-3 py-1.5 border border-[var(--border)]">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={expense.totalPrice}
                    onChange={e => handleExpenseChange(expense.id, 'totalPrice', e.target.value)}
                    onWheel={e => e.currentTarget.blur()}
                    className="w-full text-right bg-transparent text-xs text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>
                <td className="px-2 py-1.5 text-center border border-[var(--border)]">
                  <button
                    onClick={() => handleRemoveExpense(expense.id)}
                    className="text-[var(--text-faint)] hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </td>
              </tr>
            ))}
            <tr className="bg-[var(--primary-bg)]">
              <td className="px-4 py-3 font-bold text-[var(--primary-text)] border border-[var(--primary-border)]">Grand Total</td>
              <td className="px-4 py-3 text-right font-bold text-[var(--primary-text)] border border-[var(--primary-border)]">
                {fmt.format(extraExpenses.reduce((sum, e) => sum + (parseFloat(e.totalPrice) || 0), 0))}
              </td>
              <td className="px-4 py-3 border border-[var(--primary-border)]" />
            </tr>
          </tbody>
        </table>
        <button
          onClick={handleAddExpense}
          className="mt-2 w-full text-xs text-[var(--text-secondary)] hover:text-[var(--text)] border border-dashed border-[var(--border)] hover:border-[var(--text-muted)] rounded px-3 py-1.5 transition-colors"
        >
          + Add Row
        </button>
      </div>

      {/* Tax */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] mb-2">Tax</p>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-[var(--bg-subtle)]">
              <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)]">Description</th>
              <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)] w-36">Tax %</th>
              <th className="w-8 border border-[var(--border)]" />
            </tr>
          </thead>
          <tbody>
            {taxRows.map(row => (
              <tr key={row.id} className="bg-[var(--bg)]">
                <td className="px-2 py-1.5 border border-[var(--border)]">
                  <input
                    type="text"
                    placeholder="e.g. GST, HST…"
                    value={row.description}
                    onChange={e => handleTaxRowChange(row.id, 'description', e.target.value)}
                    className="w-full text-xs bg-[var(--bg-muted)] border border-[var(--border)] rounded px-2 py-1 text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--primary-action)]"
                  />
                </td>
                <td className="px-2 py-1.5 border border-[var(--border)]">
                  <div className="flex items-center justify-end gap-1">
                    <input
                      type="number"
                      min="0"
                      max="999"
                      step="0.1"
                      placeholder="0"
                      value={row.taxPct}
                      onWheel={e => e.currentTarget.blur()}
                      onChange={e => handleTaxRowChange(row.id, 'taxPct', e.target.value)}
                      className="w-16 text-right text-xs bg-[var(--bg-muted)] border border-[var(--border)] rounded px-2 py-1 text-[var(--text)] focus:outline-none focus:border-[var(--primary-action)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-[var(--text-faint)] text-xs font-medium select-none">%</span>
                  </div>
                </td>
                <td className="px-2 border border-[var(--border)] text-center">
                  <button
                    onClick={() => handleRemoveTaxRow(row.id)}
                    className="text-[var(--text-faint)] hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    aria-label="Remove tax row"
                  >✕</button>
                </td>
              </tr>
            ))}
            {taxRows.length === 0 && (
              <tr className="bg-[var(--bg)]">
                <td colSpan={3} className="px-4 py-3 text-center text-[var(--text-faint)] border border-[var(--border)]">No tax rows yet — add one below</td>
              </tr>
            )}
          </tbody>
        </table>
        <button
          onClick={handleAddTaxRow}
          className="mt-2 w-full text-xs text-[var(--text-secondary)] hover:text-[var(--text)] border border-dashed border-[var(--border)] hover:border-[var(--text-muted)] rounded px-3 py-1.5 transition-colors"
        >
          + Add Tax Row
        </button>

        {/* Summary */}
        <table className="w-full text-xs border-collapse mt-4">
          <tbody>
            <tr className="bg-[var(--bg)]">
              <td className="px-4 py-2 text-[var(--text-muted)] border border-[var(--border)]">Pricing Summary Total</td>
              <td className="px-4 py-2 text-right text-[var(--text-muted)] border border-[var(--border)]">{fmt.format(proposalGrandTotal)}</td>
            </tr>
            <tr className="bg-[var(--bg)]">
              <td className="px-4 py-2 text-[var(--text-muted)] border border-[var(--border)]">Extra Expense Total</td>
              <td className="px-4 py-2 text-right text-[var(--text-muted)] border border-[var(--border)]">{fmt.format(extraExpensesTotal)}</td>
            </tr>
            <tr className="bg-[var(--bg-subtle)]">
              <td className="px-4 py-2 font-semibold text-[var(--text)] border border-[var(--border)]">Subtotal</td>
              <td className="px-4 py-2 text-right font-semibold text-[var(--text)] border border-[var(--border)]">{fmt.format(taxSubtotal)}</td>
            </tr>
            {taxRows.map(row => {
              const amt = taxSubtotal * (Math.max(0, parseFloat(row.taxPct) || 0) / 100);
              return (
                <tr key={row.id} className="bg-[var(--bg)]">
                  <td className="px-4 py-2 text-[var(--text-muted)] border border-[var(--border)]">
                    {row.description || '(Tax)'}{row.taxPct ? ` (${row.taxPct}%)` : ''}
                  </td>
                  <td className="px-4 py-2 text-right text-[var(--text-muted)] border border-[var(--border)]">{fmt.format(amt)}</td>
                </tr>
              );
            })}
            <tr className="bg-[var(--bg-subtle)]">
              <td className="px-4 py-2 font-bold text-[var(--text)] border border-[var(--border)]">Total After Tax</td>
              <td className="px-4 py-2 text-right font-bold text-[var(--primary-text)] border border-[var(--border)]">{fmt.format(totalAfterTax)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Remarks */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] mb-2">Remarks</p>
        <textarea
          rows={4}
          placeholder="Add any notes or remarks…"
          value={remarks}
          onChange={e => handleRemarksChange(e.target.value)}
          className="w-full text-xs bg-[var(--bg-muted)] border border-[var(--border)] rounded px-3 py-2 text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--primary-action)] resize-y"
        />
      </div>
    </div>
  );
};
