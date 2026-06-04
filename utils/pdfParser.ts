import { ERRORS } from '@/constants/errors';
import { ELEVATION_EXTRACTION } from '@/constants/elevationExtraction';

/** A single text item from a PDF page, positioned in rendered-image pixel space. */
export interface PDFPageTextItem {
    str: string;
    x: number;   // left edge, image pixels (top-left origin)
    y: number;   // top edge, image pixels
    w: number;
    h: number;
}

export interface PDFPageImageResult {
    pageNumber: number;
    totalPages: number;
    imageBase64: string;
    progress: number;
    textItems: PDFPageTextItem[];
}

export async function* renderPDFPagesAsImages(
    file: File,
    options?: { scale?: number },
): AsyncGenerator<PDFPageImageResult> {
    const pdfjsLib = await import('pdfjs-dist');
    // Main-thread usage — point to the real worker served from /public.
    // Cannot use workerSrc = '' here (unlike extractTextGenerator which runs
    // inside a Web Worker where nested workers are forbidden). pdfjs v5 throws
    // on an empty workerSrc when called from the main thread.
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    const scale = options?.scale ?? ELEVATION_EXTRACTION.PDF_RENDER_SCALE;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });

        // ── Render page to image ──────────────────────────────────────────
        // pdfjs-dist v5 requires an HTMLCanvasElement via the `canvas` param.
        // OffscreenCanvas is not assignable to HTMLCanvasElement, so we use
        // document.createElement('canvas') which is correct for main-thread usage.
        const canvas = document.createElement('canvas');
        canvas.width  = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas, viewport }).promise;
        const imageBase64 = canvas.toDataURL('image/jpeg', 0.75);

        // ── Extract text with image-space coordinates ─────────────────────
        // PDF user space: origin bottom-left, y grows upward.
        // Image space: origin top-left, y grows downward.
        // viewport.height at the render scale is the image height in pixels.
        const textItems: PDFPageTextItem[] = [];
        try {
            const textContent = await page.getTextContent();
            const imgH = viewport.height; // image height in px at render scale

            // Cast to the TextItem shape — items array contains TextItem | TextMarkedContent
            // and pdfjs-dist v5 doesn't narrow after 'str' in item for transform/width/height.
            type PdfjsTextItem = { str: string; transform: number[]; width: number; height: number };
            for (const raw of textContent.items) {
                const item = raw as PdfjsTextItem;
                if (!item.str?.trim()) continue;

                // transform = [scaleX, skewY, skewX, scaleY, originX, originY]
                // originX/Y are in PDF user space (bottom-left origin, unscaled).
                const pdfX = item.transform[4];
                const pdfY = item.transform[5];

                // Scale to image pixels and flip Y axis.
                // item.width / item.height are in PDF user space units.
                const iw = item.width  * scale;
                const ih = item.height * scale;
                const ix = pdfX * scale;
                // pdfY is the text baseline; subtract scaled height to get the top.
                const iy = imgH - (pdfY * scale) - ih;

                textItems.push({ str: item.str, x: ix, y: iy, w: iw, h: ih });
            }
        } catch {
            // Text extraction is non-critical — image rendering is what matters.
        }

        page.cleanup();
        await new Promise(r => setTimeout(r, 5));

        yield {
            pageNumber: pageNum,
            totalPages: numPages,
            imageBase64,
            textItems,
            progress: Math.round((pageNum / numPages) * 100),
        };
    }
}

/**
 * Result structure for a batch of pages
 */
export interface PDFBatchResult {
    text: string;
    startPage: number;
    endPage: number;
    totalPages: number;
    progress: number;
}

/**
 * Generates text chunks from a PDF file in batches.
 * This allows for processing large files without locking the UI or consuming excessive memory.
 * It also enables "stopping" early by simply breaking the iteration loop.
 *
 * @param file The PDF file to parse.
 * @param batchSize Number of pages to process in each yield.
 */
export async function* extractTextGenerator(file: File, batchSize: number = 20): AsyncGenerator<PDFBatchResult> {
    // Lazy import — keeps pdfjs-dist out of the server bundle
    const pdfjsLib = await import('pdfjs-dist');
    // Always use FakeWorker (workerSrc = '').
    //
    // Why: Turbopack statically analyzes `new URL('...worker...', import.meta.url)`
    // patterns regardless of surrounding if-conditions. When upload.worker.ts is
    // bundled, that pattern causes Turbopack to try to create a nested module-worker
    // asset inside the outer worker bundle — which fails in Next.js 15.5.x and
    // prevents the upload worker from loading at all.
    //
    // The Turbopack alias in next.config.ts already maps pdf.worker.min.mjs to
    // the empty stub anyway, so the runtime branch that set the real worker URL
    // was a no-op (pdfjs fell back to FakeWorker in all cases).
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';

    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;


        // Last page text from the previous batch — prepended as context so the
        // AI can continue hardware sets that straddle a batch boundary.
        let prevPageContextText = '';

        for (let i = 0; i < numPages; i += batchSize) {
            const batchPromises = [];
            const start = i;
            const end = Math.min(i + batchSize, numPages);

            // Fetch text for the current batch
            for (let j = start; j < end; j++) {
                // pdf.getPage is 1-indexed
                batchPromises.push(
                    pdf.getPage(j + 1).then(async (page) => {
                        const content = await page.getTextContent();
                        // @ts-ignore
                        const strings = content.items.map((item: any) => item.str).join(' ');
                        page.cleanup();
                        return { index: j, text: strings };
                    })
                );
            }

            const batchResults = await Promise.all(batchPromises);

            // Re-assemble in order
            const sorted = batchResults.sort((a, b) => a.index - b.index);
            const batchText = sorted.map(r => r.text).join('\n\n');

            // Build final text: prepend previous-batch context when available
            let yieldText = batchText;
            if (prevPageContextText) {
                yieldText =
                    `[CONTEXT: last page from previous section — for continuity only, do NOT re-extract]\n` +
                    prevPageContextText +
                    `\n[END CONTEXT — extract only from the pages below]\n\n` +
                    batchText;
            }

            // Save last page of this batch as context for the next iteration
            prevPageContextText = sorted[sorted.length - 1]?.text ?? '';

            const progress = Math.round((end / numPages) * 100);

            yield {
                text: yieldText,
                startPage: start + 1,
                endPage: end,
                totalPages: numPages,
                progress
            };

            // Yield to event loop to keep UI responsive
            await new Promise(resolve => setTimeout(resolve, 10));
        }

    } catch (error: any) {
        console.error("Failed to parse PDF:", error);
        throw new Error(ERRORS.PDF.PARSE_FAILED.message);
    }
}

/**
 * Legacy wrapper for backward compatibility or simple one-shot usage.
 */
export const extractTextFromPDF = async (file: File, onProgress?: (percent: number) => void): Promise<string> => {
    let fullText = '';
    
    // Use the generator to process all chunks
    for await (const batch of extractTextGenerator(file)) {
        fullText += (fullText ? '\n\n' : '') + batch.text;
        if (onProgress) onProgress(batch.progress);
    }
    
    return fullText;
};
