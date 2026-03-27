import * as pdfjsLib from 'pdfjs-dist';

// Set PDF.js worker source. `import.meta.url` works in both the browser main thread
// and inside a Web Worker (nested workers are supported in modern browsers).
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/**
 * Extracts all text content from a PDF file.
 * Uses local pdfjs-dist instead of unstable CDN global.
 * @param file The PDF file to parse.
 * @returns A promise that resolves with the full text content of the PDF.
 * @throws An error if parsing fails.
 */
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
    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;

        console.log(`PDF Loaded: ${numPages} pages. Starting generator...`);

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
            
            // Re-assemble in order (though Promise.all preserves order of promises, the index check is extra safety)
            const batchText = batchResults
                .sort((a, b) => a.index - b.index)
                .map(r => r.text)
                .join('\n\n');

            const progress = Math.round((end / numPages) * 100);

            yield {
                text: batchText,
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
        throw new Error(`PDF Parsing Error: ${error.message || 'Unknown error'}. Please check if the file is a valid PDF.`);
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
