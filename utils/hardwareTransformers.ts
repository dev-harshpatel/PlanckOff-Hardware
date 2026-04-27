/**
 * Transforms data from the new DB tables (hardware_pdf_extractions, door_schedule_imports)
 * into the legacy UI types (HardwareSet[], Door[]) that the existing components consume.
 */

import type { HardwareSet, HardwareItem, Door } from '../types';
import type { ExtractedHardwareSet, DoorScheduleRow, MergedHardwareSet } from '@/lib/db/hardware';

// ---------------------------------------------------------------------------
// Dimension parsing
// Handles real-world formats from door schedules:
//   "3'-0\""  → 36 (inches)
//   "7'-0\""  → 84
//   "2'-8\""  → 32
//   "2*3'-0\"" → 36 (paired door — take single leaf)
//   "1 3/4\"" → 1.75 (thickness)
//   "915"     → 915mm — if no feet-inches pattern, treat as mm → convert
// ---------------------------------------------------------------------------

function parseFeetInches(val: string): number | null {
  // Strip paired prefix like "2*"
  const clean = val.replace(/^\d+\s*\*\s*/, '').trim();
  const match = clean.match(/^(\d+)['′]-(\d+(?:\.\d+)?)["″]?/);
  if (match) return parseInt(match[1], 10) * 12 + parseFloat(match[2]);
  return null;
}

function parseMm(val: string): number | null {
  // "2*915" → strip prefix
  const clean = val.replace(/^\d+\s*\*\s*/, '').trim();
  const n = parseFloat(clean);
  if (!isNaN(n) && n > 10) return Math.round(n / 25.4); // mm → inches
  return null;
}

function parseQuantityValue(val: string | number | undefined): number | undefined {
  if (typeof val === 'number') return isNaN(val) ? undefined : val;
  if (val === undefined) return undefined;

  const numeric = parseFloat(String(val).trim());
  return isNaN(numeric) ? undefined : numeric;
}

function parseFraction(val: string): number | null {
  // "1 3/4" or "1 3/4\""
  const match = val.replace(/["″]/, '').trim().match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (match) return parseInt(match[1], 10) + parseInt(match[2], 10) / parseInt(match[3], 10);
  const simple = parseFloat(val);
  if (!isNaN(simple)) return simple;
  return null;
}

function parseDimension(val: string | undefined): number {
  if (!val) return 0;
  const fi = parseFeetInches(val);
  if (fi !== null) return fi;
  const mm = parseMm(val);
  if (mm !== null) return mm;
  const fr = parseFraction(val);
  if (fr !== null) return fr < 10 ? fr * 12 : fr; // bare number < 10 assumed feet
  return 0;
}

function parseThickness(val: string | undefined): number {
  if (!val) return 0;
  return parseFraction(val) ?? 0;
}

function parseLeafCountValue(val: string | number | undefined): number | undefined {
  if (val === undefined || val === null) return undefined;

  const raw = String(val).trim();
  if (!raw) return undefined;

  const numeric = parseInt(raw, 10);
  if (!isNaN(numeric)) return numeric;

  const normalized = raw.toLowerCase();
  if (['single', 'singles', 'single leaf', '1 leaf'].includes(normalized)) return 1;
  if (['double', 'pair', 'double leaf', '2 leaf', '2 leaves'].includes(normalized)) return 2;

  return undefined;
}

function getLeafCountDisplayValue(val: string | number | undefined): string | undefined {
  if (val === undefined || val === null) return undefined;
  const raw = String(val).trim();
  return raw || undefined;
}

// ---------------------------------------------------------------------------
// ExtractedHardwareSet → HardwareSet (UI type)
// ---------------------------------------------------------------------------

function toHardwareItem(raw: ExtractedHardwareSet['hardwareItems'][number], setName: string, idx: number): HardwareItem {
  return {
    id: `hs-${setName}-${idx}`,
    name: raw.item,
    quantity: raw.qty,
    multipliedQuantity: raw.multipliedQuantity,
    manufacturer: raw.manufacturer,
    description: raw.description,
    finish: raw.finish,
  };
}

export function transformHardwareSets(sets: ExtractedHardwareSet[]): HardwareSet[] {
  const seenIds = new Map<string, number>();
  return sets.map((set) => {
    const base = `hs-pdf-${set.setName.toLowerCase().replace(/\s+/g, '-')}`;
    const count = seenIds.get(base) ?? 0;
    seenIds.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count}`;
    return {
      id,
      name: set.setName,
      description: set.notes ?? '',
      division: 'Division 08',
      items: set.hardwareItems.map((item, idx) => toHardwareItem(item, set.setName, idx)),
    };
  });
}

// ---------------------------------------------------------------------------
// DoorScheduleRow → Door (UI type)
// ---------------------------------------------------------------------------

export function transformDoors(rows: DoorScheduleRow[], hardwareSets: HardwareSet[]): Door[] {
  const setsByName = new Map(hardwareSets.map((s) => [s.name.toLowerCase(), s]));

  return rows.map((row, idx): Door => {
    const providedSet = row.hwSet?.trim() ?? '';
    const assignedSet = providedSet ? (setsByName.get(providedSet.toLowerCase()) ?? null) : null;

    // basic_information section (new format) → door section (old format) → flat field
    // This three-way fallback ensures backward compatibility with existing DB records.
    const bi = row.sections?.basic_information;
    const d  = row.sections?.door;
    const fr = row.sections?.frame;
    const hw = row.sections?.hardware;

    const rawWidth     = bi?.['WIDTH'] ?? bi?.['DOOR WIDTH'] ?? d?.['WIDTH'] ?? d?.['DOOR WIDTH'] ?? row.doorWidth;
    const rawHeight    = bi?.['HEIGHT'] ?? bi?.['DOOR HEIGHT'] ?? d?.['HEIGHT'] ?? d?.['DOOR HEIGHT'] ?? row.doorHeight;
    const rawThickness = bi?.['THICKNESS'] ?? bi?.['DOOR THICKNESS'] ?? d?.['THICKNESS'] ?? d?.['DOOR THICKNESS'] ?? row.thickness;
    const rawLeafCount = bi?.['LEAF COUNT'] ?? d?.['LEAF COUNT'] ?? row.leafCount;
    const rawQuantity  = bi?.['QUANTITY'] ?? d?.['QUANTITY'] ?? row.quantity;

    return {
      id: `door-import-${idx}-${row.doorTag}`,
      doorTag: String(row.doorTag),
      status: assignedSet ? 'complete' : 'pending',

      width: parseDimension(rawWidth),
      height: parseDimension(rawHeight),
      thickness: parseThickness(rawThickness),

      // Basic-information fields (moved from door section in new format)
      fireRating:       bi?.['FIRE RATING']       ?? d?.['FIRE RATING']       ?? row.fireRating,
      interiorExterior: bi?.['INTERIOR/EXTERIOR']  ?? d?.['INTERIOR/EXTERIOR'] ?? row.interiorExterior,
      quantity: parseQuantityValue(rawQuantity) ?? 1,
      location:         bi?.['DOOR LOCATION']      ?? d?.['DOOR LOCATION']     ?? row.doorLocation,
      type: (() => {
        const leafCount = parseLeafCountValue(rawLeafCount);
        return leafCount !== undefined ? (leafCount > 1 ? 'Pair' : 'Single') : undefined;
      })(),
      buildingTag:      bi?.['BUILDING TAG']        ?? d?.['BUILDING TAG']       ?? row.buildingTag,
      buildingLocation: bi?.['BUILDING LOCATION']   ?? d?.['BUILDING LOCATION']  ?? row.buildingLocation,
      handing:          (bi?.['HAND OF OPENINGS']   ?? d?.['HAND OF OPENINGS']   ?? row.handOfOpenings) as Door['handing'],
      operation:        bi?.['DOOR OPERATION']      ?? d?.['DOOR OPERATION']     ?? row.doorOperation,
      leafCount: parseLeafCountValue(rawLeafCount),
      leafCountDisplay: getLeafCountDisplayValue(rawLeafCount),
      excludeReason:    bi?.['EXCLUDE REASON']      ?? d?.['EXCLUDE REASON']     ?? row.excludeReason,

      // Door-section fields (material / finish / spec — remain in door section)
      doorMaterial:       d?.['DOOR MATERIAL']      ?? row.doorMaterial ?? '',
      doorFinish:         d?.['DOOR FINISH']        ?? row.doorFinish,
      stcRating:          d?.['STC RATING']         ?? row.stcRating,
      undercut:           d?.['DOOR UNDERCUT']      ?? row.doorUndercut,
      doorCore:           d?.['DOOR CORE']          ?? row.doorCore,
      doorFace:           d?.['DOOR FACE']          ?? row.doorFace,
      doorEdge:           d?.['DOOR EDGE']          ?? row.doorEdge,
      doorGauge:          d?.['DOOR GUAGE']         ?? row.doorGauge,
      doorIncludeExclude: d?.['DOOR INCLUDE/EXCLUDE'] ?? row.doorIncludeExclude,
      elevationTypeId:    d?.['DOOR ELEVATION TYPE']  ?? row.doorElevationType,

      // Frame section
      frameMaterial:    (fr?.['FRAME MATERIAL']      ?? row.frameMaterial) as Door['frameMaterial'],
      frameGauge:        fr?.['FRAME GUAGE']         ?? row.frameGauge ?? row.frameType,
      wallType:          fr?.['WALL TYPE']           ?? row.wallType,
      throatThickness:   fr?.['THROAT THICKNESS']    ?? row.throatThickness,
      frameAnchor:       fr?.['FRAME ANCHOR']        ?? row.frameAnchor,
      baseAnchor:        fr?.['BASE ANCHOR']         ?? row.baseAnchor,
      numberOfAnchors:   fr?.['NO OF ANCHOR']        ?? row.numberOfAnchors,
      frameProfile:      (fr?.['FRAME PROFILE']      ?? row.frameProfile) as Door['frameProfile'],
      frameElevationType: fr?.['FRAME ELEVATION TYPE'] ?? row.frameElevationType,
      frameAssembly:     fr?.['FRAME ASSEMBLY']      ?? row.frameAssembly,
      frameFinish:       fr?.['FRAME FINISH']        ?? row.frameFinish,
      prehung:           fr?.['PREHUNG']             ?? row.prehung,
      frameHead:         fr?.['FRAME HEAD']          ?? row.frameHead,
      casing:            fr?.['CASING']              ?? row.casing,
      frameIncludeExclude: fr?.['FRAME INCLUDE/EXCLUDE'] ?? row.frameIncludeExclude,

      // Hardware section
      hardwareIncludeExclude: hw?.['HARDWARE INCLUDE/EXCLUDE'] ?? row.hardwareIncludeExclude,

      // Carry raw sections through as-is for preservation
      sections: row.sections as unknown as Door['sections'],

      providedHardwareSet: providedSet || undefined,
      assignedHardwareSet: assignedSet ?? null,
      assignmentConfidence: assignedSet ? 'high' : undefined,
      assignmentReason: assignedSet ? 'Matched from door schedule' : undefined,
    };
  });
}

// ---------------------------------------------------------------------------
// MergedHardwareSet[] → { hardwareSets, doors } (final JSON → UI types)
// ---------------------------------------------------------------------------

export function transformFromFinalJson(
  finalJson: MergedHardwareSet[],
): { hardwareSets: HardwareSet[]; doors: Door[] } {
  // Build HardwareSet[] from the merged sets
  const seenIds = new Map<string, number>();
  const hardwareSets: HardwareSet[] = finalJson.map((set) => {
    const base = `hs-pdf-${set.setName.toLowerCase().replace(/\s+/g, '-')}`;
    const count = seenIds.get(base) ?? 0;
    seenIds.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count}`;
    return {
      id,
      name: set.setName,
      description: set.notes ?? '',
      division: 'Division 08',
      items: set.hardwareItems.map((item, idx) => toHardwareItem(item, set.setName, idx)),
    };
  });

  const setsByName = new Map(hardwareSets.map((s) => [s.name.toLowerCase(), s]));

  const doorsWithOrder: Array<{ door: Door; order: number }> = [];
  let doorCounter = 0;

  for (const set of finalJson) {
    const assignedSet = setsByName.get(set.setName.toLowerCase()) ?? null;

    // Deduplicate doors within the same set by doorTag (last-write wins)
    const uniqueDoorsInSet = Array.from(
      new Map(set.doors.map((d) => [String(d.doorTag).toLowerCase(), d])).values(),
    );

    for (const door of uniqueDoorsInSet) {
      const bi = door.sections?.basic_information;
      const ds = door.sections?.door;

      // Resolve dimensions: prefer basic_information, then door section, then flat fields
      const rawWidth =
        bi?.['WIDTH'] ?? bi?.['DOOR WIDTH'] ??
        ds?.['WIDTH'] ?? ds?.['DOOR WIDTH'] ??
        door.doorWidth;
      const rawHeight =
        bi?.['HEIGHT'] ?? bi?.['DOOR HEIGHT'] ??
        ds?.['HEIGHT'] ?? ds?.['DOOR HEIGHT'] ??
        door.doorHeight;
      const rawThickness =
        bi?.['THICKNESS'] ?? bi?.['DOOR THICKNESS'] ??
        ds?.['THICKNESS'] ?? ds?.['DOOR THICKNESS'] ??
        door.thickness;

      const leafCountRaw = bi?.['LEAF COUNT'] ?? ds?.['LEAF COUNT'] ?? door.leafCount;
      const leafCountNum = parseLeafCountValue(leafCountRaw);
      const rawQuantity = bi?.['QUANTITY'] ?? ds?.['QUANTITY'] ?? door.quantity;

      const providedHardwareSet = door.sections?.hardware?.['HARDWARE SET'] ?? door.hwSet ?? door.matchedSetName;

      const builtDoor: Door = {
        id: `door-final-${doorCounter++}-${door.doorTag}`,
        doorTag: String(door.doorTag),
        status: assignedSet ? 'complete' : 'pending',

        width: parseDimension(rawWidth),
        height: parseDimension(rawHeight),
        thickness: parseThickness(rawThickness),

        doorMaterial: ds?.['DOOR MATERIAL'] ?? door.doorMaterial ?? '',
        doorFinish: ds?.['DOOR FINISH'],
        fireRating: bi?.['FIRE RATING'] ?? ds?.['FIRE RATING'] ?? door.fireRating,
        interiorExterior: bi?.['INTERIOR/EXTERIOR'] ?? ds?.['INTERIOR/EXTERIOR'] ?? door.interiorExterior,
        quantity: parseQuantityValue(rawQuantity) ?? 1,
        location: bi?.['DOOR LOCATION'] ?? ds?.['DOOR LOCATION'] ?? door.doorLocation,
        type: leafCountNum !== undefined ? (leafCountNum > 1 ? 'Pair' : 'Single') : undefined,
        leafCount: leafCountNum,
        leafCountDisplay: getLeafCountDisplayValue(leafCountRaw),

        buildingTag: bi?.['BUILDING TAG'] ?? ds?.['BUILDING TAG'],
        buildingLocation: bi?.['BUILDING LOCATION'] ?? ds?.['BUILDING LOCATION'],
        handing: (bi?.['HAND OF OPENINGS'] ?? ds?.['HAND OF OPENINGS']) as Door['handing'],
        operation: bi?.['DOOR OPERATION'] ?? ds?.['DOOR OPERATION'],
        excludeReason: bi?.['EXCLUDE REASON'] ?? ds?.['EXCLUDE REASON'] ?? door.excludeReason,
        stcRating: ds?.['STC RATING'],
        undercut: ds?.['DOOR UNDERCUT'],
        doorCore: ds?.['DOOR CORE'],
        doorFace: ds?.['DOOR FACE'],
        doorEdge: ds?.['DOOR EDGE'],
        doorGauge: ds?.['DOOR GUAGE'],
        doorIncludeExclude: ds?.['DOOR INCLUDE/EXCLUDE'],
        elevationTypeId:
          ds?.['DOOR ELEVATION TYPE'] ??
          door.doorElevationType ??
          door.doorType,

        frameMaterial: door.sections?.frame?.['FRAME MATERIAL'] as Door['frameMaterial'],
        wallType: door.sections?.frame?.['WALL TYPE'],
        throatThickness: door.sections?.frame?.['THROAT THICKNESS'],
        frameAnchor: door.sections?.frame?.['FRAME ANCHOR'],
        baseAnchor: door.sections?.frame?.['BASE ANCHOR'],
        numberOfAnchors: door.sections?.frame?.['NO OF ANCHOR'],
        frameProfile: door.sections?.frame?.['FRAME PROFILE'] as Door['frameProfile'],
        frameElevationType: door.sections?.frame?.['FRAME ELEVATION TYPE'],
        frameAssembly: door.sections?.frame?.['FRAME ASSEMBLY'],
        frameGauge: door.sections?.frame?.['FRAME GUAGE'],
        frameFinish: door.sections?.frame?.['FRAME FINISH'],
        prehung: door.sections?.frame?.['PREHUNG'],
        frameHead: door.sections?.frame?.['FRAME HEAD'],
        casing: door.sections?.frame?.['CASING'],
        frameIncludeExclude: door.sections?.frame?.['FRAME INCLUDE/EXCLUDE'],

        hardwareIncludeExclude: door.sections?.hardware?.['HARDWARE INCLUDE/EXCLUDE'],

        // Carry raw sections through as-is
        sections: door.sections as unknown as Door['sections'],

        providedHardwareSet: providedHardwareSet || undefined,
        assignedHardwareSet: assignedSet,
        assignmentConfidence: assignedSet ? 'high' : undefined,
        assignmentReason: assignedSet ? 'Matched from door schedule' : undefined,

        hardwarePrep: door.hardwarePrep,
      };

      doorsWithOrder.push({ door: builtDoor, order: door.scheduleOrder ?? Infinity });
    }
  }

  // Restore the original door schedule row order across all sets
  doorsWithOrder.sort((a, b) => a.order - b.order);
  const doors = doorsWithOrder.map((d) => d.door);

  return { hardwareSets, doors };
}
