'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Eye, DollarSign, FileSpreadsheet, FileDown } from 'lucide-react';
import type { Door, HardwareSet } from '@/types';
import {
  groupDoors, groupFrames, groupHardwareItems,
  applyPrices, filterDoorGroups, filterHardwareGroups, uniqueValues,
  type DoorPricingGroup, type HardwarePricingGroup, type PriceMap,
  DOOR_FIELD_DEFS, FRAME_FIELD_DEFS,
} from '@/utils/pricingGrouping';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

// ─── Types ────────────────────────────────────────────────────────────────────

type PricingTab = 'door' | 'frame' | 'hardware';

interface Filters { material: string; floor: string; building: string; }

interface Props {
  projectId: string;
  doors: Door[];
  hardwareSets: HardwareSet[];
  projectName: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

function calcTotal(groups: Array<{ totalPrice: number }>): number {
  return groups.reduce((s, g) => s + g.totalPrice, 0);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const FilterSelect: React.FC<{
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => (
  <div className="flex items-center gap-1.5">
    <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wide whitespace-nowrap">{label}</span>
    <Select value={value || '__all__'} onValueChange={v => onChange(v === '__all__' ? '' : v)}>
      <SelectTrigger className="h-7 text-xs w-36">
        <SelectValue placeholder="All" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All</SelectItem>
        {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>
);

const PriceInput: React.FC<{
  value: number;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => (
  <input
    type="number"
    min={0}
    step={0.01}
    value={value || ''}
    placeholder="0.00"
    onChange={e => onChange(e.target.value)}
    className="w-24 text-right text-xs bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-[var(--text)] focus:border-[var(--primary-action)] focus:ring-1 focus:ring-[var(--primary-ring)] outline-none"
  />
);

// ─── Detail modal ─────────────────────────────────────────────────────────────

const DetailModal: React.FC<{
  group: DoorPricingGroup | HardwarePricingGroup | null;
  tab: PricingTab;
  onClose: () => void;
}> = ({ group, tab, onClose }) => {
  const isDoorFrame = tab === 'door' || tab === 'frame';
  const doorGroup   = isDoorFrame ? (group as DoorPricingGroup)     : null;
  const hwGroup     = !isDoorFrame ? (group as HardwarePricingGroup) : null;

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

        {/* Scrollable table */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <table className="min-w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[var(--bg-subtle)]">
                {isDoorFrame ? (
                  <>
                    <th className={TH_MODAL}>Door Tag</th>
                    <th className={TH_MODAL}>Door Location</th>
                    <th className={TH_MODAL}>Fire Rating</th>
                    {tab === 'frame' && (
                      <>
                        <th className={`${TH_MODAL} w-px`}>Width</th>
                        <th className={`${TH_MODAL} w-px`}>Height</th>
                      </>
                    )}
                    <th className={TH_MODAL}>Description</th>
                    <th className={`${TH_MODAL} text-right w-px`}>Qty</th>
                  </>
                ) : (
                  <>
                    <th className={TH_MODAL}>Set Name</th>
                    <th className={`${TH_MODAL} text-right`}>Multiplied Qty</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {isDoorFrame && doorGroup
                ? doorGroup.doors.map((d, i) => (
                  <tr key={d.id} className={i % 2 === 0 ? 'bg-[var(--bg)]' : 'bg-[var(--bg-subtle)]/40'}>
                    <td className={`${TD_MODAL} font-mono font-medium text-[var(--text)] w-px whitespace-nowrap`}>{d.doorTag}</td>
                    <td className={`${TD_MODAL} w-px whitespace-nowrap text-[var(--text-muted)]`}>{d.location ?? '—'}</td>
                    <td className={`${TD_MODAL} w-px whitespace-nowrap text-[var(--text-muted)]`}>{d.fireRating ?? '—'}</td>
                    {tab === 'frame' && (() => {
                      const sec = d.sections as Record<string, Record<string, string>> | undefined;
                      const bi  = sec?.basic_information;
                      const ds  = sec?.door;
                      const rawW = bi?.['WIDTH'] ?? bi?.['DOOR WIDTH'] ?? ds?.['WIDTH'] ?? ds?.['DOOR WIDTH'] ?? '—';
                      const rawH = bi?.['HEIGHT'] ?? bi?.['DOOR HEIGHT'] ?? ds?.['HEIGHT'] ?? ds?.['DOOR HEIGHT'] ?? '—';
                      return (
                        <>
                          <td className={`${TD_MODAL} w-px whitespace-nowrap font-mono text-[var(--text-muted)]`}>{rawW || '—'}</td>
                          <td className={`${TD_MODAL} w-px whitespace-nowrap font-mono text-[var(--text-muted)]`}>{rawH || '—'}</td>
                        </>
                      );
                    })()}
                    <td className={`${TD_MODAL} text-[var(--text-muted)]`}>
                      {doorGroup.description}
                    </td>
                    <td className={`${TD_MODAL} text-right w-px whitespace-nowrap`}>
                      {d.quantity ?? 1}
                    </td>
                  </tr>
                ))
                : hwGroup?.sets.map((s, i) => (
                  <tr key={s.setId} className={i % 2 === 0 ? 'bg-[var(--bg)]' : 'bg-[var(--bg-subtle)]/40'}>
                    <td className={`${TD_MODAL} font-medium text-[var(--text)]`}>{s.setName}</td>
                    <td className={`${TD_MODAL} text-right`}>{s.multipliedQty}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>

        {/* Footer summary */}
        <div className="px-5 py-3 border-t border-[var(--border)] bg-[var(--bg-subtle)] flex-shrink-0">
          <span className="text-xs text-[var(--text-faint)]">
            {isDoorFrame && doorGroup
              ? `${doorGroup.doors.length} door${doorGroup.doors.length !== 1 ? 's' : ''} · Total qty: ${doorGroup.totalQty}`
              : hwGroup
                ? `${hwGroup.sets.length} set${hwGroup.sets.length !== 1 ? 's' : ''} · Total qty: ${hwGroup.totalQty}`
                : ''
            }
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const TH_MODAL = 'px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border-b border-[var(--border)]';
const TD_MODAL = 'px-4 py-2.5 text-xs text-[var(--text-secondary)] border-b border-[var(--border-subtle)]';

// ─── Main component ───────────────────────────────────────────────────────────

const PricingReportConfig: React.FC<Props> = ({ projectId, doors, hardwareSets }) => {
  const [activeTab, setActiveTab]   = useState<PricingTab>('door');
  const [prices, setPrices]         = useState<PriceMap>(new Map());
  const [filters, setFilters]       = useState<Filters>({ material: '', floor: '', building: '' });
  const [modalGroup, setModalGroup] = useState<DoorPricingGroup | HardwarePricingGroup | null>(null);
  const [loadingPrices, setLoadingPrices] = useState(true);
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ── Load saved prices on mount ─────────────────────────────────────────────
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

  // ── Raw groups (memo) ──────────────────────────────────────────────────────
  const rawDoorGroups     = useMemo(() => groupDoors(doors),                   [doors]);
  const rawFrameGroups    = useMemo(() => groupFrames(doors),                  [doors]);
  const rawHardwareGroups = useMemo(() => groupHardwareItems(hardwareSets, doors), [hardwareSets, doors]);

  // ── Apply saved prices ─────────────────────────────────────────────────────
  const doorGroups     = useMemo(() => applyPrices(rawDoorGroups,     prices, 'door'),     [rawDoorGroups,     prices]);
  const frameGroups    = useMemo(() => applyPrices(rawFrameGroups,    prices, 'frame'),    [rawFrameGroups,    prices]);
  const hardwareGroups = useMemo(() => applyPrices(rawHardwareGroups, prices, 'hardware'), [rawHardwareGroups, prices]);

  // ── Filter options ─────────────────────────────────────────────────────────
  const doorMaterials   = useMemo(() => uniqueValues(doorGroups,  'materials'),  [doorGroups]);
  const doorFloors      = useMemo(() => uniqueValues(doorGroups,  'floors'),     [doorGroups]);
  const doorBuildings   = useMemo(() => uniqueValues(doorGroups,  'buildings'),  [doorGroups]);
  const frameMaterials  = useMemo(() => uniqueValues(frameGroups, 'materials'),  [frameGroups]);
  const frameFloors     = useMemo(() => uniqueValues(frameGroups, 'floors'),     [frameGroups]);
  const frameBuildings  = useMemo(() => uniqueValues(frameGroups, 'buildings'),  [frameGroups]);
  const hwMaterials     = useMemo(() => {
    const seen = new Set<string>();
    hardwareGroups.forEach(g => g.doorMaterials.forEach(m => seen.add(m)));
    return Array.from(seen).sort();
  }, [hardwareGroups]);

  // ── Filtered groups ────────────────────────────────────────────────────────
  const visibleDoors     = useMemo(() => filterDoorGroups(doorGroups,     filters), [doorGroups,     filters]);
  const visibleFrames    = useMemo(() => filterDoorGroups(frameGroups,    filters), [frameGroups,    filters]);
  const visibleHardware  = useMemo(() => filterHardwareGroups(hardwareGroups, { material: filters.material }), [hardwareGroups, filters.material]);

  // ── Totals ─────────────────────────────────────────────────────────────────
  const doorTotal     = useMemo(() => calcTotal(visibleDoors),    [visibleDoors]);
  const frameTotal    = useMemo(() => calcTotal(visibleFrames),   [visibleFrames]);
  const hwTotal       = useMemo(() => calcTotal(visibleHardware), [visibleHardware]);
  const grandTotal    = doorTotal + frameTotal + hwTotal;

  // ── Price change handler (debounced save) ──────────────────────────────────
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

  const setFilter = (k: keyof Filters, v: string) => setFilters(prev => ({ ...prev, [k]: v }));

  // ── Download Excel ─────────────────────────────────────────────────────────
  const handleDownloadExcel = useCallback(async () => {
    const { utils, writeFile } = await import('xlsx');

    const makeSheet = <T extends { totalPrice: number }>(
      rows: T[],
      total: number,
      toRow: (g: T) => Record<string, string | number>,
    ) => {
      const dataRows = rows.map(toRow);
      const ws = utils.json_to_sheet(dataRows);
      // Append a blank row then the total below the data
      const nextRow = dataRows.length + 2; // 1-based header + data rows + 1 blank
      utils.sheet_add_aoa(ws, [['', 'Total', '', fmt.format(total)]], { origin: nextRow });
      return ws;
    };

    const wb = utils.book_new();
    utils.book_append_sheet(wb,
      makeSheet(doorGroups, doorTotal, g => ({
        'Description': g.description,
        'Total Qty':   g.totalQty,
        'Unit Price':  g.unitPrice,
        'Total Price': g.totalPrice,
      })),
      'Doors',
    );
    utils.book_append_sheet(wb,
      makeSheet(frameGroups, frameTotal, g => ({
        'Description': g.description,
        'Total Qty':   g.totalQty,
        'Unit Price':  g.unitPrice,
        'Total Price': g.totalPrice,
      })),
      'Frames',
    );
    utils.book_append_sheet(wb,
      makeSheet(hardwareGroups, hwTotal, g => ({
        'Item Name':      g.item.name          ?? '',
        'Description':    g.item.description   ?? '',
        'Manufacturer':   g.item.manufacturer  ?? '',
        'Finish':         g.item.finish        ?? '',
        'Total Qty':      g.totalQty,
        'Door Materials': g.doorMaterials.join(', '),
        'Unit Price':     g.unitPrice,
        'Total Price':    g.totalPrice,
      })),
      'Hardware',
    );
    writeFile(wb, 'pricing-report.xlsx');
  }, [doorGroups, frameGroups, hardwareGroups, doorTotal, frameTotal, hwTotal]);

  // ── Download PDF ───────────────────────────────────────────────────────────
  const handleDownloadPdf = useCallback(async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: 'landscape' });
    type DocWithAutoTable = typeof doc & { lastAutoTable?: { finalY: number } };
    const d = doc as DocWithAutoTable;

    const nextY = (offset = 0) => (d.lastAutoTable?.finalY ?? 0) + offset;

    const totalRowStyle = { fontStyle: 'bold' as const, fillColor: [240, 243, 250] as [number, number, number] };

    // Doors
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Doors — Total: ${fmt.format(doorTotal)}`, 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [['Description', 'Total Qty', 'Unit Price', 'Total Price']],
      body: [
        ...doorGroups.map(g => [g.description, g.totalQty, fmt.format(g.unitPrice), fmt.format(g.totalPrice)]),
        ['', '', 'Total', fmt.format(doorTotal)],
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [60, 80, 120] },
      didParseCell: (data) => {
        if (data.row.index === doorGroups.length) Object.assign(data.cell.styles, totalRowStyle);
      },
    });

    // Frames
    doc.setFontSize(11);
    doc.text(`Frames — Total: ${fmt.format(frameTotal)}`, 14, nextY(12));
    autoTable(doc, {
      startY: nextY(18),
      head: [['Description', 'Total Qty', 'Unit Price', 'Total Price']],
      body: [
        ...frameGroups.map(g => [g.description, g.totalQty, fmt.format(g.unitPrice), fmt.format(g.totalPrice)]),
        ['', '', 'Total', fmt.format(frameTotal)],
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [60, 80, 120] },
      didParseCell: (data) => {
        if (data.row.index === frameGroups.length) Object.assign(data.cell.styles, totalRowStyle);
      },
    });

    // Hardware
    doc.setFontSize(11);
    doc.text(`Hardware — Total: ${fmt.format(hwTotal)}`, 14, nextY(12));
    autoTable(doc, {
      startY: nextY(18),
      head: [['Item Name', 'Description', 'Manufacturer', 'Finish', 'Qty', 'Unit Price', 'Total Price']],
      body: [
        ...hardwareGroups.map(g => [
          g.item.name ?? '', g.item.description ?? '', g.item.manufacturer ?? '', g.item.finish ?? '',
          g.totalQty, fmt.format(g.unitPrice), fmt.format(g.totalPrice),
        ]),
        ['', '', '', '', '', 'Total', fmt.format(hwTotal)],
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [60, 80, 120] },
      didParseCell: (data) => {
        if (data.row.index === hardwareGroups.length) Object.assign(data.cell.styles, totalRowStyle);
      },
    });

    doc.save('pricing-report.pdf');
  }, [doorGroups, frameGroups, hardwareGroups, doorTotal, frameTotal, hwTotal]);

  // ── Tab data ───────────────────────────────────────────────────────────────
  // Show total individual door/frame count (not group count) so users aren't confused
  const totalDoorCount     = useMemo(() => visibleDoors.reduce((s, g) => s + g.doors.length, 0),    [visibleDoors]);
  const totalFrameCount    = useMemo(() => visibleFrames.reduce((s, g) => s + g.doors.length, 0),   [visibleFrames]);
  const totalHwCount       = useMemo(() => visibleHardware.reduce((s, g) => s + g.totalQty, 0),     [visibleHardware]);

  const TABS: Array<{ id: PricingTab; label: string; count: number; sub: string }> = [
    { id: 'door',     label: 'Doors',    count: totalDoorCount,  sub: `${visibleDoors.length} group${visibleDoors.length !== 1 ? 's' : ''}`     },
    { id: 'frame',    label: 'Frames',   count: totalFrameCount, sub: `${visibleFrames.length} group${visibleFrames.length !== 1 ? 's' : ''}`    },
    { id: 'hardware', label: 'Hardware', count: totalHwCount,    sub: `${visibleHardware.length} item${visibleHardware.length !== 1 ? 's' : ''}` },
  ];

  const currentMaterials = activeTab === 'door' ? doorMaterials : activeTab === 'frame' ? frameMaterials : hwMaterials;
  const currentFloors    = activeTab === 'hardware' ? [] : activeTab === 'door' ? doorFloors    : frameFloors;
  const currentBuildings = activeTab === 'hardware' ? [] : activeTab === 'door' ? doorBuildings : frameBuildings;

  // ─────────────────────────────────────────────────────────────────────────

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
          <button
            onClick={handleDownloadExcel}
            title="Download Excel"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-[var(--primary-action)]/10 hover:bg-[var(--primary-action)]/20 text-[var(--primary-text)] transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel
          </button>
          <button
            onClick={handleDownloadPdf}
            title="Download PDF"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-[var(--primary-action)]/10 hover:bg-[var(--primary-action)]/20 text-[var(--primary-text)] transition-colors"
          >
            <FileDown className="w-3.5 h-3.5" />
            PDF
          </button>
        </div>
      </div>

      {/* ── Tabs + filter bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Tabs */}
        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--bg-subtle)]">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => { setActiveTab(t.id); setFilters({ material: '', floor: '', building: '' }); }}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold transition-all border-r border-[var(--border)] last:border-r-0 ${
                activeTab === t.id
                  ? 'bg-[var(--primary-action)] text-white'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg)]'
              }`}
            >
              {t.label}
              <span className={`flex flex-col items-center leading-none ${
                activeTab === t.id ? 'text-white' : 'text-[var(--text-faint)]'
              }`}>
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === t.id ? 'bg-white/20' : 'bg-[var(--bg-muted)]'
                }`}>{t.count}</span>
                <span className="text-[9px] mt-0.5 opacity-70 whitespace-nowrap">{t.sub}</span>
              </span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 ml-auto">
          <FilterSelect label="Material" value={filters.material} options={currentMaterials} onChange={v => setFilter('material', v)} />
          {activeTab !== 'hardware' && (
            <>
              <FilterSelect label="Floor"    value={filters.floor}    options={currentFloors}    onChange={v => setFilter('floor',    v)} />
              <FilterSelect label="Building" value={filters.building} options={currentBuildings} onChange={v => setFilter('building', v)} />
            </>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      {loadingPrices ? (
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
                <DoorRow key={g.key} group={g} idx={i} category="door" onPriceChange={handlePriceChange} onView={() => setModalGroup(g)} />
              ))}
              {activeTab === 'frame' && visibleFrames.map((g, i) => (
                <DoorRow key={g.key} group={g} idx={i} category="frame" onPriceChange={handlePriceChange} onView={() => setModalGroup(g)} />
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
      )}

      <DetailModal group={modalGroup} tab={activeTab} onClose={() => setModalGroup(null)} />
    </div>
  );
};

// ─── Shared table header class ─────────────────────────────────────────────────

const TH = 'px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] whitespace-nowrap shadow-[inset_0_-1px_0_0_var(--border)]';
const TD = 'px-4 py-2.5 border-b border-[var(--border-subtle)] text-[var(--text-secondary)]';

// ─── Door / Frame row ─────────────────────────────────────────────────────────

const DoorRow: React.FC<{
  group: DoorPricingGroup;
  idx: number;
  category: PricingTab;
  onPriceChange: (cat: PricingTab, key: string, val: string) => void;
  onView: () => void;
}> = ({ group, idx, category, onPriceChange, onView }) => {
  const even = idx % 2 === 0;
  const fieldDefs = category === 'door' ? DOOR_FIELD_DEFS : FRAME_FIELD_DEFS;
  const visibleFields = fieldDefs.filter(f => group.fields[f.key]);
  return (
    <tr className={even ? 'bg-[var(--bg)]' : 'bg-[var(--bg-subtle)]/40'}>
      {/* Description spans 2 cols — takes all available space */}
      <td className={TD} colSpan={2}>
        <div className="font-medium text-[var(--text)]">{group.description}</div>
        <div className="flex flex-wrap gap-1 mt-0.5">
          {visibleFields.slice(0, 4).map(f => (
            <span key={f.key} className="text-[10px] px-1 py-px rounded bg-[var(--bg-muted)] text-[var(--text-faint)]">
              {f.label}: {group.fields[f.key]}
            </span>
          ))}
        </div>
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

const HardwareRow: React.FC<{
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

export default PricingReportConfig;
