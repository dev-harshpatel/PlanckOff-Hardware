/**
 * Matrix / checkbox schedule extraction (Format F).
 *
 * Matrix schedules (door numbers as columns, item names as rows, checkboxes
 * in the grid body) defeat single-shot extraction: the model cannot reliably
 * transpose a dense 20×23 checkbox grid into per-door sets — it collapses
 * into emitting the same item list for every door.
 *
 * Instead, when close-up images of embedded schedule tables exist, we first
 * run a dedicated TRANSCRIPTION call: the model only reads the grid row by
 * row (its natural reading order) into structured output, and the code below
 * performs the row→column transposition deterministically.
 *
 * If the document is not a matrix schedule (isMatrix=false) or the call
 * fails, the normal visual extraction runs unchanged.
 */

import type OpenAI from 'openai';
import type { ExtractedHardwareSet, HardwareItem } from '@/lib/db/hardware';
import { analyzeCheckboxGrid, cropRowStrip } from '@/lib/ai/matrixGridAnalyzer';
import type { MatrixGridAnalysis } from '@/lib/ai/matrixGridAnalyzer';
import { sanitizeText } from '@/lib/db/masterHardware';
import { MATRIX_MODEL } from './config';
import { MATRIX_SCHEMA, VALUE_ROW_SCHEMA } from './schemas';
import { MATRIX_SYSTEM_PROMPT, MATRIX_USER_PROMPT, VALUE_ROW_SYSTEM_PROMPT } from './prompts';
import { callOpenRouterForSets } from './openRouterClient';

interface MatrixTranscription {
  isMatrix: boolean;
  doorNumbers?: unknown[];
  valueRows?: Array<{ label?: unknown; values?: unknown[] }>;
  checkboxRows?: Array<{ label?: unknown; checkedDoors?: unknown[] }>;
  columnNotes?: Array<{ door?: unknown; note?: unknown }>;
  products?: Array<{ label?: unknown; manufacturer?: unknown; description?: unknown; finish?: unknown }>;
}

// Deterministic row→column transposition of the transcribed matrix.
function buildSetsFromMatrix(matrix: MatrixTranscription): ExtractedHardwareSet[] {
  const doors = (Array.isArray(matrix.doorNumbers) ? matrix.doorNumbers : [])
    .map(d => sanitizeText(String(d ?? '')))
    .filter(Boolean);
  if (doors.length === 0) return [];

  // Product legend lookup — exact label first, then label without parenthetical
  const products = Array.isArray(matrix.products) ? matrix.products : [];
  const productByLabel = new Map<string, { manufacturer: string; description: string; finish: string }>();
  for (const p of products) {
    const label = sanitizeText(String(p?.label ?? '')).toUpperCase();
    if (!label) continue;
    productByLabel.set(label, {
      manufacturer: sanitizeText(String(p?.manufacturer ?? '')),
      description: sanitizeText(String(p?.description ?? '')),
      finish: sanitizeText(String(p?.finish ?? '')),
    });
  }
  const lookupProduct = (itemLabel: string) => {
    const key = itemLabel.toUpperCase();
    return (
      productByLabel.get(key) ??
      productByLabel.get(key.replace(/\s*\(.*\)\s*$/, '').trim()) ??
      { manufacturer: '', description: '', finish: '' }
    );
  };

  const itemsByDoor = new Map<string, HardwareItem[]>(doors.map(d => [d.toLowerCase(), []]));
  const resolveDoor = (raw: unknown): string | undefined => {
    const key = sanitizeText(String(raw ?? '')).toLowerCase();
    return itemsByDoor.has(key) ? key : undefined;
  };

  // Value rows (e.g. LOCKSET codes) — values aligned by index to doorNumbers
  for (const row of Array.isArray(matrix.valueRows) ? matrix.valueRows : []) {
    const label = sanitizeText(String(row?.label ?? ''));
    if (!label) continue;
    const values = Array.isArray(row.values) ? row.values : [];
    doors.forEach((door, idx) => {
      const value = sanitizeText(String(values[idx] ?? ''));
      if (!value || value === '-' || value === '—') return;
      const itemLabel = `${label} (${value})`;
      const product = lookupProduct(itemLabel);
      itemsByDoor.get(door.toLowerCase())!.push({ qty: 1, item: itemLabel, ...product });
    });
  }

  // Checkbox rows — a row's item goes to every door listed as checked
  for (const row of Array.isArray(matrix.checkboxRows) ? matrix.checkboxRows : []) {
    const label = sanitizeText(String(row?.label ?? ''));
    if (!label) continue;
    const product = lookupProduct(label);
    for (const rawDoor of Array.isArray(row.checkedDoors) ? row.checkedDoors : []) {
      const door = resolveDoor(rawDoor);
      if (!door) continue; // door not in header list — drop rather than invent a set
      itemsByDoor.get(door)!.push({ qty: 1, item: label, ...product });
    }
  }

  // Column notes (e.g. "EXISTING - PROVIDE NEW LOCK SET ONLY")
  const noteByDoor = new Map<string, string>();
  for (const cn of Array.isArray(matrix.columnNotes) ? matrix.columnNotes : []) {
    const door = resolveDoor(cn?.door);
    const note = sanitizeText(String(cn?.note ?? ''));
    if (door && note) noteByDoor.set(door, note);
  }

  return doors.map(door => ({
    setName: door,
    notes: noteByDoor.get(door.toLowerCase()) ?? '',
    hardwareItems: itemsByDoor.get(door.toLowerCase()) ?? [],
  }));
}

