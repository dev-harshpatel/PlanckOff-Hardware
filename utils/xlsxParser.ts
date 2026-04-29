import * as XLSX from 'xlsx';
import { Door, HardwareSet, HardwareItem, DoorScheduleSections } from '../types';

/**
 * Parses an Excel file buffer into an array of Door objects.
 * Uses the 'xlsx' npm package.
 * 
 * @param data The Excel file content as an ArrayBuffer.
 * @returns An array of Door objects.
 * @throws An error if the format is invalid.
 */
// Detects whether the sheet uses the sectioned 2-row header format:
//   Row 0: section labels (DOOR, FRAME, HARDWARE — merged cells with blanks)
//   Row 1: actual column names (DOOR TAG, BUILDING TAG, …)
// Returns true when row 0 looks like section headers.
const isSectionedHeaderFormat = (worksheet: XLSX.WorkSheet): boolean => {
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 0, defval: '' }) as any[][];
    const firstRow: any[] = rows[0] ?? [];
    const normalized = firstRow.map((v: any) => String(v || '').trim().toUpperCase());
    return normalized.includes('DOOR') && normalized.includes('FRAME') && normalized.includes('HARDWARE');
};

// Returns true if the sheet has a BASIC INFORMATION section header in row 0.
const hasBasicInformationSection = (worksheet: XLSX.WorkSheet): boolean => {
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 0, defval: '' }) as any[][];
    const firstRow: any[] = rows[0] ?? [];
    return firstRow.some((v: any) => String(v || '').trim().toUpperCase() === 'BASIC INFORMATION');
};

// Maps column index → section name for the sectioned format.
// Built by reading row 0 and tracking which section each column falls under.
const buildColumnSectionMap = (worksheet: XLSX.WorkSheet): Record<number, 'basic_information' | 'door' | 'frame' | 'hardware'> => {
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 0, defval: '' }) as any[][];
    const firstRow: any[] = rows[0] ?? [];
    const map: Record<number, 'basic_information' | 'door' | 'frame' | 'hardware'> = {};
    // If the sheet has an explicit BASIC INFORMATION header, start there; otherwise default to 'door'
    // so columns before the first section header still get classified.
    const startsWithBasicInfo = firstRow.some((v: any) => String(v || '').trim().toUpperCase() === 'BASIC INFORMATION');
    let current: 'basic_information' | 'door' | 'frame' | 'hardware' = startsWithBasicInfo ? 'basic_information' : 'door';
    firstRow.forEach((cell: any, idx: number) => {
        const val = String(cell || '').trim().toUpperCase();
        if (val === 'BASIC INFORMATION') current = 'basic_information';
        if (val === 'DOOR')              current = 'door';
        if (val === 'FRAME')             current = 'frame';
        if (val === 'HARDWARE')          current = 'hardware';
        map[idx] = current;
    });
    return map;
};

