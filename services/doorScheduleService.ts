/**
 * Server-side door schedule parsing service.
 * Parses Excel (.xlsx) and CSV files into a canonical JSON shape.
 * Never import from client components.
 */

import * as XLSX from 'xlsx-js-style';
import Papa from 'papaparse';
import type { DoorScheduleRow } from '@/lib/db/hardware';

// ---------------------------------------------------------------------------
// Header normalisation map
// Handles the many variations found in real-world door schedule exports.
// ---------------------------------------------------------------------------

const HEADER_MAP: Record<string, keyof DoorScheduleRow> = {
  // Door tag
  'door tag': 'doorTag', 'doortag': 'doorTag', 'door#': 'doorTag',
  'door no': 'doorTag', 'door no.': 'doorTag', 'tag': 'doorTag',
  'mark': 'doorTag', 'dr. #': 'doorTag', 'dr #': 'doorTag',
  // HW Set (join key) — "HARDWARE SET" in new sectioned format maps here
  'hw set': 'hwSet', 'hwset': 'hwSet', 'hw#': 'hwSet',
  'hardware set #': 'hwSet', 'set#': 'hwSet', 'set #': 'hwSet',
  'hardware set': 'hwSet',
  // Building
  'building tag': 'buildingTag', 'buildingtag': 'buildingTag',
  'building location': 'buildingLocation', 'buildinglocation': 'buildingLocation',
  'buildingn area': 'buildingArea', 'building area': 'buildingArea',
  'building': 'buildingArea', 'area': 'buildingArea',
  // Room
  'room no.': 'roomNumber', 'room no': 'roomNumber', 'room': 'roomNumber',
  'room number': 'roomNumber',
  // Location
  'door location': 'doorLocation', 'location': 'doorLocation', 'room name': 'doorLocation',
  // Interior/Exterior
  'interior/exterior': 'interiorExterior', 'int/ext': 'interiorExterior',
  'interior exterior': 'interiorExterior',
  // Quantity
  'quantity': 'quantity', 'qty': 'quantity', 'count': 'quantity',
  // Handing / operation / leaf
  'hand of openings': 'handOfOpenings', 'handing': 'handOfOpenings', 'hand of opening': 'handOfOpenings',
  'door operation': 'doorOperation', 'operation': 'doorOperation',
  'leaf count': 'leafCount', 'leafcount': 'leafCount', 'leaves': 'leafCount',
  // Exclude
  'exclude reason': 'excludeReason', 'excludereason': 'excludeReason',
  // Dimensions
  'door width': 'doorWidth', 'width': 'doorWidth',
  'door height': 'doorHeight', 'height': 'doorHeight',
  'thickness': 'thickness',
  'door width (mm)': 'doorWidthMm', 'width (mm)': 'doorWidthMm',
  'door height (mm)': 'doorHeightMm', 'height (mm)': 'doorHeightMm',
  // Fire rating
  'fire rating': 'fireRating', 'firerating': 'fireRating', 'fr': 'fireRating',
  // Door type / elevation
  'door type': 'doorType', 'type': 'doorType', 'elevation': 'doorType',
  'door elevation type': 'doorElevationType', 'door elev type': 'doorElevationType',
  // Door material & finish
  'door material': 'doorMaterial', 'door mat': 'doorMaterial',
  'door core': 'doorCore', 'doorcore': 'doorCore',
  'door face': 'doorFace', 'doorface': 'doorFace',
  'door edge': 'doorEdge', 'dooredge': 'doorEdge',
  'door guage': 'doorGauge', 'door gauge': 'doorGauge', 'doorguage': 'doorGauge', 'doorgauge': 'doorGauge',
  'door finish': 'doorFinish',
  'stc rating': 'stcRating', 'stcrating': 'stcRating', 'stc': 'stcRating',
  'door undercut': 'doorUndercut', 'undercut': 'doorUndercut',
  'door include/exclude': 'doorIncludeExclude', 'door include exclude': 'doorIncludeExclude',
  'glazing type': 'glazingType', 'glazing': 'glazingType',
  // Frame
  'wall type': 'wallType', 'walltype': 'wallType',
  'throat thickness': 'throatThickness', 'throat': 'throatThickness',
  'frame type': 'frameType',
  'frame material': 'frameMaterial', 'frame mat': 'frameMaterial',
  'frame anchor': 'frameAnchor', 'frameanchor': 'frameAnchor',
  'base anchor': 'baseAnchor', 'baseanchor': 'baseAnchor',
  'no of anchor': 'numberOfAnchors', 'number of anchors': 'numberOfAnchors', 'noofanchor': 'numberOfAnchors',
  'frame profile': 'frameProfile', 'frameprofile': 'frameProfile',
  'frame elevation type': 'frameElevationType', 'frame elev type': 'frameElevationType',
  'frame assembly': 'frameAssembly', 'frameassembly': 'frameAssembly',
  'frame guage': 'frameGauge', 'frame gauge': 'frameGauge', 'frameguage': 'frameGauge', 'framegauge': 'frameGauge',
  'frame finish': 'frameFinish',
  'prehung': 'prehung', 'pre hung': 'prehung', 'pre-hung': 'prehung',
  'frame head': 'frameHead', 'framehead': 'frameHead',
  'casing': 'casing',
  'frame include/exclude': 'frameIncludeExclude', 'frame include exclude': 'frameIncludeExclude',
  // Hardware
  'hardware include/exclude': 'hardwareIncludeExclude', 'hardware include exclude': 'hardwareIncludeExclude',
  'hardware prep': 'hardwarePrep', 'hw prep': 'hardwarePrep',
  'hardware on door': 'hardwareOnDoor', 'hardware on door ': 'hardwareOnDoor',
  // Boolean accessories
  'card reader': 'hasCardReader', 'cr': 'hasCardReader',
  'key pad': 'hasKeyPad', 'keypad': 'hasKeyPad', 'kp': 'hasKeyPad',
  'auto operator': 'hasAutoOperator', 'ao': 'hasAutoOperator', 'operator': 'hasAutoOperator',
  'privacy set': 'hasPrivacySet', 'privacy': 'hasPrivacySet',
  'keyed lock': 'hasKeyedLock',
  'push plate': 'hasPushPlate', 'pp': 'hasPushPlate',
  'anti- barricade': 'hasAntiBarricade', 'anti-barricade': 'hasAntiBarricade', 'antibarricade': 'hasAntiBarricade',
  'kick plate': 'hasKickPlate', 'kp ': 'hasKickPlate',
  'frame protection': 'hasFrameProtection',
  'door closer': 'hasDoorCloser', 'closer': 'hasDoorCloser',
  // Notes
  'comments': 'comments', 'comment': 'comments', 'notes': 'comments',
};

