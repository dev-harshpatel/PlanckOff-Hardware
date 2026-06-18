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
// We use VIEWPORT coordinates (visual vx/vy) rather than raw PDF transform
// coordinates. This matters for pages with rotation != 0 (e.g. rotation=90
// landscape architectural drawings): in raw PDF space transform[5] is the
// visual X axis and transform[4] is the visual Y axis, so grouping by
// transform[5] would cluster visual columns together instead of rows.
// viewport.convertToViewportPoint() applies the page rotation so that
// vx always runs left→right and vy always runs top→bottom regardless of
// how the page is stored in the PDF.
// ---------------------------------------------------------------------------

interface VpTextItem {
  vx: number;   // visual x — left to right
  vy: number;   // visual y — top to bottom
  str: string;
}

// When two independent hardware set tables appear side by side on the same page
// (e.g. "EXTERIOR COMMON DOORS" and "INTERIOR COMMON DOORS"), their rows get
// interleaved in the vy-sorted output. A right-column-only row (all items have
// vx > splitX) looks identical to a left-column row — the AI has no way to tell
// which column it belongs to and may assign it to the wrong hardware set.
//
// Solution: detect the inter-table gap by voting — each row votes for its
// largest intra-row gap. The gap that appears consistently across many rows is
// the real column boundary; incidental large gaps in door-schedule rows appear
// in only 1–3 rows and lose the vote.
const COLUMN_GAP_BIN_WIDTH = 120;   // group gap centres within 120 pts into one bin
const COLUMN_GAP_MIN_FOR_VOTE = 80; // minimum gap (pts) to participate in voting
const COLUMN_GAP_QUALIFY = 150;     // winning bin's max gap must be ≥ this
const COLUMN_GAP_MIN_VOTES = 4;     // bin must win ≥ this many row votes

function detectColumnSplitX(rows: VpTextItem[][]): number | null {
  // Compute the vx range so we can focus on the "high-x" region.
  // On pages that mix a door schedule (items from vx≈100 to vx≈2100) with a
  // two-column hardware schedule (items from vx≈1400 to vx≈2200), the door
  // schedule rows dominate voting because they span the full page width.
  // By restricting to rows where EVERY item has vx > 45 % of the page range,
  // we exclude wide door-schedule rows while keeping hardware-schedule rows
  // (whose leftmost items are at ≈ 55–70 % of the range).
  const allVx = rows.flat().map((i) => i.vx);
  if (allVx.length === 0) return null;
  const minVx = Math.min(...allVx);
  const maxVx = Math.max(...allVx);
  const range = maxVx - minVx;
  if (range < 200) return null; // page too narrow to have a side-by-side two-column layout

  const highVxThreshold = minVx + range * 0.45;
  const highVxRows = rows.filter((row) => row.every((item) => item.vx >= highVxThreshold));

  if (highVxRows.length < COLUMN_GAP_MIN_VOTES) return null;

  const voteCounts = new Map<number, number>();
  const voteMaxGap = new Map<number, number>();

  for (const row of highVxRows) {
    if (row.length < 2) continue;
    const sorted = [...row].sort((a, b) => a.vx - b.vx);

    // Each row casts exactly one vote — for its own largest gap
    let rowMaxGap = 0;
    let rowMaxCenter = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i + 1].vx - sorted[i].vx;
      if (gap > rowMaxGap) {
        rowMaxGap = gap;
        rowMaxCenter = (sorted[i].vx + sorted[i + 1].vx) / 2;
      }
    }

    if (rowMaxGap < COLUMN_GAP_MIN_FOR_VOTE) continue;

    const bin = Math.floor(rowMaxCenter / COLUMN_GAP_BIN_WIDTH) * COLUMN_GAP_BIN_WIDTH;
    voteCounts.set(bin, (voteCounts.get(bin) ?? 0) + 1);
    voteMaxGap.set(bin, Math.max(voteMaxGap.get(bin) ?? 0, rowMaxGap));
  }

  // The winning bin must have both enough votes AND a qualifying gap size
  let bestBin: number | null = null;
  let bestVotes = 0;

  for (const [bin, votes] of voteCounts) {
    const maxGap = voteMaxGap.get(bin) ?? 0;
    if (maxGap >= COLUMN_GAP_QUALIFY && votes > bestVotes) {
      bestVotes = votes;
      bestBin = bin;
    }
  }

  if (bestBin === null || bestVotes < COLUMN_GAP_MIN_VOTES) return null;
  return bestBin + COLUMN_GAP_BIN_WIDTH / 2;
}

