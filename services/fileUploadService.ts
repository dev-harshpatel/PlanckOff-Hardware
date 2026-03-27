
import { Door, HardwareSet, ValidationReport, ValidationError, AppSettings } from '../types';
import { extractTextFromPDF, extractTextGenerator, PDFBatchResult } from '../utils/pdfParser'; // Import generator
import { extractTextFromDOCX } from '../utils/docxParser';
import { extractDoorsFromText, extractHardwareSetsFromText } from './geminiService';
import { parseDoorScheduleCSV, parseHardwareSetCSV } from '../utils/csvParser';
import { parseDoorScheduleXLSX, parseHardwareSetXLSX } from '../utils/xlsxParser';

// ... (omitted)

// --- Validation Helpers (Mirrored from geminiService for consistency across manual parsing) ---

const validateDoors = (doors: Door[]): ValidationReport<Door> => {
    const validationErrors: ValidationError[] = [];
    const validDoors: Door[] = [];
    const seenTags = new Set<string>();
    let errorCount = 0;
    let warningCount = 0;

    doors.forEach((d, index) => {
        let isFatal = false;
        const rowId = d.doorTag || `Row ${index + 1}`; 

        // 1. Critical: Missing Door Tag
        if (!d.doorTag || d.doorTag === 'Unknown' || d.doorTag.trim() === '') {
            validationErrors.push({
                row: index + 1,
                field: 'doorTag',
                value: d.doorTag,
                issue: 'Row Skipped: Missing Door Tag',
                suggestion: 'Every door must have a unique identifier (Tag/Mark) to be imported.',
                severity: 'error'
            });
            isFatal = true;
            errorCount++;
        } else {
            // 2. Critical: Duplicate Door Tag
            const normalizedTag = d.doorTag.trim().toLowerCase();
            if (seenTags.has(normalizedTag)) {
                validationErrors.push({
                    row: rowId,
                    field: 'doorTag',
                    value: d.doorTag,
                    issue: 'Row Skipped: Duplicate Door Tag',
                    suggestion: `The door tag "${d.doorTag}" appears multiple times. Only the first occurrence is kept.`,
                    severity: 'error'
                });
                isFatal = true; 
                errorCount++;
            }
            seenTags.add(normalizedTag);
        }

        // Normalization (Feet -> Inches)
        if (d.width > 0 && d.width < 10) d.width = Math.round(d.width * 12);
        if (d.height > 0 && d.height < 10) d.height = Math.round(d.height * 12);

        // 3. Warning: Missing Dimensions
        if (d.width === 0 || d.height === 0) {
             validationErrors.push({
                row: rowId,
                field: 'dimensions',
                value: `${d.width}x${d.height}`,
                issue: 'Item Warning: Missing/Invalid Dimensions',
                suggestion: 'Width or Height is 0. Please verify the dimensions in the source file.',
                severity: 'warning'
            });
            warningCount++;
        }

        if (!isFatal) {
            validDoors.push(d);
        }
    });

    return {
        data: validDoors,
        errors: validationErrors.filter(e => e.severity === 'error'),
        warnings: validationErrors.filter(e => e.severity === 'warning'),
        summary: {
            totalProcessed: doors.length,
            validCount: validDoors.length,
            errorCount,
            warningCount
        }
    };
};

const validateHardwareSets = (sets: HardwareSet[]): ValidationReport<HardwareSet> => {
    const validationErrors: ValidationError[] = [];
    const validSets: HardwareSet[] = [];
    const setNames = new Set<string>();
    let errorCount = 0;
    let warningCount = 0;

    sets.forEach((set, index) => {
        let isFatal = false;
        const rowId = set.name || `Set ${index + 1}`;

        // 1. Critical: Missing Set Name
        if (!set.name || set.name.trim() === '') {
             validationErrors.push({
                row: index + 1,
                field: 'name',
                value: '',
                issue: 'Set Skipped: Missing Hardware Set Name',
                suggestion: 'Every hardware set must have a name (e.g. Set 01, HW-1) to be imported.',
                severity: 'error'
            });
            isFatal = true;
            errorCount++;
        } else {
            // 2. Critical: Duplicate Set Name
            const normalizedName = set.name.trim().toLowerCase();
            if (setNames.has(normalizedName)) {
                validationErrors.push({
                    row: rowId,
                    field: 'name',
                    value: set.name,
                    issue: 'Set Skipped: Duplicate Hardware Set',
                    suggestion: `The set name "${set.name}" appears multiple times in this file. Only the first occurrence is kept.`,
                    severity: 'error'
                });
                isFatal = true; 
                errorCount++;
            }
            setNames.add(normalizedName);
        }

        // 3. Warning: Empty Items
        if (!set.items || set.items.length === 0) {
             validationErrors.push({
                row: rowId,
                field: 'items',
                value: 0,
                issue: 'Set Warning: No items found in this set',
                suggestion: 'This set was imported but appears to be empty. Please verify the source document.',
                severity: 'warning'
            });
            warningCount++;
        }

        // 4. Warning: Missing Division
        if (!set.division) {
             validationErrors.push({
                row: rowId,
                field: 'division',
                value: '',
                issue: 'Item Warning: Missing Division',
                suggestion: 'Defaulted to "Division 08".',
                severity: 'warning'
            });
            set.division = 'Division 08'; 
            warningCount++;
        }

        if (!isFatal) {
            validSets.push(set);
        }
    });

    return {
        data: validSets,
        errors: validationErrors.filter(e => e.severity === 'error'),
        warnings: validationErrors.filter(e => e.severity === 'warning'),
        summary: {
            totalProcessed: sets.length,
            validCount: validSets.length,
            errorCount,
            warningCount
        }
    };
};

