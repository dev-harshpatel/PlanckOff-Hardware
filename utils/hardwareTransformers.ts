/**
 * Transforms data from the new DB tables (hardware_pdf_extractions, door_schedule_imports)
 * into the legacy UI types (HardwareSet[], Door[]) that the existing components consume.
 */

import type { HardwareSet, HardwareItem, Door } from '../types';
import type { ExtractedHardwareSet, DoorScheduleRow } from '@/lib/db/hardware';

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

    return {
      id: `door-import-${idx}-${row.doorTag}`,
      doorTag: String(row.doorTag),
      status: assignedSet ? 'complete' : 'pending',

      width: parseDimension(row.doorWidth),
      height: parseDimension(row.doorHeight),
      thickness: parseThickness(row.thickness),

      doorMaterial: row.doorMaterial ?? '',
      doorFinish: row.doorFinish,
      fireRating: row.fireRating,
      interiorExterior: row.interiorExterior,
      quantity: row.quantity ?? 1,
      location: row.doorLocation,
      type: row.leafCount ? (parseInt(row.leafCount, 10) > 1 ? 'Pair' : 'Single') : undefined,

      frameMaterial: row.frameMaterial as Door['frameMaterial'],
      frameGauge: row.frameType,

      providedHardwareSet: providedSet || undefined,
      assignedHardwareSet: assignedSet ?? null,
      assignmentConfidence: assignedSet ? 'high' : undefined,
      assignmentReason: assignedSet ? 'Matched from door schedule' : undefined,
    };
  });
}
