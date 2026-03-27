
import { Door, HardwareSet, HardwareItem } from '../types';

/**
 * Parses a CSV string into an array of Door objects.
 * 
 * Searches for common header variations (e.g., "Door Tag", "doorTag", "door #").
 * Required columns: doorTag, width, height.
 * 
 * @param csvText The raw CSV string content.
 * @returns An array of Door objects.
 * @throws An error if the CSV format is invalid or missing required columns.
 */
export const parseDoorScheduleCSV = (csvText: string): Door[] => {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) {
        throw new Error("CSV file must contain a header row and at least one data row.");
    }

    // Handle potential Byte Order Mark (BOM) at the start of the file
    const headerLine = lines[0].startsWith('﻿') ? lines[0].substring(1) : lines[0];
    const dataLines = lines.slice(1);

    // Define mappings from internal property names to possible CSV header names.
    const headerMappings: { [key: string]: string[] } = {
        doorTag: ['doortag', 'door tag', 'door#', 'tag', 'mark', 'doornumber', 'doorid', 'opening', 'door no', 'door no.'],
        location: ['location', 'doorlocation', 'room', 'room name'],
        interiorExterior: ['interiorexterior', 'interior/exterior', 'int/ext', 'position'],
        quantity: ['quantity', 'qty', 'q', 'count'],
        liftCount: ['liftcount', 'doorliftcount', 'door lift count'],
        operation: ['operation', 'dooroperation', 'hand', 'swing'],
        fireRating: ['firerating', 'fire rating', 'rating', 'fire'],
        width: ['width', 'doorwidth', 'w', 'rough opening width'],
        height: ['height', 'doorheight', 'h', 'rough opening height'],
        thickness: ['thickness', 'doorthickness', 'thick', 'thk'],
        doorMaterial: ['doormaterial', 'door material', 'material', 'door mat', 'dr mat'],
        frameMaterial: ['framematerial', 'frame material', 'frame mat', 'frm mat'],
        hardwarePrep: ['hardwareprep', 'hardware prep', 'hw prep', 'prep', 'function', 'device'],
        // Removed generic 'set' to avoid matching non-hardware columns.
        providedHardwareSet: ['hardwareset', 'hwset', 'hw set', 'hardware set', 'set #', 'hws', 'hardware group', 'hw group'],
        schedule: ['schedule', 'door schedule'],
        type: ['type', 'doortype', 'description', 'remarks', 'comments']
    };
    
    // Normalize a string for robust matching (lowercase, remove non-alphanumeric).
    const normalizeHeader = (header: string) => (header || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const fileHeaders = headerLine.split(',').map(h => normalizeHeader(h.trim()));

    // Create a reverse map from normalized possible names back to our internal property key.
    const reverseMappings: { [key: string]: keyof Door } = {};
    for (const key in headerMappings) {
        headerMappings[key].forEach(alias => {
            reverseMappings[normalizeHeader(alias)] = key as keyof Door;
        });
    }

    // Map the index of each column in the file to our internal property key.
    const columnIndexMap: { [key in keyof Door]?: number } = {};
    fileHeaders.forEach((header, index) => {
        const key = reverseMappings[header];
        if (key) {
            columnIndexMap[key] = index;
        }
    });

    const requiredFields: (keyof Door)[] = ['doorTag', 'width', 'height'];
    const missingHeaders = requiredFields.filter(field => columnIndexMap[field] === undefined);

    if (missingHeaders.length > 0) {
        const friendlyNames: { [key: string]: string } = {
            doorTag: '"Door Tag" (e.g., Tag, Mark, Door #)',
            width: '"Width" (e.g., Door Width)',
            height: '"Height" (e.g., Door Height)'
        };
        const friendlyMissing = missingHeaders.map(h => friendlyNames[h] || h).join(', ');
        throw new Error(`CSV is missing required columns. Please ensure your file has headers for at least: ${friendlyMissing}.`);
    }

    const doors: Door[] = dataLines.map((line, index): Door | null => {
        if (!line.trim()) return null;

        const values = line.split(',');

        const getVal = (key: keyof Door, defaultValue: any): string => {
            const colIndex = columnIndexMap[key];
            return colIndex !== undefined && values[colIndex] ? values[colIndex].trim() : defaultValue;
        };

        const getNum = (key: keyof Door, defaultValue: number): number => {
            const val = getVal(key, '');
            const num = parseFloat(val);
            return isNaN(num) ? defaultValue : num;
        };

        return {
            id: `csv-${Date.now()}-${index}`,
            doorTag: getVal('doorTag', `Row ${index + 2}`),
            location: getVal('location', 'N/A'),
            interiorExterior: getVal('interiorExterior', 'N/A') as Door['interiorExterior'],
            quantity: getNum('quantity', 1),
            liftCount: getNum('liftCount', 1),
            operation: getVal('operation', 'Swing'),
            fireRating: getVal('fireRating', 'N/A'),
            width: getNum('width', 0),
            height: getNum('height', 0),
            thickness: getNum('thickness', 1.75),
            doorMaterial: getVal('doorMaterial', 'N/A'),
            frameMaterial: getVal('frameMaterial', 'N/A'),
            hardwarePrep: getVal('hardwarePrep', 'N/A'),
            providedHardwareSet: getVal('providedHardwareSet', undefined) || undefined,
            schedule: getVal('schedule', 'N/A'),
            type: getVal('type', 'Standard Door'),
            status: 'pending',
        };
    }).filter((door): door is Door => door !== null && !!door.doorTag && door.width > 0 && door.height > 0);

    if (doors.length === 0 && dataLines.filter(l => l.trim()).length > 0) {
        throw new Error("Could not parse any valid door data from the CSV. Please check that the required columns (doorTag, width, height) contain valid data.");
    }

    return doors;
};

