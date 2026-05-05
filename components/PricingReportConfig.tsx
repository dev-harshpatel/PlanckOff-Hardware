'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Eye, DollarSign, FileSpreadsheet, FileDown, ChevronDown, X, Scissors, Trash2, Tag } from 'lucide-react';
import type { Door, HardwareSet } from '@/types';
import type { CompanySettings } from '@/lib/db/companySettings';
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

const withPrep = (g: { description: string; prep: string[] }) =>
  g.prep.length ? `${g.description} | Prep: ${g.prep.join('; ')}` : g.description;

function calcTotal(groups: Array<{ totalPrice: number }>): number {
  return groups.reduce((s, g) => s + g.totalPrice, 0);
}

// ── Hierarchy breakdown helpers ────────────────────────────────────────────────
//
// Groups aggregate doors that share the same specs, so one group can span
// multiple floors / buildings / materials.  Filtering at the group level causes
// double-counting (the full group price appears under every dimension value it
// touches).  Instead we compute individual door contributions and split
// correctly at the door level.

interface HierarchyNode { label: string; dimType: 'Building' | 'Floor' | 'Material'; count: number; base: number; depth: number; children: HierarchyNode[] }

interface DoorContrib { price: number; material: string; floor: string; building: string }

type ContribDim = { type: 'Building' | 'Floor' | 'Material'; key: keyof DoorContrib; values: string[] };

function doorGroupsToContribs(groups: DoorPricingGroup[], getMat: (d: Door) => string): DoorContrib[] {
  return groups.flatMap(g =>
    g.doors.map(d => ({
      price:    g.unitPrice * (d.quantity != null && d.quantity > 0 ? d.quantity : 1),
      material: getMat(d).trim(),
      floor:    (d.buildingLocation ?? d.location ?? '').trim(),
      building: (d.buildingTag ?? '').trim(),
    }))
  );
}

function buildContribNodes(contribs: DoorContrib[], dims: ContribDim[], depth: number): HierarchyNode[] {
  if (dims.length === 0) return [];
  const [dim, ...rest] = dims;
  return dim.values.flatMap(val => {
    const matched = contribs.filter(c => (c[dim.key] as string) === val);
    if (matched.length === 0) return [];
    return [{ label: val, dimType: dim.type, count: matched.length, base: matched.reduce((s, c) => s + c.price, 0), depth, children: buildContribNodes(matched, rest, depth + 1) }];
  });
}

function buildDoorHierarchy(groups: DoorPricingGroup[], filters: { material: string[]; floor: string[]; building: string[] }, getMat: (d: Door) => string): HierarchyNode[] {
  const dims: ContribDim[] = [];
  if (filters.building.length > 0) dims.push({ type: 'Building', key: 'building', values: filters.building });
  if (filters.floor.length > 0)    dims.push({ type: 'Floor',    key: 'floor',    values: filters.floor    });
  if (filters.material.length > 0) dims.push({ type: 'Material', key: 'material', values: filters.material });
  if (dims.length === 0) return [];
  return buildContribNodes(doorGroupsToContribs(groups, getMat), dims, 0);
}

function buildHwHierarchy(groups: HardwarePricingGroup[], filters: { material: string[] }, doors: Door[]): HierarchyNode[] {
  if (filters.material.length === 0) return [];

  // Map each hardware unit to its door's material using proportional splits per set.
  // A set's multipliedQty = item.qty × sum(door.qty), so each door's share is
  //   unitPrice × multipliedQty × (door.qty / totalDoorQty for that set).
  const contribs: Array<{ price: number; material: string }> = [];
  const includedDoors = doors.filter(d => d.hardwareIncludeExclude?.trim().toUpperCase() !== 'EXCLUDE');

  for (const group of groups) {
    for (const setInfo of group.sets) {
      const setNameLower = setInfo.setName.toLowerCase();
      const setDoors = includedDoors.filter(d => {
        const name = (
          d.assignedHardwareSet?.name?.trim() ||
          (d.sections as unknown as Record<string, Record<string, string | undefined>> | undefined)?.hardware?.['HARDWARE SET']?.trim() ||
          d.providedHardwareSet?.trim() ||
          ''
        ).toLowerCase();
        return name === setNameLower;
      });
      if (setDoors.length === 0) continue;

      const totalDoorQty = setDoors.reduce((s, d) => s + (d.quantity != null && d.quantity > 0 ? d.quantity : 1), 0);
      for (const door of setDoors) {
        const dq = door.quantity != null && door.quantity > 0 ? door.quantity : 1;
        contribs.push({
          price:    group.unitPrice * setInfo.multipliedQty * (dq / totalDoorQty),
          material: door.doorMaterial?.trim() ?? '',
        });
      }
    }
  }

  return filters.material.flatMap(mat => {
    const matched = contribs.filter(c => c.material === mat);
    if (matched.length === 0) return [];
    return [{ label: mat, dimType: 'Material' as const, count: matched.length, base: matched.reduce((s, c) => s + c.price, 0), depth: 0, children: [] }];
  });
}