export const parseDoorScheduleXLSX = (data: ArrayBuffer): Door[] => {
    const workbook = XLSX.read(data, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Detect new sectioned 2-row header format vs legacy single-row format.
    const sectioned = isSectionedHeaderFormat(worksheet);
    // For the sectioned format, skip row 0 (section labels) so row 1 becomes the header row.
    const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, sectioned ? { range: 1 } : undefined);
    // Column→section mapping (only used when sectioned).
    const colSectionMap = sectioned ? buildColumnSectionMap(worksheet) : {};

    if (jsonData.length === 0) {
        throw new Error("Excel file appears to be empty or in an unsupported format.");
    }

    // Define mappings from internal property names to possible Excel header names.
    const headerMappings: { [key: string]: string[] } = {
        // Core identification
        doorTag:              ['doortag', 'door tag', 'door#', 'tag', 'mark', 'doornumber', 'doorid', 'opening', 'door no', 'door no.'],
        buildingTag:          ['buildingtag', 'building tag', 'bldg tag', 'bldgtag', 'building#', 'bldg#'],
        buildingLocation:     ['buildinglocation', 'building location', 'bldg location', 'bldglocation'],
        location:             ['location', 'doorlocation', 'door location', 'room', 'room name'],
        quantity:             ['quantity', 'qty', 'q', 'count'],
        handing:              ['handofopenings', 'hand of openings', 'handing', 'handofopening'],
        operation:            ['operation', 'dooroperation', 'door operation', 'swing'],
        leafCount:            ['leafcount', 'leaf count', 'leaves', 'liftcount', 'lift count'],
        interiorExterior:     ['interiorexterior', 'interior/exterior', 'int/ext', 'position'],
        excludeReason:        ['excludereason', 'exclude reason', 'exclusionreason', 'exclusion reason'],

        // Dimensions
        width:                ['width', 'doorwidth', 'door width', 'w', 'rough opening width'],
        height:               ['height', 'doorheight', 'door height', 'h', 'rough opening height'],
        thickness:            ['thickness', 'doorthickness', 'door thickness', 'thick', 'thk'],

        // Door material & finish
        fireRating:           ['firerating', 'fire rating', 'rating', 'fire'],
        doorMaterial:         ['doormaterial', 'door material', 'material', 'door mat', 'dr mat'],
        elevationTypeId:      ['doorelevationtype', 'door elevation type', 'elevationtype', 'elevation type', 'door elev type'],
        doorCore:             ['doorcore', 'door core', 'core'],
        doorFace:             ['doorface', 'door face', 'face'],
        doorEdge:             ['dooredge', 'door edge', 'edge'],
        doorGauge:            ['doorguage', 'door guage', 'doorgauge', 'door gauge', 'dr gauge', 'dr guage'],
        doorFinish:           ['doorfinish', 'door finish', 'finish'],
        stcRating:            ['stcrating', 'stc rating', 'stc'],
        undercut:             ['doorundercut', 'door undercut', 'undercut'],
        doorIncludeExclude:   ['doorincludeexclude', 'door include/exclude', 'door includeexclude', 'door include exclude'],

        // Frame
        frameMaterial:        ['framematerial', 'frame material', 'frame mat', 'frm mat'],
        wallType:             ['walltype', 'wall type', 'wall'],
        throatThickness:      ['throatthickness', 'throat thickness', 'throat', 'frame throat'],
        frameAnchor:          ['frameanchor', 'frame anchor', 'anchor', 'anchor type'],
        baseAnchor:           ['baseanchor', 'base anchor'],
        numberOfAnchors:      ['noofanchor', 'no of anchor', 'numberofanchors', 'number of anchors', 'anchor count'],
        frameProfile:         ['frameprofile', 'frame profile', 'frm profile'],
        frameElevationType:   ['frameelevationtype', 'frame elevation type', 'frame elev type'],
        frameAssembly:        ['frameassembly', 'frame assembly'],
        frameGauge:           ['frameguage', 'frame guage', 'framegauge', 'frame gauge', 'frm gauge', 'frm guage'],
        frameFinish:          ['framefinish', 'frame finish', 'frm finish'],
        prehung:              ['prehung', 'pre hung', 'pre-hung'],
        frameHead:            ['framehead', 'frame head', 'frm head'],
        casing:               ['casing'],
        frameIncludeExclude:  ['frameincludeexclude', 'frame include/exclude', 'frame include exclude'],

        // Hardware — "HARDWARE SET" column is in the HARDWARE section of the new format
        providedHardwareSet:  ['hardwareset', 'hwset', 'hw set', 'hardware set', 'set #', 'hws', 'hardware group', 'hw group'],
        hardwareIncludeExclude: ['hardwareincludeexclude', 'hardware include/exclude', 'hardware include exclude'],

        // Legacy / misc
        hardwarePrep:         ['hardwareprep', 'hardware prep', 'hw prep', 'prep', 'function', 'device'],
        schedule:             ['schedule', 'door schedule'],
        type:                 ['type', 'doortype', 'description', 'remarks', 'comments'],
    };

    // For the sectioned format, also build a map from normalized column name → column index
    // so we can reconstruct the section-grouped raw values.
    let colIndexByNormalizedHeader: Record<string, number> = {};
    if (sectioned) {
        const headerRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 1, defval: '' }) as any[][];
        const headerRow: any[] = headerRows[0] ?? [];
        headerRow.forEach((h: any, idx: number) => {
            const norm = (String(h || '')).toLowerCase().replace(/[^a-z0-9]/g, '');
            if (norm) colIndexByNormalizedHeader[norm] = idx;
        });
    }
    
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

        const opt = (key: keyof Door) => getVal(key, undefined) || undefined;

        return {
            id: `xlsx-${Date.now()}-${index}`,
            status: 'pending',

            // Identification
            doorTag:              getVal('doorTag', `Row ${index + 2}`),
            buildingTag:          opt('buildingTag'),
            buildingLocation:     opt('buildingLocation'),
            location:             getVal('location', ''),
            quantity:             getNum('quantity', 1),
            handing:              opt('handing') as Door['handing'],
            operation:            opt('operation'),
            leafCount:            (() => {
                const raw = opt('leafCount');
                const num = raw !== undefined ? parseFloat(raw) : NaN;
                return isNaN(num) ? undefined : num;
            })(),
            leafCountDisplay:     opt('leafCount'),
            interiorExterior:     opt('interiorExterior'),
            excludeReason:        opt('excludeReason'),

            // Dimensions
            width:                getNum('width', 0),
            height:               getNum('height', 0),
            thickness:            getNum('thickness', 1.75),

            // Door material & finish
            fireRating:           opt('fireRating'),
            doorMaterial:         getVal('doorMaterial', ''),
            elevationTypeId:      opt('elevationTypeId'),
            doorCore:             opt('doorCore'),
            doorFace:             opt('doorFace'),
            doorEdge:             opt('doorEdge'),
            doorGauge:            opt('doorGauge'),
            doorFinish:           opt('doorFinish'),
            stcRating:            opt('stcRating'),
            undercut:             opt('undercut'),
            doorIncludeExclude:   opt('doorIncludeExclude'),

            // Frame
            frameMaterial:        getVal('frameMaterial', '') as Door['frameMaterial'],
            wallType:             opt('wallType'),
            throatThickness:      opt('throatThickness'),
            frameAnchor:          opt('frameAnchor'),
            baseAnchor:           opt('baseAnchor'),
            numberOfAnchors:      opt('numberOfAnchors'),
            frameProfile:         opt('frameProfile') as Door['frameProfile'],
            frameElevationType:   opt('frameElevationType'),
            frameAssembly:        opt('frameAssembly'),
            frameGauge:           opt('frameGauge'),
            frameFinish:          opt('frameFinish'),
            prehung:              opt('prehung'),
            frameHead:            opt('frameHead'),
            casing:               opt('casing'),
            frameIncludeExclude:  opt('frameIncludeExclude'),

            // Hardware
            providedHardwareSet:      opt('providedHardwareSet'),
            hardwareIncludeExclude:   opt('hardwareIncludeExclude'),

            // Legacy
            hardwarePrep: opt('hardwarePrep'),
            type:         opt('type'),

            // Sectioned representation — only populated for the new 2-row header format
            ...(sectioned ? {
                sections: {
                    basic_information: {
                        doorTag:          opt('doorTag'),
                        buildingTag:      opt('buildingTag'),
                        buildingLocation: opt('buildingLocation'),
                        doorLocation:     opt('location'),
                        quantity:         getNum('quantity', 1),
                        handOfOpenings:   opt('handing'),
                        doorOperation:    opt('operation'),
                        leafCount:        opt('leafCount'),
                        interiorExterior: opt('interiorExterior'),
                        excludeReason:    opt('excludeReason'),
                    },
                    door: {
                        width:            getVal('width', ''),
                        height:           getVal('height', ''),
                        thickness:        getVal('thickness', ''),
                        fireRating:       opt('fireRating'),
                        doorMaterial:     opt('doorMaterial'),
                        doorElevationType: opt('elevationTypeId'),
                        doorCore:         opt('doorCore'),
                        doorFace:         opt('doorFace'),
                        doorEdge:         opt('doorEdge'),
                        doorGauge:        opt('doorGauge'),
                        doorFinish:       opt('doorFinish'),
                        stcRating:        opt('stcRating'),
                        doorUndercut:     opt('undercut'),
                        doorIncludeExclude: opt('doorIncludeExclude'),
                    },
                    frame: {
                        frameMaterial:      opt('frameMaterial'),
                        wallType:           opt('wallType'),
                        throatThickness:    opt('throatThickness'),
                        frameAnchor:        opt('frameAnchor'),
                        baseAnchor:         opt('baseAnchor'),
                        noOfAnchor:         opt('numberOfAnchors'),
                        frameProfile:       opt('frameProfile'),
                        frameElevationType: opt('frameElevationType'),
                        frameAssembly:      opt('frameAssembly'),
                        frameGauge:         opt('frameGauge'),
                        frameFinish:        opt('frameFinish'),
                        prehung:            opt('prehung'),
                        frameHead:          opt('frameHead'),
                        casing:             opt('casing'),
                        frameIncludeExclude: opt('frameIncludeExclude'),
                    },
                    hardware: {
                        hardwareSet:            opt('providedHardwareSet'),
                        hardwareIncludeExclude: opt('hardwareIncludeExclude'),
                    },
                } satisfies DoorScheduleSections,
            } : {}),
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
