/**
 * Visual extraction: send PDF to the vision model.
 *
 * Primary path: render PDF pages to PNG images via @napi-rs/canvas, then send
 * to the model. Works locally and in environments with native module support.
 *
 * Fallback path (no canvas): encode the raw PDF as base64 and send it directly
 * as data:application/pdf. Gemini natively understands PDF files, so this
 * produces equivalent results without any native binary dependency — making it
 * safe on Vercel's serverless Lambda where @napi-rs/canvas may be unavailable.
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

  // ── Attempt image rendering (requires @napi-rs/canvas) ────────────────────
  // Rendering gives pdfjs's glyph output — bypasses broken font encodings and
  // enables matrix/close-up extraction. Falls back to direct PDF if unavailable.
  let pageImages: string[] = [];
  let closeupImages: string[] = [];

  try {
    console.log('[hardwarePdf:visual] Rendering PDF pages to images…');
    pageImages = await renderPdfToImages(buffer);

    try {
      closeupImages = await renderEmbeddedImageCloseups(buffer);
      if (closeupImages.length > 0) {
        console.log(`[hardwarePdf:visual] Added ${closeupImages.length} high-res close-up(s) of embedded schedule image(s).`);
      }
    } catch (closeupErr) {
      if (closeupErr instanceof Error && closeupErr.name === 'AbortError') throw closeupErr;
      console.warn('[hardwarePdf:visual] Embedded-image close-up rendering failed — continuing without close-ups:', closeupErr);
    }

    // Matrix/checkbox schedules need the dedicated transcription path.
    // Only attempted when close-ups are present.
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
  } catch (canvasErr) {
    if (canvasErr instanceof Error && canvasErr.name === 'AbortError') throw canvasErr;
    // @napi-rs/canvas not available in this environment (e.g. Vercel Lambda).
    // Fall through to the direct PDF path below.
    console.warn(
      `[hardwarePdf:visual] Image rendering unavailable (platform=${process.platform} arch=${process.arch}) — falling back to direct PDF upload`,
      canvasErr,
    );
    pageImages = [];
    closeupImages = [];
  }

  // ── Build message content ─────────────────────────────────────────────────
  let messageContent: Array<{ type: 'image_url'; image_url: { url: string } } | { type: 'text'; text: string }>;

  if (pageImages.length > 0) {
    // When close-ups exist the hardware schedule is embedded as a raster image
    // inside a larger architectural sheet. The full-page render contains the
    // hardware schedule at tiny scale alongside other elements (door schedule,
    // title block, grid lines) that confuse the model. Sending only the
    // close-up — which is a high-resolution crop of just the schedule — gives
    // the model a clean, unambiguous view and produces accurate results.
    const imagesToSend = closeupImages.length > 0 ? closeupImages : pageImages;
    const imageItems = imagesToSend.map(b64 => ({
      type: 'image_url' as const,
      image_url: { url: `data:image/png;base64,${b64}` },
    }));
    const sourceNote = closeupImages.length > 0
      ? `\n\nNOTE: This image is a HIGH-RESOLUTION EXTRACT of the hardware schedule table from the original document. Read ALL hardware groups from this image exactly as printed.`
      : '';
    messageContent = [
      ...imageItems,
      { type: 'text', text: USER_PROMPT + sourceNote },
    ];
    console.log(`[hardwarePdf:visual] Sending ${imagesToSend.length} image(s) to ${MODEL} (${closeupImages.length > 0 ? 'close-up only — skipping noisy full-page render' : 'full page'})…`);
  } else {
    // Direct PDF path: send the raw file as inline base64 — no canvas needed
    const pdfBase64 = buffer.toString('base64');
    messageContent = [
      {
        type: 'image_url' as const,
        image_url: { url: `data:application/pdf;base64,${pdfBase64}` },
      },
      { type: 'text', text: USER_PROMPT },
    ];
    console.log(`[hardwarePdf:visual] Sending PDF directly (${(buffer.length / 1024 / 1024).toFixed(1)} MB) to ${MODEL}…`);
  }

  const raw = await callOpenRouterForSets(client, [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: messageContent },
  ], signal);

  console.log(`[hardwarePdf:visual] Response received — ${raw.length} chars`);

  const { sets, parseWarning } = parseResponse(raw, ':visual');
  if (parseWarning) warnings.push(parseWarning);

  return { raw, sets, warnings };
}
