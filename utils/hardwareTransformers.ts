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
  return sets.map((set) => ({
    id: `hs-pdf-${set.setName.toLowerCase().replace(/\s+/g, '-')}`,
    name: set.setName,
    description: set.notes ?? '',
    division: 'Division 08',
    items: set.hardwareItems.map((item, idx) => toHardwareItem(item, set.setName, idx)),
  }));
}

// ---------------------------------------------------------------------------
// DoorScheduleRow → Door (UI type)
// ---------------------------------------------------------------------------

export function transformDoors(rows: DoorScheduleRow[], hardwareSets: HardwareSet[]): Door[] {
  const setsByName = new Map(hardwareSets.map((s) => [s.name.toLowerCase(), s]));

  return rows.map((row, idx): Door => {
    const providedSet = row.hwSet?.trim() ?? '';
    const assignedSet = providedSet ? (setsByName.get(providedSet.toLowerCase()) ?? null) : null;

    // When sections are present, read dimensions from section keys with fallbacks
    const rawWidth = row.sections
      ? (row.sections.door['WIDTH'] ?? row.sections.door['DOOR WIDTH'] ?? row.doorWidth)
      : row.doorWidth;
    const rawHeight = row.sections
      ? (row.sections.door['HEIGHT'] ?? row.sections.door['DOOR HEIGHT'] ?? row.doorHeight)
      : row.doorHeight;
    const rawThickness = row.sections
      ? (row.sections.door['THICKNESS'] ?? row.sections.door['DOOR THICKNESS'] ?? row.thickness)
      : row.thickness;

    return {
      id: `door-import-${idx}-${row.doorTag}`,
      doorTag: String(row.doorTag),
      status: assignedSet ? 'complete' : 'pending',

      width: parseDimension(rawWidth),
      height: parseDimension(rawHeight),
      thickness: parseThickness(rawThickness),

      doorMaterial: (row.sections ? row.sections.door['DOOR MATERIAL'] : undefined) ?? row.doorMaterial ?? '',
      doorFinish: (row.sections ? row.sections.door['DOOR FINISH'] : undefined) ?? row.doorFinish,
      fireRating: (row.sections ? row.sections.door['FIRE RATING'] : undefined) ?? row.fireRating,
      interiorExterior: (row.sections ? row.sections.door['INTERIOR/EXTERIOR'] : undefined) ?? row.interiorExterior,
      quantity: row.quantity ?? 1,
      location: (row.sections ? row.sections.door['DOOR LOCATION'] : undefined) ?? row.doorLocation,
      type: row.leafCount ? (parseInt(row.leafCount, 10) > 1 ? 'Pair' : 'Single') : undefined,

      buildingTag: (row.sections ? row.sections.door['BUILDING TAG'] : undefined) ?? row.buildingTag,
      buildingLocation: (row.sections ? row.sections.door['BUILDING LOCATION'] : undefined) ?? row.buildingLocation,
      handing: ((row.sections ? row.sections.door['HAND OF OPENINGS'] : undefined) ?? row.handOfOpenings) as Door['handing'],
      operation: (row.sections ? row.sections.door['DOOR OPERATION'] : undefined) ?? row.doorOperation,
      leafCount: (() => {
        const raw = (row.sections ? row.sections.door['LEAF COUNT'] : undefined) ?? row.leafCount;
        const n = raw !== undefined ? parseInt(String(raw), 10) : NaN;
        return isNaN(n) ? undefined : n;
      })(),
      excludeReason: (row.sections ? row.sections.door['EXCLUDE REASON'] : undefined) ?? row.excludeReason,
      stcRating: (row.sections ? row.sections.door['STC RATING'] : undefined) ?? row.stcRating,
      undercut: (row.sections ? row.sections.door['DOOR UNDERCUT'] : undefined) ?? row.doorUndercut,
      doorCore: (row.sections ? row.sections.door['DOOR CORE'] : undefined) ?? row.doorCore,
      doorFace: (row.sections ? row.sections.door['DOOR FACE'] : undefined) ?? row.doorFace,
      doorEdge: (row.sections ? row.sections.door['DOOR EDGE'] : undefined) ?? row.doorEdge,
      doorGauge: (row.sections ? row.sections.door['DOOR GUAGE'] : undefined) ?? row.doorGauge,
      doorIncludeExclude: (row.sections ? row.sections.door['DOOR INCLUDE/EXCLUDE'] : undefined) ?? row.doorIncludeExclude,
      elevationTypeId: (row.sections ? row.sections.door['DOOR ELEVATION TYPE'] : undefined) ?? row.doorElevationType,

      frameMaterial: ((row.sections ? row.sections.frame['FRAME MATERIAL'] : undefined) ?? row.frameMaterial) as Door['frameMaterial'],
      frameGauge: (row.sections ? row.sections.frame['FRAME GUAGE'] : undefined) ?? row.frameGauge ?? row.frameType,
      wallType: (row.sections ? row.sections.frame['WALL TYPE'] : undefined) ?? row.wallType,
      throatThickness: (row.sections ? row.sections.frame['THROAT THICKNESS'] : undefined) ?? row.throatThickness,
      frameAnchor: (row.sections ? row.sections.frame['FRAME ANCHOR'] : undefined) ?? row.frameAnchor,
      baseAnchor: (row.sections ? row.sections.frame['BASE ANCHOR'] : undefined) ?? row.baseAnchor,
      numberOfAnchors: (row.sections ? row.sections.frame['NO OF ANCHOR'] : undefined) ?? row.numberOfAnchors,
      frameProfile: ((row.sections ? row.sections.frame['FRAME PROFILE'] : undefined) ?? row.frameProfile) as Door['frameProfile'],
      frameElevationType: (row.sections ? row.sections.frame['FRAME ELEVATION TYPE'] : undefined) ?? row.frameElevationType,
      frameAssembly: (row.sections ? row.sections.frame['FRAME ASSEMBLY'] : undefined) ?? row.frameAssembly,
      frameFinish: (row.sections ? row.sections.frame['FRAME FINISH'] : undefined) ?? row.frameFinish,
      prehung: (row.sections ? row.sections.frame['PREHUNG'] : undefined) ?? row.prehung,
      frameHead: (row.sections ? row.sections.frame['FRAME HEAD'] : undefined) ?? row.frameHead,
      casing: (row.sections ? row.sections.frame['CASING'] : undefined) ?? row.casing,
      frameIncludeExclude: (row.sections ? row.sections.frame['FRAME INCLUDE/EXCLUDE'] : undefined) ?? row.frameIncludeExclude,

      hardwareIncludeExclude: (row.sections ? row.sections.hardware['HARDWARE INCLUDE/EXCLUDE'] : undefined) ?? row.hardwareIncludeExclude,

      // Carry raw sections through as-is for preservation
      // (cast required: DoorScheduleRow.sections uses raw Excel column names,
      //  Door.sections uses structured camelCase keys — shape mismatch is intentional here)
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
  const hardwareSets: HardwareSet[] = finalJson.map((set) => ({
    id: `hs-pdf-${set.setName.toLowerCase().replace(/\s+/g, '-')}`,
    name: set.setName,
    description: set.notes ?? '',
    division: 'Division 08',
    items: set.hardwareItems.map((item, idx) => toHardwareItem(item, set.setName, idx)),
  }));

  const setsByName = new Map(hardwareSets.map((s) => [s.name.toLowerCase(), s]));

  const doorsWithOrder: Array<{ door: Door; order: number }> = [];

  for (const set of finalJson) {
    const assignedSet = setsByName.get(set.setName.toLowerCase()) ?? null;

    // Deduplicate doors within the same set by doorTag (last-write wins)
    const uniqueDoorsInSet = Array.from(
      new Map(set.doors.map((d) => [String(d.doorTag).toLowerCase(), d])).values(),
    );

    for (const door of uniqueDoorsInSet) {
      // Resolve dimensions: prefer sections, fall back to flat fields
      const rawWidth =
        door.sections?.door['WIDTH'] ??
        door.sections?.door['DOOR WIDTH'] ??
        door.doorWidth;
      const rawHeight =
        door.sections?.door['HEIGHT'] ??
        door.sections?.door['DOOR HEIGHT'] ??
        door.doorHeight;
      const rawThickness =
        door.sections?.door['THICKNESS'] ??
        door.sections?.door['DOOR THICKNESS'] ??
        door.thickness;

      const leafCountRaw =
        door.sections?.door['LEAF COUNT'] ?? door.leafCount;
      const leafCountNum = leafCountRaw !== undefined
        ? parseInt(String(leafCountRaw), 10)
        : NaN;

      const providedHardwareSet = door.sections?.hardware?.['HARDWARE SET'] ?? door.hwSet ?? door.matchedSetName;

      const builtDoor: Door = {
        id: `door-final-${set.setName}-${door.doorTag}`,
        doorTag: String(door.doorTag),
        status: assignedSet ? 'complete' : 'pending',

        width: parseDimension(rawWidth),
        height: parseDimension(rawHeight),
        thickness: parseThickness(rawThickness),

        doorMaterial: (door.sections?.door['DOOR MATERIAL']) ?? door.doorMaterial ?? '',
        doorFinish: door.sections?.door['DOOR FINISH'],
        fireRating: (door.sections?.door['FIRE RATING']) ?? door.fireRating,
        interiorExterior: (door.sections?.door['INTERIOR/EXTERIOR']) ?? door.interiorExterior,
        quantity: door.quantity ?? 1,
        location: door.sections?.door['DOOR LOCATION'] ?? door.doorLocation,
        type: !isNaN(leafCountNum) ? (leafCountNum > 1 ? 'Pair' : 'Single') : undefined,
        leafCount: !isNaN(leafCountNum) ? leafCountNum : undefined,

        buildingTag: door.sections?.door['BUILDING TAG'],
        buildingLocation: door.sections?.door['BUILDING LOCATION'],
        handing: door.sections?.door['HAND OF OPENINGS'] as Door['handing'],
        operation: door.sections?.door['DOOR OPERATION'],
        excludeReason: (door.sections?.door['EXCLUDE REASON']) ?? door.excludeReason,
        stcRating: door.sections?.door['STC RATING'],
        undercut: door.sections?.door['DOOR UNDERCUT'],
        doorCore: door.sections?.door['DOOR CORE'],
        doorFace: door.sections?.door['DOOR FACE'],
        doorEdge: door.sections?.door['DOOR EDGE'],
        doorGauge: door.sections?.door['DOOR GUAGE'],
        doorIncludeExclude: door.sections?.door['DOOR INCLUDE/EXCLUDE'],
        elevationTypeId: door.sections?.door['DOOR ELEVATION TYPE'],

        frameMaterial: door.sections?.frame['FRAME MATERIAL'] as Door['frameMaterial'],
        wallType: door.sections?.frame['WALL TYPE'],
        throatThickness: door.sections?.frame['THROAT THICKNESS'],
        frameAnchor: door.sections?.frame['FRAME ANCHOR'],
        baseAnchor: door.sections?.frame['BASE ANCHOR'],
        numberOfAnchors: door.sections?.frame['NO OF ANCHOR'],
        frameProfile: door.sections?.frame['FRAME PROFILE'] as Door['frameProfile'],
        frameElevationType: door.sections?.frame['FRAME ELEVATION TYPE'],
        frameAssembly: door.sections?.frame['FRAME ASSEMBLY'],
        frameGauge: door.sections?.frame['FRAME GUAGE'],
        frameFinish: door.sections?.frame['FRAME FINISH'],
        prehung: door.sections?.frame['PREHUNG'],
        frameHead: door.sections?.frame['FRAME HEAD'],
        casing: door.sections?.frame['CASING'],
        frameIncludeExclude: door.sections?.frame['FRAME INCLUDE/EXCLUDE'],

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