function flattenNodes(nodes: HierarchyNode[]): Array<{ label: string; dimType: string; count: number; base: number; depth: number }> {
  return nodes.flatMap(n => [{ label: n.label, dimType: n.dimType, count: n.count, base: n.base, depth: n.depth }, ...flattenNodes(n.children)]);
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
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [filters, setFilters]           = useState<Filters>({ material: [], floor: [], building: [] });
  const [proposalFilters, setProposalFilters] = useState<Filters>({ material: [], floor: [], building: [] });
  const [modalGroup, setModalGroup] = useState<DoorPricingGroup | HardwarePricingGroup | null>(null);
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [hiddenProposalTables, setHiddenProposalTables] = useState<Set<'doors' | 'frames' | 'hardware'>>(new Set());

  const toggleProposalTable = (key: 'doors' | 'frames' | 'hardware') =>
    setHiddenProposalTables(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  const [variants, setVariants]     = useState<PricingVariant[]>([]);
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ── Load company settings on mount ────────────────────────────────────────
  useEffect(() => {
    fetch('/api/settings/company', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((json: { data: CompanySettings } | null) => { if (json?.data) setCompanySettings(json.data); })
      .catch(() => {});
  }, []);

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

  // ── Proposal filter options (union across all categories) ──────────────────
  const proposalMaterials = useMemo(() => Array.from(new Set([...doorMaterials, ...frameMaterials, ...hwMaterials])).sort(), [doorMaterials, frameMaterials, hwMaterials]);
  const proposalFloors    = useMemo(() => Array.from(new Set([...doorFloors, ...frameFloors])).sort(),       [doorFloors, frameFloors]);
  const proposalBuildings = useMemo(() => Array.from(new Set([...doorBuildings, ...frameBuildings])).sort(), [doorBuildings, frameBuildings]);

  // ── Tab-filtered groups ────────────────────────────────────────────────────
  const visibleDoors     = useMemo(() => filterDoorGroups(doorGroups,     filters), [doorGroups,     filters]);
  const visibleFrames    = useMemo(() => filterDoorGroups(frameGroups,    filters), [frameGroups,    filters]);
  const visibleHardware  = useMemo(() => filterHardwareGroups(hardwareGroups, { material: filters.material }), [hardwareGroups, filters.material]);

  // ── Tab totals ─────────────────────────────────────────────────────────────
  const doorTotal     = useMemo(() => calcTotal(visibleDoors),    [visibleDoors]);
  const frameTotal    = useMemo(() => calcTotal(visibleFrames),   [visibleFrames]);
  const hwTotal       = useMemo(() => calcTotal(visibleHardware), [visibleHardware]);
  const grandTotal    = doorTotal + frameTotal + hwTotal;

  // ── Proposal totals (full, unaffected by tab filters) ─────────────────────
  const proposalDoorBase  = useMemo(() => calcTotal(doorGroups),     [doorGroups]);
  const proposalFrameBase = useMemo(() => calcTotal(frameGroups),    [frameGroups]);
  const proposalHwBase    = useMemo(() => calcTotal(hardwareGroups), [hardwareGroups]);

  // ── Proposal breakdown sub-rows (hierarchical: Building > Floor > Material) ──
  const proposalBreakdown = useMemo(() => ({
    doors:    flattenNodes(buildDoorHierarchy(doorGroups,     proposalFilters, d => d.doorMaterial          ?? '')),
    frames:   flattenNodes(buildDoorHierarchy(frameGroups,    proposalFilters, d => String(d.frameMaterial ?? ''))),
    hardware: flattenNodes(buildHwHierarchy(hardwareGroups,  proposalFilters, doors)),
  }), [doorGroups, frameGroups, hardwareGroups, proposalFilters, doors]);

  // ── Hardware set → door count (for proposal detail table) ─────────────────
  const hwSetList = useMemo(() => {
    const countMap = new Map<string, number>();
    const includedDoors = doors.filter(d => d.hardwareIncludeExclude?.trim().toUpperCase() !== 'EXCLUDE');
    for (const door of includedDoors) {
      const name = (
        door.assignedHardwareSet?.name?.trim() ||
        (door.sections as unknown as Record<string, Record<string, string | undefined>> | undefined)?.hardware?.['HARDWARE SET']?.trim() ||
        door.providedHardwareSet?.trim() ||
        ''
      );
      if (!name) continue;
      const qty = door.quantity != null && door.quantity > 0 ? door.quantity : 1;
      countMap.set(name.toLowerCase(), (countMap.get(name.toLowerCase()) ?? 0) + qty);
    }
    const seen = new Set<string>();
    const result: { name: string; doorCount: number }[] = [];
    for (const g of hardwareGroups) {
      for (const s of g.sets) {
        const key = s.setName.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          result.push({ name: s.setName, doorCount: countMap.get(key) ?? 0 });
        }
      }
    }
    return result;
  }, [doors, hardwareGroups]);

  // ── Proposal profit percentages ────────────────────────────────────────────
  const [profitPct, setProfitPct] = useState<{ door: string; frame: string; hardware: string }>({
    door: '', frame: '', hardware: '',
  });
  const profitDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Proposal settings state ────────────────────────────────────────────────
  const [allocateExpenses, setAllocateExpenses] = useState(false);
  const [taxRows, setTaxRows]                   = useState<Array<{ id: string; description: string; taxPct: string }>>([]);
  const [remarks, setRemarks]                   = useState('');
  const [extraExpenses, setExtraExpenses]        = useState<Array<{ id: string; delivery: string; totalPrice: string }>>([]);

  // Refs holding the latest values so debounced saves always read fresh state
  const latestProfitPct  = useRef(profitPct);
  const latestAllocate   = useRef(false);
  const latestTaxRows    = useRef<Array<{ id: string; description: string; taxPct: string }>>([]);
  const latestRemarks    = useRef('');
  const expenseDebounce  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taxDebounce      = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load saved proposal settings on mount ─────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/pricing-proposal`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!json?.data) return;
        const { profit_door, profit_frame, profit_hardware, allocate_expenses } =
          json.data as { profit_door: number; profit_frame: number; profit_hardware: number; allocate_expenses: boolean };
        const next = {
          door:     profit_door     > 0 ? String(profit_door)     : '',
          frame:    profit_frame    > 0 ? String(profit_frame)    : '',
          hardware: profit_hardware > 0 ? String(profit_hardware) : '',
        };
        setProfitPct(next);
        latestProfitPct.current = next;
        setAllocateExpenses(allocate_expenses);
        latestAllocate.current = allocate_expenses;
        const r = (json.data as { remarks: string }).remarks ?? '';
        setRemarks(r);
        latestRemarks.current = r;
      })
      .catch(console.error);
  }, [projectId]);

  // ── Load saved expenses on mount ───────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/proposal-expenses`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!json?.data) return;
        setExtraExpenses(
          (json.data as Array<{ id: string; delivery: string; total_price: number }>).map(row => ({
            id:         row.id,
            delivery:   row.delivery,
            totalPrice: row.total_price > 0 ? String(row.total_price) : '',
          })),
        );
      })
      .catch(console.error);
  }, [projectId]);

  // ── Load saved tax rows on mount ───────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/proposal-tax-rows`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!json?.data) return;
        const loaded = (json.data as Array<{ id: string; description: string; tax_pct: number }>).map(row => ({
          id:          row.id,
          description: row.description,
          taxPct:      row.tax_pct > 0 ? String(row.tax_pct) : '',
        }));
        setTaxRows(loaded);
        latestTaxRows.current = loaded;
      })
      .catch(console.error);
  }, [projectId]);

  // ── Unified debounced save for all proposal settings ──────────────────────
  const saveProposalSettings = useCallback(() => {
    if (profitDebounce.current) clearTimeout(profitDebounce.current);
    profitDebounce.current = setTimeout(() => {
      const toNum = (s: string) => Math.max(0, parseFloat(s) || 0);
      fetch(`/api/projects/${projectId}/pricing-proposal`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profit_door:       toNum(latestProfitPct.current.door),
          profit_frame:      toNum(latestProfitPct.current.frame),
          profit_hardware:   toNum(latestProfitPct.current.hardware),
          allocate_expenses: latestAllocate.current,
          remarks:           latestRemarks.current,
        }),
      }).catch(console.error);
    }, 800);
  }, [projectId]);

  // ── Debounced save for expense rows (full replace) ─────────────────────────
  const saveExpenses = useCallback((expenses: typeof extraExpenses) => {
    if (expenseDebounce.current) clearTimeout(expenseDebounce.current);
    expenseDebounce.current = setTimeout(() => {
      fetch(`/api/projects/${projectId}/proposal-expenses`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expenses: expenses.map((e, i) => ({
            sort_order:  i,
            delivery:    e.delivery,
            total_price: parseFloat(e.totalPrice) || 0,
          })),
        }),
      }).catch(console.error);
    }, 800);
  }, [projectId]);

  // ── Debounced save for tax rows (full replace) ────────────────────────────
  const saveTaxRows = useCallback((rows: typeof taxRows) => {
    if (taxDebounce.current) clearTimeout(taxDebounce.current);
    taxDebounce.current = setTimeout(() => {
      fetch(`/api/projects/${projectId}/proposal-tax-rows`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: rows.map((r, i) => ({
            sort_order:  i,
            description: r.description,
            tax_pct:     parseFloat(r.taxPct) || 0,
          })),
        }),
      }).catch(console.error);
    }, 800);
  }, [projectId]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleProfitChange = useCallback((key: 'door' | 'frame' | 'hardware', raw: string) => {
    setProfitPct(prev => {
      const next = { ...prev, [key]: raw };
      latestProfitPct.current = next;
      saveProposalSettings();
      return next;
    });
  }, [saveProposalSettings]);

  const handleAllocateChange = useCallback((val: boolean) => {
    setAllocateExpenses(val);
    latestAllocate.current = val;
    saveProposalSettings();
  }, [saveProposalSettings]);

  const handleAddTaxRow = useCallback(() => {
    setTaxRows(prev => {
      const next = [...prev, { id: crypto.randomUUID(), description: '', taxPct: '' }];
      latestTaxRows.current = next;
      saveTaxRows(next);
      return next;
    });
  }, [saveTaxRows]);

  const handleTaxRowChange = useCallback((id: string, field: 'description' | 'taxPct', value: string) => {
    setTaxRows(prev => {
      const next = prev.map(r => r.id === id ? { ...r, [field]: value } : r);
      latestTaxRows.current = next;
      saveTaxRows(next);
      return next;
    });
  }, [saveTaxRows]);

  const handleRemoveTaxRow = useCallback((id: string) => {
    setTaxRows(prev => {
      const next = prev.filter(r => r.id !== id);
      latestTaxRows.current = next;
      saveTaxRows(next);
      return next;
    });
  }, [saveTaxRows]);

  const handleRemarksChange = useCallback((val: string) => {
    setRemarks(val);
    latestRemarks.current = val;
    saveProposalSettings();
  }, [saveProposalSettings]);

  const handleAddExpense = useCallback(() => {
    setExtraExpenses(prev => {
      const next = [...prev, { id: crypto.randomUUID(), delivery: '', totalPrice: '' }];
      saveExpenses(next);
      return next;
    });
  }, [saveExpenses]);

  const handleExpenseChange = useCallback((id: string, field: 'delivery' | 'totalPrice', value: string) => {
    setExtraExpenses(prev => {
      const next = prev.map(e => e.id === id ? { ...e, [field]: value } : e);
      saveExpenses(next);
      return next;
    });
  }, [saveExpenses]);

  const handleRemoveExpense = useCallback((id: string) => {
    setExtraExpenses(prev => {
      const next = prev.filter(e => e.id !== id);
      saveExpenses(next);
      return next;
    });
  }, [saveExpenses]);

  const withProfit = (base: number, pctStr: string): number => {
    const p = parseFloat(pctStr);
    return isNaN(p) || p <= 0 ? base : base * (1 + p / 100);
  };

  const proposalDoorTotal  = withProfit(proposalDoorBase,  profitPct.door);
  const proposalFrameTotal = withProfit(proposalFrameBase, profitPct.frame);
  const proposalHwTotal    = withProfit(proposalHwBase,    profitPct.hardware);

  const extraExpensesTotal = extraExpenses.reduce((sum, e) => sum + (parseFloat(e.totalPrice) || 0), 0);
  const proposalGrandTotal = proposalDoorTotal + proposalFrameTotal + proposalHwTotal;
  const taxSubtotal        = proposalGrandTotal + extraExpensesTotal;
  const totalTaxAmount     = taxRows.reduce((sum, r) => sum + taxSubtotal * (Math.max(0, parseFloat(r.taxPct) || 0) / 100), 0);
  const totalAfterTax      = taxSubtotal + totalTaxAmount;
  // Split extra expenses proportional to each category's share of the Pricing Summary Grand Total
  const doorAlloc  = allocateExpenses && proposalGrandTotal > 0 ? extraExpensesTotal * (proposalDoorTotal  / proposalGrandTotal) : 0;
  const frameAlloc = allocateExpenses && proposalGrandTotal > 0 ? extraExpensesTotal * (proposalFrameTotal / proposalGrandTotal) : 0;
  const hwAlloc    = allocateExpenses && proposalGrandTotal > 0 ? extraExpensesTotal * (proposalHwTotal    / proposalGrandTotal) : 0;

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

  const setFilter         = (k: keyof Filters, v: string[]) => setFilters(prev => ({ ...prev, [k]: v }));
  const setProposalFilter = (k: keyof Filters, v: string[]) => setProposalFilters(prev => ({ ...prev, [k]: v }));

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

    // Company header sheet (only when settings are filled)
    if (companySettings?.companyName) {
      const co = companySettings;
      const coverRows: [string, string][] = [
        ['Project',      projectName],
        ['',             ''],
        ['Company',      co.companyName],
      ];
      if (co.websiteUrl) coverRows.push(['Website', co.websiteUrl]);
      if (co.email)      coverRows.push(['Email',   co.email]);
      if (co.phone)      coverRows.push(['Phone',   co.phone]);
      if (co.address)    coverRows.push(['Address', co.address]);
      const coverParts = [co.province, co.country].filter(Boolean).join(', ');
      if (coverParts)    coverRows.push(['',        coverParts]);
      utils.book_append_sheet(wb, utils.aoa_to_sheet(coverRows), 'Company');
    }

    utils.book_append_sheet(wb,
      makeSheet(doorGroups, doorTotal, g => ({
        'Description': withPrep(g),
        'Total Qty':   g.totalQty,
        'Unit Price':  g.unitPrice,
        'Total Price': g.totalPrice,
      })),
      'Doors',
    );
    utils.book_append_sheet(wb,
      makeSheet(frameGroups, frameTotal, g => ({
        'Description': withPrep(g),
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
  }, [doorGroups, frameGroups, hardwareGroups, doorTotal, frameTotal, hwTotal, companySettings, projectName]);

  // ── Download PDF ───────────────────────────────────────────────────────────
  const handleDownloadPdf = useCallback(async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: 'landscape' });
    type DocWithAutoTable = typeof doc & { lastAutoTable?: { finalY: number } };
    const d = doc as DocWithAutoTable;

    const nextY = (offset = 0) => (d.lastAutoTable?.finalY ?? 0) + offset;

    const totalRowStyle = { fontStyle: 'bold' as const, fillColor: [240, 243, 250] as [number, number, number] };

    // Company header block
    let headerBottomY = 10;
    if (companySettings?.companyName) {
      const co = companySettings;
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(co.companyName, 14, 12);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const lines: string[] = [];
      if (co.websiteUrl || co.email) lines.push([co.websiteUrl, co.email].filter(Boolean).join('  |  '));
      if (co.phone) lines.push(co.phone);
      const addrParts = [co.address, co.province, co.country].filter(Boolean).join(', ');
      if (addrParts) lines.push(addrParts);
      lines.forEach((line, i) => doc.text(line, 14, 18 + i * 5));
      headerBottomY = 18 + lines.length * 5 + 4;
      doc.setDrawColor(180, 180, 180);
      doc.line(14, headerBottomY, doc.internal.pageSize.width - 14, headerBottomY);
      headerBottomY += 6;
    }

    // Doors
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Doors — Total: ${fmt.format(doorTotal)}`, 14, headerBottomY);
    autoTable(doc, {
      startY: headerBottomY + 6,
      head: [['Description', 'Total Qty', 'Unit Price', 'Total Price']],
      body: [
        ...doorGroups.map(g => [withPrep(g), g.totalQty, fmt.format(g.unitPrice), fmt.format(g.totalPrice)]),
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
        ...frameGroups.map(g => [withPrep(g), g.totalQty, fmt.format(g.unitPrice), fmt.format(g.totalPrice)]),
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
  }, [doorGroups, frameGroups, hardwareGroups, doorTotal, frameTotal, hwTotal, companySettings]);

  // ── Download Proposal PDF ──────────────────────────────────────────────────
  const handleDownloadProposalPdf = useCallback(async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    type DocWithAutoTable = typeof doc & { lastAutoTable?: { finalY: number } };
    const d = doc as DocWithAutoTable;

    const pageW  = doc.internal.pageSize.width;
    const pageH  = doc.internal.pageSize.height;
    const margin = 40;
    let y = margin;

    // ── Company header ───────────────────────────────────────────────────────
    if (companySettings?.companyName) {
      const co = companySettings;
      let textX = margin;

      // Logo — fetch as blob to avoid canvas CORS taint from Supabase Storage
      if (co.logoUrl) {
        try {
          const resp    = await fetch(co.logoUrl);
          const blob    = await resp.blob();
          const dataUrl = await new Promise<string>((res, rej) => {
            const reader    = new FileReader();
            reader.onloadend = () => res(reader.result as string);
            reader.onerror   = rej;
            reader.readAsDataURL(blob);
          });
          // Load dataUrl into img so we can get natural dimensions (no CORS taint on local dataUrl)
          const img = new Image();
          await new Promise<void>(res => { img.onload = () => res(); img.src = dataUrl; });
          const maxLogoH = 40;
          const scale    = maxLogoH / img.height;
          const logoW    = Math.min(img.width * scale, 120);
          const canvas   = document.createElement('canvas');
          canvas.width   = logoW;
          canvas.height  = maxLogoH;
          canvas.getContext('2d')?.drawImage(img, 0, 0, logoW, maxLogoH);
          doc.addImage(canvas.toDataURL('image/png'), 'PNG', margin, y, logoW, maxLogoH);
          textX = margin + logoW + 12;
        } catch { /* skip logo on error */ }
      }

      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 20, 20);
      doc.text(co.companyName, textX, y + 14);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      const contactLines: string[] = [];
      if (co.websiteUrl || co.email) contactLines.push([co.websiteUrl, co.email].filter(Boolean).join('  ·  '));
      if (co.phone) contactLines.push(co.phone);
      const addr = [co.address, co.province, co.country].filter(Boolean).join(', ');
      if (addr) contactLines.push(addr);
      contactLines.forEach((line, i) => doc.text(line, textX, y + 26 + i * 10));

      y += 54;
      doc.setDrawColor(210, 215, 225);
      doc.line(margin, y, pageW - margin, y);
      y += 16;
    }

    // ── Proposal title ────────────────────────────────────────────────────────
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(130, 140, 160);
    doc.text('PROPOSAL', margin, y);
    y += 14;

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 20, 30);
    doc.text(projectName || 'Untitled Project', margin, y);
    y += 14;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110, 110, 120);
    doc.text(
      `Prepared on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      margin, y,
    );
    y += 22;

    doc.setDrawColor(225, 228, 235);
    doc.line(margin, y, pageW - margin, y);
    y += 16;

    // ── Pricing summary table ─────────────────────────────────────────────────
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 35, 45);
    doc.text('Pricing Summary', margin, y);
    y += 8;

    const summaryRows = [
      { label: 'Doors',    base: proposalDoorBase,  pct: profitPct.door,     total: proposalDoorTotal,  alloc: doorAlloc   },
      { label: 'Frames',   base: proposalFrameBase, pct: profitPct.frame,    total: proposalFrameTotal, alloc: frameAlloc  },
      { label: 'Hardware', base: proposalHwBase,    pct: profitPct.hardware, total: proposalHwTotal,    alloc: hwAlloc     },
    ];
    const grandLabel = allocateExpenses && extraExpensesTotal > 0
      ? `${fmt.format(proposalGrandTotal)} + ${fmt.format(extraExpensesTotal)} exp.`
      : '';

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Category', 'Base Cost', 'Profit %', 'Total']],
      body: [
        ...summaryRows.map(r => [
          r.label,
          fmt.format(r.base),
          r.pct ? `${r.pct}%` : '—',
          fmt.format(r.total + r.alloc),
        ]),
        ['Grand Total', grandLabel, '', fmt.format(proposalGrandTotal + (allocateExpenses ? extraExpensesTotal : 0))],
      ],
      styles:     { fontSize: 8, cellPadding: 5 },
      headStyles: { fillColor: [45, 60, 100], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (data) => {
        if (data.row.index === summaryRows.length) {
          Object.assign(data.cell.styles, { fontStyle: 'bold', fillColor: [235, 240, 252] });
        }
      },
    });
    y = (d.lastAutoTable?.finalY ?? y) + 20;

    // ── Doors detail table ────────────────────────────────────────────────────
    if (!hiddenProposalTables.has('doors') && doorGroups.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 35, 45);
      doc.text('Doors', margin, y);
      y += 8;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Description', 'Total Qty']],
        body: [
          ...doorGroups.map(g => [g.description, g.totalQty]),
          ['Total', doorGroups.reduce((s, g) => s + g.totalQty, 0)],
        ],
        styles:       { fontSize: 8, cellPadding: 5 },
        headStyles:   { fillColor: [45, 60, 100], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'right' } },
        didParseCell: (data) => {
          if (data.row.index === doorGroups.length) {
            Object.assign(data.cell.styles, { fontStyle: 'bold', fillColor: [235, 240, 252] });
          }
        },
      });
      y = (d.lastAutoTable?.finalY ?? y) + 20;
    }

    // ── Frames detail table ───────────────────────────────────────────────────
    if (!hiddenProposalTables.has('frames') && frameGroups.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 35, 45);
      doc.text('Frames', margin, y);
      y += 8;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Description', 'Total Qty']],
        body: [
          ...frameGroups.map(g => [g.description, g.totalQty]),
          ['Total', frameGroups.reduce((s, g) => s + g.totalQty, 0)],
        ],
        styles:       { fontSize: 8, cellPadding: 5 },
        headStyles:   { fillColor: [45, 60, 100], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'right' } },
        didParseCell: (data) => {
          if (data.row.index === frameGroups.length) {
            Object.assign(data.cell.styles, { fontStyle: 'bold', fillColor: [235, 240, 252] });
          }
        },
      });
      y = (d.lastAutoTable?.finalY ?? y) + 20;
    }

    // ── Hardware sets table ───────────────────────────────────────────────────
    if (!hiddenProposalTables.has('hardware') && hwSetList.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 35, 45);
      doc.text('Hardware', margin, y);
      y += 8;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Hardware Set', 'Doors Used In']],
        body: hwSetList.map(s => [s.name, s.doorCount]),
        styles:       { fontSize: 8, cellPadding: 5 },
        headStyles:   { fillColor: [45, 60, 100], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'right' } },
      });
      y = (d.lastAutoTable?.finalY ?? y) + 20;
    }

    // ── Extra expenses ────────────────────────────────────────────────────────
    if (extraExpenses.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 35, 45);
      doc.text('Extra Expenses', margin, y);
      y += 8;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Description', 'Total Price']],
        body: [
          ...extraExpenses.map(e => [e.delivery || '—', fmt.format(parseFloat(e.totalPrice) || 0)]),
          ['Total', fmt.format(extraExpensesTotal)],
        ],
        styles:       { fontSize: 8, cellPadding: 5 },
        headStyles:   { fillColor: [45, 60, 100], textColor: 255 },
        columnStyles: { 1: { halign: 'right' } },
        didParseCell: (data) => {
          if (data.row.index === extraExpenses.length) {
            Object.assign(data.cell.styles, { fontStyle: 'bold', fillColor: [235, 240, 252] });
          }
        },
      });
      y = (d.lastAutoTable?.finalY ?? y) + 20;
    }

    // ── Tax ───────────────────────────────────────────────────────────────────
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 35, 45);
    doc.text('Tax', margin, y);
    y += 8;

    const taxBody: string[][] = [
      ['Pricing Summary Total', fmt.format(proposalGrandTotal)],
      ['Extra Expense Total',   fmt.format(extraExpensesTotal)],
      ['Subtotal',              fmt.format(taxSubtotal)],
      ...taxRows.map(r => [
        r.description || '(Tax)',
        `${fmt.format(taxSubtotal * (Math.max(0, parseFloat(r.taxPct) || 0) / 100))} (${r.taxPct || 0}%)`,
      ]),
      ['Total After Tax', fmt.format(totalAfterTax)],
    ];

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Description', 'Amount']],
      body: taxBody,
      styles:       { fontSize: 8, cellPadding: 5 },
      headStyles:   { fillColor: [45, 60, 100], textColor: 255 },
      columnStyles: {
        0: { halign: 'left' },
        1: { halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === taxBody.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [235, 240, 252];
        }
      },
    });
    y = (d.lastAutoTable?.finalY ?? y) + 20;

    // ── Remarks ───────────────────────────────────────────────────────────────
    if (remarks.trim()) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 35, 45);
      doc.text('Remarks', margin, y);
      y += 12;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 65, 75);
      const splitText = doc.splitTextToSize(remarks, pageW - margin * 2);
      doc.text(splitText, margin, y);
    }

    // ── Page numbers ──────────────────────────────────────────────────────────
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(160, 165, 175);
      doc.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 20, { align: 'right' });
    }

    const safeName = (projectName || 'Proposal').replace(/[^a-z0-9]/gi, '_');
    doc.save(`${safeName}_Proposal.pdf`);
  }, [
    companySettings, projectName,
    proposalDoorBase, proposalFrameBase, proposalHwBase,
    profitPct, proposalDoorTotal, proposalFrameTotal, proposalHwTotal,
    doorAlloc, frameAlloc, hwAlloc,
    proposalGrandTotal, allocateExpenses,
    extraExpenses, extraExpensesTotal,
    taxRows, totalTaxAmount, taxSubtotal, totalAfterTax,
    remarks,
    hiddenProposalTables, doorGroups, frameGroups, hwSetList,
  ]);

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
            <>
              <button
                onClick={handleDownloadExcel}
                title="Download Pricing Report Excel"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-[var(--primary-action)]/10 hover:bg-[var(--primary-action)]/20 text-[var(--primary-text)] transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Excel
              </button>
              <button
                onClick={handleDownloadPdf}
                title="Download Pricing Report PDF"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-[var(--primary-action)]/10 hover:bg-[var(--primary-action)]/20 text-[var(--primary-text)] transition-colors"
              >
                <FileDown className="w-3.5 h-3.5" />
                PDF
              </button>
            </>
          )}
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
      {activeTab === 'proposal' && (() => {
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
                      { label: 'Doors',    key: 'door'     as const, count: doorGroups.length,     base: proposalDoorBase,  newTotal: proposalDoorTotal,  alloc: doorAlloc,  breakdown: proposalBreakdown.doors    },
                      { label: 'Frames',   key: 'frame'    as const, count: frameGroups.length,    base: proposalFrameBase, newTotal: proposalFrameTotal, alloc: frameAlloc, breakdown: proposalBreakdown.frames   },
                      { label: 'Hardware', key: 'hardware' as const, count: hardwareGroups.length, base: proposalHwBase,    newTotal: proposalHwTotal,    alloc: hwAlloc,    breakdown: proposalBreakdown.hardware },
                    ]
                  ).flatMap(({ label, key, count, base, newTotal, alloc, breakdown }, i) => [
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
      })()}

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
