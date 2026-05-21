/**
 * Hardware merge service.
 *
 * Matches door rows (from door_schedule_imports) to hardware sets
 * (from hardware_pdf_extractions) and produces the canonical merged JSON
 * stored in project_hardware_finals.
 *
 * Matching strategy (applied in order, first match wins):
 *   1. Exact match, case-insensitive         — "CA01" === "CA01"
 *   2. Prefix match (strip trailing letters) — "AD05e" → "AD05" (last resort)
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
import { resolveAllMergedSets } from '@/utils/descriptionResolver';

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
 * Normalize comma spacing for multi-value name comparison.
 * "S2,S4,S5 and S6" and "S2, S4, S5 and S6" both → "s2,s4,s5 and s6"
 */
function normalizeCommaSpaces(s: string): string {
  return s.replace(/\s*,\s*/g, ',').trim().toLowerCase();
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
  setIndex: Map<string, string>,       // normalized key → original setName
  prefixIndex: Map<string, string[]>,  // stripped prefix → [setNames]
  tokenIndex: Map<string, string>,     // individual token from multi-value name → setName
): { setName: string; matchType: 'exact' | 'prefix'; warning?: string } | null {
  // 1. Exact (case-insensitive)
  const exact = setIndex.get(normalize(hwSet));
  if (exact) return { setName: exact, matchType: 'exact' };

  // 1.5. Comma-space-normalized match — "S2,S4,S5 and S6" matches "S2, S4, S5 and S6"
  //      (Excel may omit spaces after commas that the PDF name includes)
  const normComma = normalizeCommaSpaces(hwSet);
  for (const [, originalName] of setIndex) {
    if (normalizeCommaSpaces(originalName) === normComma) {
      return { setName: originalName, matchType: 'exact' };
    }
  }

  // 2. Numeric equivalence — "1" should match "001", "07" should match "007"
  // Excel sheets use plain numbers while the PDF extractor zero-pads to 3 digits.
  const hwSetNumeric = parseInt(hwSet.trim(), 10);
  if (!isNaN(hwSetNumeric)) {
    for (const [normKey, originalName] of setIndex) {
      const keyNumeric = parseInt(normKey, 10);
      if (!isNaN(keyNumeric) && keyNumeric === hwSetNumeric) {
        return { setName: originalName, matchType: 'exact' };
      }
    }
  }

  // 3. Starts-with match — PDF set names often include a trailing description after
  //    a separator, e.g. "P200 – Elevator Lobby" should match Excel hwSet "P200".
  //    Only accept if the next character after the code is a recognised separator
  //    (space, hyphen, en-dash, em-dash, comma) to avoid false matches like "P2" → "P200 …".
  const normHwSet = normalize(hwSet);
  const startsWithMatches: string[] = [];
  for (const [normKey, originalName] of setIndex) {
    if (normKey.startsWith(normHwSet) && normKey.length > normHwSet.length) {
      const nextChar = normKey[normHwSet.length];
      if (/[\s\-–—_,]/.test(nextChar)) {
        startsWithMatches.push(originalName);
      }
    }
  }
  if (startsWithMatches.length === 1) return { setName: startsWithMatches[0], matchType: 'exact' };
  if (startsWithMatches.length > 1) {
    // Ambiguous — multiple sets share this code prefix. Pick the shortest name
    // (most general — fewest extra characters after the code) and warn.
    const best = startsWithMatches.reduce((a, b) => a.length <= b.length ? a : b);
    return {
      setName: best,
      matchType: 'prefix',
      warning: `hwSet "${hwSet}" matched multiple sets (${startsWithMatches.join(', ')}) — picked "${best}" (shortest name); verify manually.`,
    };
  }

  // 4. Reverse token match — the PDF set name is itself a comma/and-separated list
  //    of codes, e.g. door "S2" should match set "S2, S4, S5, S6, S7, S8, S9 and S10".
  const tokenMatch = tokenIndex.get(normalize(hwSet));
  if (tokenMatch) return { setName: tokenMatch, matchType: 'exact' };

  // 5. Prefix (strip trailing lowercase letters) — only use if exactly one set matches
  const prefix = prefixIndex.get(prefixName(hwSet));
  if (prefix && prefix.length === 1) return { setName: prefix[0], matchType: 'prefix' };

  return null;
}

/**
 * Split a hwSet field that may contain multiple comma/and-separated codes.
 * "P106, P109, P111" → ["P106", "P109", "P111"]
 * "S2,S4,S5 and S6"  → ["S2", "S4", "S5", "S6"]
 * "P200"             → ["P200"]
 */
