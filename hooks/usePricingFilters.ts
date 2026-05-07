import { useState, useMemo, useEffect } from 'react';
import type { Door, HardwareSet } from '@/types';
import {
  groupDoors, groupFrames, groupHardwareItems,
  applyPrices, filterDoorGroups, filterHardwareGroups, uniqueValues, uniquePreps,
  type DoorPricingGroup, type HardwarePricingGroup, type PriceMap,
  type VariantOverrideMap,
} from '@/utils/pricingGrouping';
import type { PricingVariant } from '@/lib/db/pricing';

export type PricingTab = 'door' | 'frame' | 'hardware' | 'proposal';

export interface FlatNode {
  label: string;
  dimType: string;
  count: number;
  base: number;
  depth: number;
}

interface Filters { material: string[]; floor: string[]; building: string[]; prep: string[]; }

// ── Hierarchy breakdown helpers ───────────────────────────────────────────────
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

function flattenNodes(nodes: HierarchyNode[]): FlatNode[] {
  return nodes.flatMap(n => [{ label: n.label, dimType: n.dimType, count: n.count, base: n.base, depth: n.depth }, ...flattenNodes(n.children)]);
}

function calcTotal(groups: Array<{ totalPrice: number }>): number {
  return groups.reduce((s, g) => s + g.totalPrice, 0);
}

interface UsePricingFiltersParams {
  projectId: string;
  doors: Door[];
  hardwareSets: HardwareSet[];
  prices: PriceMap;
  activeTab: PricingTab;
}

