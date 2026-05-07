'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DollarSign, FileSpreadsheet, FileDown, X, Check } from 'lucide-react';
import type { Door, HardwareSet } from '@/types';
import type { CompanySettings } from '@/lib/db/companySettings';
import {
  type PriceMap,
  type DoorPricingGroup, type HardwarePricingGroup,
} from '@/utils/pricingGrouping';
import { MultiFilterSelect } from './MultiFilterSelect';
import { PricingDetailModal, type PricingTab } from './PricingDetailModal';
import { PricingHierarchyView } from './PricingHierarchyView';
import { DoorRow, HardwareRow, TH } from './PricingTableRows';
import { usePricingFilters } from '@/hooks/usePricingFilters';
import { usePricingExport, type ExportSections } from '@/hooks/usePricingExport';
import { usePricingProposal } from '@/hooks/usePricingProposal';

interface Props {
  projectId: string;
  doors: Door[];
  hardwareSets: HardwareSet[];
  projectName: string;
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

const PricingReportConfig: React.FC<Props> = ({ projectId, doors, hardwareSets, projectName }) => {
  const [activeTab, setActiveTab]   = useState<PricingTab>('door');
  const [prices, setPrices]         = useState<PriceMap>(new Map());
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [modalGroup, setModalGroup] = useState<DoorPricingGroup | HardwarePricingGroup | null>(null);
  const [loadingPrices, setLoadingPrices] = useState(true);

  // Export dialog state
  const [exportDialog, setExportDialog] = useState<null | 'excel' | 'pdf'>(null);
  const [exportSections, setExportSections] = useState<ExportSections>({ doors: true, frames: true, hardware: true });
  const exportDialogRef = useRef<HTMLDivElement>(null);

  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    fetch('/api/settings/company', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((json: { data: CompanySettings } | null) => { if (json?.data) setCompanySettings(json.data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/pricing`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((json) => {
        if (!json?.data) return;
        const map: PriceMap = new Map();
        for (const row of json.data as Array<{ category: string; group_key: string; unit_price: number }>) {
          map.set(`${row.category}:${row.group_key}`, row.unit_price);
        }
        setPrices(map);
      })
      .catch(console.error)
      .finally(() => setLoadingPrices(false));
  }, [projectId]);

  // Close export dialog when clicking outside
  useEffect(() => {
    if (!exportDialog) return;
    const handler = (e: MouseEvent) => {
      if (exportDialogRef.current && !exportDialogRef.current.contains(e.target as Node)) {
        setExportDialog(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [exportDialog]);

  const handlePriceChange = useCallback((category: PricingTab, key: string, raw: string) => {
    const unitPrice = Math.max(0, parseFloat(raw) || 0);
    const mapKey    = `${category}:${key}`;
    setPrices(prev => new Map(prev).set(mapKey, unitPrice));

    const existing = debounceTimers.current.get(mapKey);
    if (existing) clearTimeout(existing);
    debounceTimers.current.set(mapKey, setTimeout(async () => {
      try {
        await fetch(`/api/projects/${projectId}/pricing`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category, group_key: key, unit_price: unitPrice }),
        });
      } catch (err) {
        console.error('[Pricing] Save failed:', err);
      }
      debounceTimers.current.delete(mapKey);
    }, 600));
  }, [projectId]);

  const {
    filters,
    proposalFilters,
    doorGroups,
    frameGroups,
    hardwareGroups,
    doorMaterials,
    doorFloors,
    doorBuildings,
    frameMaterials,
    frameFloors,
    frameBuildings,
    hwMaterials,
    proposalMaterials,
    proposalFloors,
    proposalBuildings,
    visibleDoors,
    visibleFrames,
    visibleHardware,
    doorTotal,
    frameTotal,
    hwTotal,
    grandTotal,
    proposalDoorBase,
    proposalFrameBase,
    proposalHwBase,
    proposalBreakdown,
    hwSetList,
    totalDoorCount,
    totalFrameCount,
    totalHwCount,
    currentMaterials,
    currentFloors,
    currentBuildings,
    setFilter,
    setProposalFilter,
    handleCreateVariant,
    handleDeleteVariant,
  } = usePricingFilters({ projectId, doors, hardwareSets, prices, activeTab });

  const {
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
  } = usePricingProposal({ projectId, proposalDoorBase, proposalFrameBase, proposalHwBase });

  const { handleDownloadExcel, handleDownloadPdf, handleDownloadProposalPdf } = usePricingExport({
    projectId,
    projectName,
    companySettings,
    doorGroups,
    frameGroups,
    hardwareGroups: visibleHardware,
    doorTotal,
    frameTotal,
    hwTotal,
    hwSetList,
    hiddenProposalTables,
    profitPct,
    proposalDoorBase,
    proposalFrameBase,
    proposalHwBase,
    proposalDoorTotal,
    proposalFrameTotal,
    proposalHwTotal,
    doorAlloc,
    frameAlloc,
    hwAlloc,
    proposalGrandTotal,
    allocateExpenses,
    extraExpenses,
    extraExpensesTotal,
    taxRows,
    taxSubtotal,
    totalAfterTax,
    remarks,
  });

  const handleExportConfirm = useCallback(() => {
    if (!exportDialog) return;
    if (exportDialog === 'excel') void handleDownloadExcel(exportSections);
    else void handleDownloadPdf(exportSections);
    setExportDialog(null);
  }, [exportDialog, exportSections, handleDownloadExcel, handleDownloadPdf]);

  const TABS: Array<{ id: PricingTab; label: string; count: number; sub: string }> = [
    { id: 'door',     label: 'Doors',    count: totalDoorCount,  sub: `${visibleDoors.length} group${visibleDoors.length !== 1 ? 's' : ''}`     },
    { id: 'frame',    label: 'Frames',   count: totalFrameCount, sub: `${visibleFrames.length} group${visibleFrames.length !== 1 ? 's' : ''}`    },
    { id: 'hardware', label: 'Hardware', count: totalHwCount,    sub: `${visibleHardware.length} item${visibleHardware.length !== 1 ? 's' : ''}` },
    { id: 'proposal', label: 'Proposal', count: 0,               sub: 'summary'                                                                 },
  ];

  return (
    <div className="space-y-4">

      {/* ── Total price banner ── */}
      <div className="bg-[var(--primary-bg)] border border-[var(--primary-border)] rounded-lg px-5 py-3 flex flex-wrap items-center gap-x-5 gap-y-1">
        <DollarSign className="w-4 h-4 text-[var(--primary-text-muted)] flex-shrink-0" />
        {[
          { label: 'Doors',    total: doorTotal  },
          { label: 'Frames',   total: frameTotal },
          { label: 'Hardware', total: hwTotal    },
        ].map(({ label, total }) => (
          <span key={label} className="text-xs text-[var(--primary-text-muted)]">
            {label}: <span className="font-semibold text-[var(--primary-text)]">{fmt.format(total)}</span>
          </span>
        ))}
        <span className="ml-auto text-xs font-bold text-[var(--primary-text)] border-l border-[var(--primary-border)] pl-5">
          Grand Total: {fmt.format(grandTotal)}
        </span>
        <div className="flex items-center gap-2 border-l border-[var(--primary-border)] pl-4">
          {activeTab === 'proposal' ? (
            <button
              onClick={() => void handleDownloadProposalPdf()}
              title="Export Proposal PDF"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-[var(--primary-action)]/10 hover:bg-[var(--primary-action)]/20 text-[var(--primary-text)] transition-colors"
            >
              <FileDown className="w-3.5 h-3.5" />
              Export Proposal
            </button>
          ) : (
            <div ref={exportDialogRef} className="relative flex items-center gap-2">
              <button
                onClick={() => setExportDialog(prev => prev === 'excel' ? null : 'excel')}
                title="Download Pricing Report Excel"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-[var(--primary-action)]/10 hover:bg-[var(--primary-action)]/20 text-[var(--primary-text)] transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Excel
              </button>
              <button
                onClick={() => setExportDialog(prev => prev === 'pdf' ? null : 'pdf')}
                title="Download Pricing Report PDF"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-[var(--primary-action)]/10 hover:bg-[var(--primary-action)]/20 text-[var(--primary-text)] transition-colors"
              >
                <FileDown className="w-3.5 h-3.5" />
                PDF
              </button>

              {/* Export options popover */}
              {exportDialog && (
                <div className="absolute right-0 top-full mt-2 z-50 w-52 rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-lg">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
                    <span className="text-[11px] font-semibold text-[var(--text)]">
                      Include in {exportDialog === 'excel' ? 'Excel' : 'PDF'}
                    </span>
                    <button onClick={() => setExportDialog(null)} className="text-[var(--text-faint)] hover:text-[var(--text)] transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="px-3 py-2 space-y-2">
                    {([ ['doors', 'Doors'], ['frames', 'Frames'], ['hardware', 'Hardware'] ] as const).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                        <span
                          className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${
                            exportSections[key]
                              ? 'bg-[var(--primary-action)] border-[var(--primary-action)]'
                              : 'border-[var(--border)] bg-[var(--bg)] group-hover:border-[var(--primary-ring)]'
                          }`}
                          onClick={() => setExportSections(prev => ({ ...prev, [key]: !prev[key] }))}
                        >
                          {exportSections[key] && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                        </span>
                        <span
                          className="text-xs text-[var(--text)] select-none"
                          onClick={() => setExportSections(prev => ({ ...prev, [key]: !prev[key] }))}
                        >
                          {label}
                        </span>
                      </label>
                    ))}
                  </div>

                  <div className="px-3 pb-3">
                    <button
                      onClick={handleExportConfirm}
                      disabled={!exportSections.doors && !exportSections.frames && !exportSections.hardware}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold bg-[var(--primary-action)] text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {exportDialog === 'excel' ? <FileSpreadsheet className="w-3.5 h-3.5" /> : <FileDown className="w-3.5 h-3.5" />}
                      Download {exportDialog === 'excel' ? 'Excel' : 'PDF'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs + filter bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--bg-subtle)]">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => { setActiveTab(t.id); setFilter('material', []); setFilter('floor', []); setFilter('building', []); setFilter('prep', []); }}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold transition-all border-r border-[var(--border)] last:border-r-0 ${
                activeTab === t.id
                  ? 'bg-[var(--primary-action)] text-white'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg)]'
              }`}
            >
              {t.label}
              {t.id !== 'proposal' && (
                <span className={`flex flex-col items-center leading-none ${
                  activeTab === t.id ? 'text-white' : 'text-[var(--text-faint)]'
                }`}>
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                    activeTab === t.id ? 'bg-white/20' : 'bg-[var(--bg-muted)]'
                  }`}>{t.count}</span>
                  <span className="text-[9px] mt-0.5 opacity-70 whitespace-nowrap">{t.sub}</span>
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab !== 'proposal' && (
          <div className="flex flex-wrap items-center gap-3 ml-auto">
            <MultiFilterSelect label="Material"          selected={filters.material} options={currentMaterials} onChange={v => setFilter('material', v)} />
            <MultiFilterSelect label="Building Location" selected={filters.floor}    options={currentFloors}    onChange={v => setFilter('floor',    v)} />
            <MultiFilterSelect label="Building"          selected={filters.building} options={currentBuildings} onChange={v => setFilter('building', v)} />
          </div>
        )}
      </div>

      {/* ── Proposal tab ── */}
      {activeTab === 'proposal' && (
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
      )}

      {/* ── Table (Doors / Frames / Hardware tabs) ── */}
      {activeTab !== 'proposal' && (loadingPrices ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-5 h-5 border-2 border-[var(--primary-action)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--border)] overflow-y-auto max-h-[520px] bg-[var(--bg)]">
          <table className="min-w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[var(--bg-subtle)]">
                {activeTab === 'hardware' ? (
                  <>
                    <th className={TH}>Item Name</th>
                    <th className={TH}>Description</th>
                    <th className={TH}>Manufacturer</th>
                    <th className={TH}>Finish</th>
                    <th className={`${TH} text-right w-px`}>Total</th>
                    <th className={TH}>Door Material</th>
                    <th className={`${TH} text-right w-px`}>Unit Price</th>
                    <th className={`${TH} text-right w-px`}>Total Price</th>
                    <th className={`${TH} w-px`} />
                  </>
                ) : (
                  <>
                    <th className={TH} colSpan={2}>Description</th>
                    <th className={`${TH} text-right w-px`}>Total Qty</th>
                    <th className={`${TH} text-right w-px`}>Unit Price</th>
                    <th className={`${TH} text-right w-px`}>Total Price</th>
                    <th className={`${TH} w-px`} />
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {activeTab === 'door' && visibleDoors.map((g, i) => (
                <DoorRow key={g.key} group={g} idx={i} category="door" onPriceChange={handlePriceChange} onView={() => setModalGroup(g)} onDeleteVariant={handleDeleteVariant} />
              ))}
              {activeTab === 'frame' && visibleFrames.map((g, i) => (
                <DoorRow key={g.key} group={g} idx={i} category="frame" onPriceChange={handlePriceChange} onView={() => setModalGroup(g)} onDeleteVariant={handleDeleteVariant} />
              ))}
              {activeTab === 'hardware' && visibleHardware.map((g, i) => (
                <HardwareRow key={g.key} group={g} idx={i} onPriceChange={handlePriceChange} onView={() => setModalGroup(g)} />
              ))}
              {(
                (activeTab === 'door'     && visibleDoors.length     === 0) ||
                (activeTab === 'frame'    && visibleFrames.length    === 0) ||
                (activeTab === 'hardware' && visibleHardware.length  === 0)
              ) && (
                <tr>
                  <td colSpan={activeTab === 'hardware' ? 9 : 6} className="px-4 py-10 text-center text-xs text-[var(--text-faint)]">
                    No items found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ))}

      <PricingDetailModal
        group={modalGroup}
        tab={activeTab}
        onClose={() => setModalGroup(null)}
        onCreateVariant={activeTab !== 'hardware' ? handleCreateVariant : null}
      />
    </div>
  );
};

export default PricingReportConfig;