/**
 * Replace the AI's checkbox readings with the deterministic pixel-derived
 * ones when the grid analysis aligns with the transcription. Vision models
 * lose column alignment across 20+ door columns and start inferring patterns
 * instead of reading them — the pixel analysis has no such failure mode.
 *
 * Only checkbox STATES are overridden; door numbers, row labels, lockset
 * codes and the product legend stay as transcribed (they need OCR). When the
 * row/column counts do not line up, the AI transcription is kept as-is.
 */
function reconcileMatrixWithGrid(matrix: MatrixTranscription, grid: MatrixGridAnalysis): boolean {
  const doors = (Array.isArray(matrix.doorNumbers) ? matrix.doorNumbers : [])
    .map(d => sanitizeText(String(d ?? '')))
    .filter(Boolean);
  if (grid.doorColumnCount !== doors.length) {
    console.warn(`[hardwarePdf:matrix] Grid analysis found ${grid.doorColumnCount} door columns but AI transcribed ${doors.length} — keeping AI checkbox readings.`);
    return false;
  }

  const gridCheckboxRows = grid.rows.filter(r => r.type === 'checkbox');
  const aiCheckboxRows = Array.isArray(matrix.checkboxRows) ? matrix.checkboxRows : [];
  if (gridCheckboxRows.length !== aiCheckboxRows.length) {
    console.warn(`[hardwarePdf:matrix] Grid analysis found ${gridCheckboxRows.length} checkbox rows but AI transcribed ${aiCheckboxRows.length} — keeping AI checkbox readings.`);
    return false;
  }

  // Both lists are in top-to-bottom document order — align by index.
  aiCheckboxRows.forEach((row, i) => {
    row.checkedDoors = doors.filter((_, j) => gridCheckboxRows[i].cells[j] === 'checked');
  });
  console.log(`[hardwarePdf:matrix] Checkbox states verified against pixel grid analysis (${gridCheckboxRows.length} rows × ${doors.length} doors).`);
  return true;
}

/**
 * Re-read each value row (e.g. LOCKSET codes) from a cropped strip: the
 * door-number header band stacked over just that row. The full-grid
 * transcription tends to shift these values by a column; a single row paired
 * directly with its headers is a reliable local read. Overrides the
 * transcribed values only when the strip read covers the door list.
 */