function parseHwSetCodes(hwSet: string): string[] {
  return hwSet
    .split(/,|\band\b/i)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

// ---------------------------------------------------------------------------
// Door row → MergedDoor
// ---------------------------------------------------------------------------

function toMergedDoor(row: DoorScheduleRow, matchedSetName: string, scheduleOrder: number): MergedDoor {
  return {
    doorTag: row.doorTag,
    hwSet: row.hwSet,
    matchedSetName,
    scheduleOrder,
    buildingArea: row.buildingArea,
    doorLocation: row.doorLocation,
    interiorExterior: row.interiorExterior,
    quantity: row.quantity,
    fireRating: row.fireRating,
    leafCount: row.leafCount,
    doorType: row.doorType,
    doorElevationType: row.doorElevationType,
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
    sections: row.sections,
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
  const prefixIndex = new Map<string, string[]>(); // stripped prefix → [setNames]
  const tokenIndex = new Map<string, string>();    // individual token → setName (multi-value names only)

  for (const set of pdfSets) {
    const norm = normalize(set.setName);
    const prefix = prefixName(set.setName);

    setIndex.set(norm, set.setName);

    // Prefix index: collect all matches for ambiguity detection
    const existing = prefixIndex.get(prefix) ?? [];
    existing.push(set.setName);
    prefixIndex.set(prefix, existing);

    // Token index: if the set name is a comma/and-separated list of codes (e.g. "S2, S4, S5 and S6"),
    // index each individual token so a door with hwSet "S2" can find this set.
    if (/,|\band\b/i.test(set.setName)) {
      const tokens = parseHwSetCodes(set.setName);
      // Only treat as a multi-code name when every token looks like a set code
      // (short, alphanumeric — not prose like "Hinge and Lever").
      if (tokens.every(t => /^[A-Za-z0-9._-]{1,10}$/.test(t))) {
        for (const token of tokens) {
          const normToken = normalize(token);
          if (!tokenIndex.has(normToken)) tokenIndex.set(normToken, set.setName);
        }
      }
    }
  }

  // Build a map of setName → matched doors
  const doorsBySet = new Map<string, MergedDoor[]>();
  for (const set of pdfSets) {
    doorsBySet.set(set.setName, []);
  }

  const unmatchedDoorCodes = new Set<string>();
  let matchedDoorCount = 0;

  for (const [scheduleOrder, row] of doorRows.entries()) {
    const hwSetRaw = row.hwSet?.trim();

    // Skip rows with no hwSet or NOTE# placeholders
    if (!hwSetRaw || hwSetRaw.toUpperCase().startsWith('NOTE#') || hwSetRaw === '-') {
      continue;
    }

    // Try the whole hwSet value first — this directly handles cases where the Excel
    // cell contains the full multi-value set name, e.g. "S2,S4,S5,S6,S7,S8,S9 and S10"
    // which should match the PDF set "S2, S4, S5, S6, S7, S8, S9 and S10" directly.
    const wholeMatch = matchSetName(hwSetRaw, setIndex, prefixIndex, tokenIndex);
    if (wholeMatch) {
      doorsBySet.get(wholeMatch.setName)!.push(toMergedDoor(row, wholeMatch.setName, scheduleOrder));
      matchedDoorCount++;
      if (wholeMatch.warning) {
        warnings.push(`Door ${row.doorTag}: ${wholeMatch.warning}`);
      } else if (wholeMatch.matchType === 'prefix') {
        warnings.push(`Door ${row.doorTag}: hwSet "${hwSetRaw}" matched set "${wholeMatch.setName}" by prefix — verify this is correct.`);
      }
      continue;
    }

    // Whole value didn't match — split comma/and-separated codes and assign the door
    // to every matched set individually, e.g. "P106, P109, P111" → three sets.
    const codes = parseHwSetCodes(hwSetRaw);
    for (const hwSet of codes) {
      const match = matchSetName(hwSet, setIndex, prefixIndex, tokenIndex);
      if (match) {
        doorsBySet.get(match.setName)!.push(toMergedDoor(row, match.setName, scheduleOrder));
        matchedDoorCount++;
        if (match.warning) {
          warnings.push(`Door ${row.doorTag}: ${match.warning}`);
        } else if (match.matchType === 'prefix') {
          warnings.push(`Door ${row.doorTag}: hwSet "${hwSet}" matched set "${match.setName}" by prefix — verify this is correct.`);
        }
      } else {
        unmatchedDoorCodes.add(hwSet);
      }
    }
  }

  // Build the final merged array — one entry per PDF set
  const sets: MergedHardwareSet[] = pdfSets.map((pdfSet) => {
    const assignedDoors = doorsBySet.get(pdfSet.setName) ?? [];
    const doorCount = assignedDoors.reduce((sum, d) => {
      const qty = parseInt(d.sections?.basic_information?.['QUANTITY'] ?? d.sections?.door?.['QUANTITY'] ?? String(d.quantity ?? 1)) || 1;
      return sum + qty;
    }, 0);
    return {
      setName: pdfSet.setName,
      hardwareItems: pdfSet.hardwareItems.map((item) => ({
        ...item,
        multipliedQuantity: item.qty * doorCount,
      })),
      notes: pdfSet.notes ?? '',
      doors: assignedDoors,
      prep: pdfSet.prep,
    };
  });

  // Resolve dimension placeholders in descriptions (e.g. "x width" → "46\"")
  const resolvedSets = resolveAllMergedSets(sets);

  // PDF sets with no matching doors
  const pdfSetsWithNoDoors = resolvedSets
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
    sets: resolvedSets,
    setCount: resolvedSets.length,
    matchedDoorCount,
    unmatchedDoorCount: unmatchedDoorCodes.size,
    unmatchedDoorCodes: [...unmatchedDoorCodes],
    pdfSetsWithNoDoors,
    warnings,
  };

  saveDebugFiles(projectId, result);

  return result;
}
