'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Eye, DollarSign, FileSpreadsheet, FileDown, ChevronDown, X, Scissors, Trash2, Tag } from 'lucide-react';
import type { Door, HardwareSet } from '@/types';
import {
  groupDoors, groupFrames, groupHardwareItems,
  applyPrices, filterDoorGroups, filterHardwareGroups, uniqueValues,
  buildDescription, extractDoorFields, extractFrameFields,
  type DoorPricingGroup, type HardwarePricingGroup, type PriceMap,
  type VariantOverrideMap,
  DOOR_FIELD_DEFS, FRAME_FIELD_DEFS,
} from '@/utils/pricingGrouping';
import type { PricingVariant } from '@/lib/db/pricing';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

// ─── Types ────────────────────────────────────────────────────────────────────

type PricingTab = 'door' | 'frame' | 'hardware' | 'proposal';

interface Filters { material: string[]; floor: string[]; building: string[]; }

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

const MultiFilterSelect: React.FC<{
  label: string;
  selected: string[];
  options: string[];
  onChange: (v: string[]) => void;
}> = ({ label, selected, options, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const triggerLabel = selected.length === 0
    ? 'All'
    : selected.length === 1
      ? selected[0]
      : `${selected.length} selected`;

  return (
    <div className="flex items-center gap-1.5" ref={ref}>
      <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wide whitespace-nowrap">
        {label}
      </span>
      <div className="relative">
        <button
          onClick={() => setOpen(o => !o)}
          className={`h-7 min-w-[140px] max-w-[180px] flex items-center justify-between gap-1.5 pl-2.5 pr-2 rounded-md border text-xs transition-colors ${
            open
              ? 'border-[var(--primary-action)] bg-[var(--primary-bg)] text-[var(--primary-text)]'
              : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
          }`}
        >
          <span className={`truncate ${selected.length > 0 ? 'font-medium text-[var(--text)]' : ''}`}>
            {triggerLabel}
          </span>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {selected.length > 0 && (
              <span
                role="button"
                tabIndex={0}
                onClick={clearAll}
                onKeyDown={e => e.key === 'Enter' && clearAll(e as unknown as React.MouseEvent)}
                className="p-0.5 rounded hover:bg-[var(--bg-subtle)] text-[var(--text-faint)] hover:text-[var(--text)]"
              >
                <X className="w-2.5 h-2.5" />
              </span>
            )}
            <ChevronDown className={`w-3 h-3 text-[var(--text-faint)] transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {open && options.length > 0 && (
          <div className="absolute top-full left-0 mt-1 z-50 min-w-[180px] bg-[var(--bg)] border border-[var(--border)] rounded-lg shadow-lg py-1 max-h-56 overflow-y-auto">
            <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-subtle)] cursor-pointer border-b border-[var(--border)] mb-0.5">
              <input
                type="checkbox"
                checked={selected.length === 0}
                onChange={() => onChange([])}
                className="w-3.5 h-3.5 rounded border-[var(--border-strong)] text-[var(--primary-action)] focus:ring-[var(--primary-ring)] cursor-pointer flex-shrink-0"
              />
              <span className="text-xs font-medium text-[var(--text)]">All</span>
            </label>
            {options.map(opt => (
              <label key={opt} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-subtle)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                  className="w-3.5 h-3.5 rounded border-[var(--border-strong)] text-[var(--primary-action)] focus:ring-[var(--primary-ring)] cursor-pointer flex-shrink-0"
                />
                <span className="text-xs text-[var(--text-secondary)] truncate">{opt}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

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
  onCreateVariant: ((doorIds: string[], label: string) => void) | null;
}> = ({ group, tab, onClose, onCreateVariant }) => {
  const isDoorFrame = tab === 'door' || tab === 'frame';
  const doorGroup   = isDoorFrame ? (group as DoorPricingGroup)     : null;
  const hwGroup     = !isDoorFrame ? (group as HardwarePricingGroup) : null;

  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [showForm, setShowForm]     = useState(false);
  const [variantLabel, setVariantLabel] = useState('');
  const labelRef = useRef<HTMLInputElement>(null);

  // Reset on group change
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
                  <th className={`${TH_MODAL} w-px`}>
                    <input type="checkbox" checked={allChecked} onChange={toggleAll}
                      className="w-3.5 h-3.5 rounded border-[var(--border-strong)] text-[var(--primary-action)] cursor-pointer" />
                  </th>
                )}
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
                  <tr key={d.id} className={`${i % 2 === 0 ? 'bg-[var(--bg)]' : 'bg-[var(--bg-subtle)]/40'} ${checkedIds.has(d.id) ? 'bg-[var(--primary-bg)]/30' : ''}`}>
                    {canVariant && (
                      <td className={`${TD_MODAL} w-px`}>
                        <input type="checkbox" checked={checkedIds.has(d.id)} onChange={() => toggleDoor(d.id)}
                          className="w-3.5 h-3.5 rounded border-[var(--border-strong)] text-[var(--primary-action)] cursor-pointer" />
                      </td>
                    )}
                    <td className={`${TD_MODAL} font-mono font-medium text-[var(--text)] w-px whitespace-nowrap`}>{d.doorTag}</td>
                    <td className={`${TD_MODAL} w-px whitespace-nowrap text-[var(--text-muted)]`}>{d.location ?? '—'}</td>
                    <td className={`${TD_MODAL} w-px whitespace-nowrap text-[var(--text-muted)]`}>{d.fireRating ?? '—'}</td>
                    {tab === 'frame' && (() => {
                      const sec = d.sections as unknown as Record<string, Record<string, string>> | undefined;
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
                      {tab === 'door'
                        ? buildDescription(extractDoorFields(d), DOOR_FIELD_DEFS)
                        : buildDescription(
                            Object.fromEntries(Object.entries(extractFrameFields(d)).filter(([k]) => !k.startsWith('_'))),
                            FRAME_FIELD_DEFS,
                          )
                      }
                    </td>
                    <td className={`${TD_MODAL} text-right w-px whitespace-nowrap`}>{d.quantity ?? 1}</td>
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

        <div className="px-5 py-3 border-t border-[var(--border)] bg-[var(--bg-subtle)] flex-shrink-0 space-y-2">
          {/* Variant name form */}
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
};

const TH_MODAL = 'px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border-b border-[var(--border)]';
const TD_MODAL = 'px-4 py-2.5 text-xs text-[var(--text-secondary)] border-b border-[var(--border-subtle)]';

// ─── Main component ───────────────────────────────────────────────────────────

const PricingReportConfig: React.FC<Props> = ({ projectId, doors, hardwareSets, projectName }) => {
  const [activeTab, setActiveTab]   = useState<PricingTab>('door');
  const [prices, setPrices]         = useState<PriceMap>(new Map());
  const [filters, setFilters]       = useState<Filters>({ material: [], floor: [], building: [] });
  const [modalGroup, setModalGroup] = useState<DoorPricingGroup | HardwarePricingGroup | null>(null);
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [variants, setVariants]     = useState<PricingVariant[]>([]);
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

  // ── Load saved variants on mount ───────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/pricing-variants`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(json => { if (json?.data) setVariants(json.data as PricingVariant[]); })
      .catch(console.error);
  }, [projectId]);

  // ── Variant override map ───────────────────────────────────────────────────
  const variantOverrides = useMemo<VariantOverrideMap>(() => {
    const map: VariantOverrideMap = new Map();
    for (const v of variants) {
      for (const doorId of v.doorIds) {
        map.set(doorId, { variantKey: v.key, variantLabel: v.label });
      }
    }
    return map;
  }, [variants]);

  // ── Raw groups (memo) ──────────────────────────────────────────────────────
  const rawDoorGroups     = useMemo(() => groupDoors(doors, variantOverrides),                   [doors, variantOverrides]);
  const rawFrameGroups    = useMemo(() => groupFrames(doors, variantOverrides),                  [doors, variantOverrides]);
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

  // ── Proposal profit percentages ────────────────────────────────────────────
  const [profitPct, setProfitPct] = useState<{ door: string; frame: string; hardware: string }>({
    door: '', frame: '', hardware: '',
  });
  const profitDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved profit percentages on mount
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/pricing-proposal`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!json?.data) return;
        const { profit_door, profit_frame, profit_hardware } = json.data as { profit_door: number; profit_frame: number; profit_hardware: number };
        setProfitPct({
          door:     profit_door     > 0 ? String(profit_door)     : '',
          frame:    profit_frame    > 0 ? String(profit_frame)    : '',
          hardware: profit_hardware > 0 ? String(profit_hardware) : '',
        });
      })
      .catch(console.error);
  }, [projectId]);

  // Debounced save whenever profit percentages change
  const handleProfitChange = useCallback((key: 'door' | 'frame' | 'hardware', raw: string) => {
    setProfitPct(prev => {
      const next = { ...prev, [key]: raw };
      if (profitDebounce.current) clearTimeout(profitDebounce.current);
      profitDebounce.current = setTimeout(() => {
        const toNum = (s: string) => Math.max(0, parseFloat(s) || 0);
        fetch(`/api/projects/${projectId}/pricing-proposal`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profit_door:     toNum(next.door),
            profit_frame:    toNum(next.frame),
            profit_hardware: toNum(next.hardware),
          }),
        }).catch(console.error);
      }, 800);
      return next;
    });
  }, [projectId]);

  const withProfit = (base: number, pctStr: string): number => {
    const p = parseFloat(pctStr);
    return isNaN(p) || p <= 0 ? base : base * (1 + p / 100);
  };

  const proposalDoorTotal     = withProfit(doorTotal,  profitPct.door);
  const proposalFrameTotal    = withProfit(frameTotal, profitPct.frame);
  const proposalHwTotal       = withProfit(hwTotal,    profitPct.hardware);
  const proposalGrandTotal    = proposalDoorTotal + proposalFrameTotal + proposalHwTotal;

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

  // ── Variant handlers ───────────────────────────────────────────────────────
  const handleCreateVariant = useCallback(async (doorIds: string[], label: string) => {
    const variantKey = `vprice-${Date.now()}`;
    const newVariant: PricingVariant = {
      key: variantKey,
      label,
      category: activeTab as 'door' | 'frame',
      doorIds,
    };
    // Optimistic update
    setVariants(prev => [...prev, newVariant]);
    // Persist
    try {
      await fetch(`/api/projects/${projectId}/pricing-variants`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant: newVariant }),
      });
    } catch (err) {
      console.error('[Pricing] Variant save failed:', err);
    }
  }, [projectId, activeTab]);

  const handleDeleteVariant = useCallback(async (variantKey: string) => {
    setVariants(prev => prev.filter(v => v.key !== variantKey));
    try {
      await fetch(`/api/projects/${projectId}/pricing-variants?variantKey=${variantKey}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch (err) {
      console.error('[Pricing] Variant delete failed:', err);
    }
  }, [projectId]);

  const setFilter = (k: keyof Filters, v: string[]) => setFilters(prev => ({ ...prev, [k]: v }));

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
    { id: 'proposal', label: 'Proposal', count: 0,               sub: 'summary'                                                                 },
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
              onClick={() => { setActiveTab(t.id); setFilters({ material: [], floor: [], building: [] }); }}
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

        {/* Filters — hidden on Proposal tab */}
        {activeTab !== 'proposal' && (
          <div className="flex flex-wrap items-center gap-3 ml-auto">
            <MultiFilterSelect label="Material" selected={filters.material} options={currentMaterials} onChange={v => setFilter('material', v)} />
            {activeTab !== 'hardware' && (
              <>
                <MultiFilterSelect label="Floor"    selected={filters.floor}    options={currentFloors}    onChange={v => setFilter('floor',    v)} />
                <MultiFilterSelect label="Building" selected={filters.building} options={currentBuildings} onChange={v => setFilter('building', v)} />
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Proposal tab ── */}
      {activeTab === 'proposal' && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-6 space-y-6">
          {/* Header */}
          <div className="border-b border-[var(--border)] pb-4">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-faint)] mb-1">Proposal</p>
            <h3 className="text-lg font-bold text-[var(--text)]">{projectName || 'Untitled Project'}</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Prepared on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          {/* Summary table */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] mb-2">Pricing Summary</p>
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
                {(
                  [
                    { label: 'Doors',    key: 'door'     as const, count: doorGroups.length,     base: doorTotal,  newTotal: proposalDoorTotal  },
                    { label: 'Frames',   key: 'frame'    as const, count: frameGroups.length,    base: frameTotal, newTotal: proposalFrameTotal },
                    { label: 'Hardware', key: 'hardware' as const, count: hardwareGroups.length, base: hwTotal,    newTotal: proposalHwTotal    },
                  ]
                ).map(({ label, key, count, base, newTotal }, i) => (
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
                    <td className="px-4 py-2 text-right font-semibold text-[var(--primary-text)] border border-[var(--border)]">
                      {fmt.format(newTotal)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-[var(--primary-bg)]">
                  <td className="px-4 py-3 font-bold text-[var(--primary-text)] border border-[var(--primary-border)]" colSpan={3}>Grand Total</td>
                  <td className="px-4 py-3 border border-[var(--primary-border)]" />
                  <td className="px-4 py-3 text-right font-bold text-[var(--primary-text)] border border-[var(--primary-border)]">{fmt.format(proposalGrandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Door groups breakdown */}
          {doorGroups.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] mb-2">Door Details</p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[var(--bg-subtle)]">
                    <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)]">Description</th>
                    <th className="text-right px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)]">Qty</th>
                    <th className="text-right px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)]">Unit Price</th>
                    <th className="text-right px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {doorGroups.map((g, i) => (
                    <tr key={g.key} className={i % 2 === 0 ? 'bg-[var(--bg)]' : 'bg-[var(--bg-subtle)]/40'}>
                      <td className="px-4 py-2 text-[var(--text-secondary)] border border-[var(--border)]">{g.description}</td>
                      <td className="px-4 py-2 text-right text-[var(--text-muted)] border border-[var(--border)]">{g.totalQty}</td>
                      <td className="px-4 py-2 text-right text-[var(--text-muted)] border border-[var(--border)]">{fmt.format(g.unitPrice)}</td>
                      <td className="px-4 py-2 text-right font-medium text-[var(--text)] border border-[var(--border)]">{fmt.format(g.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Frame groups breakdown */}
          {frameGroups.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] mb-2">Frame Details</p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[var(--bg-subtle)]">
                    <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)]">Description</th>
                    <th className="text-right px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)]">Qty</th>
                    <th className="text-right px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)]">Unit Price</th>
                    <th className="text-right px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {frameGroups.map((g, i) => (
                    <tr key={g.key} className={i % 2 === 0 ? 'bg-[var(--bg)]' : 'bg-[var(--bg-subtle)]/40'}>
                      <td className="px-4 py-2 text-[var(--text-secondary)] border border-[var(--border)]">{g.description}</td>
                      <td className="px-4 py-2 text-right text-[var(--text-muted)] border border-[var(--border)]">{g.totalQty}</td>
                      <td className="px-4 py-2 text-right text-[var(--text-muted)] border border-[var(--border)]">{fmt.format(g.unitPrice)}</td>
                      <td className="px-4 py-2 text-right font-medium text-[var(--text)] border border-[var(--border)]">{fmt.format(g.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Hardware breakdown */}
          {hardwareGroups.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] mb-2">Hardware Details</p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[var(--bg-subtle)]">
                    <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)]">Item</th>
                    <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)]">Manufacturer</th>
                    <th className="text-right px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)]">Qty</th>
                    <th className="text-right px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)]">Unit Price</th>
                    <th className="text-right px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {hardwareGroups.map((g, i) => (
                    <tr key={g.key} className={i % 2 === 0 ? 'bg-[var(--bg)]' : 'bg-[var(--bg-subtle)]/40'}>
                      <td className="px-4 py-2 text-[var(--text-secondary)] border border-[var(--border)]">{g.item.name ?? '—'}</td>
                      <td className="px-4 py-2 text-[var(--text-muted)] border border-[var(--border)]">{g.item.manufacturer ?? '—'}</td>
                      <td className="px-4 py-2 text-right text-[var(--text-muted)] border border-[var(--border)]">{g.totalQty}</td>
                      <td className="px-4 py-2 text-right text-[var(--text-muted)] border border-[var(--border)]">{fmt.format(g.unitPrice)}</td>
                      <td className="px-4 py-2 text-right font-medium text-[var(--text)] border border-[var(--border)]">{fmt.format(g.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

      <DetailModal
        group={modalGroup}
        tab={activeTab}
        onClose={() => setModalGroup(null)}
        onCreateVariant={activeTab !== 'hardware' ? handleCreateVariant : null}
      />
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
  onDeleteVariant?: (variantKey: string) => void;
}> = ({ group, idx, category, onPriceChange, onView, onDeleteVariant }) => {
  const even = idx % 2 === 0;
  const fieldDefs = category === 'door' ? DOOR_FIELD_DEFS : FRAME_FIELD_DEFS;
  const visibleFields = fieldDefs.filter(f => group.fields[f.key]);
  return (
    <tr className={even ? 'bg-[var(--bg)]' : 'bg-[var(--bg-subtle)]/40'}>
      {/* Description spans 2 cols — takes all available space */}
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