/**
 * Processes a door schedule file and returns a ValidationReport.
 */
/**
 * Processes a door schedule file.
 * Now supports streaming data updates via onData callback.
 */
export const processDoorScheduleFile = async (
    file: File, 
    apiKey?: string, 
    onProgress?: (stage: string, percent: number) => void,
    onData?: (doors: Door[]) => void,
    signal?: AbortSignal, // Add signal
    settings?: AppSettings // Added settings parameter
): Promise<ValidationReport<Door>> => {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    // 1. File Size Check (10MB Limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum allowed size is 10MB.`);
    }

    const excelMimeTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    const excelExtensions = ['.xlsx', '.xls'];

    // PDF (AI) - CHUNKED
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
        let allDoors: Door[] = [];
        
        // Use generator to process chunks
        const generator = extractTextGenerator(file, 10); // Batch size 10 for AI
        
        for await (const batch of generator) {
            // Check signal
            if (signal?.aborted) {
                if (signal.reason === 'stop') break; // Graceful stop
                throw new Error('Upload cancelled');
            }

            onProgress?.(`Analyzing Pages ${batch.startPage}-${batch.endPage}`, batch.progress);
            
            // Analyze chunk
            const report = await extractDoorsFromText(batch.text, undefined, apiKey, undefined, settings);
            
            // Emit chunk data
            if (report.data && report.data.length > 0) {
                // Adjust row IDs if needed, or just push
                onData?.(report.data);
                allDoors = [...allDoors, ...report.data];
            }
        }
        
        return validateDoors(allDoors);
    } 
    // CSV
    else if (fileType === 'text/csv' || fileName.endsWith('.csv')) {
        const csvText = await file.text();
        const doors = await parseDoorScheduleCSV(csvText);
        onData?.(doors); // Emit all at once
        return validateDoors(doors);
    } 
    // Excel
    else if (excelMimeTypes.includes(fileType) || excelExtensions.some(ext => fileName.endsWith(ext))) {
        const arrayBuffer = await file.arrayBuffer();
        const doors = await parseDoorScheduleXLSX(arrayBuffer);
        onData?.(doors);
        return validateDoors(doors);
    } 
    // Word (DOCX) (AI)
    else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.endsWith('.docx')) {
        const docText = await extractTextFromDOCX(file);
        const report = await extractDoorsFromText(docText, undefined, apiKey, undefined, settings);
        onData?.(report.data);
        return report;
    }
    // Text (AI)
    else if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
        const textContent = await file.text();
        const report = await extractDoorsFromText(textContent, undefined, apiKey, undefined, settings);
        onData?.(report.data);
        return report;
    }
    else {
        throw new Error(`Unsupported door schedule file type for "${file.name}". Supported formats: CSV, Excel, PDF, Word (.docx), Text.`);
    }
};

/**
 * Processes a hardware set file and returns a ValidationReport.
 */
// Similar update for Hardware Sets
export const processHardwareSetFile = async (
    file: File, 
    apiKey?: string, 
    onProgress?: (stage: string, percent: number) => void,
    onData?: (sets: HardwareSet[]) => void,
    signal?: AbortSignal,
    settings?: AppSettings // Added settings parameter
): Promise<ValidationReport<HardwareSet>> => {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    // 1. File Size Check (10MB Limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum allowed size is 10MB.`);
    }

    const excelMimeTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    const excelExtensions = ['.xlsx', '.xls'];
    
    // PDF (AI) - CHUNKED
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
         let allSets: HardwareSet[] = [];
         
         const generator = extractTextGenerator(file, 10);
         
         for await (const batch of generator) {
             if (signal?.aborted) {
                 if (signal.reason === 'stop') break;
                 throw new Error('Upload cancelled');
             }

             onProgress?.(`Analyzing Pages ${batch.startPage}-${batch.endPage}`, batch.progress);
             
            // Analyze chunk
            const report = await extractHardwareSetsFromText(batch.text, undefined, apiKey, undefined, settings);
            
            // Emit chunk data
            if (report.data && report.data.length > 0) {
                onData?.(report.data);
                allSets = [...allSets, ...report.data];
            }
        }
        return validateHardwareSets(allSets);
   } 
   // ...
   // Word (DOCX) (AI)
   else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.endsWith('.docx')) {
       const docText = await extractTextFromDOCX(file);
       const report = await extractHardwareSetsFromText(docText, undefined, apiKey, undefined, settings);
       onData?.(report.data);
       return report;
   }
   // Text (AI)
   else if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
       const textContent = await file.text();
       const report = await extractHardwareSetsFromText(textContent, undefined, apiKey, undefined, settings);
        onData?.(report.data);
        return report;
    }
    else {
         throw new Error(`Unsupported hardware set file type for "${file.name}". Supported formats: PDF, CSV, Excel, Word (.docx), Text.`);
    }
};
