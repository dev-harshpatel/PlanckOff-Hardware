/**
 * Visual extraction: render PDF pages to images and send to the vision model.
 *
 * Used as the fallback tier when text extraction is garbled or finds 0 sets.
 * Also hosts the Format F (matrix/checkbox) entry point, since matrix
 * schedules are only detectable from the rendered close-up images.
 */

import type OpenAI from 'openai';
import type { ExtractedHardwareSet } from '@/lib/db/hardware';
import { renderPdfToImages, renderEmbeddedImageCloseups } from '@/lib/ai/pdfTextExtractor';
import { MODEL } from './config';
import { SYSTEM_PROMPT, USER_PROMPT } from './prompts';
import { callOpenRouterForSets } from './openRouterClient';
import { parseResponse } from './responseParser';
import { tryMatrixExtraction } from './matrixExtraction';

export async function visualExtract(
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

  // Some sheets embed their hardware schedule as a raster IMAGE (e.g. a matrix
  // checkbox table pasted into the drawing). At full-sheet render scale those
  // tables are illegible — checkbox states cannot be read. Render high-zoom
  // close-ups of such regions and append them after the full-page images.
  // PDFs without large embedded images get an empty array — nothing changes.
  let closeupImages: string[] = [];
  try {
    closeupImages = await renderEmbeddedImageCloseups(buffer);
    if (closeupImages.length > 0) {
      console.log(`[hardwarePdf:visual] Added ${closeupImages.length} high-res close-up(s) of embedded schedule image(s).`);
    }
  } catch (closeupErr) {
    if (closeupErr instanceof Error && closeupErr.name === 'AbortError') throw closeupErr;
    console.warn('[hardwarePdf:visual] Embedded-image close-up rendering failed — continuing with page renders only:', closeupErr);
  }

  // Matrix/checkbox schedules (Format F) need the dedicated transcription
  // path — single-shot extraction cannot transpose the checkbox grid. Only
  // attempted when close-ups exist; any non-matrix document falls through to
  // the normal visual extraction below, unchanged.
  if (closeupImages.length > 0) {
    try {
      const matrixResult = await tryMatrixExtraction(client, closeupImages, signal);
      if (matrixResult) {
        return { raw: matrixResult.raw, sets: matrixResult.sets, warnings };
      }
    } catch (matrixErr) {
      if (matrixErr instanceof Error && matrixErr.name === 'AbortError') throw matrixErr;
      console.warn('[hardwarePdf:matrix] Matrix extraction failed — continuing with normal visual extraction:', matrixErr);
    }
  }

  console.log(`[hardwarePdf:visual] Rendered ${pageImages.length} page(s) — sending to ${MODEL}…`);

  const imageContent = [...pageImages, ...closeupImages].map(b64 => ({
    type: 'image_url' as const,
    image_url: { url: `data:image/png;base64,${b64}` },
  }));

  const closeupNote = closeupImages.length > 0
    ? `\n\nNOTE: the final ${closeupImages.length} image(s) are HIGH-RESOLUTION CLOSE-UPS of table regions embedded in the sheet(s) shown before them — the same content, magnified. Read fine details (checkbox states, set numbers, quantities, codes, finishes) from these close-ups rather than from the small full-sheet view.`
    : '';

  const raw = await callOpenRouterForSets(client, [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        ...imageContent,
        { type: 'text', text: USER_PROMPT + closeupNote },
      ],
    },
  ], signal);

  console.log(`[hardwarePdf:visual] Response received — ${raw.length} chars`);

  const { sets, parseWarning } = parseResponse(raw, ':visual');
  if (parseWarning) warnings.push(parseWarning);

  return { raw, sets, warnings };
}
