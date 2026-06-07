/**
 * Hardware PDF extraction service — V2
 *
 * Tier 1 (primary): Sends raw PDF buffer to OpenRouter (Gemini 2.5 Flash) as
 * base64-encoded inline file. Model reads the actual PDF layout natively.
 *
 * Tier 2 (fallback): If Tier 1 fails or file exceeds 15 MB, extracts text
 * server-side with pdfjs (position-aware row reconstruction), then sends
 * batches to OpenRouter in PARALLEL with json_schema structured output.
 *
 * Server-side only. Never import from client components.
 *
 * Debug output (DEV only):
 *   debug-extractions/{projectId}_{timestamp}_raw.txt     ← Tier 1 raw response
 *   debug-extractions/{projectId}_{timestamp}_parsed.json ← normalized sets
 *   debug-extractions/{projectId}_{timestamp}_meta.json   ← run metadata
 *   debug-extractions/{projectId}_{timestamp}_t2_batch_N.txt ← Tier 2 batch raws
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import type { ExtractedHardwareSet, HardwareItem } from '@/lib/db/hardware';
import { extractPdfText, batchPages, renderPdfToImages } from '@/lib/ai/pdfTextExtractor';
import { sanitizeText } from '@/lib/db/masterHardware';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MODEL = 'google/gemini-2.5-flash';
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;   // 20 MB hard cap
const TIER1_SIZE_LIMIT = 15 * 1024 * 1024;       // 15 MB — above this, skip Tier 1
const TIER2_BATCH_SIZE = 10;                      // pages per AI batch in Tier 2
const TIER2_MAX_CONCURRENT = 4;                   // parallel AI calls in Tier 2

// ---------------------------------------------------------------------------
// JSON schema for structured output
//
// Wrapped in an object (not top-level array) because OpenAI-format json_schema
// response_format requires the root to be an object.
// We access response.sets after parsing.
// Kept flat — no $ref, no anyOf — for Gemini via OpenRouter compatibility.
// ---------------------------------------------------------------------------

const RESPONSE_SCHEMA = {
  type: 'object',
  required: ['sets'],
  properties: {
    sets: {
      type: 'array',
      items: {
        type: 'object',
        required: ['setName', 'hardwareItems'],
        properties: {
          setName: {
            type: 'string',
            description: 'Hardware set identifier. Named codes: "AD01b", "SE02a.W", "CA01". Simple numbers: "1", "2", "3". NEVER include column header text — output only the identifier value, never "SET DOOR TYPE 1" or "SET 1", just "1".',
          },
          hardwareItems: {
            type: 'array',
            items: {
              type: 'object',
              required: ['qty', 'item', 'manufacturer', 'description', 'finish'],
              properties: {
                qty:          { type: 'integer' },
                item:         { type: 'string' },
                manufacturer: { type: 'string' },
                description:  { type: 'string' },
                finish:       { type: 'string' },
              },
            },
          },
          notes: {
            type: 'string',
            description: 'Any notes or special instructions for this hardware set',
          },
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a construction document parser specializing in Division 08 door hardware schedules.

⚠️ ABSOLUTE RULE — READ BEFORE ANYTHING ELSE:
You are a TRANSCRIPTION tool, not a knowledge tool. Your ONLY job is to copy what is printed in the document into JSON. You must NEVER substitute, infer, or replace any hardware item with what you think "should" be there based on the door type. Hardware schedules routinely specify unexpected combinations — a RESTROOM door may have PUSH/PULL + CLOSER instead of a privacy lockset; a STORAGE door may have a passage latch instead of a keyed lock. Whatever is printed is correct. If PUSH/PULL is printed, output PUSH/PULL. If CLOSER is printed, output CLOSER. Do NOT replace them with PRIVACY LOCKSET LEVER or any other item. This is a zero-tolerance rule — any substitution is a critical error.

Your job is to extract every hardware set (hardware group) from the uploaded PDF and return them as structured JSON.

MULTI-COLUMN TABLES — hardware schedules often print two or more complete, independent hardware set tables side by side on the same page:
  - Each column table has its OWN "SET" column on its left edge with its own set numbers.
  - The left table and the right table are COMPLETELY INDEPENDENT — they share no content.
  - The SET number for a set comes ONLY from the "SET" cell in that set's own table column — NEVER from the other column's SET cells.
  - Even when a left-column set and a right-column set appear at the same vertical height on the page, they are SEPARATE sets. Do NOT pair a SET number from one table with content from the other table.
  - Read the ENTIRE left-column table top-to-bottom first, extracting all its sets. Only after fully completing the left table do you start reading the right-column table.
  - Do NOT mix items from one column's set into another column's set.
  - Treat each column table as if it were a completely separate document that happens to appear side by side on the same page.

DOCUMENT FORMATS — this document may follow one of several formats:

Format A — named set codes (e.g. "AD01b", "SE02a.W", "CA01", "WE01a"):
  - setName = the code exactly as written

Format B — numbered hardware groups (e.g. "Hardware Group No. 001", "HARDWARE GROUP 5"):
  - setName = the group number as a zero-padded string, e.g. "001", "002", "135"
  - These groups typically start with "For use on Door #(s):" listing the doors — skip that line, it is not a hardware item

Format C — table with SET and DOOR TYPE columns (common in simple hardware schedules):
  - Document has a table where the left column is labeled "SET" and the next column is "DOOR TYPE"
  - Each row (or merged-cell block) in the SET column holds the hardware set identifier: a simple integer like 1, 2, 3, …
  - setName = the integer from the SET column ONLY — e.g. "1", "2", "3"
  - CRITICAL: do NOT include column header text in the setName. Never output "SET 1", "SET DOOR TYPE 1", or any variation — output only the raw value from the SET column, i.e. "1"
  - The DOOR TYPE column contains a description (e.g. "LOBBY EXTERIOR DOOR") — put it in the notes field, not in setName

Format D — per-door hardware schedule (e.g. "Door No. P200 – Elevator Lobby", "Door No. 101 – Main Entry"):
  - Each door entry is its own hardware set. The door number is the set identifier.
  - setName = the door number/code exactly as written (e.g. "P200", "101", "A-05")
  - The header line "Door No. X – Location" marks the start of a new set. Put the location in the notes field.
  - SKIP the lines immediately following the header that describe the door opening itself: door size (e.g. "3'-0" x 7'-0" x 1 3/4""), door material (e.g. "Hollow Core Metal"), frame type (e.g. "Welded Pressed Steel Frame"), and fire rating (e.g. "Fire rated 45 min"). These are NOT hardware items.
  - All remaining lines until the next "Door No." header are hardware items — extract them all.

Format E — merged-cell set table (simple hardware schedule, often on architectural drawing sheets):
  - A table where a set number (e.g. "2") appears in a large merged cell spanning multiple rows on the LEFT side
  - A door type label (e.g. "RESTROOM INTERIOR DOOR", "EXTERIOR ENTRY") spans the top row as a header
  - Below the header: columns labeled QUANTITY (or QTY) and DESCRIPTION — there may be NO manufacturer, catalog, or finish columns
  - Each subsequent row is one hardware item with a quantity and description
  - setName = the number in the merged cell on the left (e.g. "2")
  - notes = the door type label from the header row (e.g. "RESTROOM INTERIOR DOOR")
  - Extract EVERY row in the item list — PUSH / PULL, CLOSER, WALL STOP, HINGES, etc. are all valid items
  - IMPORTANT: the quantity "1" may be printed as the letter "I" in some architectural fonts — treat "I" in the quantity column as the integer 1

COLUMNS — the hardware item table may use different column headers:
  - QTY or Qty → qty (integer, default 1 if blank)
  - DESCRIPTION or Item → item (hardware category name, e.g. "HINGE", "MORTISE LOCK", "SURFACE CLOSER")
  - CATALOG NUMBER, Part No., or Model → description (exact catalog/part number string)
  - MFR or Manufacturer → manufacturer (abbreviation or full name, e.g. "IVE", "SCH", "LCN", "VON")
  - FINISH or Finish Code → finish (exact code, e.g. "626", "630", "652", "US26D")

RULES:
- Extract ALL hardware sets/groups — do not skip any.
- qty must be an integer. Use 1 if not stated. The letter "I" in a quantity cell means 1.
- Preserve catalog numbers and finish codes exactly as written.
- If a note or special instruction applies to a set, put it in the notes field.
- Items marked "By Others" — include them, set description to "By Others".
- Skip any door-index or door-to-set mapping tables at the start of the document — only extract the set/group definitions.
- Return results in the JSON format defined by the response schema.
- When a [CONTEXT] block appears at the top of the text: those pages were already processed. Use them only to identify which set was being listed when that section ended — then continue extracting items for that set from the pages that follow [END CONTEXT]. Do NOT emit set entries for items that appear exclusively inside the [CONTEXT] block.
- CRITICAL — never drop items: every row in the hardware table is a separate item. PUSH / PULL, CLOSER, WALL STOP, KICK PLATE, DOOR STOP are all valid standalone items — extract every one of them.
- CRITICAL — never substitute items: if the printed description is "PUSH / PULL", output item="PUSH / PULL" exactly. Never replace it with LOCKSET, PRIVACY SET, STORAGE LOCKSET LEVER, or any other item. If the printed text says "CLOSER", output item="CLOSER" — do not drop it or merge it with another row. Substitution is a critical error regardless of what door type the set is for.`;

const USER_PROMPT = `Extract all hardware sets from this document.

STEP 1 — before writing any JSON, count every visible row in every set's item table. Include ALL rows: hinges, push/pull, closer, wall stop, threshold, weatherstripping, transition strip — every single row.

STEP 2 — output the JSON. Every row counted in Step 1 must appear as a hardwareItem. If you counted 4 rows for a set, the hardwareItems array must have 4 entries.

⚠️ FINAL REMINDER — these substitutions are FORBIDDEN regardless of door type:
• "PUSH / PULL" must NEVER become "LOCKSET", "STORAGE LOCKSET LEVER", "PRIVACY SET", or anything else. A restroom door with PUSH/PULL bars is normal and correct.
• "CLOSER" must NEVER be dropped or merged with another item.
• "ENTRY LOCKSET SET" is NOT the same as "ENTRY LOCKSET LEVER" — transcribe whichever exact words are printed.
• "TRANSITION STRIP" must NEVER become "WALL STOP".
• "OFFICE LOCKSET LEVER" must NEVER become "KEYED LOCK".
If the door type label suggests one thing but the printed items say another — trust the printed items, always.`;

// ---------------------------------------------------------------------------
// Debug file writer (DEV only)
// ---------------------------------------------------------------------------

function saveDebugFiles(
  projectId: string,
  fileName: string,
  rawResponse: string,
  parsed: ExtractedHardwareSet[],
  meta: Record<string, unknown>,
): void {
  if (process.env.NODE_ENV !== 'development') return;

  try {
    const debugDir = path.join(process.cwd(), 'debug-extractions', 'pdf-extraction');
    fs.mkdirSync(debugDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeProjectId = projectId.slice(0, 8);
    const prefix = `${safeProjectId}_${timestamp}`;

    fs.writeFileSync(path.join(debugDir, `${prefix}_raw.txt`), rawResponse, 'utf-8');
    fs.writeFileSync(path.join(debugDir, `${prefix}_parsed.json`), JSON.stringify(parsed, null, 2), 'utf-8');
    fs.writeFileSync(path.join(debugDir, `${prefix}_meta.json`), JSON.stringify({ fileName, model: MODEL, ...meta }, null, 2), 'utf-8');

    console.log(`[hardwarePdfServiceV2] Debug files → debug-extractions/pdf-extraction/${prefix}_*`);
  } catch (err) {
    // Never crash the main flow because of debug output
    console.warn('[hardwarePdfServiceV2] Could not write debug files:', err);
  }
}

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

function normalizeItem(raw: unknown): HardwareItem {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    qty: typeof r.qty === 'number' ? Math.round(r.qty) : parseInt(String(r.qty ?? '1'), 10) || 1,
    item: sanitizeText(String(r.item ?? '')),
    manufacturer: sanitizeText(String(r.manufacturer ?? '')),
    description: sanitizeText(String(r.description ?? '')),
    finish: sanitizeText(String(r.finish ?? '')),
  };
}

function normalizeSet(raw: Record<string, unknown>): ExtractedHardwareSet {
  let setName = String(raw.setName ?? '').trim();
  // Strip column-header prefixes the AI may include when reading "SET | DOOR TYPE" tables.
  // e.g. "SET DOOR TYPE 1" → "1", "SET 2" → "2"
  setName = setName.replace(/^SET\s+DOOR\s+TYPE\s+/i, '').replace(/^SET\s+/i, '').trim();
  return {
    setName,
    notes: String(raw.notes ?? '').trim(),
    hardwareItems: Array.isArray(raw.hardwareItems)
      ? raw.hardwareItems.map(normalizeItem)
      : [],
  };
}

function isValidSet(item: unknown): item is Record<string, unknown> {
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof (item as Record<string, unknown>).setName === 'string' &&
    String((item as Record<string, unknown>).setName).trim() !== ''
  );
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

function parseResponse(raw: string, label = ''): { sets: ExtractedHardwareSet[]; parseWarning?: string } {
  let text = raw.trim();
  const prefix = label ? `[hardwarePdf:parse${label}]` : '[hardwarePdf:parse]';

  console.log(`${prefix} raw length=${raw.length} chars, first 200: ${raw.slice(0, 200).replace(/\n/g, '\\n')}`);

  // Strip markdown fences if model ignored the json_schema instruction
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    console.log(`${prefix} stripped markdown fence`);
    text = fenceMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(text) as unknown;

    // Unwrap { sets: [...] } envelope (expected shape)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      Array.isArray((parsed as Record<string, unknown>).sets)
    ) {
      const sets = ((parsed as Record<string, unknown>).sets as unknown[])
        .filter(isValidSet)
        .map(normalizeSet);
      console.log(`${prefix} parsed OK — ${sets.length} sets`);
      return { sets };
    }

    // Fallback: model returned a bare array
    if (Array.isArray(parsed)) {
      const sets = (parsed as unknown[]).filter(isValidSet).map(normalizeSet);
      console.log(`${prefix} bare array fallback — ${sets.length} sets`);
      return { sets, parseWarning: 'Model returned bare array instead of { sets: [] } — still parsed.' };
    }

    console.warn(`${prefix} unexpected structure — keys: ${Object.keys(parsed as object).join(', ')}`);
    return { sets: [], parseWarning: 'AI response was valid JSON but had unexpected structure.' };
  } catch (e) {
    console.error(`${prefix} JSON.parse failed: ${e instanceof Error ? e.message : e}. First 500 chars: ${text.slice(0, 500)}`);
    return { sets: [], parseWarning: 'AI response was not valid JSON. No sets extracted.' };
  }
}

// ---------------------------------------------------------------------------
// Public result type
// ---------------------------------------------------------------------------

export interface HardwarePdfResult {
  sets: ExtractedHardwareSet[];
  setCount: number;
  itemCount: number;
  warnings: string[];
  durationMs: number;
  tier: 1 | 2; // which extraction path was used
}

// ---------------------------------------------------------------------------
// OpenRouter client factory (shared between tiers)
// ---------------------------------------------------------------------------

function makeOpenRouterClient(apiKey: string): OpenAI {
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
// Shared AI call helper (used by both tiers)
// ---------------------------------------------------------------------------

async function callOpenRouterForSets(
  client: OpenAI,
  messages: Parameters<OpenAI['chat']['completions']['create']>[0]['messages'],
  signal?: AbortSignal,
): Promise<string> {
  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'hardware_extraction',
        schema: RESPONSE_SCHEMA,
        strict: false,
      },
    } as Parameters<typeof client.chat.completions.create>[0]['response_format'],
    messages,
  }, { signal });
  return response.choices[0]?.message?.content ?? '';
}

// ---------------------------------------------------------------------------
// Tier 2 helpers
// ---------------------------------------------------------------------------

// Merge sets from multiple batches by setName — handles sets that span pages
function mergeBatchSets(allBatchSets: ExtractedHardwareSet[][]): ExtractedHardwareSet[] {
  const setMap = new Map<string, ExtractedHardwareSet>();

  for (const batch of allBatchSets) {
    for (const set of batch) {
      const key = set.setName.toLowerCase();
      const existing = setMap.get(key);
      if (existing) {
        existing.hardwareItems.push(...set.hardwareItems);
        if (set.notes && !existing.notes) existing.notes = set.notes;
      } else {
        setMap.set(key, { ...set, hardwareItems: [...set.hardwareItems] });
      }
    }
  }

  return Array.from(setMap.values());
}

// Run up to `concurrency` promises at a time
async function runConcurrent<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<Array<T | Error>> {
  const results: Array<T | Error> = new Array(tasks.length);
  let nextIdx = 0;

  async function worker() {
    while (nextIdx < tasks.length) {
      const idx = nextIdx++;
      try {
        results[idx] = await tasks[idx]();
      } catch (err) {
        // Propagate abort so the caller knows processing was cancelled
        if (err instanceof Error && err.name === 'AbortError') throw err;
        results[idx] = err instanceof Error ? err : new Error(String(err));
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

// ---------------------------------------------------------------------------
// Tier 1 — base64 inline PDF
// ---------------------------------------------------------------------------

async function tier1Extract(
  client: OpenAI,
  buffer: Buffer,
  signal?: AbortSignal,
): Promise<{ raw: string; sets: ExtractedHardwareSet[]; warnings: string[] }> {
  const warnings: string[] = [];

  // Render PDF pages to PNG images using pdfjs's glyph renderer.
  // This bypasses broken font ToUnicode mappings entirely — the model receives
  // the exact same visual output a user sees in a PDF viewer, so garbled font
  // encoding cannot affect what the model reads or hallucinates about.
  console.log(`[hardwarePdf:visual] Rendering PDF pages to images…`);
  const pageImages = await renderPdfToImages(buffer);
  console.log(`[hardwarePdf:visual] Rendered ${pageImages.length} page(s) — sending to ${MODEL}…`);

  const imageContent = pageImages.map(b64 => ({
    type: 'image_url' as const,
    image_url: { url: `data:image/png;base64,${b64}` },
  }));

  const raw = await callOpenRouterForSets(client, [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        ...imageContent,
        { type: 'text', text: USER_PROMPT },
      ],
    },
  ], signal);

  console.log(`[hardwarePdf:visual] Response received — ${raw.length} chars`);

  const { sets, parseWarning } = parseResponse(raw, ':visual');
  if (parseWarning) warnings.push(parseWarning);

  return { raw, sets, warnings };
}

// ---------------------------------------------------------------------------
// Tier 2 — server-side text extraction + parallel AI batches
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Garbled-text detector
// ---------------------------------------------------------------------------

/**
 * Returns true if the extracted text looks like a real hardware schedule.
 * Requires at least 2 hardware-specific words to match — prevents false
 * positives from architectural drawings that happen to contain "DOOR" or
 * "SET" as part of garbled general notes.
 */
