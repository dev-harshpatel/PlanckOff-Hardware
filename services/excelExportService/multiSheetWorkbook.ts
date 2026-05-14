'use client';

import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';
import { applySheetTheme } from '../excelTheme';
import { Door, HardwareSet, HardwareItem } from '../../types';
import { assignDoorCSISection, assignHardwareCSISection } from '../../utils/csiMasterFormat';
import { buildExportFilename } from '../../utils/exportFilename';

export interface MultiSheetExportOptions {
    includeDoorSchedule?: boolean;
    includeHardwareSchedule?: boolean;
    includeFrameDetails?: boolean;
    includeProcurementSummary?: boolean;
    projectName: string;
}

/**
 * Export multi-sheet Excel workbook with Door Schedule, Hardware Schedule, Frame Details, and Procurement Summary
 */
export function exportMultiSheetWorkbook(
    doors: Door[],
    hardwareSets: HardwareSet[],
    options: MultiSheetExportOptions
): void {
    const workbook = XLSX.utils.book_new();

    // Add sheets based on options
    if (options.includeDoorSchedule !== false) {
        createComprehensiveDoorScheduleSheet(workbook, doors);
    }

    if (options.includeHardwareSchedule !== false) {
        createComprehensiveHardwareScheduleSheet(workbook, hardwareSets, doors);
    }

    if (options.includeFrameDetails !== false) {
        createFrameDetailsSheet(workbook, doors);
    }

    if (options.includeProcurementSummary !== false) {
        createProcurementSummarySheet(workbook, hardwareSets, doors);
    }

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    saveAs(blob, buildExportFilename(options.projectName, 'complete-schedule', 'xlsx'));
}

/**
 * Create comprehensive Door Schedule sheet
 */
function createComprehensiveDoorScheduleSheet(
    workbook: XLSX.WorkBook,
    doors: Door[]
): void {
    const headers = [
        'Door Tag',
        'Width',
        'Height',
        'Thickness',
        'Material',
        'Core Type',
        'Face Type',
        'Fire Rating',
        'Hardware Set',
        'Location',
        'Handing',
        'CSI Section'
    ];

    const data: any[][] = [headers];

    // Add door data
    doors.forEach(door => {
        const csiSection = door.csiSection || assignDoorCSISection(door);
        const row = [
            door.tag || door.doorTag,
            door.width || '',
            door.height || '',
            door.thickness || '',
            door.material || door.doorMaterial || '',
            door.coreType || '',
            door.faceType || '',
            door.fireRating || '',
            door.hardwareSet || door.assignedHardwareSet?.name || '',
            door.location || '',
            door.handing || '',
            csiSection
        ];
        data.push(row);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Apply brand header styling, freeze pane, and content-aware column widths (XLS-01/02/03)
    applySheetTheme(worksheet, headers, data.slice(1));

    // Add auto-filter
    worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: data.length - 1, c: headers.length - 1 } }) };

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Door Schedule');
}

/**
 * Create comprehensive Hardware Schedule sheet
 */
function createComprehensiveHardwareScheduleSheet(
    workbook: XLSX.WorkBook,
    hardwareSets: HardwareSet[],
    doors: Door[]
): void {
    const headers = [
        'Hardware Set',
        'Item Name',
        'Description',
        'Manufacturer',
        'Model Number',
        'Finish',
        'Qty per Set',
        'Doors Using Set',
        'Total Qty',
        'ANSI Grade',
        'Lead Time',
        'CSI Section'
    ];

    const data: any[][] = [headers];

    // Calculate door counts per hardware set
    const setDoorCounts = new Map<string, number>();
    doors.forEach(door => {
        const setName = door.hardwareSet || door.assignedHardwareSet?.name;
        if (setName) {
            setDoorCounts.set(setName, (setDoorCounts.get(setName) || 0) + 1);
        }
    });

    // Add hardware data
    hardwareSets.forEach(set => {
        const doorCount = setDoorCounts.get(set.name) || 0;

        // Add set header row
        const setHeaderRow = [
            `${set.name} - ${set.description || ''}`,
            '', '', '', '', '', '', doorCount, '', '', '', ''
        ];
        data.push(setHeaderRow);

        // Add items
        set.items.forEach(item => {
            const csiSection = item.csiSection || assignHardwareCSISection(item);
            const totalQty = (item.quantity || 1) * doorCount;

            const row = [
                '', // Empty for set name column
                item.name,
                item.description || '',
                item.manufacturer || '',
                item.modelNumber || '',
                item.finish || '',
                item.quantity ?? 1,
                doorCount,
                totalQty,
                item.ansiGrade || '',
                item.leadTime || '',
                csiSection
            ];
            data.push(row);
        });

        // Add blank row between sets
        data.push(Array(headers.length).fill(''));
    });

    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Apply brand header styling, freeze pane, and content-aware column widths (XLS-01/02/03)
    applySheetTheme(worksheet, headers, data.slice(1));

    // Add auto-filter
    worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: data.length - 1, c: headers.length - 1 } }) };

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hardware Schedule');
}