function reconstructRows(items: VpTextItem[], yTolerance = 4): string {
  if (items.length === 0) return '';

  const positioned = items.filter((item) => item.str.trim() !== '');

  if (positioned.length === 0) return '';

  // Sort by vy ascending (top to bottom in viewport)
  positioned.sort((a, b) => a.vy - b.vy);

  // Group into rows by vy proximity
  const rows: VpTextItem[][] = [];
  let currentRow: VpTextItem[] = [positioned[0]];

  for (let i = 1; i < positioned.length; i++) {
    const item = positioned[i];
    if (Math.abs(item.vy - currentRow[0].vy) <= yTolerance) {
      currentRow.push(item);
    } else {
      rows.push(currentRow);
      currentRow = [item];
    }
  }
  rows.push(currentRow);

  // Detect two-column layout from the largest intra-row horizontal gap
  const splitX = detectColumnSplitX(rows);

  // Within each row sort by vx ascending (left to right), then annotate:
  //   [RIGHT] prefix  → row belongs entirely to the right-column table
  //   ||| separator   → row has content from BOTH tables; left of ||| = left table, right of ||| = right table
  return rows
    .map((row) => {
      const sorted = row.sort((a, b) => a.vx - b.vx);

      if (splitX !== null && sorted.length > 0) {
        const hasLeft = sorted.some((i) => i.vx <= splitX);
        const hasRight = sorted.some((i) => i.vx > splitX);

        if (!hasLeft) {
          // All items are in the right column
          const text = sorted.map((i) => i.str.trim()).filter(Boolean).join(' ');
          return `[RIGHT] ${text}`;
        }

        if (hasRight) {
          // Items span both columns — split at the boundary so the AI sees each side clearly
          const leftText = sorted
            .filter((i) => i.vx <= splitX)
            .map((i) => i.str.trim())
            .filter(Boolean)
            .join(' ');
          const rightText = sorted
            .filter((i) => i.vx > splitX)
            .map((i) => i.str.trim())
            .filter(Boolean)
            .join(' ');
          return `${leftText} ||| ${rightText}`;
        }
      }

      // Left-only row or no column split detected — output normally
      return sorted
        .map((item) => item.str.trim())
        .filter(Boolean)
        .join(' ');
    })
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
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = content.items as any[];
    const vpItems: VpTextItem[] = items
      .filter((item) => typeof item.str === 'string')
      .map((item) => {
        const [vx, vy] = viewport.convertToViewportPoint(
          item.transform[4] as number,
          item.transform[5] as number,
        );
        return { vx, vy, str: item.str as string };
      });

    const text = reconstructRows(vpItems);
    pages.push({ pageNumber: i, text });

    page.cleanup();
  }

  return { pages, pageCount };
}

// ---------------------------------------------------------------------------
// Positioned text extraction
// ---------------------------------------------------------------------------

export interface PositionedTextItem {
  str: string;
  /** viewport coordinates at scale 1: origin top-left, page rotation applied */
  x: number;
  y: number;
  width: number;
  /** approximate font height from the transform matrix */
  height: number;
}

export interface PositionedPage {
  pageNumber: number;
  /** page size in PDF user-space points */
  pageWidth: number;
  pageHeight: number;
  items: PositionedTextItem[];
}

