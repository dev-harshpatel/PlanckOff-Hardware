/**
 * Door Schedule PDF extraction service
 *
 * Extracts door schedule rows from a PDF using AI (Gemini via OpenRouter).
 *
 * Tier 1 (primary): Sends raw PDF buffer as base64 inline to Gemini 2.5 Flash.
 *   Model reads the actual PDF layout natively — preserves table structure.
 *   Used when file ≤ 15 MB.
 *
 * Tier 2 (fallback): Server-side pdfjs text extraction + parallel AI batches.
 *   Used when Tier 1 fails or file > 15 MB.
 *   Merges door rows across batches by doorTag (deduplicates, last-write wins).
 *
 * Server-side only. Never import from client components.
 */

import OpenAI from 'openai';
import type { DoorScheduleRow } from '@/lib/db/hardware';
import { extractPdfText, batchPages } from '@/lib/ai/pdfTextExtractor';
import type { DoorScheduleResult } from './doorScheduleService';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MODEL = 'google/gemini-2.5-flash';
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const TIER1_SIZE_LIMIT = 15 * 1024 * 1024;
const TIER2_BATCH_SIZE = 8; // smaller than hardware PDF — door tables are wide
const TIER2_MAX_CONCURRENT = 3;

// ---------------------------------------------------------------------------
// JSON schema — subset of DoorScheduleRow fields most commonly in PDFs
// ---------------------------------------------------------------------------