function isTextReadable(pages: Array<{ text: string }>): boolean {
  const combined = pages.map(p => p.text).join(' ').toUpperCase();
  if (combined.trim().length < 100) return false;
  // These words only appear in hardware schedules, not in garbled
  // architectural drawing notes (glazing, storefront, window types, etc.)
  const indicators = [
    'HINGE', 'LOCKSET', 'LOCK SET', 'CLOSER', 'DEADBOLT',
    'WEATHERSTRIP', 'KICK PLATE', 'DOOR STOP', 'WALL STOP',
    'PUSH/PULL', 'PUSH / PULL', 'HARDWARE SET', 'HARDWARE GROUP',
    'QUANTITY', 'MANUFACTURER', 'CATALOG',
  ];
  const matchCount = indicators.filter(word => combined.includes(word)).length;
  return matchCount >= 2;
}

async function tier2Extract(
  client: OpenAI,
  buffer: Buffer,
  projectId: string,
  warnings: string[],
  signal?: AbortSignal,
): Promise<{ sets: ExtractedHardwareSet[]; textReadable: boolean; warnings: string[] }> {
  console.log('[hardwarePdf:t2] Starting pdfjs text extraction…');

  // Extract text server-side with position-aware row reconstruction
  console.log('[hardwarePdf:t2] Starting pdfjs text extraction…');
  const { pages, pageCount } = await extractPdfText(buffer, (cur, total) => {
    if (cur === 1 || cur % 5 === 0 || cur === total) {
      console.log(`[hardwarePdf:t2] Extracting text — page ${cur}/${total}`);
    }
  });
  const totalTextChars = pages.reduce((sum, p) => sum + p.text.length, 0);

  if (totalTextChars < 100) {
    return { sets: [], textReadable: false, warnings };
  }

  const textReadable = isTextReadable(pages);
  if (!textReadable) {
    console.warn('[hardwarePdf:t2] Extracted text appears garbled (broken font encoding) — skipping AI batches.');
    return { sets: [], textReadable: false, warnings };
  }

  const batches = batchPages(pages, TIER2_BATCH_SIZE);

  console.log(`[hardwarePdf:t2] Splitting ${pageCount} pages into ${batches.length} batches of ${TIER2_BATCH_SIZE} — model: ${MODEL}`);

  // Build parallel tasks — one AI call per batch
  const tasks = batches.map((batch, idx) => async (): Promise<ExtractedHardwareSet[]> => {
    if (!batch.text.trim()) return [];

    console.log(`[hardwarePdf:t2] → Batch ${idx + 1}/${batches.length}: pages ${batch.startPage}–${batch.endPage} — sending to ${MODEL}…`);

    const continuationNote = batch.hasContextPrefix
      ? ' (context from previous section prepended — see [CONTEXT] block)'
      : '';
    const batchPrompt =
      `Pages ${batch.startPage}–${batch.endPage} of ${pageCount}${continuationNote}:\n\n${batch.text}`;

    const raw = await callOpenRouterForSets(client, [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `${USER_PROMPT}\n\n${batchPrompt}` },
    ], signal);

    console.log(`[hardwarePdf:t2] ✓ Batch ${idx + 1}/${batches.length} done (pages ${batch.startPage}–${batch.endPage}) — response length: ${raw.length} chars`);

    // Save per-batch debug file
    if (process.env.NODE_ENV === 'development') {
      try {
        const debugDir = path.join(process.cwd(), 'debug-extractions', 'pdf-extraction');
        fs.mkdirSync(debugDir, { recursive: true });
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        fs.writeFileSync(
          path.join(debugDir, `${projectId.slice(0, 8)}_${ts}_t2_batch_${idx + 1}.txt`),
          `=== BATCH ${idx + 1} (pages ${batch.startPage}-${batch.endPage}) ===\n\nINPUT:\n${batch.text}\n\nOUTPUT:\n${raw}`,
          'utf-8',
        );
      } catch { /* non-critical */ }
    }

    const { sets, parseWarning } = parseResponse(raw, `:t2-b${idx + 1}`);
    if (parseWarning) warnings.push(`Batch ${idx + 1}: ${parseWarning}`);
    return sets;
  });

  // Run batches in parallel (up to TIER2_MAX_CONCURRENT at a time)
  const results = await runConcurrent(tasks, TIER2_MAX_CONCURRENT);  // AbortError propagates up

  const batchSets: ExtractedHardwareSet[][] = [];
  results.forEach((result, idx) => {
    if (result instanceof Error) {
      warnings.push(`Batch ${idx + 1} (pages ${batches[idx].startPage}–${batches[idx].endPage}): ${result.message}`);
    } else {
      batchSets.push(result);
    }
  });

  const sets = mergeBatchSets(batchSets);
  return { sets, textReadable: true, warnings };
}