/**
 * Extract raw text items WITH their positions, instead of flattening to
 * row-reconstructed strings. Needed by deterministic table analyzers that
 * map text cells to grid columns (e.g. per-door mark-grid door schedules).
 */
export async function extractPositionedText(buffer: Buffer): Promise<PositionedPage[]> {
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

  const pages: PositionedPage[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    // Convert raw user-space coordinates to viewport coordinates so that
    // rotated pages (common for landscape architectural sheets) come out in
    // visual orientation: origin top-left, y growing downward.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = (content.items as any[])
      .filter((it) => typeof it.str === 'string' && it.str.trim() !== '')
      .map((it) => {
        const [vx, vy] = viewport.convertToViewportPoint(it.transform[4] as number, it.transform[5] as number);
        return {
          str: it.str as string,
          x: vx,
          y: vy,
          width: it.width as number,
          height: Math.abs(it.transform[3] as number) || Math.abs(it.transform[1] as number) || 8,
        };
      });
    pages.push({ pageNumber: i, pageWidth: viewport.width, pageHeight: viewport.height, items });
    page.cleanup();
  }
  return pages;
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
      // Render the full page at 1.5× scale, excluding the title block column on
      // the right edge. This gives Gemini a complete view of all hardware groups
      // with their correct column headers — splitting into tiles caused set-number
      // collisions and column-mapping errors when tiles lacked header rows.
      const zoomScale = 1.5;
      const vp = page.getViewport({ scale: zoomScale });
      const canvasW = Math.round(pdfW * 0.92 * zoomScale); // exclude right-edge title block
      const canvasH = Math.round(pdfH * zoomScale);
      const canvas = createCanvas(canvasW, canvasH);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctx = canvas.getContext('2d') as any;
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      renderImages.push(canvas.toBuffer('image/png').toString('base64'));
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

// ---------------------------------------------------------------------------
// High-resolution close-ups of large embedded raster images
//
// Some architectural sheets paste their hardware schedule into the drawing as
// a PICTURE (a raster image XObject) — e.g. a matrix "DOOR HARDWARE SCHEDULE"
// with checkbox cells. Two problems follow:
//   1. Text extraction sees NOTHING of it (it is pixels, not text).
//   2. The full-sheet render makes the table so small that checkbox states
//      become illegible after the vision model downscales the image.
// This helper finds large embedded raster images on each page and re-renders
// just those page regions at high zoom, so the vision model gets a legible
// close-up alongside the full-sheet view.
// ---------------------------------------------------------------------------

const CLOSEUP_MIN_NATIVE_PIXELS = 500_000;  // ignore logos/stamps/small details
const CLOSEUP_MIN_PAGE_FRACTION = 0.02;     // ignore tiny placements
const CLOSEUP_MAX_PAGE_FRACTION = 0.60;     // skip full-page scans — the normal page render already covers those
const CLOSEUP_TARGET_LONG_SIDE_PX = 3200;   // render region so its long side is ~this many pixels
const CLOSEUP_MAX_SCALE = 4;
const CLOSEUP_MAX_PER_PAGE = 3;

// Compose two PDF transform matrices: result applies `n` first, then `m`.
function composeTransform(m: number[], n: number[]): number[] {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

/**
 * Render high-zoom close-ups of large embedded raster images (e.g. a hardware
 * schedule pasted into a sheet as a picture).
 *
 * Walks each page's operator list tracking the transform matrix to find where
 * image XObjects are placed, filters to "large schedule-like" images (big
 * native resolution, placed as a sub-region of the page — not a full-page
 * scan), then renders each region with pdfjs's own renderer (so orientation,
 * rotation and any vector overlays are handled correctly).
 *
 * Returns base64-encoded PNGs. Empty array for PDFs without such images —
 * which is the common case and leaves the existing pipeline untouched.
 */
export async function renderEmbeddedImageCloseups(buffer: Buffer): Promise<string[]> {
  const { createCanvas, Path2D } = await import('@napi-rs/canvas');
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const OPS = (pdfjsLib as any).OPS;
  const closeups: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const baseViewport = page.getViewport({ scale: 1 });
    const pageArea = baseViewport.width * baseViewport.height;

    const opList = await page.getOperatorList();

    // Track the current transformation matrix to find image placements
    let ctm = [1, 0, 0, 1, 0, 0];
    const ctmStack: number[][] = [];
    const placements: Array<{ name: string; ctm: number[] }> = [];

    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i];
      if (fn === OPS.save) {
        ctmStack.push(ctm.slice());
      } else if (fn === OPS.restore) {
        ctm = ctmStack.pop() ?? ctm;
      } else if (fn === OPS.transform) {
        ctm = composeTransform(ctm, args as number[]);
      } else if (fn === OPS.paintFormXObjectBegin) {
        ctmStack.push(ctm.slice());
        if (Array.isArray(args?.[0])) ctm = composeTransform(ctm, args[0] as number[]);
      } else if (fn === OPS.paintFormXObjectEnd) {
        ctm = ctmStack.pop() ?? ctm;
      } else if (fn === OPS.paintImageXObject) {
        placements.push({ name: String(args[0]), ctm: ctm.slice() });
      }
    }

    // Resolve native image sizes and compute page-space regions
    const regions: Array<{ x: number; y: number; w: number; h: number; nativePixels: number }> = [];
    const seenRects = new Set<string>();

    for (const { name, ctm: m } of placements) {
      let nativePixels = 0;
      try {
        if (!page.objs.has(name)) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const img = await new Promise<any>((res) => page.objs.get(name, res));
        if (!img || typeof img.width !== 'number') continue;
        nativePixels = img.width * img.height;
      } catch {
        continue;
      }
      if (nativePixels < CLOSEUP_MIN_NATIVE_PIXELS) continue;

      // Image XObjects are painted into the unit square — transform its corners
      const corners = [
        [0, 0], [1, 0], [0, 1], [1, 1],
      ].map(([ux, uy]) => [m[0] * ux + m[2] * uy + m[4], m[1] * ux + m[3] * uy + m[5]]);
      const xs = corners.map((c) => c[0]);
      const ys = corners.map((c) => c[1]);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      const w = Math.max(...xs) - x;
      const h = Math.max(...ys) - y;

      const fraction = (w * h) / pageArea;
      if (fraction < CLOSEUP_MIN_PAGE_FRACTION || fraction > CLOSEUP_MAX_PAGE_FRACTION) continue;

      const rectKey = [x, y, w, h].map((v) => Math.round(v)).join(',');
      if (seenRects.has(rectKey)) continue;
      seenRects.add(rectKey);

      regions.push({ x, y, w, h, nativePixels });
    }

    // Largest (most detailed) images first; cap per page to bound AI cost
    regions.sort((a, b) => b.nativePixels - a.nativePixels);

    for (const region of regions.slice(0, CLOSEUP_MAX_PER_PAGE)) {
      const regionScale = Math.min(
        CLOSEUP_MAX_SCALE,
        Math.max(1.5, CLOSEUP_TARGET_LONG_SIDE_PX / Math.max(region.w, region.h)),
      );
      const viewport = page.getViewport({ scale: regionScale });
      const [ax, ay] = viewport.convertToViewportPoint(region.x, region.y);
      const [bx, by] = viewport.convertToViewportPoint(region.x + region.w, region.y + region.h);
      const left = Math.min(ax, bx);
      const top = Math.min(ay, by);
      const canvasW = Math.round(Math.abs(bx - ax));
      const canvasH = Math.round(Math.abs(by - ay));
      if (canvasW < 10 || canvasH < 10) continue;

      const canvas = createCanvas(canvasW, canvasH);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctx = canvas.getContext('2d') as any;
      ctx.translate(-left, -top);
      await page.render({ canvasContext: ctx, viewport }).promise;
      closeups.push(canvas.toBuffer('image/png').toString('base64'));
    }

    page.cleanup();
  }

  return closeups;
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
