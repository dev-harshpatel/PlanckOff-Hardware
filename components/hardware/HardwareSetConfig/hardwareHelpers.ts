import type { Door, HardwareSet, HardwareItem } from '../../../types';

/** Grouping mode key for the hardware-set report. */
export type GroupByOption = 'set' | 'type' | 'manufacturer' | 'flat' | 'buildingTag' | 'buildingLocation' | 'doorMaterial';

/** A single hardware item enriched with usage statistics across all doors. */
export interface HardwareItemUsage {
  item: HardwareItem;
  doorTags: string[];
  totalQuantity: number;
  sets: string[];
  /** Sum of basic_information.quantity across all doors that use this item */
  doorQuantitySum: number;
  /** Unique door materials from all doors that use this item */
  doorMaterials: string[];
}

/** A group of related hardware items used together — by set, type, manufacturer, etc. */
export interface HardwareGroup {
  label: string;
  items: HardwareItemUsage[];
  /** Door tags for the whole group — set only in "By Hardware Set" mode */
  groupDoorTags?: string[];
  /** Sum of basic_information.QUANTITY across all doors in the group */
  groupTotalQuantity?: number;
}

/**
 * Extract the hardware set name from a door.
 * Priority: assignedHardwareSet.name (the merged/matched PDF set name) first,
 * then raw schedule values as fallback.
 * This is critical because the Excel schedule may say "AD07b" while the PDF set
 * is named "AD07c" — the merge resolved the correct name into assignedHardwareSet.
 */
export function getDoorHwSetName(door: Door): string | null {
  return (
    door.assignedHardwareSet?.name?.trim() ||
    (door.sections as unknown as Record<string, Record<string, string | undefined>> | undefined)
      ?.hardware?.['HARDWARE SET']?.trim() ||
    door.providedHardwareSet?.trim() ||
    null
  );
}

/**
 * Formats door info for the group header.
 *
 * 'all'   → comma-separated door tags: "1109, 1111, 2727A, 2727C"
 * 'count' → sum of basic_information.QUANTITY: "Qty: 4"
 *            (a door with QUANTITY=2 counts as 2, not 1)
 * both    → "1109, 1111, 2727A, 2727C (Qty: 4)"
 * neither → '' (nothing shown)
 */
export function formatDoorTags(doorTags: string[], display: string[], totalQuantity?: number): string {
  if (doorTags.length === 0) return '';
  const showAll   = display.includes('all');
  const showCount = display.includes('count');
  if (!showAll && !showCount) return '';

  const qtyStr = totalQuantity !== undefined ? `Qty: ${totalQuantity}` : `Qty: ${doorTags.length}`;

  if (showAll && showCount) return `${doorTags.join(', ')} (${qtyStr})`;
  if (showAll)              return doorTags.join(', ');
  return qtyStr; // showCount only
}

export function getItemValue(usage: HardwareItemUsage, colId: string): string {
  switch (colId) {
    case 'hw_set_name':   return usage.sets.length > 0 ? usage.sets.join(', ') : '—';
    case 'name':          return usage.item.name         || '—';
    case 'description':   return (usage.item.processedDescription ?? usage.item.description) || '—';
    case 'manufacturer':  return usage.item.manufacturer || '—';
    case 'finish':        return usage.item.finish       || '—';
    case 'qty_per_set':   return usage.item.quantity > 0 ? String(usage.item.quantity) : '—';
    case 'quantity':      return usage.totalQuantity > 0 ? String(usage.totalQuantity) : '—';
    case 'door_material': return usage.doorMaterials.length > 0 ? usage.doorMaterials.join(', ') : '—';
    default:              return '—';
  }
}

/**
 * Returns the value for the Usage column cell.
 *
 * 'all'   → comma-separated door tags: "101, 102, 201"
 * 'count' → sum of basic_information.quantity: "Qty: 4"
 * both    → "101, 102, 201 (Qty: 4)"
 * neither → '—'
 */
