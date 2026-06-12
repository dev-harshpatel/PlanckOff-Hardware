/**
 * Text extraction: server-side pdfjs text extraction (position-aware row
 * reconstruction) + parallel AI batches with structured output.
 *
 * Primary tier — fast, deterministic, cheap. Returns textReadable=false when
 * the extracted text is garbled or structurally unusable, so the caller can
 * fall back to visual extraction.
 */

import fs from 'fs';
import path from 'path';
import type OpenAI from 'openai';
import type { ExtractedHardwareSet } from '@/lib/db/hardware';
import { extractPdfText, batchPages } from '@/lib/ai/pdfTextExtractor';
import { MODEL, TIER2_BATCH_SIZE, TIER2_MAX_CONCURRENT } from './config';
import { SYSTEM_PROMPT, USER_PROMPT } from './prompts';
import { callOpenRouterForSets } from './openRouterClient';
import { parseResponse } from './responseParser';

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

/**
 * Returns true if the extracted text looks like a real hardware schedule.
 * Requires at least 2 hardware-specific words to match — prevents false
 * positives from architectural drawings that happen to contain "DOOR" or
 * "SET" as part of garbled general notes.
 */
function isTextReadable(pages: Array<{ text: string }>): boolean {
  const combined = pages.map(p => p.text).join(' ').toUpperCase();
  if (combined.trim().length < 100) return false;

  // Horizontal column-per-group layout: when groups are TABLE COLUMNS (not rows),
  // pdfjs row reconstruction produces lines like "GROUP #12 GROUP #11 ... GROUP #1"
  // with all items for every group interleaved on the same lines. The AI cannot
  // resolve column assignments from this text — force visual fallback instead.
  const allLines = pages.flatMap(p => p.text.split('\n'));
  const horizontalGroupLayout = allLines.some(line => {
    const matches = line.match(/GROUP\s*#?\s*\d+/gi);
    return matches !== null && matches.length >= 3;
  });
  if (horizontalGroupLayout) {
    console.warn('[hardwarePdf:t2] Horizontal column-per-group layout detected — skipping text extraction, using visual fallback.');
    return false;
  }

  // Door & frame construction schedule sheets: some sheets embed the hardware
  // schedule itself as a raster IMAGE (e.g. a matrix checkbox grid), so text
  // extraction sees only door construction specs (width/height/jamb/frame) and
  // zero hardware definitions. The AI would fabricate sets from door-schedule
  // rows (remarks like "PROVIDE NEW LOCKSET ONLY"). Detect: construction
  // column headers present but no hardware vocabulary at all → force visual.
  const constructionHeaders = ['WIDTH', 'HEIGHT', 'THICKNES', 'GLAZING', 'JAMB', 'FRAME', 'REMARKS'];
  const constructionMatches = constructionHeaders.filter(w => combined.includes(w)).length;
  const hardwareDefinitionMarkers = [
    'HARDWARE SET', 'HARDWARE GROUP', 'HINGE', 'CLOSER', 'DEADBOLT',
    'KICK PLATE', 'PUSH/PULL', 'PUSH / PULL', 'CATALOG', 'MANUFACTURER', 'MFR',
  ];
  const hasHardwareDefinitions = hardwareDefinitionMarkers.some(w => combined.includes(w));
  if (constructionMatches >= 4 && !hasHardwareDefinitions) {
    console.warn('[hardwarePdf:t2] Door/frame construction schedule with no hardware definitions in text — skipping text extraction, using visual fallback.');
    return false;
  }

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

export async function textExtract(
  client: OpenAI,
  buffer: Buffer,
  projectId: string,
  warnings: string[],
  signal?: AbortSignal,
): Promise<{ sets: ExtractedHardwareSet[]; textReadable: boolean; warnings: string[] }> {
  console.log('[hardwarePdf:t2] Starting pdfjs text extraction…');

  // Extract text server-side with position-aware row reconstruction
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
