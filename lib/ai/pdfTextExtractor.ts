/**
 * Server-side PDF text extraction using pdfjs-dist (legacy ESM build).
 *
 * Unlike the browser pdfParser.ts which just joins item.str with spaces,
 * this uses x/y coordinates from each text item's transform matrix to
 * reconstruct the visual row/column structure of the PDF.
 *
 * Hardware schedules are tables. Preserving row grouping means the AI
 * receives "2 Ea. Exit Device Sargent 56-NB-PE8613 626" as one line
 * instead of all tokens scattered across a flat string.
 *
 * Server-side only. Never import from client components.
 */

// pdfjs-dist legacy build works in Node.js without a DOM
// The dynamic import is lazy so Next.js doesn't try to bundle it client-side.

export interface ExtractedPage {
  pageNumber: number;
  text: string; // position-reconstructed text for this page
}

export interface PdfExtractionResult {
  pages: ExtractedPage[];
  pageCount: number;
}

// ---------------------------------------------------------------------------
// Row reconstruction
//
// pdfjs text items each have a `transform` array: [scaleX, skewX, skewY, scaleY, x, y]
// We use transform[5] (y) to group items into the same visual row,
// and transform[4] (x) to sort left-to-right within each row.
// ---------------------------------------------------------------------------

interface RawTextItem {
  str: string;
  transform: number[];
  width: number;
}

function reconstructRows(items: RawTextItem[], yTolerance = 3): string {
  if (items.length === 0) return '';

  // Build [x, y, str] tuples
  const positioned = items
    .filter((item) => item.str.trim() !== '')
    .map((item) => ({
      x: item.transform[4],
      y: item.transform[5],
      str: item.str,
      width: item.width,
    }));

  if (positioned.length === 0) return '';

  // Sort by y descending (PDF y=0 is bottom, so higher y = higher on page)
  positioned.sort((a, b) => b.y - a.y);

  // Group into rows by y proximity
  const rows: Array<typeof positioned> = [];
  let currentRow: typeof positioned = [positioned[0]];

  for (let i = 1; i < positioned.length; i++) {
    const item = positioned[i];
    const rowY = currentRow[0].y;

    if (Math.abs(item.y - rowY) <= yTolerance) {
      currentRow.push(item);
    } else {
      rows.push(currentRow);
      currentRow = [item];
    }
  }
  rows.push(currentRow);

  // Within each row sort by x ascending (left to right)
  // Join with a single space — preserves column separation
  return rows
    .map((row) =>
      row
        .sort((a, b) => a.x - b.x)
        .map((item) => item.str.trim())
        .filter(Boolean)
        .join(' '),
    )
    .join('\n');
}

// ---------------------------------------------------------------------------
// Main extractor
// ---------------------------------------------------------------------------

/**
 * Extract text from a PDF buffer server-side, using position-aware row
 * reconstruction to preserve the visual table structure.
 *
 * @param buffer  Raw PDF bytes
 * @returns       Array of per-page text strings + total page count
 */
export async function extractPdfText(
  buffer: Buffer,
  onPageProgress?: (current: number, total: number) => void,
): Promise<PdfExtractionResult> {
  // Dynamic import — keeps pdfjs out of the client bundle
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs' as string);

  // pdfjs v4+ requires a real worker src even in Node.js.
  // import.meta.resolve is the most reliable approach (Node 20.6+, Next.js ESM).
  // Falls back to pathToFileURL(process.cwd() + relative path) for older runtimes.
  const WORKER_SUBPATH = 'pdfjs-dist/legacy/build/pdf.worker.min.mjs';
  let workerSrc: string;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (import.meta as any).resolve === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      workerSrc = (import.meta as any).resolve(WORKER_SUBPATH);
    } else {
      throw new Error('import.meta.resolve unavailable');
    }
  } catch {
    const { pathToFileURL } = await import('url');
    const { resolve } = await import('path');
    workerSrc = pathToFileURL(resolve(process.cwd(), 'node_modules', ...WORKER_SUBPATH.split('/'))).href;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;
  console.log('[pdfTextExtractor] workerSrc:', workerSrc);

  const uint8 = new Uint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({ data: uint8, useWorkerFetch: false, isEvalSupported: false, disableAutoFetch: true });
  const pdf = await loadingTask.promise;

  const pageCount = pdf.numPages;
  const pages: ExtractedPage[] = [];

  for (let i = 1; i <= pageCount; i++) {
    onPageProgress?.(i, pageCount);

    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = content.items as any[];
    const rawItems: RawTextItem[] = items
      .filter((item) => typeof item.str === 'string')
      .map((item) => ({
        str: item.str,
        transform: item.transform as number[],
        width: item.width as number,
      }));

    const text = reconstructRows(rawItems);
    pages.push({ pageNumber: i, text });

    page.cleanup();
  }

  return { pages, pageCount };
}

// ---------------------------------------------------------------------------
// PDF → PNG image renderer
// ---------------------------------------------------------------------------

/**
 * Renders each page of a PDF to a PNG image using pdfjs's actual rendering
 * engine (glyph-based, not character-encoding-based). This bypasses broken
 * font ToUnicode mappings — the output image is what the user sees in a PDF
 * viewer, regardless of how the font's text extraction is broken.
 *
 * Returns an array of base64-encoded PNG strings, one per page.
 */