/**
 * Helper function to split a CSV line handling quoted fields.
 * @param line The CSV line string.
 * @returns An array of field strings.
 */
const splitCSVLine = (line: string): string[] => {
    const result = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            // Handle escaped quotes "" inside a quoted field
            if (inQuote && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuote = !inQuote;
            }
        } else if (char === ',' && !inQuote) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
};

/**
 * Parses a CSV string into an array of HardwareSet objects.
 * Expects a flattened structure where multiple rows can belong to the same Hardware Set.
 * 
 * Required Header: "Set Name" (to group items)
 * 
 * @param csvText The raw CSV string content.
 * @returns An array of HardwareSet objects.
 */
export const parseHardwareSetCSV = (csvText: string): HardwareSet[] => {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) {
        throw new Error("CSV file must contain a header row and at least one data row.");
    }

    const headerLine = lines[0].startsWith('﻿') ? lines[0].substring(1) : lines[0];
    const dataLines = lines.slice(1);

    // Header Mappings
    const headerMappings: { [key: string]: string[] } = {
        setName: ['set name', 'set', 'hardware set', 'hw set', 'heading', 'set #'],
        setDescription: ['set description', 'description', 'notes'],
        division: ['division', 'spec section'],
        // Item Mappings
        itemQty: ['quantity', 'qty', 'q', 'count'],
        itemName: ['item', 'item name', 'type', 'hardware item', 'product'],
        itemManufacturer: ['manufacturer', 'mfr', 'brand', 'manuf'],
        itemDescription: ['item description', 'desc'],
        itemFinish: ['finish', 'color', 'us code']
    };

    const normalizeHeader = (header: string) => (header || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const fileHeaders = splitCSVLine(headerLine).map(h => normalizeHeader(h));

    const reverseMappings: Record<string, string> = {};
    for (const key in headerMappings) {
        headerMappings[key].forEach(alias => {
            reverseMappings[normalizeHeader(alias)] = key;
        });
    }

    const columnIndexMap: Record<string, number> = {};
    fileHeaders.forEach((header, index) => {
        const key = reverseMappings[header];
        if (key) columnIndexMap[key] = index;
        
        // Fallback: if 'description' is found and we haven't mapped 'itemDescription', map it.
        // But prioritize 'setDescription' if explicit.
        if (header === 'description') {
             if (columnIndexMap['setDescription'] === undefined) columnIndexMap['setDescription'] = index;
             if (columnIndexMap['itemDescription'] === undefined) columnIndexMap['itemDescription'] = index;
        }
    });

    if (columnIndexMap['setName'] === undefined) {
        throw new Error("CSV is missing the required 'Set Name' column.");
    }

    const setsMap = new Map<string, HardwareSet>();

    dataLines.forEach((line, index) => {
        if (!line.trim()) return;
        
        const values = splitCSVLine(line);
        const getVal = (key: string): string => {
            const idx = columnIndexMap[key];
            return idx !== undefined && values[idx] ? values[idx].trim() : '';
        };

        const setName = getVal('setName');
        if (!setName) return; // Skip rows without a set name

        let set = setsMap.get(setName);
        if (!set) {
            set = {
                id: `csv-set-${Date.now()}-${index}`,
                name: setName,
                description: getVal('setDescription'),
                division: getVal('division') || 'Division 08',
                items: [],
            };
            setsMap.set(setName, set);
        } else {
            // If we find a better description later, maybe update? 
            // For now, assume first row of set has description or all rows do.
            if (!set.description && getVal('setDescription')) {
                set.description = getVal('setDescription');
            }
        }

        const itemQtyVal = getVal('itemQty');
        const qty = itemQtyVal ? parseFloat(itemQtyVal) : 1; // Default to 1 if parsing fails or empty, but usually check existence
        const itemName = getVal('itemName');

        if (itemName || itemQtyVal) {
            const item: HardwareItem = {
                id: `csv-item-${Date.now()}-${index}`,
                quantity: isNaN(qty) ? 1 : qty,
                name: itemName,
                manufacturer: getVal('itemManufacturer'),
                description: getVal('itemDescription'),
                finish: getVal('itemFinish')
            };
            set.items.push(item);
        }
    });

    return Array.from(setsMap.values());
};
