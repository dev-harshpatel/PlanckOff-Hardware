import type { Door, HardwareSet, HardwareItem } from '@/types';

// ─── Field definitions (order controls Description display) ──────────────────

export const DOOR_FIELD_DEFS = [
  { key: 'doorMaterial',      label: 'Door Material'      },
  { key: 'width',             label: 'Width'              },
  { key: 'height',            label: 'Height'             },
  { key: 'thickness',         label: 'Thickness'          },
  { key: 'fireRating',        label: 'Fire Rating'        },
  { key: 'leafCount',         label: 'Leaf Count'         },
  { key: 'handOfOpenings',    label: 'Hand'               },
  { key: 'doorCore',          label: 'Door Core'          },
  { key: 'doorFace',          label: 'Door Face'          },
  { key: 'doorGauge',         label: 'Door Gauge'         },
  { key: 'doorFinish',        label: 'Door Finish'        },
  { key: 'doorElevationType', label: 'Door Elevation'     },
] as const;

export const FRAME_FIELD_DEFS = [
  { key: 'frameMaterial',      label: 'Frame Material'     },
  { key: 'throatThickness',    label: 'Throat Thickness'   },
  { key: 'frameGauge',         label: 'Frame Gauge'        },
  { key: 'frameAssembly',      label: 'Frame Assembly'     },
  { key: 'frameAnchor',        label: 'Frame Anchor'       },
  { key: 'baseAnchor',         label: 'Base Anchor'        },
  { key: 'frameElevationType', label: 'Frame Elevation'    },
  { key: 'frameFinish',        label: 'Frame Finish'       },
  { key: 'prehung',            label: 'Prehung'            },
  { key: 'casing',             label: 'Casing'             },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DoorPricingGroup {
  key: string;
  description: string;
  fields: Record<string, string>;
  doors: Door[];
  totalQty: number;
  unitPrice: number;
  totalPrice: number;
  materials: string[];
  floors: string[];
  buildings: string[];
  isVariant?: boolean;
  variantKey?: string;
}

export type VariantOverrideMap = Map<string, { variantKey: string; variantLabel: string }>;
// doorId → { variantKey, variantLabel }

export interface HardwarePricingGroup {
  key: string;
  item: HardwareItem;
  sets: Array<{ setName: string; setId: string; multipliedQty: number }>;
  doorMaterials: string[];
  totalQty: number;
  unitPrice: number;
  totalPrice: number;
}

// ─── Field extraction ─────────────────────────────────────────────────────────

export function extractDoorFields(door: Door): Record<string, string> {
  // transformDoors already resolves all top-level fields correctly.
  // Only read raw sections for dimensions (we want "3'-0\"" not the numeric 36 for grouping/display).
  const raw = door.sections as unknown as Record<string, Record<string, string | undefined>> | undefined;
  const bi = raw?.basic_information;
  const d  = raw?.door;
  return {
    doorMaterial:      (door.doorMaterial        ?? '').trim(),
    // Prefer basic_information (new format), fall back to door section (old format)
    width:             (bi?.['WIDTH']            ?? d?.['WIDTH']     ?? '').trim(),
    height:            (bi?.['HEIGHT']           ?? d?.['HEIGHT']    ?? '').trim(),
    thickness:         (bi?.['THICKNESS']        ?? d?.['THICKNESS'] ?? '').trim(),
    fireRating:        (door.fireRating          ?? '').trim(),
    leafCount:         (door.leafCountDisplay    ?? '').trim(),
    handOfOpenings:    (door.handing             ?? '').trim(),
    doorCore:          (door.doorCore            ?? '').trim(),
    doorFace:          (door.doorFace            ?? '').trim(),
    doorGauge:         (door.doorGauge           ?? '').trim(),
    doorFinish:        (door.doorFinish          ?? '').trim(),
    doorElevationType: (door.elevationTypeId     ?? '').trim(),
  };
}

export function extractFrameFields(door: Door): Record<string, string> {
  // transformDoors already resolves all top-level frame fields correctly.
  return {
    frameMaterial:      String(door.frameMaterial  ?? '').trim(),
    throatThickness:    (door.throatThickness      ?? '').trim(),
    frameGauge:         (door.frameGauge           ?? '').trim(),
    frameAssembly:      (door.frameAssembly        ?? '').trim(),
    frameAnchor:        (door.frameAnchor          ?? '').trim(),
    baseAnchor:         (door.baseAnchor           ?? '').trim(),
    frameElevationType: (door.frameElevationType   ?? '').trim(),
    frameFinish:        (door.frameFinish          ?? '').trim(),
    prehung:            (door.prehung              ?? '').trim(),
    casing:             (door.casing               ?? '').trim(),
    // Private filter keys (stripped from group key/description by cleanFields)
    _material:          String(door.frameMaterial  ?? '').trim(),
    _floor:             (door.buildingLocation ?? door.location ?? '').trim(),
    _building:          (door.buildingTag ?? '').trim(),
  };
}

// ─── Key & description builders ───────────────────────────────────────────────

function cleanFields(raw: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(raw).filter(([k, v]) => !k.startsWith('_') && v !== '' && v !== '-'),
  );
}