export async function renderPdfToImages(
  buffer: Buffer,
  scale = 2.0,
): Promise<string[]> {
  const { createCanvas, Path2D } = await import('@napi-rs/canvas');

  // pdfjs calls ctx.clip(path) where path = new Path2D().
  // In Node.js, global Path2D is undefined, so pdfjs creates a plain object
  // that @napi-rs/canvas's clip() rejects with "Value is none of these types".
  // Setting the global to @napi-rs/canvas's Path2D makes pdfjs create the
  // right type so clip() accepts it.
  (globalThis as Record<string, unknown>).Path2D = Path2D;

  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs' as string);

  const WORKER_SUBPATH = 'pdfjs-dist/legacy/build/pdf.worker.min.mjs';
  let workerSrc: string;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (import.meta as any).resolve === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      workerSrc = (import.meta as any).resolve(WORKER_SUBPATH);
    } else {
      throw new Error('import.meta.resolve unavailable');
    }
  } catch {
    const { pathToFileURL } = await import('url');
    const { resolve } = await import('path');
    workerSrc = pathToFileURL(resolve(process.cwd(), 'node_modules', ...WORKER_SUBPATH.split('/'))).href;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;

  const uint8 = new Uint8Array(buffer);
  const pdf = await pdfjsLib.getDocument({
    data: uint8,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableAutoFetch: true,
  }).promise;

  const images: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const rawViewport = page.getViewport({ scale: 1 });
    const pdfW = rawViewport.width;
    const pdfH = rawViewport.height;

    // For large-format architectural sheets (landscape, wider than 1400 pts)
    // the hardware schedule is a small table in the right portion of the page.
    // Rendering the full sheet makes that table tiny and hard to read.
    // Instead: render the right 60% × bottom 65% region at 3× scale so the
    // table text is legible. For normal-size PDFs, render the full page as usual.
    const isLargeSheet = pdfW > 1400 && pdfW > pdfH; // landscape A1/A0/custom
    const renderImages: string[] = [];

    if (isLargeSheet) {
      // Hardware schedule is in the bottom ~45% of large architectural sheets.
      // Crop to that region and render at 3× scale so quantities like "2" vs "1"
      // are clearly readable rather than tiny specks on a full-sheet image.
      const regionX = 0;
      const regionW = pdfW * 0.92;   // exclude title block on right edge
      // PDF y=0 is bottom — bottom 45% means y from 0 to pdfH*0.45
      const regionH = pdfH * 0.45;
      const regionY = 0;             // starts at bottom of page (y=0 in PDF coords)
      const zoomScale = 3.0;

      // offsetY in pdfjs viewport: positive moves content down (shifts page up)
      // To render only the bottom regionH points: no vertical offset needed —
      // we clip the canvas to regionH height so only the bottom portion is drawn.
      const vp = page.getViewport({ scale: zoomScale });
      const canvasW = Math.round(regionW * zoomScale);
      const canvasH = Math.round(regionH * zoomScale);
      const fullH = Math.round(pdfH * zoomScale);

      // Render full page into a tall canvas, then slice the bottom portion
      const fullCanvas = createCanvas(canvasW, fullH);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fullCtx = fullCanvas.getContext('2d') as any;
      await page.render({ canvasContext: fullCtx, viewport: vp }).promise;

      // Crop the bottom regionH*scale pixels from the rendered full page
      const cropCanvas = createCanvas(canvasW, canvasH);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cropCtx = cropCanvas.getContext('2d') as any;
      cropCtx.drawImage(fullCanvas, 0, fullH - canvasH, canvasW, canvasH, 0, 0, canvasW, canvasH);

      renderImages.push(cropCanvas.toBuffer('image/png').toString('base64'));
    } else {
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctx = canvas.getContext('2d') as any;
      await page.render({ canvasContext: ctx, viewport }).promise;
      renderImages.push(canvas.toBuffer('image/png').toString('base64'));
    }

    images.push(...renderImages);
    page.cleanup();
  }

  return images;
}

/**
 * Batch extracted pages into groups for AI processing.
 *
 * @param pages        Extracted pages from the PDF.
 * @param batchSize    Number of content pages per batch.
 * @param overlapPages Number of pages from the end of the previous batch to
 *                     prepend as context. Prevents hardware sets that span a
 *                     page boundary from being split across AI calls.
 */
export function batchPages(
  pages: ExtractedPage[],
  batchSize = 10,
  overlapPages = 1,
): Array<{ text: string; startPage: number; endPage: number; hasContextPrefix: boolean }> {
  const batches: Array<{ text: string; startPage: number; endPage: number; hasContextPrefix: boolean }> = [];

  for (let i = 0; i < pages.length; i += batchSize) {
    const slice = pages.slice(i, i + batchSize);
    const contentText = slice.map((p) => p.text).join('\n\n');

    let text = contentText;
    let hasContextPrefix = false;

    if (i > 0 && overlapPages > 0) {
      const contextSlice = pages.slice(Math.max(0, i - overlapPages), i);
      const contextText = contextSlice.map((p) => p.text).join('\n\n');
      // Clearly mark the context so the AI knows these pages were already
      // processed and exist only to maintain continuity for sets that span
      // the page boundary.
      text =
        `[CONTEXT: last ${contextSlice.length} page(s) from previous section — for continuity only, do NOT re-extract these]\n` +
        contextText +
        `\n[END CONTEXT — extract only from the pages below]\n\n` +
        contentText;
      hasContextPrefix = true;
    }

    batches.push({
      text,
      startPage: slice[0].pageNumber,
      endPage: slice[slice.length - 1].pageNumber,
      hasContextPrefix,
    });
  }

  return batches;
}
