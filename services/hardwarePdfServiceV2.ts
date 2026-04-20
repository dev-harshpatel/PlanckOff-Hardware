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
import { extractPdfText, batchPages } from '@/lib/ai/pdfTextExtractor';

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
            description: 'Hardware set identifier, e.g. "AD01b", "SE02a.W", "CA01"',
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

Your job is to extract every hardware set (hardware group) from the uploaded PDF and return them as structured JSON.

DOCUMENT FORMATS — this document may follow one of several formats:

Format A — named set codes (e.g. "AD01b", "SE02a.W", "CA01", "WE01a"):
  - setName = the code exactly as written

Format B — numbered hardware groups (e.g. "Hardware Group No. 001", "HARDWARE GROUP 5"):
  - setName = the group number as a zero-padded string, e.g. "001", "002", "135"
  - These groups typically start with "For use on Door #(s):" listing the doors — skip that line, it is not a hardware item

COLUMNS — the hardware item table may use different column headers:
  - QTY or Qty → qty (integer, default 1 if blank)
  - DESCRIPTION or Item → item (hardware category name, e.g. "HINGE", "MORTISE LOCK", "SURFACE CLOSER")
  - CATALOG NUMBER, Part No., or Model → description (exact catalog/part number string)
  - MFR or Manufacturer → manufacturer (abbreviation or full name, e.g. "IVE", "SCH", "LCN", "VON")
  - FINISH or Finish Code → finish (exact code, e.g. "626", "630", "652", "US26D")

