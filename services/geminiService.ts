import { GoogleGenAI, Type } from "@google/genai";
import { Door, HardwareSet, HardwareItem, ValidationReport, ValidationError, AppSettings } from '../types';
import { getLearnedExamples } from './mlOpsService';
import { generateAIContent } from './aiProviderService';

/**
 * Safely parses a JSON string that might be malformed.
 * ... (No cleanup changes needed here) ...
 */
const safeParseJson = <T>(text: string): T => {
    // 1. Initial cleanup: find JSON block if wrapped in markdown.
    let jsonText = text;
    const markdownMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[1]) {
        jsonText = markdownMatch[1];
    }

    // 2. Isolate the core JSON string from potential surrounding text.
    const jsonStart = jsonText.indexOf('{');
    const arrayStart = jsonText.indexOf('[');
    let start = -1;
    if (jsonStart === -1) start = arrayStart;
    else if (arrayStart === -1) start = jsonStart;
    else start = Math.min(jsonStart, arrayStart);
    if (start === -1) throw new SyntaxError("No JSON object or array found in the response.");

    const jsonEnd = jsonText.lastIndexOf('}');
    const arrayEnd = jsonText.lastIndexOf(']');
    const end = Math.max(jsonEnd, arrayEnd);
    if (end === -1) throw new SyntaxError("Could not find the end of the JSON object or array.");
    let jsonString = jsonText.substring(start, end + 1);

    // 3. Iterative, parser-guided fixing loop.
    for (let i = 0; i < 100; i++) { 
        try {
            return JSON.parse(jsonString) as T;
        } catch (e) {
            if (e instanceof SyntaxError) {
                const message = (e as Error).message;
                const match = message.match(/position (\d+)/i);
                
                if (match && match[1]) {
                    const errorPos = parseInt(match[1], 10);
                    let fixed = false;

                    // --- HEURISTIC 1: ADD MISSING COMMA ---
                    let prevCharIndex = errorPos - 1;
                    while (prevCharIndex >= 0 && /\s/.test(jsonString[prevCharIndex])) {
                        prevCharIndex--;
                    }
                    if (prevCharIndex >= 0) {
                        const prevChar = jsonString[prevCharIndex];
                        const errorChar = jsonString[errorPos];
                        
                        const isEndOfValue = ['"', '}', ']', 'e', 'l'].includes(prevChar) || (prevChar >= '0' && prevChar <= '9');
                        const isStartOfKeyOrValue = ['"', '{', '['].includes(errorChar);

                        if (isEndOfValue && isStartOfKeyOrValue) {
                            jsonString = jsonString.substring(0, errorPos) + ',' + jsonString.substring(errorPos);
                            fixed = true;
                        }
                    }
                    
                    // --- HEURISTIC 2: ESCAPE UNESCAPED DOUBLE QUOTES ---
                    if (!fixed && jsonString[errorPos] === '"') {
                        const lastStructuralChar = Math.max(
                            jsonString.lastIndexOf(':', errorPos), 
                            jsonString.lastIndexOf(',', errorPos), 
                            jsonString.lastIndexOf('[', errorPos)
                        );
                        if (lastStructuralChar > -1) {
                            const substring = jsonString.substring(lastStructuralChar, errorPos);
                            const quoteCount = (substring.match(/"/g) || []).length;
                            if (quoteCount % 2 === 1) { 
                                jsonString = jsonString.substring(0, errorPos) + '\\' + jsonString.substring(errorPos);
                                fixed = true;
                            }
                        }
                    }
                    
                    // --- HEURISTIC 3: REMOVE TRAILING COMMA ---
                    if (!fixed) {
                        let prevMeaningfulCharIndex = errorPos - 1;
                        while (prevMeaningfulCharIndex >= 0 && /\s/.test(jsonString[prevMeaningfulCharIndex])) {
                            prevMeaningfulCharIndex--;
                        }
                        if (prevMeaningfulCharIndex >= 0) {
                            const prevChar = jsonString[prevMeaningfulCharIndex];
                            const errorChar = jsonString[errorPos];
                            if (prevChar === ',' && [']', '}'].includes(errorChar)) {
                                jsonString = jsonString.substring(0, prevMeaningfulCharIndex) + jsonString.substring(prevMeaningfulCharIndex + 1);
                                fixed = true;
                            }
                        }
                    }

                    if (fixed) continue; 
                }
            }
            console.error("Failed to parse cleaned JSON string:", jsonString);
            const newError = new SyntaxError(`We detected text in the file, but could not extract valid hardware data. Please manually review the file for legibility.`);
            (newError as any).jsonString = jsonString; 
            throw newError;
        }
    }

    throw new SyntaxError("Failed to parse JSON after multiple automated correction attempts.");
};


const hardwareSetAssignmentSchema = {
    type: Type.OBJECT,
    properties: {
        setName: { type: Type.STRING },
        adjustedHardware: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    name: { type: Type.STRING },
                    quantity: { type: Type.NUMBER },
                    manufacturer: { type: Type.STRING },
                    description: { type: Type.STRING },
                    finish: { type: Type.STRING },
                },
                required: ["id", "name", "quantity", "manufacturer", "description", "finish"],
            },
        },
    },
    required: ["setName", "adjustedHardware"],
};

const hardwareSetArraySchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            id: { type: Type.STRING, description: "A unique ID for the hardware set, e.g., 'hs-pdf-1'" },
            name: { type: Type.STRING, description: "The specific hardware set number/code ONLY." },
            doorTags: { type: Type.STRING, description: "Comma-separated list of door tags/identifiers." },
            description: { type: Type.STRING, description: "Operational notes or general descriptions." },
            division: { type: Type.STRING, description: "The specification division, e.g., 'Division 08'" },
            extractionWarnings: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "List of specific errors if data was missing."
            },
            items: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.STRING, description: "A unique ID for the item" },
                        name: { type: Type.STRING },
                        quantity: { type: Type.NUMBER },
                        manufacturer: { type: Type.STRING },
                        description: { type: Type.STRING },
                        finish: { type: Type.STRING },
                    },
                    required: ["id", "name", "quantity", "manufacturer", "description", "finish"],
                },
            },
        },
        required: ["id", "name", "description", "division", "items"],
    },
};

const doorArraySchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            id: { type: Type.STRING },
            doorTag: { type: Type.STRING },
            location: { type: Type.STRING },
            interiorExterior: { type: Type.STRING, enum: ['Interior', 'Exterior', 'N/A'] },
            quantity: { type: Type.NUMBER },
            liftCount: { type: Type.NUMBER },
            operation: { type: Type.STRING },
            fireRating: { type: Type.STRING },
            width: { type: Type.NUMBER },
            height: { type: Type.NUMBER },
            thickness: { type: Type.NUMBER },
            doorMaterial: { type: Type.STRING },
            frameMaterial: { type: Type.STRING },
            hardwarePrep: { type: Type.STRING },
            providedHardwareSet: { type: Type.STRING },
            schedule: { type: Type.STRING },
            type: { type: Type.STRING },
        },
        required: ["id", "doorTag", "location", "interiorExterior", "quantity", "type"],
    },
};

