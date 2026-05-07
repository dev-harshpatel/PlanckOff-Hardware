
import { ERRORS } from '@/constants/errors';

/**
 * Extracts raw text content from a DOCX file using Mammoth.js.
 * @param file The DOCX file to parse.
 * @returns A promise that resolves with the raw text content.
 */
export const extractTextFromDOCX = async (file: File): Promise<string> => {
    // Safe access to global scope (works in Window and Worker)
    const globalScope = typeof window !== 'undefined' ? window : self as any;
    
    if (!globalScope.mammoth) {
        throw new Error(ERRORS.HARDWARE.DOCX_LIBRARY_MISSING.message);
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        // extractRawText extracts all text from the document, ignoring formatting.
        // This is usually suitable for passing to an LLM for parsing.
        const result = await globalScope.mammoth.extractRawText({ arrayBuffer });
        return result.value;
    } catch (error) {
        console.error("Failed to parse DOCX:", error);
        throw new Error(ERRORS.HARDWARE.DOCX_READ_FAILED.message);
    }
};