const RESPONSE_SCHEMA = {
  type: 'object',
  required: ['doors'],
  properties: {
    doors: {
      type: 'array',
      items: {
        type: 'object',
        required: ['doorTag'],
        properties: {
          doorTag:          { type: 'string', description: 'Door identifier, e.g. "101", "A-01", "1001A"' },
          hwSet:            { type: 'string', description: 'Hardware set code, e.g. "AD01a", "SE02", "CA01"' },
          doorLocation:     { type: 'string', description: 'Room name or space the door serves' },
          buildingArea:     { type: 'string', description: 'Building, floor, or area label' },
          interiorExterior: { type: 'string', description: '"INT" or "EXT"' },
          quantity:         { type: 'integer', description: 'Number of identical openings (default 1)' },
          leafCount:        { type: 'string', description: '"SINGLE" or "DOUBLE"' },
          doorWidth:        { type: 'string', description: 'Door width as found in document, e.g. "3\'-0\""' },
          doorHeight:       { type: 'string', description: 'Door height as found in document, e.g. "7\'-0\""' },
          thickness:        { type: 'string', description: 'Door thickness, e.g. "1 3/4\""' },
          fireRating:       { type: 'string', description: 'Fire rating, e.g. "45 MIN.", "60 MIN.", "NONE"' },
          doorType:         { type: 'string', description: 'Door type or elevation code' },
          doorMaterial:     { type: 'string', description: 'Door material, e.g. "HOLLOW METAL", "WOOD", "ALUMINUM"' },
          doorCore:         { type: 'string' },
          doorGauge:        { type: 'string' },
          doorFinish:       { type: 'string' },
          frameMaterial:    { type: 'string', description: 'Frame material, e.g. "HM", "ALUMINUM"' },
          frameType:        { type: 'string' },
          wallType:         { type: 'string' },
          throatThickness:  { type: 'string' },
          frameGauge:       { type: 'string' },
          frameFinish:      { type: 'string' },
          glazingType:      { type: 'string' },
          stcRating:        { type: 'string' },
          doorUndercut:     { type: 'string' },
          handOfOpenings:   { type: 'string' },
          comments:         { type: 'string' },
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a construction document parser specializing in architectural door schedules.

Your job is to extract every door opening from the uploaded door schedule PDF and return them as structured JSON.

RULES:
- Extract ALL door rows — do not skip any.
- doorTag is the door number/mark (e.g. "101", "A-01", "1001", "1001A") — this is REQUIRED.
- hwSet is the hardware set code assigned to the door (e.g. "AD01a", "SE02", "CA01") — extract it exactly as written.
- Extract ALL columns available in the document — dimensions, materials, ratings, etc.
- If a column has no value for a door, omit that field (do not include empty strings).
- Preserve exact values (e.g. fire ratings like "45 MIN.", dimensions like "3'-0\"").
- If the PDF has multiple floors or areas, still extract every door and include the floor/area in buildingArea.
- Return results in the JSON format defined by the response schema.`;

const USER_PROMPT = 'Extract all door openings from this door schedule. Return every door row with all available fields.';

// ---------------------------------------------------------------------------
// OpenRouter client
// ---------------------------------------------------------------------------

function makeClient(apiKey: string): OpenAI {
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      'X-Title': 'PlanckOff Hardware Estimating',
    },
  });
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

function parseResponse(raw: string): { rows: DoorScheduleRow[]; parseWarning?: string } {
  let text = raw.trim();

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  try {
    const parsed = JSON.parse(text) as unknown;

    let rawDoors: unknown[] = [];

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      Array.isArray((parsed as Record<string, unknown>).doors)
    ) {
      rawDoors = (parsed as Record<string, unknown>).doors as unknown[];
    } else if (Array.isArray(parsed)) {
      rawDoors = parsed;
    } else {
      return { rows: [], parseWarning: 'AI response had unexpected structure.' };
    }

    const rows: DoorScheduleRow[] = rawDoors
      .filter((d): d is Record<string, unknown> => typeof d === 'object' && d !== null)
      .map((d) => {
        const row: Partial<DoorScheduleRow> = {};
        // String fields
        const strFields: (keyof DoorScheduleRow)[] = [
          'doorTag', 'hwSet', 'doorLocation', 'buildingArea', 'buildingTag',
          'buildingLocation', 'roomNumber', 'interiorExterior', 'leafCount',
          'handOfOpenings', 'doorOperation', 'doorWidth', 'doorHeight', 'thickness',
          'doorWidthMm', 'doorHeightMm', 'fireRating', 'doorType', 'doorElevationType',
          'doorMaterial', 'doorCore', 'doorFace', 'doorEdge', 'doorGauge', 'doorFinish',
          'stcRating', 'doorUndercut', 'doorIncludeExclude', 'glazingType',
          'wallType', 'throatThickness', 'frameType', 'frameMaterial', 'frameAnchor',
          'baseAnchor', 'numberOfAnchors', 'frameProfile', 'frameElevationType',
          'frameAssembly', 'frameGauge', 'frameFinish', 'prehung', 'frameHead',
          'casing', 'frameIncludeExclude', 'hardwareSet', 'hardwareIncludeExclude',
          'hardwarePrep', 'hardwareOnDoor', 'excludeReason', 'comments',
        ];
        for (const f of strFields) {
          if (d[f] !== undefined && d[f] !== null && d[f] !== '') {
            (row as Record<string, unknown>)[f] = String(d[f]).trim();
          }
        }
        // Number fields
        if (d.quantity !== undefined) {
          const n = Number(d.quantity);
          if (!isNaN(n)) row.quantity = n;
        }
        return row as DoorScheduleRow;
      })
      .filter((r) => r.doorTag && r.doorTag.trim() !== '');

    return { rows };
  } catch {
    return { rows: [], parseWarning: 'AI response was not valid JSON.' };
  }
}

// ---------------------------------------------------------------------------
// Merge door rows from multiple batches — dedup by doorTag (last write wins)
// ---------------------------------------------------------------------------

function mergeBatchRows(batches: DoorScheduleRow[][]): DoorScheduleRow[] {
  const map = new Map<string, DoorScheduleRow>();
  for (const batch of batches) {
    for (const row of batch) {
      map.set(row.doorTag.toLowerCase(), row);
    }
  }
  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// Concurrency helper
// ---------------------------------------------------------------------------

async function runConcurrent<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<Array<T | Error>> {
  const results: Array<T | Error> = new Array(tasks.length);
  let nextIdx = 0;
  async function worker() {
    while (nextIdx < tasks.length) {
      const idx = nextIdx++;
      try { results[idx] = await tasks[idx](); }
      catch (err) { results[idx] = err instanceof Error ? err : new Error(String(err)); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

// ---------------------------------------------------------------------------
// AI call helper
// ---------------------------------------------------------------------------

async function callAI(client: OpenAI, messages: OpenAI.Chat.ChatCompletionMessageParam[]): Promise<string> {
  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.1,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'door_schedule_extraction',
        schema: RESPONSE_SCHEMA,
        strict: false,
      },
    } as Parameters<typeof client.chat.completions.create>[0]['response_format'],
    messages,
  });
  return response.choices[0]?.message?.content ?? '';
}

// ---------------------------------------------------------------------------
// Tier 1 — base64 inline PDF
// ---------------------------------------------------------------------------

async function tier1Extract(
  client: OpenAI,
  buffer: Buffer,
): Promise<{ rows: DoorScheduleRow[]; warnings: string[] }> {
  const warnings: string[] = [];
  const base64Pdf = buffer.toString('base64');

  console.log(`[doorSchedulePdf:t1] Sending full PDF (${(buffer.length / 1024).toFixed(0)} KB base64) to ${MODEL}…`);

  const raw = await callAI(client, [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:application/pdf;base64,${base64Pdf}` } },
        { type: 'text', text: USER_PROMPT },
      ] as OpenAI.Chat.ChatCompletionContentPart[],
    },
  ]);

  console.log(`[doorSchedulePdf:t1] Response received — ${raw.length} chars`);

  const { rows, parseWarning } = parseResponse(raw);
  if (parseWarning) warnings.push(parseWarning);
  return { rows, warnings };
}

