import { ERRORS } from '@/constants/errors';

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
    // When running inside a Web Worker (upload.worker.ts), import.meta.url is a
    // blob: URL and spawning a nested pdfjs sub-worker from it fails. Setting
    // workerSrc to '' makes pdfjs use its in-thread FakeWorker instead.
    if (typeof window !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
            'pdfjs-dist/build/pdf.worker.min.mjs',
            import.meta.url
        ).toString();
    } else {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;

        console.log(`PDF Loaded: ${numPages} pages. Starting generator...`);

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