const adjustHingeQuantity = (set: HardwareSet, doorHeight: number): HardwareSet => {
    const requiredHinges = (doorHeight && doorHeight > 90) ? 4 : 3;
    const newItems = set.items.map(item => {
        const name = item.name.toLowerCase();
        if (name.includes('hinge')) {
             return { ...item, quantity: requiredHinges };
        }
        return item;
    });
    return { ...set, items: newItems };
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Robust retry mechanism using the abstracted AI provider
const generateWithRetry = async (model: string, prompt: string, schema: any, apiKey?: string, retries = 5, baseDelay = 5000, settings?: AppSettings): Promise<any> => {
    // The aiProviderService will handle provider selection and API key management
    // We pass retries as an option
    try {
        const response = await generateAIContent(prompt, schema, {
            temperature: 0.1,
            maxRetries: retries,
            settings: settings // Pass injected settings
        });
        return response;
    } catch (error) {
        console.error('AI generation failed:', error);
        throw error;
    }
};

/**
 * OpenRouter with json_object mode wraps arrays in an object (e.g. { "hardwareSets": [...] }).
 * This helper extracts the first array found in whatever the AI returned.
 */
const extractArray = (parsed: any): any[] => {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') {
        for (const key of Object.keys(parsed)) {
            if (Array.isArray(parsed[key])) return parsed[key];
        }
    }
    return [];
};

const chunkArray = <T>(arr: T[], size: number): T[][] => {
    return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
        arr.slice(i * size, i * size + size)
    );
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
    };
    reader.onerror = error => reject(error);
  });
};

export const analyzeImageWithAI = async (
    imageFile: File, 
    promptText: string,
    apiKey?: string
): Promise<string> => {
    const key = apiKey || process.env.VITE_GEMINI_API_KEY;
    if (!key) {
        throw new Error("No Gemini API Key provided. Please update your settings.");
    }

    const ai = new GoogleGenAI({ apiKey: key });

    try {
        const base64Data = await fileToBase64(imageFile);
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp', 
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: promptText },
                        { 
                            inlineData: { 
                                mimeType: imageFile.type, 
                                data: base64Data 
                            } 
                        }
                    ]
                }
            ]
        });

        return response.text || "No analysis generated.";

    } catch (error: any) {
        console.error("Error analyzing image:", error);
        throw new Error(`Image Analysis Failed: ${error.message}`);
    }
};

export const assignHardwareWithAI = async (
    door: Door, 
    sets: HardwareSet[], 
    model: string = 'gemini-2.5-flash',
    apiKey?: string
): Promise<{ assignedSet: HardwareSet; confidence: 'high' | 'medium' | 'low'; reason: string }> => {
    
    // For structured Excel uploads the hardware set lives in sections.hardware.hardwareSet;
    // fall back to the legacy flat field for PDF-extracted doors and older uploads.
    const provided = (door.sections?.hardware?.hardwareSet || door.providedHardwareSet)?.trim();

    if (provided) {
        const providedLower = provided.toLowerCase();
        const exactMatch = sets.find(s => s.name.trim().toLowerCase() === providedLower);
        if (exactMatch) {
            return {
                assignedSet: adjustHingeQuantity(exactMatch, door.height),
                confidence: 'high',
                reason: 'Exact Match',
            };
        }
        const firstToken = provided.split(/[\s-_]+/)[0].toLowerCase();
        if (firstToken) {
             const normalizedMatch = sets.find(s => s.name.trim().toLowerCase() === firstToken);
             if (normalizedMatch) {
                return {
                    assignedSet: adjustHingeQuantity(normalizedMatch, door.height),
                    confidence: 'medium',
                    reason: 'Normalized Match',
                };
             }
        }
    }

    const learnedExamples = getLearnedExamples();
    
    const prompt = `
        You are an expert door hardware estimator...
        (Prompt omitted for brevity)
        **Available Hardware Sets:**
        ${JSON.stringify(sets.map(s => ({ name: s.name, division: s.division, description: s.description })), null, 2)}
        ${learnedExamples}
        **Door to Estimate:**
        - Door Tag: ${door.doorTag}
        - Provided: ${door.sections?.hardware?.hardwareSet || door.providedHardwareSet}
        - Type: ${door.type}
        ...
    `;
    
    let parsedResponse;
    try {
        const response = await generateWithRetry(model, prompt, hardwareSetAssignmentSchema, apiKey);
        
        const jsonText = response.text?.trim(); 
        if (!jsonText) throw new Error("AI returned an empty response.");

        parsedResponse = safeParseJson(jsonText);
        
        const originalSet = sets.find(s => s.name === parsedResponse.setName);
        if (!originalSet) {
             const matchedSet = sets.find(s => s.name.toLowerCase().includes(parsedResponse.setName.toLowerCase()));
             if(matchedSet) {
                   const newHardwareSet: HardwareSet = {
                    ...matchedSet,
                    items: parsedResponse.adjustedHardware as HardwareItem[],
                };
                return { assignedSet: newHardwareSet, confidence: 'low', reason: 'AI Fuzzy Match' };
             }
             throw new Error(`AI chose a non-existent set: "${parsedResponse.setName}"`);
        }

        const newHardwareSet: HardwareSet = {
            ...originalSet,
            items: parsedResponse.adjustedHardware as HardwareItem[],
        };

        return { assignedSet: newHardwareSet, confidence: 'low', reason: 'AI Fuzzy Match' };

    } catch (error: any) {
        console.error('Error in AI assignment:', error);
        throw error;
    }
};