export function getUsageCellValue(usage: HardwareItemUsage, usageDisplay: string[]): string {
  if (usage.doorTags.length === 0) return '—';
  const showAll   = usageDisplay.includes('all');
  const showCount = usageDisplay.includes('count');
  if (!showAll && !showCount) return '—';

  const qty = usage.doorQuantitySum > 0 ? usage.doorQuantitySum : usage.doorTags.length;
  if (showAll && showCount) return `${usage.doorTags.join(', ')} (Qty: ${qty})`;
  if (showAll)              return usage.doorTags.join(', ');
  return `Qty: ${qty}`;
}

/**
 * Build groups for "By Hardware Set" mode.
 * Each set becomes one group; items come directly from set.items with door tags
 * computed only for doors assigned to THAT set (not merged across sets).
 */
export function buildSetGroups(hardwareSets: HardwareSet[], doors: Door[]): HardwareGroup[] {
  return hardwareSets
    .map(set => {
      const setName = set.name.toLowerCase();
      const setDoors = doors.filter(d => getDoorHwSetName(d)?.toLowerCase() === setName);
      const doorTags = setDoors.map(d => d.doorTag);
      // Sum of basic_information.QUANTITY across all doors for this set.
      // door.quantity is already parsed from that field by transformFromFinalJson.
      const groupTotalQuantity = setDoors.reduce((sum, d) => sum + (d.quantity || 1), 0);

      const doorMaterials = [...new Set(
        setDoors.map(d => d.doorMaterial).filter(Boolean),
      )];

      const items: HardwareItemUsage[] = set.items.map(item => ({
        item,
        doorTags,
        // multipliedQuantity from the final JSON = qty × door count for this set
        totalQuantity: item.multipliedQuantity ?? item.quantity,
        sets: [set.name],
        doorQuantitySum: groupTotalQuantity,
        doorMaterials,
      }));
      return { label: set.name, items, groupDoorTags: doorTags, groupTotalQuantity };
    })
    .filter(g => g.items.length > 0);
}

/**
 * Groups hardware items by a door-level field (buildingTag, buildingLocation, doorMaterial).
 * Each unique field value becomes one group; doors with no value fall into "(Unassigned)".
 * Quantity is computed as item.quantity × door.quantity for each door in the group.
 */
export function buildDoorFieldGroups(
  hardwareSets: HardwareSet[],
  doors: Door[],
  field: 'buildingTag' | 'buildingLocation' | 'doorMaterial',
): HardwareGroup[] {
  const setMap = new Map(hardwareSets.map(s => [s.name.toLowerCase(), s]));

  const doorsByValue = new Map<string, Door[]>();
  for (const door of doors) {
    const key = door[field]?.trim() || '(Unassigned)';
    if (!doorsByValue.has(key)) doorsByValue.set(key, []);
    doorsByValue.get(key)!.push(door);
  }

  return Array.from(doorsByValue.entries())
    .map(([label, groupDoors]) => {
      const itemMap = new Map<string, HardwareItemUsage>();

      for (const door of groupDoors) {
        const setName = getDoorHwSetName(door)?.toLowerCase();
        if (!setName) continue;
        const set = setMap.get(setName);
        if (!set) continue;

        for (const item of set.items) {
          const key = `${item.name}|${item.processedDescription ?? item.description ?? ''}|${item.manufacturer || ''}|${item.finish || ''}|${item.quantity || 0}`;
          if (!itemMap.has(key)) {
            itemMap.set(key, { item, doorTags: [], totalQuantity: 0, sets: [], doorQuantitySum: 0, doorMaterials: [] });
          }
          const usage = itemMap.get(key)!;
          if (!usage.doorTags.includes(door.doorTag)) {
            usage.doorTags.push(door.doorTag);
            usage.doorQuantitySum += (door.quantity || 1);
            const mat = door.doorMaterial?.trim();
            if (mat && !usage.doorMaterials.includes(mat)) usage.doorMaterials.push(mat);
          }
          usage.totalQuantity += item.quantity * (door.quantity || 1);
          if (!usage.sets.includes(set.name)) usage.sets.push(set.name);
        }
      }

      return { label, items: Array.from(itemMap.values()) };
    })
    .filter(g => g.items.length > 0);
}

