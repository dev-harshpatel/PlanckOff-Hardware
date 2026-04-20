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

/**
 * Batch extracted pages into groups for AI processing.
 * Returns arrays of page text strings, each batch being `batchSize` pages.
 */
export function batchPages(
  pages: ExtractedPage[],
  batchSize = 10,
): Array<{ text: string; startPage: number; endPage: number }> {
  const batches: Array<{ text: string; startPage: number; endPage: number }> = [];

  for (let i = 0; i < pages.length; i += batchSize) {
    const slice = pages.slice(i, i + batchSize);
    batches.push({
      text: slice.map((p) => p.text).join('\n\n'),
      startPage: slice[0].pageNumber,
      endPage: slice[slice.length - 1].pageNumber,
    });
  }

  return batches;
}