const extractHardwareSetsFromChunk = async (text: string, model: string, chunkIndex: number, apiKey?: string, settings?: AppSettings): Promise<HardwareSet[]> => {
    const prompt = `
        Analyze the following text from a construction document (Hardware Sets/Groups) and extract a list of Hardware Sets.
        Return a JSON array of objects.
        
        Schema:
        [{
            "name": "string (The Set Name/Heading, e.g., 'HW-1', 'Set 01')",
            "description": "string (General description of the set)",
            "doorTags": "string (List of doors assigned to this set)",
            "division": "string (e.g., 'Division 08')",
            "items": [{
                "name": "string (Item name/type, e.g., 'Hinge', 'Lockset')",
                "description": "string (Full spec description)",
                "quantity": "number",
                "manufacturer": "string",
                "finish": "string"
            }]
        }]
        
        Raw Text:
        ${text}
    `;

    try {
        const response = await generateWithRetry(model, prompt, hardwareSetArraySchema, apiKey, 5, 5000, settings);
        
        const jsonText = response.text?.trim();
        if (!jsonText) throw new Error("AI returned an empty response.");
        
        const rawSets = extractArray(safeParseJson<any>(jsonText));

        return (rawSets)
            .filter(Boolean)
            .map((set: any, setIndex: number) => {
                 const items = (set.items || []).map((item: any, itemIndex: number) => ({
                    id: item.id || `item-pdf-${Date.now()}-${chunkIndex}-${setIndex}-${itemIndex}`,
                    name: item.name,
                    quantity: typeof item.quantity === 'number' ? item.quantity : 1,
                    manufacturer: item.manufacturer || '',
                    description: item.description || '',
                    finish: item.finish || ''
                 }));
                 return {
                    id: set.id,
                    name: set.name,
                    description: set.description,
                    doorTags: set.doorTags,
                    division: set.division,
                    items
                 };
            });
    } catch (error) {
        throw error;
    }
};