export function buildGroupKey(fields: Record<string, string>): string {
  const clean = cleanFields(fields);
  const sorted = Object.keys(clean).sort().reduce<Record<string, string>>(
    (acc, k) => { acc[k] = clean[k]; return acc; },
    {},
  );
  return JSON.stringify(sorted);
}

export function buildDescription(
  fields: Record<string, string>,
  defs: ReadonlyArray<{ key: string }>,
): string {
  const clean = cleanFields(fields);

  // Combine W × H × T as a single dimension token
  const dims = ['width', 'height', 'thickness'].map(k => clean[k]).filter(Boolean);
  const dimStr = dims.length ? dims.join(' × ') : '';

  const parts: string[] = [];
  if (dimStr) parts.push(dimStr);

  const skip = new Set(['width', 'height', 'thickness']);
  defs.forEach(({ key }) => {
    if (!skip.has(key) && clean[key]) parts.push(clean[key]);
  });

  return parts.join(' · ') || 'No specification';
}

// ─── Door qty helper ──────────────────────────────────────────────────────────

function getDoorQty(door: Door): number {
  // transformDoors parses QUANTITY from basic_information or door section already
  return door.quantity != null && door.quantity > 0 ? door.quantity : 1;
}

// ─── Variant group builder ────────────────────────────────────────────────────

function buildVariantGroups(variantDoors: Door[], overrides: VariantOverrideMap): DoorPricingGroup[] {
  const map = new Map<string, DoorPricingGroup>();
  for (const door of variantDoors) {
    const ov = overrides.get(door.id);
    if (!ov) continue;
    if (!map.has(ov.variantKey)) {
      map.set(ov.variantKey, {
        key: ov.variantKey,
        description: ov.variantLabel,
        fields: {},
        doors: [],
        totalQty: 0,
        unitPrice: 0,
        totalPrice: 0,
        materials: [],
        floors: [],
        buildings: [],
        isVariant: true,
        variantKey: ov.variantKey,
      });
    }
    const g = map.get(ov.variantKey)!;
    g.doors.push(door);
    g.totalQty += getDoorQty(door);
    const mat = (door.doorMaterial ?? '').trim();
    if (mat && !g.materials.includes(mat)) g.materials.push(mat);
    const floor = (door.buildingLocation ?? door.location ?? '').trim();
    if (floor && !g.floors.includes(floor)) g.floors.push(floor);
    const bldg = (door.buildingTag ?? '').trim();
    if (bldg && !g.buildings.includes(bldg)) g.buildings.push(bldg);
  }
  return Array.from(map.values());
}

// ─── Grouping functions ───────────────────────────────────────────────────────

function groupByFields(
  doors: Door[],
  extract: (d: Door) => Record<string, string>,
  defs: ReadonlyArray<{ key: string }>,
  getMaterial: (d: Door) => string,
): DoorPricingGroup[] {
  const map = new Map<string, DoorPricingGroup>();

  for (const door of doors) {
    const fields  = extract(door);
    const key     = buildGroupKey(fields);

    if (!map.has(key)) {
      map.set(key, {
        key,
        description: buildDescription(fields, defs),
        fields: cleanFields(fields),
        doors: [],
        totalQty: 0,
        unitPrice: 0,
        totalPrice: 0,
        materials:  [],
        floors:     [],
        buildings:  [],
      });
    }

    const group = map.get(key)!;
    group.doors.push(door);
    group.totalQty += getDoorQty(door);

    const mat  = getMaterial(door).trim();
    if (mat && !group.materials.includes(mat))   group.materials.push(mat);

    const floor = (door.buildingLocation ?? door.location ?? '').trim();
    if (floor && !group.floors.includes(floor))   group.floors.push(floor);

    const bldg  = (door.buildingTag ?? '').trim();
    if (bldg && !group.buildings.includes(bldg)) group.buildings.push(bldg);
  }

  return Array.from(map.values());
}

