import * as XLSX from 'xlsx';
import { Door, HardwareSet, HardwareItem } from '../types';

/**
 * Parses an Excel file buffer into an array of Door objects.
 * Uses the 'xlsx' npm package.
 * 
 * @param data The Excel file content as an ArrayBuffer.
 * @returns An array of Door objects.
 * @throws An error if the format is invalid.
 */
export const parseDoorScheduleXLSX = (data: ArrayBuffer): Door[] => {
    // Read directly using the imported library
    const workbook = XLSX.read(data, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

    if (jsonData.length === 0) {
        throw new Error("Excel file appears to be empty or in an unsupported format.");
    }

    // Define mappings from internal property names to possible Excel header names.
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
        providedHardwareSet: ['hardwareset', 'hwset', 'hw set', 'hardware set', 'set #', 'hws', 'hardware group', 'hw group'],
        schedule: ['schedule', 'door schedule'],
        type: ['type', 'doortype', 'description', 'remarks', 'comments']
    };
    
    // Normalize a string for robust matching (lowercase, remove non-alphanumeric).
    const normalizeHeader = (header: string) => (header || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    // Create a reverse map from normalized possible names back to our internal property key.
    const reverseMappings: { [key: string]: keyof Door } = {};
    for (const key in headerMappings) {
        headerMappings[key].forEach(alias => {
            reverseMappings[normalizeHeader(alias)] = key as keyof Door;
        });
    }
    
    const fileHeaders = Object.keys(jsonData[0] || {});
    const mappedHeaders = new Set(
        fileHeaders.map(h => reverseMappings[normalizeHeader(h)]).filter(Boolean)
    );

    const requiredFields: (keyof Door)[] = ['doorTag', 'width', 'height'];
    const missingHeaders = requiredFields.filter(field => !mappedHeaders.has(field));

    if (missingHeaders.length > 0) {
        const friendlyNames: { [key: string]: string } = {
            doorTag: '"Door Tag" (e.g., Tag, Mark, Door #)',
            width: '"Width" (e.g., Door Width)',
            height: '"Height" (e.g., Door Height)'
        };
        const friendlyMissing = missingHeaders.map(h => friendlyNames[h] || h).join(', ');
        throw new Error(`Excel file is missing required columns. Please ensure your file has headers for at least: ${friendlyMissing}.`);
    }

    const doors: Door[] = jsonData.map((row, index): Door | null => {
        if (!row || Object.keys(row).length === 0) return null;

        const mappedRow: { [key in keyof Door]?: any } = {};
        for (const originalHeader in row) {
            const normalized = normalizeHeader(originalHeader);
            const doorKey = reverseMappings[normalized];
            if (doorKey) {
                mappedRow[doorKey] = row[originalHeader];
            }
        }

        const getVal = (key: keyof Door, defaultValue: any): string => {
            const value = mappedRow[key];
            return value !== undefined && value !== null ? String(value).trim() : defaultValue;
        };

        const getNum = (key: keyof Door, defaultValue: number): number => {
            const val = getVal(key, '');
            const num = parseFloat(val);
            return isNaN(num) ? defaultValue : num;
        };

        return {
            id: `xlsx-${Date.now()}-${index}`,
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

    if (doors.length === 0 && jsonData.length > 0) {
        throw new Error("Could not parse any valid door data from the Excel file. Please check that the required columns (doorTag, width, height) contain valid data.");
    }

    return doors;
};

/**
 * Parses an Excel file buffer into an array of HardwareSet objects.
 * Assumes a flattened structure where multiple rows with the same "Set Name" belong to the same set.
 * 
 * @param data The Excel file content as an ArrayBuffer.
 * @returns An array of HardwareSet objects.
 */
export const parseHardwareSetXLSX = (data: ArrayBuffer): HardwareSet[] => {
    // Read directly using the imported library
    const workbook = XLSX.read(data, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

    if (jsonData.length === 0) {
        throw new Error("Excel file appears to be empty or in an unsupported format.");
    }

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
    const reverseMappings: Record<string, string> = {};
    for (const key in headerMappings) {
        headerMappings[key].forEach(alias => {
            reverseMappings[normalizeHeader(alias)] = key;
        });
    }

    const setsMap = new Map<string, HardwareSet>();

    jsonData.forEach((row, index) => {
        if (!row || Object.keys(row).length === 0) return;

        const mappedRow: Record<string, any> = {};
        for (const originalHeader in row) {
            const normalized = normalizeHeader(originalHeader);
            const key = reverseMappings[normalized];
            // Fallback for description ambiguity
            if (normalized === 'description' && !key) {
                 mappedRow['setDescription'] = row[originalHeader];
                 mappedRow['itemDescription'] = row[originalHeader];
            } else if (key) {
                mappedRow[key] = row[originalHeader];
            }
        }

        const setName = mappedRow['setName'] ? String(mappedRow['setName']).trim() : '';
        if (!setName) return; // Skip if no set identifier

        let set = setsMap.get(setName);
        if (!set) {
            set = {
                id: `xlsx-set-${Date.now()}-${index}`,
                name: setName,
                description: mappedRow['setDescription'] ? String(mappedRow['setDescription']) : '',
                division: mappedRow['division'] ? String(mappedRow['division']) : 'Division 08',
                items: [],
            };
            setsMap.set(setName, set);
        } else {
            // Update description if previously missing
             if (!set.description && mappedRow['setDescription']) {
                set.description = String(mappedRow['setDescription']);
            }
        }

        const qtyVal = mappedRow['itemQty'];
        const itemName = mappedRow['itemName'] ? String(mappedRow['itemName']).trim() : '';
        
        if (itemName || qtyVal) {
             const qty = qtyVal ? parseFloat(qtyVal) : 1;
             const item: HardwareItem = {
                 id: `xlsx-item-${Date.now()}-${index}`,
                 quantity: isNaN(qty) ? 1 : qty,
                 name: itemName,
                 manufacturer: mappedRow['itemManufacturer'] ? String(mappedRow['itemManufacturer']) : '',
                 description: mappedRow['itemDescription'] ? String(mappedRow['itemDescription']) : '',
                 finish: mappedRow['itemFinish'] ? String(mappedRow['itemFinish']) : '',
             };
             set.items.push(item);
        }
    });

    if (setsMap.size === 0) {
        throw new Error("Could not find any valid hardware sets in the Excel file. Ensure you have a 'Set Name' column.");
    }

    return Array.from(setsMap.values());
};