export const extractHardwareSetsFromText = async (
    text: string, 
    model: string = 'gemini-2.5-flash', 
    apiKey?: string, 
    onProgress?: (percent: number) => void,
    settings?: AppSettings // Added settings parameter
): Promise<ValidationReport<HardwareSet>> => {
    const pages = text.split('\n\n');
    const CHUNK_SIZE = 10; // Reduced to 10 to avoid output token limits
    
    if (pages.length <= CHUNK_SIZE) {
        const res = await extractHardwareSetsFromChunk(text, model, 0, apiKey, settings);
        if (onProgress) onProgress(100);
        return validateHardwareSets(res);
    }

    const chunks = chunkArray(pages, CHUNK_SIZE).map(c => c.join('\n\n'));
    const totalChunks = chunks.length;
    let completedChunks = 0;
    const results: HardwareSet[] = [];

    // Process sequentially to be safe with Free Tier rate limits
    const CONCURRENCY = 1;
    for (let i = 0; i < totalChunks; i += CONCURRENCY) {
        const batch = chunks.slice(i, i + CONCURRENCY);
        const batchPromises = batch.map((chunk, batchIdx) => 
            extractHardwareSetsFromChunk(chunk, model, i + batchIdx, apiKey, settings)
                .then(res => {
                    completedChunks++;
                    if (onProgress) onProgress(Math.round((completedChunks / totalChunks) * 100));
                    return res;
                })
        );
        
        try {
            const batchResults = await Promise.all(batchPromises);
            batchResults.forEach(r => results.push(...r));
        } catch (e) {
            console.error("Batch processing error:", e);
            throw e;
        }
    }

    return validateHardwareSets(results);
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
                suggestion: 'Every hardware set must have a name (e.g. Set 01, HW-1) to be imported by the AI.',
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
                    suggestion: `The AI found multiple sets named "${set.name}". Only the first one in this chunk is kept.`,
                    severity: 'error'
                });
                isFatal = true; 
                errorCount++;
            }
            if (set.name) setNames.add(normalizedName);
        }

        // 3. Warning: Empty Items
        if (!set.items || set.items.length === 0) {
             validationErrors.push({
                row: rowId,
                field: 'items',
                value: 0,
                issue: 'Set Warning: No items extracted for this set',
                suggestion: 'The AI could not find specific hardware items for this set. Please verify the PDF content.',
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

const extractDoorsFromChunk = async (text: string, model: string, chunkIndex: number, apiKey?: string, settings?: AppSettings): Promise<Door[]> => {
    const prompt = `
        Analyze the following text from a construction document (Door Schedule) and extract a list of doors.
        Return a JSON array of objects adhering to this schema:
        
        [{
            "doorTag": "string (The door number/tag, e.g., '101', 'D-102')",
            "location": "string (Room name or location)",
            "interiorExterior": "string ('Interior', 'Exterior', or 'N/A')",
            "quantity": "number (Count of this specific door type)",
            "type": "string (e.g., 'Single', 'Pair', 'Double', 'Unequal Pair')",
            "width": "number (Width in INCHES. Convert '3070', '3\\'0\"', '3.0' etc to INCHES e.g., 36. If value < 10, treat as feet and convert.)",
            "height": "number (Height in INCHES. Convert '7\\'0\"', '7070', '7.0' etc to INCHES e.g., 84. If value < 10, treat as feet and convert.)",
            "thickness": "number (Thickness in INCHES, e.g. 1.75)",
            "doorMaterial": "string (e.g. 'WD', 'HM', 'ALum')",
            "frameMaterial": "string (e.g. 'HM', 'Alum')",
            "hardwarePrep": "string (Any hardware notes)",
            "providedHardwareSet": "string (The hardware set name specified, e.g. 'HW-1', 'Set 03')",
            "fireRating": "string (e.g. '20 min', '3 HR', 'Non-Rated')",
            "schedule": "string (The extracted raw text line for reference)"
        }]

        CRITICAL RULES:
        1. **Dimensions**: Always output width and height in INCHES. 
           - '3070' -> Width: 36, Height: 84
           - '3-0' or '3\\'0"' -> Width: 36
           - '6\\'0"' -> Width: 72
           - **Multipliers**: If text says "2*3'-0"" or "2x3070", this means QUANTITY = 2 (or existing qty * 2) and Width = 36.
           - **Unequal Pairs**: If text says "1'-4\", 3'-6\"", SUM them for total width (e.g. 16+42 = 58). Set type to 'Unequal Pair'.
        2. **Quantity**: Look closely for "2*", "3x" prefixes in Size columns. If found, use that as the quantity for this row.
        3. **Missing Data**: If a value is missing or illegible, set it to null or 0 (for numbers).
        4. **Type**: Infer 'Pair' if the door is listed as a pair or double.
        
        Raw Text:
        ${text}
    `;
    try {
        const response = await generateWithRetry(model, prompt, doorArraySchema, apiKey, 5, 5000, settings);
        const jsonText = response.text?.trim();
        const rawDoors = extractArray(safeParseJson<any>(jsonText));
        return rawDoors.map((d: any, index: number) => ({
             id: d.id || `door-${Date.now()}-${chunkIndex}-${index}`,
             doorTag: d.doorTag || 'Unknown',
             location: d.location || '',
             interiorExterior: d.interiorExterior || 'N/A',
             quantity: typeof d.quantity === 'number' ? d.quantity : 1,
             liftCount: d.liftCount || 0,
             operation: d.operation || '',
             fireRating: d.fireRating || '',
             width: d.width || 0,
             height: d.height || 0,
             thickness: d.thickness || 0,
             doorMaterial: d.doorMaterial || '',
             frameMaterial: d.frameMaterial || '',
             hardwarePrep: d.hardwarePrep || '',
             providedHardwareSet: d.providedHardwareSet || '',
             schedule: d.schedule || '',
             type: d.type || 'Single',
             status: 'pending'
        }));
    } catch (error) { throw error; }
};

export const extractDoorsFromText = async (
    text: string, 
    model: string = 'gemini-2.5-flash', 
    apiKey?: string, 
    onProgress?: (percent: number) => void,
    settings?: AppSettings // Added settings parameter
): Promise<ValidationReport<Door>> => {
    const pages = text.split('\n\n');
    const CHUNK_SIZE = 10;
    
    // Immediate extraction for small files
    if (pages.length <= CHUNK_SIZE) {
        const doors = await extractDoorsFromChunk(text, model, 0, apiKey, settings);
        if (onProgress) onProgress(100);
        return validateDoors(doors);
    }
    
    // Chunk processing for large files
    const chunks = chunkArray(pages, CHUNK_SIZE).map(c => c.join('\n\n'));
    const totalChunks = chunks.length;
    let completedChunks = 0;
    let allDoors: Door[] = [];

    const CONCURRENCY = 1;
    for (let i = 0; i < totalChunks; i += CONCURRENCY) {
        const batch = chunks.slice(i, i + CONCURRENCY);
        const batchPromises = batch.map((chunk, batchIdx) => 
            extractDoorsFromChunk(chunk, model, i + batchIdx, apiKey, settings)
                .then(res => {
                     completedChunks++;
                     if (onProgress) onProgress(Math.round((completedChunks / totalChunks) * 100));
                     return res;
                })
        );

        try {
             const batchResults = await Promise.all(batchPromises);
             batchResults.flat().forEach(d => allDoors.push(d));
        } catch (error) {
            console.error('Error processing batch:', error);
            throw error;
        }
    }

    return validateDoors(allDoors);
};

// Helper Validation Function
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
                suggestion: 'Every door must have a unique identifier (Tag/Mark) for the AI to process it.',
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
                    suggestion: `The door tag "${d.doorTag}" was found multiple times in this AI session. Only the first one is imported.`,
                    severity: 'error'
                });
                isFatal = true; 
                errorCount++;
            }
            seenTags.add(normalizedTag);
        }

        // 3. Normalization (Feet -> Inches)
        if (d.width > 0 && d.width < 10) d.width = Math.round(d.width * 12);
        if (d.height > 0 && d.height < 10) d.height = Math.round(d.height * 12);

        // 4. Warning: Invalid Dimensions
        if (d.width === 0 || d.height === 0) {
             validationErrors.push({
                row: rowId,
                field: 'dimensions',
                value: `${d.width}x${d.height}`,
                issue: 'Item Warning: Missing/Invalid Dimensions',
                suggestion: 'Check width/height in raw data. The AI might have missed them.',
                severity: 'warning'
            });
            warningCount++;
        }

        // 5. Warning: Missing Type
        if (!d.type || d.type === 'Unknown') {
             validationErrors.push({
                row: rowId,
                field: 'type',
                value: d.type,
                issue: 'Item Warning: Missing Door Type',
                suggestion: 'The AI could not determine the door type (Single/Pair). Defaulted to "Single".',
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