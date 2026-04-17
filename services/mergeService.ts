/**
 * Hardware merge service.
 *
 * Matches door rows (from door_schedule_imports) to hardware sets
 * (from hardware_pdf_extractions) and produces the canonical merged JSON
 * stored in project_hardware_finals.
 *
 * Matching strategy (applied in order, first match wins):
 *   1. Exact match, case-insensitive         — "CA01" === "CA01"
 *   2. Base name match (strip after ".")     — "SE02a.W" → "SE02a"
 *   3. Prefix match (strip trailing letters) — "AD05e" → "AD05" (last resort)
 *
 * Server-side only. Never import from client components.
 */

import fs from 'fs';
import path from 'path';
import type {
  ExtractedHardwareSet,
  DoorScheduleRow,
  MergedHardwareSet,
  MergedDoor,
} from '@/lib/db/hardware';

// ---------------------------------------------------------------------------
// Public result type
// ---------------------------------------------------------------------------

export interface MergeResult {
  sets: MergedHardwareSet[];
  setCount: number;
  matchedDoorCount: number;
  unmatchedDoorCount: number;
  /** hwSet codes from the schedule with no matching PDF set */
  unmatchedDoorCodes: string[];
  /** PDF set names not referenced by any door */
  pdfSetsWithNoDoors: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Matching helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a set code for comparison.
 * "SE02a.W" → "se02a.w", "AD01b" → "ad01b"
 */
function normalize(code: string): string {
  return code.trim().toLowerCase();
}

/**
 * Strip the variant suffix (everything after the first ".").
 * "SE02a.W" → "se02a"
 * "CA01"    → "ca01"  (no dot, unchanged)
 */
function baseName(code: string): string {
  return normalize(code).split('.')[0];
}

/**
 * Strip trailing lowercase letters from a base name (last-resort prefix match).
 * "ad05e" → "ad05"
 * "se02a" → "se02"
 */
function prefixName(code: string): string {
  return baseName(code).replace(/[a-z]+$/, '');
}

/**
 * Try to match a door's hwSet code against the available PDF set names.
 * Returns the matched setName or null.
 */
function matchSetName(
  hwSet: string,
  setIndex: Map<string, string>, // normalized key → original setName
  baseIndex: Map<string, string>,
  prefixIndex: Map<string, string[]>,
): { setName: string; matchType: 'exact' | 'base' | 'prefix' } | null {
  // 1. Exact (case-insensitive)
  const exact = setIndex.get(normalize(hwSet));
  if (exact) return { setName: exact, matchType: 'exact' };

  // 2. Base name (strip after ".")
  const base = baseIndex.get(baseName(hwSet));
  if (base) return { setName: base, matchType: 'base' };

  // 3. Prefix (strip trailing letters) — only use if exactly one set matches
  const prefix = prefixIndex.get(prefixName(hwSet));
  if (prefix && prefix.length === 1) return { setName: prefix[0], matchType: 'prefix' };

  return null;
}

// ---------------------------------------------------------------------------
// Door row → MergedDoor
// ---------------------------------------------------------------------------

function toMergedDoor(row: DoorScheduleRow, matchedSetName: string): MergedDoor {
  return {
    doorTag: row.doorTag,
    hwSet: row.hwSet,
    matchedSetName,
    buildingArea: row.buildingArea,
    doorLocation: row.doorLocation,
    interiorExterior: row.interiorExterior,
    quantity: row.quantity,
    fireRating: row.fireRating,
    leafCount: row.leafCount,
    doorType: row.doorType,
    doorWidth: row.doorWidth,
    doorHeight: row.doorHeight,
    thickness: row.thickness,
    doorMaterial: row.doorMaterial,
    frameMaterial: row.frameMaterial,
    hardwarePrep: row.hardwarePrep,
    hasCardReader: row.hasCardReader,
    hasKeyPad: row.hasKeyPad,
    hasAutoOperator: row.hasAutoOperator,
    hasPrivacySet: row.hasPrivacySet,
    hasKeyedLock: row.hasKeyedLock,
    hasPushPlate: row.hasPushPlate,
    hasAntiBarricade: row.hasAntiBarricade,
    hasKickPlate: row.hasKickPlate,
    hasFrameProtection: row.hasFrameProtection,
    hasDoorCloser: row.hasDoorCloser,
    comments: row.comments,
    excludeReason: row.excludeReason,
  };
}

// ---------------------------------------------------------------------------
// Debug output (DEV only)
// ---------------------------------------------------------------------------

function saveDebugFiles(
  projectId: string,
  result: MergeResult,
): void {
  if (process.env.NODE_ENV !== 'development') return;
  try {
    const debugDir = path.join(process.cwd(), 'debug-extractions', 'final-extraction');
    fs.mkdirSync(debugDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const prefix = `${projectId.slice(0, 8)}_${timestamp}`;

    fs.writeFileSync(
      path.join(debugDir, `${prefix}_final.json`),
      JSON.stringify(result.sets, null, 2),
      'utf-8',
    );
    fs.writeFileSync(
      path.join(debugDir, `${prefix}_meta.json`),
      JSON.stringify({
        setCount: result.setCount,
        matchedDoorCount: result.matchedDoorCount,
        unmatchedDoorCount: result.unmatchedDoorCount,
        unmatchedDoorCodes: result.unmatchedDoorCodes,
        pdfSetsWithNoDoors: result.pdfSetsWithNoDoors,
        warnings: result.warnings,
      }, null, 2),
      'utf-8',
    );
    console.log(`[mergeService] Debug files → debug-extractions/final-extraction/${prefix}_*`);
  } catch (err) {
    console.warn('[mergeService] Could not write debug files:', err);
  }
}

// ---------------------------------------------------------------------------
// Main merge function
// ---------------------------------------------------------------------------

/**
 * Merge PDF hardware sets with Excel door schedule rows.
 *
 * @param pdfSets   Extracted hardware sets from the PDF
 * @param doorRows  Parsed door rows from the Excel schedule
 * @param projectId Used for debug file naming
 */
export function mergeHardwareData(
  pdfSets: ExtractedHardwareSet[],
  doorRows: DoorScheduleRow[],
  projectId: string,
): MergeResult {
  const warnings: string[] = [];

  // Build lookup indexes from PDF sets
  const setIndex = new Map<string, string>();      // exact normalized → original setName
  const baseIndex = new Map<string, string>();     // base normalized → original setName
  const prefixIndex = new Map<string, string[]>(); // prefix → [setNames]

  for (const set of pdfSets) {
    const norm = normalize(set.setName);
    const base = baseName(set.setName);
    const prefix = prefixName(set.setName);

    setIndex.set(norm, set.setName);

    // Base index: if collision, keep first (PDF sets shouldn't share base names)
    if (!baseIndex.has(base)) baseIndex.set(base, set.setName);

    // Prefix index: collect all matches for ambiguity detection
    const existing = prefixIndex.get(prefix) ?? [];
    existing.push(set.setName);
    prefixIndex.set(prefix, existing);
  }

  // Build a map of setName → matched doors
  const doorsBySet = new Map<string, MergedDoor[]>();
  for (const set of pdfSets) {
    doorsBySet.set(set.setName, []);
  }

  const unmatchedDoorCodes = new Set<string>();
  let matchedDoorCount = 0;

  for (const row of doorRows) {
    const hwSet = row.hwSet?.trim();

    // Skip rows with no hwSet or NOTE# placeholders
    if (!hwSet || hwSet.toUpperCase().startsWith('NOTE#') || hwSet === '-') {
      continue;
    }

    const match = matchSetName(hwSet, setIndex, baseIndex, prefixIndex);

    if (match) {
      const mergedDoor = toMergedDoor(row, match.setName);
      doorsBySet.get(match.setName)!.push(mergedDoor);
      matchedDoorCount++;

      if (match.matchType === 'base') {
        warnings.push(
          `Door ${row.doorTag}: hwSet "${hwSet}" matched set "${match.setName}" by base name (variant suffix stripped).`,
        );
      } else if (match.matchType === 'prefix') {
        warnings.push(
          `Door ${row.doorTag}: hwSet "${hwSet}" matched set "${match.setName}" by prefix (trailing letters stripped) — verify this is correct.`,
        );
      }
    } else {
      unmatchedDoorCodes.add(hwSet);
    }
  }

  // Build the final merged array — one entry per PDF set
  const sets: MergedHardwareSet[] = pdfSets.map((pdfSet) => ({
    setName: pdfSet.setName,
    hardwareItems: pdfSet.hardwareItems,
    notes: pdfSet.notes ?? '',
    doors: doorsBySet.get(pdfSet.setName) ?? [],
  }));

  // PDF sets with no matching doors
  const pdfSetsWithNoDoors = sets
    .filter((s) => s.doors.length === 0)
    .map((s) => s.setName);

  if (pdfSetsWithNoDoors.length > 0) {
    warnings.push(
      `PDF sets with no matching doors: ${pdfSetsWithNoDoors.join(', ')}`,
    );
  }

  if (unmatchedDoorCodes.size > 0) {
    warnings.push(
      `Door hwSet codes with no matching PDF set: ${[...unmatchedDoorCodes].join(', ')}`,
    );
  }

  const result: MergeResult = {
    sets,
    setCount: sets.length,
    matchedDoorCount,
    unmatchedDoorCount: unmatchedDoorCodes.size,
    unmatchedDoorCodes: [...unmatchedDoorCodes],
    pdfSetsWithNoDoors,
    warnings,
  };

  saveDebugFiles(projectId, result);

  return result;
}