function getGroupKeyPart(
  option: GroupByOption,
  door: Door,
  item: HardwareItem,
  setName: string,
): string {
  switch (option) {
    case 'set':              return setName || '(No Set)';
    case 'type':             return item.name?.split(' ')[0]?.toUpperCase() || '(Other)';
    case 'manufacturer':     return item.manufacturer?.trim() || '(No Manufacturer)';
    case 'buildingTag':      return door.buildingTag?.trim() || '(Unassigned)';
    case 'buildingLocation': return door.buildingLocation?.trim() || '(Unassigned)';
    case 'doorMaterial':     return door.doorMaterial?.trim() || '(Unassigned)';
    case 'flat':             return 'All Items';
  }
}

function buildCompoundGroups(
  hardwareSets: HardwareSet[],
  doors: Door[],
  groupBy: GroupByOption[],
): HardwareGroup[] {
  const setMap = new Map(hardwareSets.map(s => [s.name.toLowerCase(), s]));
  const groupMap = new Map<string, Map<string, HardwareItemUsage>>();

  for (const door of doors) {
    const setName = getDoorHwSetName(door);
    if (!setName) continue;
    const set = setMap.get(setName.toLowerCase());
    if (!set) continue;

    for (const item of set.items) {
      const compoundKey = groupBy.map(opt => getGroupKeyPart(opt, door, item, set.name)).join(' · ');
      const itemKey = `${item.name}|${item.processedDescription ?? item.description ?? ''}|${item.manufacturer || ''}|${item.finish || ''}|${item.quantity || 0}`;

      if (!groupMap.has(compoundKey)) groupMap.set(compoundKey, new Map());
      const itemMap = groupMap.get(compoundKey)!;

      if (!itemMap.has(itemKey)) {
        itemMap.set(itemKey, { item, doorTags: [], totalQuantity: 0, sets: [], doorQuantitySum: 0, doorMaterials: [] });
      }
      const usage = itemMap.get(itemKey)!;
      if (!usage.doorTags.includes(door.doorTag)) {
        usage.doorTags.push(door.doorTag);
        usage.doorQuantitySum += (door.quantity || 1);
        const mat = door.doorMaterial?.trim();
        if (mat && !usage.doorMaterials.includes(mat)) usage.doorMaterials.push(mat);
      }
      usage.totalQuantity += item.quantity * (door.quantity || 1);
      if (!usage.sets.includes(set.name)) usage.sets.push(set.name);
    }
  }

  return Array.from(groupMap.entries())
    .map(([label, itemMap]) => ({ label, items: Array.from(itemMap.values()) }))
    .filter(g => g.items.length > 0);
}

export function buildHardwareGroups(
  hardwareSets: HardwareSet[],
  doors: Door[],
  usageStats: HardwareItemUsage[],
  groupBy: GroupByOption[],
): HardwareGroup[] {
  if (groupBy.length === 0 || groupBy.includes('flat')) {
    return [{ label: 'All Items', items: usageStats }];
  }

  if (groupBy.length === 1) {
    const single = groupBy[0];
    if (single === 'set')              return buildSetGroups(hardwareSets, doors);
    if (single === 'buildingTag')      return buildDoorFieldGroups(hardwareSets, doors, 'buildingTag');
    if (single === 'buildingLocation') return buildDoorFieldGroups(hardwareSets, doors, 'buildingLocation');
    if (single === 'doorMaterial')     return buildDoorFieldGroups(hardwareSets, doors, 'doorMaterial');

    if (single === 'manufacturer') {
      const map = new Map<string, HardwareItemUsage[]>();
      for (const u of usageStats) {
        const key = u.item.manufacturer?.trim() || '(No Manufacturer)';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(u);
      }
      return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
    }

    // single === 'type' — derive from first word of item name
    const map = new Map<string, HardwareItemUsage[]>();
    for (const u of usageStats) {
      const key = u.item.name?.split(' ')[0]?.toUpperCase() || '(Other)';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(u);
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
  }

  // Multiple options — compound door-level grouping
  return buildCompoundGroups(hardwareSets, doors, groupBy);
}
