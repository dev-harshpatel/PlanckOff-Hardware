/**
 * Server-side door schedule parsing service.
 * Parses Excel (.xlsx) and CSV files into a canonical JSON shape.
 * Never import from client components.
 */

import * as XLSX from 'xlsx';
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
  // HW Set (the join key)
  'hw set': 'hwSet', 'hwset': 'hwSet', 'hw#': 'hwSet',
  'hardware set #': 'hwSet', 'set#': 'hwSet', 'set #': 'hwSet',
  // Building area
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
  // Wall type
  'wall type': 'wallType', 'walltype': 'wallType',
  // Throat thickness
  'throat thickness': 'throatThickness', 'throat': 'throatThickness',
  // Exclude reason
  'exclude reason': 'excludeReason',
  // Fire rating
  'fire rating': 'fireRating', 'firerating': 'fireRating', 'fr': 'fireRating',
  // Leaf count
  'leaf count': 'leafCount', 'leafcount': 'leafCount', 'leaves': 'leafCount',
  // Door type (elevation code)
  'door type': 'doorType', 'type': 'doorType', 'elevation': 'doorType',
  // Dimensions
  'door width': 'doorWidth', 'width': 'doorWidth',
  'door height': 'doorHeight', 'height': 'doorHeight',
  'thickness': 'thickness',
  'door width (mm)': 'doorWidthMm', 'width (mm)': 'doorWidthMm',
  'door height (mm)': 'doorHeightMm', 'height (mm)': 'doorHeightMm',
  // Materials
  'door material': 'doorMaterial', 'door mat': 'doorMaterial',
  'door finish': 'doorFinish',
  'glazing type': 'glazingType', 'glazing': 'glazingType',
  'frame type': 'frameType',
  'frame material': 'frameMaterial', 'frame mat': 'frameMaterial',
  'frame finish': 'frameFinish',
  // Hardware
  'hardware set': 'hardwareSet', // human label (e.g. "STOREROOM LOCKSET")
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

const BOOLEAN_FIELDS = new Set<keyof DoorScheduleRow>([
  'hasCardReader', 'hasKeyPad', 'hasAutoOperator', 'hasPrivacySet',
  'hasKeyedLock', 'hasPushPlate', 'hasAntiBarricade', 'hasKickPlate',
  'hasFrameProtection', 'hasDoorCloser',
]);

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

function coerceBoolean(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  const s = String(val ?? '').trim().toLowerCase();
  return s === 'y' || s === 'yes' || s === 'true' || s === '1';
}

function coerceString(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function coerceNumber(val: unknown): number | undefined {
  const n = Number(val);
  return isNaN(n) ? undefined : n;
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function mapRow(rawRow: Record<string, unknown>, headerMap: Map<string, keyof DoorScheduleRow>): DoorScheduleRow | null {
  const row: Partial<DoorScheduleRow> = {};

  for (const [rawHeader, fieldName] of headerMap.entries()) {
    const val = rawRow[rawHeader];
    if (val === undefined || val === null || val === '') continue;

    if (BOOLEAN_FIELDS.has(fieldName)) {
      (row as Record<string, unknown>)[fieldName] = coerceBoolean(val);
    } else if (fieldName === 'quantity') {
      row.quantity = coerceNumber(val);
    } else {
      (row as Record<string, unknown>)[fieldName] = coerceString(val);
    }
  }

  // doorTag is mandatory — always coerce to string (Excel stores it as number)
  if (row.doorTag !== undefined) {
    row.doorTag = coerceString(row.doorTag);
  }

  // Skip rows with no door tag
  if (!row.doorTag) return null;

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
 * Checked against the first non-empty row of each sheet.
 */
const DOOR_SHEET_SIGNALS = new Set([
  'door tag', 'doortag', 'door#', 'door no', 'door no.', 'tag', 'mark',
  'dr. #', 'dr #',
  'hw set', 'hwset', 'hw#', 'hardware set #', 'set#', 'set #',
]);

/** Return the header cells from the first non-empty row of a worksheet. */
function getSheetHeaders(ws: XLSX.WorkSheet): string[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
  for (const row of rows) {
    const cells = (row as unknown[]).map((c) => String(c ?? '').trim());
    if (cells.some((c) => c !== '')) return cells;
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

function parseExcel(buffer: Buffer): { rows: DoorScheduleRow[]; warnings: string[] } {
  const warnings: string[] = [];
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  if (workbook.SheetNames.length === 0) throw new Error('Excel file contains no sheets.');

  const { targetSheet, skipped, confident } = selectTargetSheet(workbook);

  // Only warn about skipped sheets when we weren't confident (uncertain fallback)
  if (!confident && skipped.length > 0) {
    warnings.push(`Could not auto-detect door schedule sheet — used "${targetSheet}". Skipped: ${skipped.join(', ')}`);
  }

  const ws = workbook.Sheets[targetSheet];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: '',
    raw: false, // coerce all values to strings first; we coerce ourselves
  });

  if (rawRows.length === 0) return { rows: [], warnings };

  const headers = Object.keys(rawRows[0]);
  const headerMap = buildHeaderMap(headers);

  const rows: DoorScheduleRow[] = [];
  for (const rawRow of rawRows) {
    const row = mapRow(rawRow, headerMap);
    if (row) rows.push(row);
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
