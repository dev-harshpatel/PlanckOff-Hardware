/**
 * Hardware PDF extraction service — V2 (orchestrator)
 *
 * Tier 1 (primary): server-side pdfjs text extraction + parallel AI batches
 *   (services/hardwarePdf/textExtraction.ts).
 * Tier 2 (fallback): renders pages to images for the vision model, including
 *   the Format F matrix/checkbox path (services/hardwarePdf/visualExtraction.ts).
 *
 * Implementation modules live in services/hardwarePdf/:
 *   config.ts            — models, size limits, batch settings
 *   prompts.ts           — system/user + matrix + value-row prompts
 *   schemas.ts           — structured-output JSON schemas
 *   openRouterClient.ts  — client factory + shared AI call helper
 *   responseParser.ts    — set/item normalizers + response parser
 *   debugFiles.ts        — DEV-only debug output
 *   matrixExtraction.ts  — Format F transcription + pixel verification
 *   visualExtraction.ts  — page renders + close-ups + visual AI call
 *   textExtraction.ts    — readability checks, batching, merge, concurrency
 *
 * Server-side only. Never import from client components.
 */

import type { ExtractedHardwareSet } from '@/lib/db/hardware';
import { MAX_FILE_SIZE_BYTES, TIER1_SIZE_LIMIT } from './hardwarePdf/config';
import { makeOpenRouterClient } from './hardwarePdf/openRouterClient';
import { saveDebugFiles } from './hardwarePdf/debugFiles';
import { textExtract } from './hardwarePdf/textExtraction';
import { visualExtract } from './hardwarePdf/visualExtraction';

export interface HardwarePdfResult {
  sets: ExtractedHardwareSet[];
  setCount: number;
  itemCount: number;
  warnings: string[];
  durationMs: number;
  tier: 1 | 2; // which extraction path was used
}

/**
 * Extract hardware sets from a raw PDF buffer.
 *
 * Tier 1 (primary): server-side pdfjs text extraction + parallel AI batches.
 *   - Fast, deterministic, cheap — works for all properly-encoded PDFs.
 *   - Skipped automatically if extracted text is garbled (broken font encoding).
 *
 * Tier 2 (fallback): sends rendered page images to OpenRouter (visual).
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
  let rawVisual = '';

  // ── Tier 1: text extraction ───────────────────────────────────────────────
  // Try pdfjs text extraction first. If the text is garbled (broken font
  // encoding) the helper returns textReadable=false and we skip straight to
  // the visual fallback.
  try {
    const t1Result = await textExtract(client, buffer, projectId, warnings, signal);
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
        const t2Result = await visualExtract(client, buffer, signal);
        rawVisual = t2Result.raw;
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
  saveDebugFiles(projectId, fileName, rawVisual, sets, {
    tier,
    setCount,
    itemCount,
    durationMs,
    fileSizeMb: fileSizeMb.toFixed(2),
    warnings,
  });

  return { sets, setCount, itemCount, warnings, durationMs, tier };
}