export function usePricingFilters({ projectId, doors, hardwareSets, prices, activeTab }: UsePricingFiltersParams) {
  const [filters, setFilters]                 = useState<Filters>({ material: [], floor: [], building: [], prep: [] });
  const [proposalFilters, setProposalFilters] = useState<Filters>({ material: [], floor: [], building: [], prep: [] });
  const [variants, setVariants]               = useState<PricingVariant[]>([]);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/pricing-variants`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(json => { if (json?.data) setVariants(json.data as PricingVariant[]); })
      .catch(console.error);
  }, [projectId]);

  const variantOverrides = useMemo<VariantOverrideMap>(() => {
    const map: VariantOverrideMap = new Map();
    for (const v of variants) {
      for (const doorId of v.doorIds) {
        map.set(doorId, { variantKey: v.key, variantLabel: v.label });
      }
    }
    return map;
  }, [variants]);

  const rawDoorGroups     = useMemo(() => groupDoors(doors, variantOverrides),                   [doors, variantOverrides]);
  const rawFrameGroups    = useMemo(() => groupFrames(doors, variantOverrides),                  [doors, variantOverrides]);
  const rawHardwareGroups = useMemo(() => groupHardwareItems(hardwareSets, doors), [hardwareSets, doors]);

  const doorGroups     = useMemo(() => applyPrices(rawDoorGroups,     prices, 'door'),     [rawDoorGroups,     prices]);
  const frameGroups    = useMemo(() => applyPrices(rawFrameGroups,    prices, 'frame'),    [rawFrameGroups,    prices]);
  const hardwareGroups = useMemo(() => applyPrices(rawHardwareGroups, prices, 'hardware'), [rawHardwareGroups, prices]);

  const doorMaterials   = useMemo(() => uniqueValues(doorGroups,  'materials'),  [doorGroups]);
  const doorFloors      = useMemo(() => uniqueValues(doorGroups,  'floors'),     [doorGroups]);
  const doorBuildings   = useMemo(() => uniqueValues(doorGroups,  'buildings'),  [doorGroups]);
  const frameMaterials  = useMemo(() => uniqueValues(frameGroups, 'materials'),  [frameGroups]);
  const frameFloors     = useMemo(() => uniqueValues(frameGroups, 'floors'),     [frameGroups]);
  const frameBuildings  = useMemo(() => uniqueValues(frameGroups, 'buildings'),  [frameGroups]);
  const hwMaterials  = useMemo(() => {
    const seen = new Set<string>();
    hardwareGroups.forEach(g => g.doorMaterials.forEach(m => seen.add(m)));
    return Array.from(seen).sort();
  }, [hardwareGroups]);
  const hwFloors     = useMemo(() => {
    const seen = new Set<string>();
    hardwareGroups.forEach(g => g.doorFloors.forEach(f => seen.add(f)));
    return Array.from(seen).sort();
  }, [hardwareGroups]);
  const hwBuildings  = useMemo(() => {
    const seen = new Set<string>();
    hardwareGroups.forEach(g => g.doorBuildings.forEach(b => seen.add(b)));
    return Array.from(seen).sort();
  }, [hardwareGroups]);

  const proposalMaterials = useMemo(() => Array.from(new Set([...doorMaterials, ...frameMaterials, ...hwMaterials])).sort(), [doorMaterials, frameMaterials, hwMaterials]);
  const proposalFloors    = useMemo(() => Array.from(new Set([...doorFloors, ...frameFloors])).sort(),       [doorFloors, frameFloors]);
  const proposalBuildings = useMemo(() => Array.from(new Set([...doorBuildings, ...frameBuildings])).sort(), [doorBuildings, frameBuildings]);

  const visibleDoors    = useMemo(() => filterDoorGroups(doorGroups,  filters), [doorGroups,  filters]);
  const visibleFrames   = useMemo(() => filterDoorGroups(frameGroups, filters), [frameGroups, filters]);
  const visibleHardware = useMemo(
    () => filterHardwareGroups(hardwareGroups, { material: filters.material, building: filters.building, floor: filters.floor }),
    [hardwareGroups, filters.material, filters.building, filters.floor],
  );

  const doorTotal  = useMemo(() => calcTotal(visibleDoors),    [visibleDoors]);
  const frameTotal = useMemo(() => calcTotal(visibleFrames),   [visibleFrames]);
  const hwTotal    = useMemo(() => calcTotal(visibleHardware), [visibleHardware]);
  const grandTotal = doorTotal + frameTotal + hwTotal;

  const proposalDoorBase  = useMemo(() => calcTotal(doorGroups),     [doorGroups]);
  const proposalFrameBase = useMemo(() => calcTotal(frameGroups),    [frameGroups]);
  const proposalHwBase    = useMemo(() => calcTotal(hardwareGroups), [hardwareGroups]);

  const proposalBreakdown = useMemo(() => ({
    doors:    flattenNodes(buildDoorHierarchy(doorGroups,     proposalFilters, d => d.doorMaterial          ?? '')),
    frames:   flattenNodes(buildDoorHierarchy(frameGroups,    proposalFilters, d => String(d.frameMaterial ?? ''))),
    hardware: flattenNodes(buildHwHierarchy(hardwareGroups,  proposalFilters, doors)),
  }), [doorGroups, frameGroups, hardwareGroups, proposalFilters, doors]);

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

  const totalDoorCount  = useMemo(() => visibleDoors.reduce((s, g) => s + g.doors.length, 0),    [visibleDoors]);
  const totalFrameCount = useMemo(() => visibleFrames.reduce((s, g) => s + g.doors.length, 0),   [visibleFrames]);
  const totalHwCount    = useMemo(() => visibleHardware.reduce((s, g) => s + g.totalQty, 0),     [visibleHardware]);

  const currentMaterials = activeTab === 'door' ? doorMaterials : activeTab === 'frame' ? frameMaterials : hwMaterials;
  const currentFloors    = activeTab === 'door' ? doorFloors    : activeTab === 'frame' ? frameFloors    : hwFloors;
  const currentBuildings = activeTab === 'door' ? doorBuildings : activeTab === 'frame' ? frameBuildings : hwBuildings;

  const setFilter         = (k: keyof Filters, v: string[]) => setFilters(prev => ({ ...prev, [k]: v }));
  const setProposalFilter = (k: keyof Filters, v: string[]) => setProposalFilters(prev => ({ ...prev, [k]: v }));

  const handleCreateVariant = async (doorIds: string[], label: string) => {
    const variantKey = `vprice-${Date.now()}`;
    const newVariant: PricingVariant = {
      key: variantKey,
      label,
      category: activeTab as 'door' | 'frame',
      doorIds,
    };
    setVariants(prev => [...prev, newVariant]);
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
  };

  const handleDeleteVariant = async (variantKey: string) => {
    setVariants(prev => prev.filter(v => v.key !== variantKey));
    try {
      await fetch(`/api/projects/${projectId}/pricing-variants?variantKey=${variantKey}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch (err) {
      console.error('[Pricing] Variant delete failed:', err);
    }
  };

  return {
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
    hwFloors,
    hwBuildings,
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
  };
}