// ---------------------------------------------------------------------------
// Header normalisation
// ---------------------------------------------------------------------------

function normaliseHeader(raw: string): keyof DoorScheduleRow | null {
  const key = raw.trim().toLowerCase();
  return HEADER_MAP[key] ?? null;
}

// ---------------------------------------------------------------------------
// Value coercion
// ---------------------------------------------------------------------------

function coerceString(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val);
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function mapRow(rawRow: Record<string, unknown>, headerMap: Map<string, keyof DoorScheduleRow>): DoorScheduleRow | null {
  const row: Partial<DoorScheduleRow> = {};

  for (const [rawHeader, fieldName] of headerMap.entries()) {
    const val = rawRow[rawHeader];
    (row as Record<string, unknown>)[fieldName] = coerceString(val);
  }

  // doorTag is mandatory — always store the original display text.
  if (row.doorTag !== undefined) {
    row.doorTag = coerceString(row.doorTag);
  }

  // Skip rows with no door tag
  if (!String(row.doorTag ?? '').trim()) return null;

  return row as DoorScheduleRow;
}

// ---------------------------------------------------------------------------
// Build header→field map from the first row of data
// ---------------------------------------------------------------------------

function buildHeaderMap(headers: string[]): Map<string, keyof DoorScheduleRow> {
  const map = new Map<string, keyof DoorScheduleRow>();
  for (const header of headers) {
    const fieldName = normaliseHeader(header);
    if (fieldName) map.set(header, fieldName);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Sheet selection helpers
// ---------------------------------------------------------------------------

/**
 * Header keywords that strongly indicate a door schedule sheet.
 * Checked against the first field-name row (skipping section-label rows).
 */
const DOOR_SHEET_SIGNALS = new Set([
  'door tag', 'doortag', 'door#', 'door no', 'door no.', 'tag', 'mark',
  'dr. #', 'dr #',
  'hw set', 'hwset', 'hw#', 'hardware set #', 'set#', 'set #', 'hardware set',
  'door location', 'door material', 'fire rating',
]);

/**
 * Section-label values used in row 0 of the new sectioned Excel format.
 * When a row contains ONLY these values (plus empty strings), it's a section header row.
 */
const SECTION_LABEL_TOKENS = new Set(['BASIC INFORMATION', 'DOOR', 'FRAME', 'HARDWARE']);

/** Returns true if the row is a section-label row (new 2-row header format). */
function isSectionLabelRow(cells: string[]): boolean {
  const nonEmpty = cells.filter((c) => c !== '');
  return nonEmpty.length >= 2 && nonEmpty.every((c) => SECTION_LABEL_TOKENS.has(c.toUpperCase()));
}

/**
 * Return the field-name header cells from a worksheet.
 * Skips a leading section-label row if the new 2-row header format is detected.
 */
function getSheetHeaders(ws: XLSX.WorkSheet): string[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][];
  for (let i = 0; i < rows.length; i++) {
    const cells = (rows[i] as unknown[]).map((c) => String(c ?? '').trim());
    if (!cells.some((c) => c !== '')) continue; // skip empty rows
    if (isSectionLabelRow(cells) && i + 1 < rows.length) {
      // This is the section-label row — the next row holds the real field names
      return (rows[i + 1] as unknown[]).map((c) => String(c ?? '').trim());
    }
    return cells;
  }
  return [];
}

/** Score a sheet: how many door-schedule headers does its first row contain? */
function scoreDoorSheet(ws: XLSX.WorkSheet): number {
  const headers = getSheetHeaders(ws);
  return headers.filter((h) => DOOR_SHEET_SIGNALS.has(h.toLowerCase())).length;
}

/**
 * Pick the best sheet to parse from the workbook.
 *
 * Priority:
 *   1. Sheet named "ALL DOOR" (case-insensitive) — legacy default
 *   2. Sheet whose header row has the most door-schedule signals
 *   3. First sheet (last resort)
 *
 * Returns `confident = true` when we found a sheet by name or by header scan
 * (score ≥ 1), so callers can suppress spurious "sheets skipped" noise.
 */
function selectTargetSheet(workbook: XLSX.WorkBook): {
  targetSheet: string;
  skipped: string[];
  confident: boolean;
} {
  const names = workbook.SheetNames;

  // 1. Explicit "ALL DOOR" sheet
  const allDoor = names.find((n) => n.trim().toUpperCase() === 'ALL DOOR');
  if (allDoor) {
    return { targetSheet: allDoor, skipped: names.filter((n) => n !== allDoor), confident: true };
  }

  // 2. Score every sheet; pick the one with the most signals
  let bestSheet = names[0];
  let bestScore = 0;
  for (const name of names) {
    const score = scoreDoorSheet(workbook.Sheets[name]);
    if (score > bestScore) { bestScore = score; bestSheet = name; }
  }

  const skipped = names.filter((n) => n !== bestSheet);
  return { targetSheet: bestSheet, skipped, confident: bestScore > 0 };
}

// ---------------------------------------------------------------------------
// Excel parsing
// ---------------------------------------------------------------------------

// Builds the column-index → section name map for the sectioned format.
function buildColSectionMap(
  sectionLabelRow: string[],
): Record<number, 'basic_information' | 'door' | 'frame' | 'hardware'> {
  const map: Record<number, 'basic_information' | 'door' | 'frame' | 'hardware'> = {};
  let current: 'basic_information' | 'door' | 'frame' | 'hardware' = 'basic_information';
  sectionLabelRow.forEach((cell, idx) => {
    const val = cell.toUpperCase();
    if (val === 'BASIC INFORMATION') current = 'basic_information';
    if (val === 'DOOR')              current = 'door';
    if (val === 'FRAME')             current = 'frame';
    if (val === 'HARDWARE')          current = 'hardware';
    map[idx] = current;
  });
  return map;
}

function parseExcel(buffer: Buffer): { rows: DoorScheduleRow[]; warnings: string[] } {
  const warnings: string[] = [];
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  if (workbook.SheetNames.length === 0) throw new Error('Excel file contains no sheets.');

  const { targetSheet, skipped, confident } = selectTargetSheet(workbook);

  if (!confident && skipped.length > 0) {
    warnings.push(`Could not auto-detect door schedule sheet — used "${targetSheet}". Skipped: ${skipped.join(', ')}`);
  }

  const ws = workbook.Sheets[targetSheet];

  // Detect the 2-row sectioned header format by inspecting raw rows.
  const allRawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][];
  let sectionLabelRowIdx = -1;
  for (let i = 0; i < allRawRows.length; i++) {
    const cells = (allRawRows[i] as unknown[]).map((c) => String(c ?? '').trim());
    if (!cells.some((c) => c !== '')) continue;
    if (isSectionLabelRow(cells)) { sectionLabelRowIdx = i; break; }
    break; // first non-empty row is not a section label → single-row header format
  }

  const isSectioned = sectionLabelRowIdx !== -1;
  // When sectioned, data starts 2 rows after the section-label row (1 for field names, then data).
  const dataRange = isSectioned ? sectionLabelRowIdx + 1 : 0;

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: '',
    raw: false,
    range: dataRange, // skip section-label row; use field-name row as header
  });

  if (rawRows.length === 0) return { rows: [], warnings };

  const headers = Object.keys(rawRows[0]);
  const headerMap = buildHeaderMap(headers);

  // For sectioned format, build the column→section mapping to populate `sections`.
  const sectionLabelCells = isSectioned
    ? (allRawRows[sectionLabelRowIdx] as unknown[]).map((c) => String(c ?? '').trim())
    : [];
  const colSectionMap = isSectioned ? buildColSectionMap(sectionLabelCells) : {};
  const fieldNameCells = isSectioned
    ? (allRawRows[sectionLabelRowIdx + 1] as unknown[]).map((c) => String(c ?? '').trim())
    : [];

  const rows: DoorScheduleRow[] = [];
  for (const rawRow of rawRows) {
    if (isSectioned) {
      // --- Sectioned format: emit ONLY doorTag + hwSet at top level, rest goes into sections ---
      const basicInfoSec: Record<string, string | undefined> = {};
      const doorSec: Record<string, string | undefined> = {};
      const frameSec: Record<string, string | undefined> = {};
      const hwSec: Record<string, string | undefined> = {};

      fieldNameCells.forEach((fieldName, colIdx) => {
        if (!fieldName) return;
        const section = colSectionMap[colIdx] ?? 'basic_information';
        const rawVal = rawRow[fieldName];
        const val = String(rawVal ?? '');
        // Store using the original Excel column name so keys are consistent within each section.
        if (section === 'basic_information') basicInfoSec[fieldName] = val;
        else if (section === 'door')         doorSec[fieldName] = val;
        else if (section === 'frame')        frameSec[fieldName] = val;
        else                                 hwSec[fieldName] = val;
      });

      // doorTag and hwSet are the only join/identity keys kept at the top level.
      // Case-insensitive lookup handles any capitalisation from the Excel template.
      const rawKeys = Object.keys(rawRow);
      const doorTagKey = rawKeys.find((k) => k.trim().toLowerCase() === 'door tag');
      const hwSetKey   = rawKeys.find((k) => k.trim().toLowerCase() === 'hardware set');
      const doorTag = coerceString(doorTagKey ? rawRow[doorTagKey] : '');
      if (!doorTag.trim()) continue; // skip rows without a door tag

      const hwSet = coerceString(hwSetKey ? rawRow[hwSetKey] : '');

      rows.push({
        doorTag,
        hwSet,
        sections: { basic_information: basicInfoSec, door: doorSec, frame: frameSec, hardware: hwSec },
      });
    } else {
      // --- Legacy flat format ---
      const row = mapRow(rawRow, headerMap);
      if (row) rows.push(row);
    }
  }

  return { rows, warnings };
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

