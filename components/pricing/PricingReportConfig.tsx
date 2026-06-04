'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DollarSign, FileSpreadsheet, FileDown, X, Check, Image } from 'lucide-react';
import type { Door, HardwareSet, ElevationType } from '@/types';
import { useElevationImages } from '@/hooks/useElevationImages';
import type { CompanySettings } from '@/lib/db/companySettings';
import {
  type PriceMap,
  type DoorPricingGroup, type HardwarePricingGroup,
} from '@/utils/pricingGrouping';
import { MultiFilterSelect } from './MultiFilterSelect';
import { PricingDetailModal, type PricingTab } from './PricingDetailModal';
import { DoorRow, HardwareRow, TH } from './PricingTableRows';
import { ProposalTab } from './ProposalTab';
import { usePricingFilters } from '@/hooks/usePricingFilters';
import { usePricingExport, type ExportSections } from '@/hooks/usePricingExport';
import { usePricingProposal } from '@/hooks/usePricingProposal';
import { useToast } from '@/contexts/ToastContext';

interface Props {
  projectId: string;
  doors: Door[];
  hardwareSets: HardwareSet[];
  elevationTypes?: ElevationType[];
  projectName: string;
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

const PricingReportConfig: React.FC<Props> = ({ projectId, doors, hardwareSets, elevationTypes = [], projectName }) => {
  const [activeTab, setActiveTab]   = useState<PricingTab>('door');
  const [prices, setPrices]         = useState<PriceMap>(new Map());
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [modalGroup, setModalGroup] = useState<DoorPricingGroup | HardwarePricingGroup | null>(null);
  const [loadingPrices, setLoadingPrices] = useState(true);

  const [zoom, setZoom] = useState(1.0);
  const adjustZoom = (delta: number) => setZoom(z => Math.min(2, Math.max(0.4, Math.round((z + delta) * 10) / 10)));

  // Export dialog state
  const [exportDialog, setExportDialog] = useState<null | 'excel' | 'pdf'>(null);
  const [exportSections, setExportSections] = useState<ExportSections>({ doors: true, frames: true, hardware: true });
  const exportDialogRef = useRef<HTMLDivElement>(null);

  const { showElevationImages, setShowElevationImages } = useElevationImages(elevationTypes);

  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const { addToast } = useToast();

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
    currentPreps,
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
    doorGroups: visibleDoors,
    frameGroups: visibleFrames,
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
    showElevationImages,
    elevationTypes,
    addToast,
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

                  {elevationTypes.length > 0 && (
                    <div className="px-3 pb-2 border-t border-[var(--border)]">
                      <label className="flex items-start gap-2.5 pt-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={showElevationImages}
                          onChange={e => setShowElevationImages(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-[var(--border-strong)] text-[var(--primary-action)] focus:ring-[var(--primary-ring)] cursor-pointer flex-shrink-0 mt-0.5"
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-[var(--text-secondary)] group-hover:text-[var(--primary-text)] transition-colors flex items-center gap-1.5">
                            <Image className="w-3 h-3 flex-shrink-0" />
                            Include Elevation Images
                          </span>
                          <span className="text-[10px] text-[var(--text-faint)] block mt-0.5">
                            {exportDialog === 'pdf'
                              ? `Thumbnail pages appended · ${elevationTypes.length} type${elevationTypes.length !== 1 ? 's' : ''}`
                              : `Adds elevation sheets · ${elevationTypes.length} type${elevationTypes.length !== 1 ? 's' : ''}`
                            }
                          </span>
                        </div>
                      </label>
                    </div>
                  )}

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

      {/* ── Tabs + zoom row ── */}
      <div className="flex items-center gap-3">
        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--bg-subtle)]">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
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

        <div className="flex items-center gap-1 border border-[var(--border)] rounded-md overflow-hidden ml-auto">
          <button
            onClick={() => adjustZoom(-0.1)}
            disabled={zoom <= 0.4}
            className="px-2.5 py-1 text-sm font-bold text-[var(--text-muted)] hover:bg-[var(--bg-muted)] disabled:opacity-30 transition-colors"
            title="Zoom out"
          >−</button>
          <span className="px-1 text-xs font-medium text-[var(--text-muted)] min-w-[36px] text-center select-none">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => adjustZoom(0.1)}
            disabled={zoom >= 2}
            className="px-2.5 py-1 text-sm font-bold text-[var(--text-muted)] hover:bg-[var(--bg-muted)] disabled:opacity-30 transition-colors"
            title="Zoom in"
          >+</button>
        </div>
      </div>

      {/* ── Filter bar (always same row, below tabs) ── */}
      {activeTab !== 'proposal' && (
        <div className="flex flex-wrap items-center gap-3">
          <MultiFilterSelect label="Material"          selected={filters.material} options={currentMaterials} onChange={v => setFilter('material', v)} />
          <MultiFilterSelect label="Building Location" selected={filters.floor}    options={currentFloors}    onChange={v => setFilter('floor',    v)} />
          <MultiFilterSelect label="Building"          selected={filters.building} options={currentBuildings} onChange={v => setFilter('building', v)} />
          {activeTab !== 'hardware' && currentPreps.length > 0 && (
            <MultiFilterSelect label="Prep" selected={filters.prep} options={currentPreps} onChange={v => setFilter('prep', v)} />
          )}
        </div>
      )}

      {/* ── Proposal tab ── */}
      {activeTab === 'proposal' && (
        <ProposalTab
          projectName={projectName}
          doorGroups={doorGroups}
          frameGroups={frameGroups}
          hardwareGroups={hardwareGroups}
          proposalFilters={proposalFilters}
          proposalMaterials={proposalMaterials}
          proposalFloors={proposalFloors}
          proposalBuildings={proposalBuildings}
          proposalDoorBase={proposalDoorBase}
          proposalFrameBase={proposalFrameBase}
          proposalHwBase={proposalHwBase}
          proposalBreakdown={proposalBreakdown}
          hwSetList={hwSetList}
          setProposalFilter={setProposalFilter}
          hiddenProposalTables={hiddenProposalTables}
          toggleProposalTable={toggleProposalTable}
          profitPct={profitPct}
          allocateExpenses={allocateExpenses}
          taxRows={taxRows}
          remarks={remarks}
          extraExpenses={extraExpenses}
          handleProfitChange={handleProfitChange}
          handleAllocateChange={handleAllocateChange}
          handleAddTaxRow={handleAddTaxRow}
          handleTaxRowChange={handleTaxRowChange}
          handleRemoveTaxRow={handleRemoveTaxRow}
          handleRemarksChange={handleRemarksChange}
          handleAddExpense={handleAddExpense}
          handleExpenseChange={handleExpenseChange}
          handleRemoveExpense={handleRemoveExpense}
          proposalDoorTotal={proposalDoorTotal}
          proposalFrameTotal={proposalFrameTotal}
          proposalHwTotal={proposalHwTotal}
          extraExpensesTotal={extraExpensesTotal}
          proposalGrandTotal={proposalGrandTotal}
          taxSubtotal={taxSubtotal}
          totalAfterTax={totalAfterTax}
          doorAlloc={doorAlloc}
          frameAlloc={frameAlloc}
          hwAlloc={hwAlloc}
        />
      )}

      {/* ── Table (Doors / Frames / Hardware tabs) ── */}
      {activeTab !== 'proposal' && (loadingPrices ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-5 h-5 border-2 border-[var(--primary-action)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--border)] overflow-y-auto max-h-[520px] bg-[var(--bg)]" style={{ zoom: zoom }}>
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