// ---------------------------------------------------------------------------
// Tier 2 — server-side text extraction + parallel AI batches
// ---------------------------------------------------------------------------

async function tier2Extract(
  client: OpenAI,
  buffer: Buffer,
  warnings: string[],
): Promise<{ rows: DoorScheduleRow[]; warnings: string[] }> {
  warnings.push('Tier 1 failed or file too large — using Tier 2 text extraction.');

  console.log('[doorSchedulePdf:t2] Starting pdfjs text extraction…');
  const { pages, pageCount } = await extractPdfText(buffer, (cur, total) => {
    if (cur === 1 || cur % 5 === 0 || cur === total) {
      console.log(`[doorSchedulePdf:t2] Extracting text — page ${cur}/${total}`);
    }
  });
  const totalChars = pages.reduce((s, p) => s + p.text.length, 0);

  if (totalChars < 50) {
    throw new Error(
      'Door schedule PDF appears to be a scanned image with no extractable text. ' +
      'Please provide a text-based PDF or an Excel file.',
    );
  }

  const batches = batchPages(pages, TIER2_BATCH_SIZE);
  console.log(`[doorSchedulePdf:t2] Splitting ${pageCount} pages into ${batches.length} batches of ${TIER2_BATCH_SIZE} — model: ${MODEL}`);

  const tasks = batches.map((batch, idx) => async (): Promise<DoorScheduleRow[]> => {
    if (!batch.text.trim()) return [];

    console.log(`[doorSchedulePdf:t2] → Batch ${idx + 1}/${batches.length}: pages ${batch.startPage}–${batch.endPage} — sending to ${MODEL}…`);

    const batchPrompt = `Pages ${batch.startPage}–${batch.endPage} of ${pageCount}:\n\n${batch.text}`;
    const raw = await callAI(client, [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `${USER_PROMPT}\n\n${batchPrompt}` },
    ]);

    console.log(`[doorSchedulePdf:t2] ✓ Batch ${idx + 1}/${batches.length} done (pages ${batch.startPage}–${batch.endPage}) — response length: ${raw.length} chars`);

    const { rows, parseWarning } = parseResponse(raw);
    if (parseWarning) warnings.push(`Batch ${idx + 1}: ${parseWarning}`);
    return rows;
  });

  const results = await runConcurrent(tasks, TIER2_MAX_CONCURRENT);

  const batchRows: DoorScheduleRow[][] = [];
  results.forEach((result, idx) => {
    if (result instanceof Error) {
      warnings.push(`Batch ${idx + 1} (pages ${batches[idx].startPage}–${batches[idx].endPage}): ${result.message}`);
    } else {
      batchRows.push(result);
    }
  });

  return { rows: mergeBatchRows(batchRows), warnings };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract door schedule rows from a PDF buffer using AI.
 *
 * Tier 1: full PDF sent as base64 inline to Gemini (≤ 15 MB).
 * Tier 2: server-side text extraction + parallel batched AI calls (> 15 MB or Tier 1 failure).
 */
export async function extractDoorScheduleFromPdf(
  buffer: Buffer,
  fileName: string,
  projectId: string,
): Promise<DoorScheduleResult> {
  const warnings: string[] = [];

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`PDF too large (${(buffer.length / 1024 / 1024).toFixed(1)} MB). Max is 20 MB.`);
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured on the server.');

  const client = makeClient(apiKey);
  const fileSizeMb = buffer.length / 1024 / 1024;

  console.log(`[doorSchedulePdf] Starting extraction — file="${fileName}" size=${fileSizeMb.toFixed(1)}MB project=${projectId}`);

  let rows: DoorScheduleRow[];
  let tier: 1 | 2 = 1;

  if (buffer.length <= TIER1_SIZE_LIMIT) {
    try {
      const result = await tier1Extract(client, buffer);
      rows = result.rows;
      warnings.push(...result.warnings);
      console.log(`[doorSchedulePdf] Tier 1 extracted ${rows.length} door rows`);
    } catch (err) {
      console.warn(`[doorSchedulePdf] Tier 1 failed: ${err instanceof Error ? err.message : err} — falling back to Tier 2`);
      tier = 2;
      const result = await tier2Extract(client, buffer, warnings);
      rows = result.rows;
    }
  } else {
    tier = 2;
    const result = await tier2Extract(client, buffer, warnings);
    rows = result.rows;
    console.log(`[doorSchedulePdf] Tier 2 extracted ${rows.length} door rows`);
  }

  if (rows.length === 0) {
    warnings.push('No door rows were extracted from the PDF. Verify this is a door schedule document.');
  }

  if (tier === 2) {
    warnings.push('Used fallback text extraction — check results for accuracy.');
  }

  return { rows, rowCount: rows.length, warnings };
}