function parseCsv(buffer: Buffer): { rows: DoorScheduleRow[]; warnings: string[] } {
  const warnings: string[] = [];
  const text = buffer.toString('utf-8').replace(/^\uFEFF/, ''); // strip BOM

  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (result.errors.length > 0) {
    warnings.push(...result.errors.slice(0, 5).map((e) => `CSV parse warning: ${e.message}`));
  }

  if (result.data.length === 0) return { rows: [], warnings };

  const headers = Object.keys(result.data[0]);
  const headerMap = buildHeaderMap(headers);

  const rows: DoorScheduleRow[] = [];
  for (const rawRow of result.data) {
    const row = mapRow(rawRow, headerMap);
    if (row) rows.push(row);
  }

  return { rows, warnings };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface DoorScheduleResult {
  rows: DoorScheduleRow[];
  rowCount: number;
  warnings: string[];
}

export function parseDoorSchedule(buffer: Buffer, filename: string): DoorScheduleResult {
  const ext = filename.split('.').pop()?.toLowerCase();

  let rows: DoorScheduleRow[];
  let warnings: string[];

  if (ext === 'xlsx' || ext === 'xls') {
    ({ rows, warnings } = parseExcel(buffer));
  } else if (ext === 'csv') {
    ({ rows, warnings } = parseCsv(buffer));
  } else {
    throw new Error(`Unsupported file type: .${ext}. Please upload an .xlsx or .csv file.`);
  }

  return { rows, rowCount: rows.length, warnings };
}