async function rereadValueRowsFromStrips(
  client: OpenAI,
  matrix: MatrixTranscription,
  grid: MatrixGridAnalysis,
  closeupImage: string,
  signal?: AbortSignal,
): Promise<void> {
  const aiValueRows = Array.isArray(matrix.valueRows) ? matrix.valueRows : [];
  if (aiValueRows.length === 0) return;

  const gridValueRowIndexes = grid.rows
    .map((r, i) => (r.type === 'value' ? i : -1))
    .filter(i => i >= 0);
  if (gridValueRowIndexes.length !== aiValueRows.length) {
    console.warn(`[hardwarePdf:matrix] Grid analysis found ${gridValueRowIndexes.length} value rows but AI transcribed ${aiValueRows.length} — keeping AI value readings.`);
    return;
  }

  const doors = (Array.isArray(matrix.doorNumbers) ? matrix.doorNumbers : [])
    .map(d => sanitizeText(String(d ?? '')))
    .filter(Boolean);

  for (let i = 0; i < aiValueRows.length; i++) {
    try {
      const strip = await cropRowStrip(closeupImage, grid.geometry, gridValueRowIndexes[i]);
      const raw = await callOpenRouterForSets(
        client,
        [
          { role: 'system', content: VALUE_ROW_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'image_url' as const, image_url: { url: `data:image/png;base64,${strip}` } },
              { type: 'text', text: 'Transcribe the value under each door number — one entry per column, left to right.' },
            ],
          },
        ],
        signal,
        VALUE_ROW_SCHEMA,
        'value_row_transcription',
        MATRIX_MODEL,
      );

      let text = raw.trim();
      const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fence) text = fence[1].trim();
      const parsed = JSON.parse(text) as { values?: Array<{ door?: unknown; value?: unknown }> };
      const pairs = Array.isArray(parsed.values) ? parsed.values : [];

      const valueByDoor = new Map<string, string>();
      for (const p of pairs) {
        const door = sanitizeText(String(p?.door ?? '')).toLowerCase();
        if (door) valueByDoor.set(door, sanitizeText(String(p?.value ?? '')));
      }

      // Only trust the strip read when it actually covers the door list
      const matched = doors.filter(d => valueByDoor.has(d.toLowerCase())).length;
      if (matched < doors.length * 0.8) {
        console.warn(`[hardwarePdf:matrix] Value-row strip read matched only ${matched}/${doors.length} doors — keeping AI values for row "${aiValueRows[i].label}".`);
        continue;
      }

      aiValueRows[i].values = doors.map(d => valueByDoor.get(d.toLowerCase()) ?? '');
      console.log(`[hardwarePdf:matrix] Value row "${aiValueRows[i].label}" re-read from header-aligned strip (${matched}/${doors.length} doors).`);
    } catch (stripErr) {
      if (stripErr instanceof Error && stripErr.name === 'AbortError') throw stripErr;
      console.warn(`[hardwarePdf:matrix] Value-row strip re-read failed for row ${i} — keeping AI values:`, stripErr);
    }
  }
}

/**
 * Attempt the dedicated matrix transcription call against the close-up
 * images. Returns null when the document is not a matrix schedule, when the
 * transcription is unusable, or when the call fails — callers then proceed
 * with the normal visual extraction.
 */
export async function tryMatrixExtraction(
  client: OpenAI,
  closeupImages: string[],
  signal?: AbortSignal,
): Promise<{ raw: string; sets: ExtractedHardwareSet[] } | null> {
  console.log(`[hardwarePdf:matrix] Checking ${closeupImages.length} close-up(s) for matrix/checkbox schedule with ${MATRIX_MODEL}…`);

  const raw = await callOpenRouterForSets(
    client,
    [
      { role: 'system', content: MATRIX_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          ...closeupImages.map(b64 => ({
            type: 'image_url' as const,
            image_url: { url: `data:image/png;base64,${b64}` },
          })),
          { type: 'text', text: MATRIX_USER_PROMPT },
        ],
      },
    ],
    signal,
    MATRIX_SCHEMA,
    'matrix_transcription',
    MATRIX_MODEL,
  );

  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  let matrix: MatrixTranscription;
  try {
    matrix = JSON.parse(text) as MatrixTranscription;
  } catch (e) {
    console.warn(`[hardwarePdf:matrix] Response was not valid JSON (${e instanceof Error ? e.message : e}) — falling back to normal visual extraction.`);
    return null;
  }

  if (!matrix || matrix.isMatrix !== true) {
    console.log('[hardwarePdf:matrix] Not a matrix schedule — proceeding with normal visual extraction.');
    return null;
  }

  // Deterministic verification: read the checkbox states straight from the
  // pixels of whichever close-up contains the grid, and use those instead of
  // the AI's readings when the grid aligns with the transcription.
  let matchedGrid: MatrixGridAnalysis | null = null;
  let matchedCloseup: string | null = null;
  for (const closeup of closeupImages) {
    let grid: MatrixGridAnalysis | null = null;
    try {
      grid = await analyzeCheckboxGrid(closeup);
    } catch (gridErr) {
      console.warn('[hardwarePdf:matrix] Grid analysis failed on a close-up (continuing):', gridErr);
    }
    if (grid && reconcileMatrixWithGrid(matrix, grid)) {
      matchedGrid = grid;
      matchedCloseup = closeup;
      break;
    }
  }

  // Re-read value rows (e.g. LOCKSET codes) from header-aligned strips — the
  // full-grid transcription tends to shift these by a column.
  if (matchedGrid && matchedCloseup) {
    await rereadValueRowsFromStrips(client, matrix, matchedGrid, matchedCloseup, signal);
  }

  const sets = buildSetsFromMatrix(matrix);
  const itemCount = sets.reduce((sum, s) => sum + s.hardwareItems.length, 0);
  if (sets.length === 0 || itemCount === 0) {
    console.warn('[hardwarePdf:matrix] Matrix transcription produced no usable sets — falling back to normal visual extraction.');
    return null;
  }

  console.log(`[hardwarePdf:matrix] Matrix transcription OK — ${sets.length} door sets, ${itemCount} items.`);
  return { raw, sets };
}
