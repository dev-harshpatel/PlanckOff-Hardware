
/**
 * Extracts raw text content from a DOCX file using Mammoth.js.
 * @param file The DOCX file to parse.
 * @returns A promise that resolves with the raw text content.
 */
export const extractTextFromDOCX = async (file: File): Promise<string> => {
    // Safe access to global scope (works in Window and Worker)
    const globalScope = typeof window !== 'undefined' ? window : self as any;
    
    if (!globalScope.mammoth) {
        throw new Error("The Word document processing library (Mammoth) is not loaded. If you are uploading a .docx file, this feature currently requires the main thread or npm package implementation.");
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        // extractRawText extracts all text from the document, ignoring formatting.
        // This is usually suitable for passing to an LLM for parsing.
        const result = await globalScope.mammoth.extractRawText({ arrayBuffer });
        return result.value;
    } catch (error) {
        console.error("Failed to parse DOCX:", error);
        throw new Error("Could not read the provided Word document. It might be corrupted or password protected.");
    }
};