/**
 * Create Frame Details sheet
 */
function createFrameDetailsSheet(
    workbook: XLSX.WorkBook,
    doors: Door[]
): void {
    const headers = [
        'Door Tag',
        'Frame Material',
        'Frame Depth',
        'Frame Profile',
        'Anchor Type',
        'Anchor Spacing',
        'Silencer Qty',
        'Preparation Notes'
    ];

    const data: any[][] = [headers];

    doors.forEach(door => {
        const row = [
            door.tag || door.doorTag,
            door.frameMaterial || '',
            door.frameDepth || '',
            door.frameProfile || '',
            door.anchorType || '',
            door.anchorSpacing || '',
            door.silencerQty ?? null,
            door.framePreparationNotes || ''
        ];
        data.push(row);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Apply brand header styling, freeze pane, and content-aware column widths (XLS-01/02/03)
    applySheetTheme(worksheet, headers, data.slice(1));

    // Add auto-filter
    worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: data.length - 1, c: headers.length - 1 } }) };

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Frame Details');
}

/**
 * Create Procurement Summary sheet
 */
function createProcurementSummarySheet(
    workbook: XLSX.WorkBook,
    hardwareSets: HardwareSet[],
    doors: Door[]
): void {
    // Calculate door counts per hardware set
    const setDoorCounts = new Map<string, number>();
    doors.forEach(door => {
        const setName = door.hardwareSet || door.assignedHardwareSet?.name;
        if (setName) {
            setDoorCounts.set(setName, (setDoorCounts.get(setName) || 0) + 1);
        }
    });

    // Group items by manufacturer
    const manufacturerGroups = new Map<string, Array<{
        item: HardwareItem;
        totalQty: number;
        setName: string;
    }>>();

    hardwareSets.forEach(set => {
        const doorCount = setDoorCounts.get(set.name) || 0;
        set.items.forEach(item => {
            const manufacturer = item.manufacturer || 'Unknown';
            const totalQty = (item.quantity || 1) * doorCount;

            if (!manufacturerGroups.has(manufacturer)) {
                manufacturerGroups.set(manufacturer, []);
            }
            manufacturerGroups.get(manufacturer)!.push({
                item,
                totalQty,
                setName: set.name
            });
        });
    });

    const headers = [
        'Manufacturer',
        'Product Name',
        'Model Number',
        'Total Qty',
        'Lead Time',
        'ANSI Grade',
        'CSI Section',
        'Hardware Sets'
    ];

    const data: any[][] = [
        ['PROCUREMENT SUMMARY BY MANUFACTURER'],
        [],
        headers
    ];

    // Sort manufacturers alphabetically
    const sortedManufacturers = Array.from(manufacturerGroups.keys()).sort();

    sortedManufacturers.forEach(manufacturer => {
        const items = manufacturerGroups.get(manufacturer)!;

        // Add manufacturer header
        data.push([
            manufacturer,
            '', '', '', '', '', '', ''
        ]);

        // Add items
        items.forEach(({ item, totalQty, setName }) => {
            const csiSection = item.csiSection || assignHardwareCSISection(item);
            data.push([
                '', // Empty for manufacturer column
                item.name,
                item.modelNumber || '',
                totalQty,
                item.leadTime || '',
                item.ansiGrade || '',
                csiSection,
                setName
            ]);
        });

        // Add blank row between manufacturers
        data.push(Array(headers.length).fill(''));
    });

    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Apply brand header styling, freeze pane, and content-aware column widths (XLS-01/02/03)
    // Note: data[0] is the 'PROCUREMENT SUMMARY' title, data[1] is empty, data[2] is headers.
    // applySheetTheme styles row 0 (the title) and calculates widths from headers + body data.
    applySheetTheme(worksheet, headers, data.slice(3));

    // Merge title cell
    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Procurement Summary');
}