export function groupDoors(doors: Door[], variantOverrides: VariantOverrideMap = new Map()): DoorPricingGroup[] {
  const included = doors.filter(d => d.doorIncludeExclude?.trim().toUpperCase() !== 'EXCLUDE');
  const normal = included.filter(d => !variantOverrides.has(d.id));
  const variant = included.filter(d => variantOverrides.has(d.id));
  return [
    ...groupByFields(normal, extractDoorFields, DOOR_FIELD_DEFS, d => d.doorMaterial ?? ''),
    ...buildVariantGroups(variant, variantOverrides),
  ];
}

export function groupFrames(doors: Door[], variantOverrides: VariantOverrideMap = new Map()): DoorPricingGroup[] {
  const included = doors.filter(d => d.frameIncludeExclude?.trim().toUpperCase() !== 'EXCLUDE');
  const normal = included.filter(d => !variantOverrides.has(d.id));
  const variant = included.filter(d => variantOverrides.has(d.id));
  return [
    ...groupByFields(
      normal,
      d => {
        const raw = extractFrameFields(d);
        return Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith('_')));
      },
      FRAME_FIELD_DEFS,
      d => String(d.frameMaterial ?? ''),
    ),
    ...buildVariantGroups(variant, variantOverrides),
  ];
}

// ─── Hardware grouping ────────────────────────────────────────────────────────

function getDoorHwSetName(door: Door): string | null {
  return (
    door.assignedHardwareSet?.name?.trim() ||
    (door.sections as unknown as Record<string, Record<string, string | undefined>> | undefined)
      ?.hardware?.['HARDWARE SET']?.trim() ||
    door.providedHardwareSet?.trim() ||
    null
  );
}

export function groupHardwareItems(
  hardwareSets: HardwareSet[],
  doors: Door[],
): HardwarePricingGroup[] {
  const map = new Map<string, HardwarePricingGroup>();

  const includedDoors = doors.filter(
    d => d.hardwareIncludeExclude?.trim().toUpperCase() !== 'EXCLUDE',
  );

  for (const set of hardwareSets) {
    const setName   = set.name.toLowerCase();
    const setDoors  = includedDoors.filter(d => getDoorHwSetName(d)?.toLowerCase() === setName);

    for (const item of set.items) {
      const key = `${item.name}|${item.description ?? ''}|${item.manufacturer ?? ''}|${item.finish ?? ''}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          item,
          sets: [],
          doorMaterials: [],
          totalQty: 0,
          unitPrice: 0,
          totalPrice: 0,
        });
      }

      const group = map.get(key)!;
      const multipliedQty = item.multipliedQuantity ?? (item.quantity * Math.max(setDoors.length, 1));

      group.sets.push({ setName: set.name, setId: set.id, multipliedQty });
      group.totalQty += multipliedQty;

      for (const door of setDoors) {
        const mat = door.doorMaterial?.trim();
        if (mat && !group.doorMaterials.includes(mat)) group.doorMaterials.push(mat);
      }
    }
  }

  return Array.from(map.values());
}

// ─── Price application ────────────────────────────────────────────────────────

export type PriceMap = Map<string, number>; // `${category}:${group_key}` → unitPrice

export function applyPrices<T extends { key: string; unitPrice: number; totalPrice: number; totalQty: number }>(
  groups: T[],
  prices: PriceMap,
  category: string,
): T[] {
  return groups.map(g => {
    const unitPrice  = prices.get(`${category}:${g.key}`) ?? 0;
    return { ...g, unitPrice, totalPrice: unitPrice * g.totalQty };
  });
}

// ─── Filter helpers ───────────────────────────────────────────────────────────

export function filterDoorGroups(
  groups: DoorPricingGroup[],
  filters: { material: string[]; floor: string[]; building: string[] },
): DoorPricingGroup[] {
  return groups.filter(g =>
    (filters.material.length === 0 || filters.material.some(m => g.materials.includes(m))) &&
    (filters.floor.length    === 0 || filters.floor.some(f => g.floors.includes(f)))       &&
    (filters.building.length === 0 || filters.building.some(b => g.buildings.includes(b))),
  );
}

export function filterHardwareGroups(
  groups: HardwarePricingGroup[],
  filters: { material: string[] },
): HardwarePricingGroup[] {
  return groups.filter(g =>
    filters.material.length === 0 || filters.material.some(m => g.doorMaterials.includes(m)),
  );
}

export function uniqueValues(groups: DoorPricingGroup[], key: 'materials' | 'floors' | 'buildings'): string[] {
  const seen = new Set<string>();
  groups.forEach(g => g[key].forEach(v => seen.add(v)));
  return Array.from(seen).sort();
}