// ---------------------------------------------------------------------------
// Main extraction function
// ---------------------------------------------------------------------------

/**
 * Extract hardware sets from a raw PDF buffer.
 *
 * Tier 1 (primary): server-side pdfjs text extraction + parallel AI batches.
 *   - Fast, deterministic, cheap — works for all properly-encoded PDFs.
 *   - Skipped automatically if extracted text is garbled (broken font encoding).
 *
 * Tier 2 (fallback): sends full PDF as base64 inline to OpenRouter (visual).
 *   - Gemini reads the actual PDF layout natively as an image.
 *   - Used when Tier 1 text is garbled, when Tier 1 finds 0 sets, or file > 15 MB.
 *
 * @param buffer     Raw PDF bytes
 * @param fileName   Original filename (for metadata and debug output)
 * @param projectId  Used as prefix for debug output files
 */
export async function extractHardwareSetsFromPdf(
  buffer: Buffer,
  fileName: string,
  projectId: string,
  signal?: AbortSignal,
): Promise<HardwarePdfResult> {
  const warnings: string[] = [];
  const startMs = Date.now();

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `PDF is too large (${(buffer.length / 1024 / 1024).toFixed(1)} MB). Maximum is 20 MB.`,
    );
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured on the server.');

  const client = makeOpenRouterClient(apiKey);
  const fileSizeMb = buffer.length / 1024 / 1024;

  let sets: ExtractedHardwareSet[] = [];
  let tier: 1 | 2 = 1;
  let rawTier1 = '';

  // ── Tier 1: text extraction ───────────────────────────────────────────────
  // Try pdfjs text extraction first. If the text is garbled (broken font
  // encoding) the helper returns textReadable=false and we skip straight to
  // the visual fallback.
  try {
    const t1Result = await tier2Extract(client, buffer, projectId, warnings, signal);
    warnings.push(...t1Result.warnings);
    if (t1Result.textReadable) {
      sets = t1Result.sets;
      tier = 1;
      if (sets.length > 0) {
        console.log(`[hardwarePdf] Tier 1 (text) succeeded — ${sets.length} sets extracted.`);
      } else {
        console.warn('[hardwarePdf] Tier 1 (text) produced 0 sets — falling back to visual.');
      }
    } else {
      console.warn('[hardwarePdf] Tier 1 (text) skipped — garbled font encoding detected.');
    }
  } catch (t1Err) {
    if (t1Err instanceof Error && t1Err.name === 'AbortError') throw t1Err;
    const msg = t1Err instanceof Error ? t1Err.message : String(t1Err);
    warnings.push(`Tier 1 (text) failed: ${msg}`);
    console.warn(`[hardwarePdf] Tier 1 failed: ${msg} — falling back to visual.`);
  }

  // ── Tier 2: visual fallback ───────────────────────────────────────────────
  // Used when: text is garbled, text extraction got 0 sets, or file > 15 MB.
  const canUseVisual = buffer.length <= TIER1_SIZE_LIMIT;
  if (sets.length === 0) {
    if (!canUseVisual) {
      console.warn(`[hardwarePdf] File is ${fileSizeMb.toFixed(1)} MB — too large for visual fallback (limit 15 MB).`);
    } else {
      try {
        console.log('[hardwarePdf] Tier 2 (visual) — sending full PDF to Gemini…');
        const t2Result = await tier1Extract(client, buffer, signal);
        rawTier1 = t2Result.raw;
        sets = t2Result.sets;
        warnings.push(...t2Result.warnings);
        tier = 2;
      } catch (t2Err) {
        if (t2Err instanceof Error && t2Err.name === 'AbortError') throw t2Err;
        const msg = t2Err instanceof Error ? t2Err.message : String(t2Err);
        warnings.push(`Tier 2 (visual) failed: ${msg}`);
        console.warn(`[hardwarePdf] Tier 2 failed: ${msg}`);
      }
    }
  }

  // ── Surface API-level errors (e.g. 402 insufficient credits) ─────────────
  // When both tiers produce 0 sets and warnings contain recognisable API
  // error codes, throw so the route can return a meaningful message instead
  // of the generic "No hardware sets were found."
  if (sets.length === 0) {
    const apiError = warnings.find(
      w => w.includes('402') || w.includes('insufficient credits') || w.includes('requires more credits') ||
           w.includes('401') || w.includes('403') || w.includes('API key'),
    );
    if (apiError) {
      throw new Error(
        `OpenRouter API error — ${apiError}. ` +
        'Please check your OPENROUTER_API_KEY and ensure the account has sufficient credits.',
      );
    }
  }

  const durationMs = Date.now() - startMs;
  const setCount = sets.length;
  const itemCount = sets.reduce((sum, s) => sum + s.hardwareItems.length, 0);

  // ── Debug output ─────────────────────────────────────────────────────────
  saveDebugFiles(projectId, fileName, rawTier1, sets, {
    tier,
    setCount,
    itemCount,
    durationMs,
    fileSizeMb: fileSizeMb.toFixed(2),
    warnings,
  });

  return { sets, setCount, itemCount, warnings, durationMs, tier };
}