RULES:
- Extract ALL hardware sets/groups — do not skip any.
- qty must be an integer. Use 1 if not stated.
- Preserve catalog numbers and finish codes exactly as written.
- If a note or special instruction applies to a set, put it in the notes field.
- Items marked "By Others" — include them, set description to "By Others".
- Skip any door-index or door-to-set mapping tables at the start of the document — only extract the set/group definitions.
- Return results in the JSON format defined by the response schema.`;

const USER_PROMPT = 'Extract all hardware sets from this document. Return every set and every item within each set.';

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
    item: String(r.item ?? '').trim(),
    manufacturer: String(r.manufacturer ?? '').trim(),
    description: String(r.description ?? '').trim(),
    finish: String(r.finish ?? '').trim(),
  };
}

function normalizeSet(raw: Record<string, unknown>): ExtractedHardwareSet {
  return {
    setName: String(raw.setName ?? '').trim(),
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
): Promise<string> {
  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.1,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'hardware_extraction',
        schema: RESPONSE_SCHEMA,
        strict: false,
      },
    } as Parameters<typeof client.chat.completions.create>[0]['response_format'],
    messages,
  });
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
): Promise<{ raw: string; sets: ExtractedHardwareSet[]; warnings: string[] }> {
  const base64Pdf = buffer.toString('base64');
  const warnings: string[] = [];

  console.log(`[hardwarePdf:t1] Sending full PDF (${(buffer.length / 1024).toFixed(0)} KB base64) to ${MODEL}…`);

  const raw = await callOpenRouterForSets(client, [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: `data:application/pdf;base64,${base64Pdf}` },
        },
        { type: 'text', text: USER_PROMPT },
      ],
    },
  ]);

  console.log(`[hardwarePdf:t1] Response received — ${raw.length} chars`);

  const { sets, parseWarning } = parseResponse(raw, ':t1');
  if (parseWarning) warnings.push(parseWarning);

  return { raw, sets, warnings };
}

// ---------------------------------------------------------------------------
// Tier 2 — server-side text extraction + parallel AI batches
// ---------------------------------------------------------------------------

async function tier2Extract(
  client: OpenAI,
  buffer: Buffer,
  projectId: string,
  warnings: string[],
): Promise<{ sets: ExtractedHardwareSet[]; warnings: string[] }> {
  warnings.push('Tier 1 failed or file too large — using Tier 2 (server-side text extraction).');

  // Extract text server-side with position-aware row reconstruction
  console.log('[hardwarePdf:t2] Starting pdfjs text extraction…');
  const { pages, pageCount } = await extractPdfText(buffer, (cur, total) => {
    if (cur === 1 || cur % 5 === 0 || cur === total) {
      console.log(`[hardwarePdf:t2] Extracting text — page ${cur}/${total}`);
    }
  });
  const totalTextChars = pages.reduce((sum, p) => sum + p.text.length, 0);

  if (totalTextChars < 100) {
    throw new Error(
      'PDF appears to be a scanned image with no extractable text. ' +
      'Tier 2 cannot process fully scanned PDFs. Try a text-based PDF.',
    );
  }

  const batches = batchPages(pages, TIER2_BATCH_SIZE);

  console.log(`[hardwarePdf:t2] Splitting ${pageCount} pages into ${batches.length} batches of ${TIER2_BATCH_SIZE} — model: ${MODEL}`);

  // Build parallel tasks — one AI call per batch
  const tasks = batches.map((batch, idx) => async (): Promise<ExtractedHardwareSet[]> => {
    if (!batch.text.trim()) return [];

    console.log(`[hardwarePdf:t2] → Batch ${idx + 1}/${batches.length}: pages ${batch.startPage}–${batch.endPage} — sending to ${MODEL}…`);

    const batchPrompt =
      `Pages ${batch.startPage}–${batch.endPage} of ${pageCount}:\n\n${batch.text}`;

    const raw = await callOpenRouterForSets(client, [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `${USER_PROMPT}\n\n${batchPrompt}` },
    ]);

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
  const results = await runConcurrent(tasks, TIER2_MAX_CONCURRENT);

  const batchSets: ExtractedHardwareSet[][] = [];
  results.forEach((result, idx) => {
    if (result instanceof Error) {
      warnings.push(`Batch ${idx + 1} (pages ${batches[idx].startPage}–${batches[idx].endPage}): ${result.message}`);
    } else {
      batchSets.push(result);
    }
  });

  const sets = mergeBatchSets(batchSets);
  return { sets, warnings };
}

// ---------------------------------------------------------------------------
// Main extraction function
// ---------------------------------------------------------------------------

/**
 * Extract hardware sets from a raw PDF buffer.
 *
 * Tier 1 (primary): sends full PDF as base64 inline to OpenRouter.
 *   - Gemini reads the actual PDF layout natively.
 *   - Used when file ≤ 15 MB.
 *
 * Tier 2 (fallback): server-side pdfjs text extraction + parallel AI batches.
 *   - Used when Tier 1 fails or file > 15 MB.
 *   - Position-aware row reconstruction preserves table structure.
 *
 * @param buffer     Raw PDF bytes
 * @param fileName   Original filename (for metadata and debug output)
 * @param projectId  Used as prefix for debug output files
 */
export async function extractHardwareSetsFromPdf(
  buffer: Buffer,
  fileName: string,
  projectId: string,
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
  const useTier1 = buffer.length <= TIER1_SIZE_LIMIT;

  let sets: ExtractedHardwareSet[] = [];
  let tier: 1 | 2 = 1;
  let rawTier1 = '';

  if (useTier1) {
    // ── Tier 1 attempt ────────────────────────────────────────────────────
    try {
      const result = await tier1Extract(client, buffer);
      rawTier1 = result.raw;
      sets = result.sets;
      warnings.push(...result.warnings);
      tier = 1;
    } catch (tier1Err) {
      warnings.push(
        `Tier 1 failed: ${tier1Err instanceof Error ? tier1Err.message : String(tier1Err)}`,
      );
    }
  } else {
    warnings.push(
      `File is ${fileSizeMb.toFixed(1)} MB — exceeds 15 MB Tier 1 limit, using Tier 2 directly.`,
    );
  }

  // ── Tier 2 fallback (if Tier 1 didn't run, failed, or returned nothing) ──
  if (sets.length === 0) {
    const t2Result = await tier2Extract(client, buffer, projectId, warnings);
    sets = t2Result.sets;
    tier = 2;
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
