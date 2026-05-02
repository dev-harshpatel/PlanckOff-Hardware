import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Door, HardwareSet, HardwareItem, ElevationType } from '../types';
import { DoorScheduleExportConfig } from '../components/DoorScheduleConfig';
import { HardwareSetExportConfig } from '../components/HardwareSetConfig';
import { assignDoorCSISection, assignHardwareCSISection } from '../utils/csiMasterFormat';

function resolveElevationImageUrl(door: Door, elevationTypes: ElevationType[]): string {
  if (!door.elevationTypeId) return '';
  const et = elevationTypes.find(e =>
    e.id === door.elevationTypeId ||
    e.code === door.elevationTypeId ||
    e.name === door.elevationTypeId
  );
  return et?.imageUrl ?? '';
}

// Build headers for Door Schedule
const buildDoorScheduleHeaders = (columns: DoorScheduleExportConfig['columns']): string[] => {
  const headers: string[] = [];

  // Basic Information
  if (columns.basic.includes('doorTag')) headers.push('Door Tag');
  if (columns.basic.includes('location')) headers.push('Location');
  if (columns.basic.includes('quantity')) headers.push('Quantity');
  if (columns.basic.includes('type')) headers.push('Type');

  // Dimensions
  if (columns.dimensions.includes('width')) headers.push('Width');
  if (columns.dimensions.includes('height')) headers.push('Height');
  if (columns.dimensions.includes('thickness')) headers.push('Thickness');
  if (columns.dimensions.includes('frameDepth')) headers.push('Frame Depth');

  // Materials
  if (columns.materials.includes('doorMaterial')) headers.push('Door Material');
  if (columns.materials.includes('frameMaterial')) headers.push('Frame Material');
  if (columns.materials.includes('coreType')) headers.push('Core Type');
  if (columns.materials.includes('veneerType')) headers.push('Veneer Type');

  // Fire & Safety
  if (columns.fireSafety.includes('fireRating')) headers.push('Fire Rating');
  if (columns.fireSafety.includes('smokeRating')) headers.push('Smoke Rating');
  if (columns.fireSafety.includes('stcRating')) headers.push('STC Rating');
  if (columns.fireSafety.includes('egressRequired')) headers.push('Egress Required');

  // Hardware
  if (columns.hardware.includes('assignedHardwareSet')) headers.push('Hardware Set');
  if (columns.hardware.includes('hardwarePrep')) headers.push('Hardware Prep');
  if (columns.hardware.includes('hingeType')) headers.push('Hinge Type');
  if (columns.hardware.includes('lockType')) headers.push('Lock Type');

  // Additional
  if (columns.additional.includes('interiorExterior')) headers.push('Interior/Exterior');
  if (columns.additional.includes('swingDirection')) headers.push('Swing Direction');
  if (columns.additional.includes('undercut')) headers.push('Undercut');
  if (columns.additional.includes('louvers')) headers.push('Louvers');
  if (columns.additional.includes('visionPanels')) headers.push('Vision Panels');
  if (columns.additional.includes('specialNotes')) headers.push('Special Notes');
  if (columns.additional.includes('elevationTypeId')) headers.push('Elevation Type');
  if (columns.additional.includes('elevationImageUrl')) headers.push('Elevation Image URL');

  return headers;
};

// Build data row for a door
const buildDoorScheduleRow = (
  door: Door,
  columns: DoorScheduleExportConfig['columns'],
  elevationTypes: ElevationType[] = [],
): unknown[] => {
  const row: unknown[] = [];

  // Basic Information
  if (columns.basic.includes('doorTag')) row.push(door.doorTag || '');
  if (columns.basic.includes('location')) row.push(door.location || '');
  if (columns.basic.includes('quantity')) row.push(door.quantity || 1);
  if (columns.basic.includes('type')) row.push(door.type || '');

  // Dimensions
  if (columns.dimensions.includes('width')) row.push(door.width || '');
  if (columns.dimensions.includes('height')) row.push(door.height || '');
  if (columns.dimensions.includes('thickness')) row.push(door.thickness || '');
  if (columns.dimensions.includes('frameDepth')) row.push(door.frameDepth || '');

  // Materials
  if (columns.materials.includes('doorMaterial')) row.push(door.doorMaterial || '');
  if (columns.materials.includes('frameMaterial')) row.push(door.frameMaterial || '');
  if (columns.materials.includes('coreType')) row.push(door.coreType || '');
  if (columns.materials.includes('veneerType')) row.push(door.veneerType || '');

  // Fire & Safety
  if (columns.fireSafety.includes('fireRating')) row.push(door.fireRating || '');
  if (columns.fireSafety.includes('smokeRating')) row.push(door.smokeRating || '');
  if (columns.fireSafety.includes('stcRating')) row.push(door.stcRating || '');
  if (columns.fireSafety.includes('egressRequired')) row.push(door.egressRequired ? 'Yes' : 'No');

  // Hardware
  if (columns.hardware.includes('assignedHardwareSet')) row.push(door.assignedHardwareSet?.name || '');
  if (columns.hardware.includes('hardwarePrep')) row.push(door.hardwarePrep || '');
  if (columns.hardware.includes('hingeType')) row.push(door.hingeType || '');
  if (columns.hardware.includes('lockType')) row.push(door.lockType || '');

  // Additional
  if (columns.additional.includes('interiorExterior')) row.push(door.interiorExterior || '');
  if (columns.additional.includes('swingDirection')) row.push(door.swingDirection || '');
  if (columns.additional.includes('undercut')) row.push(door.undercut || '');
  if (columns.additional.includes('louvers')) row.push(door.louvers || '');
  if (columns.additional.includes('visionPanels')) row.push(door.visionPanels || '');
  if (columns.additional.includes('specialNotes')) row.push(door.specialNotes || '');
  if (columns.additional.includes('elevationTypeId')) row.push(door.elevationTypeId || '');
  if (columns.additional.includes('elevationImageUrl')) row.push(resolveElevationImageUrl(door, elevationTypes));

  return row;
};

// Export Door Schedule to Excel
export const exportDoorScheduleToExcel = (
  doors: Door[],
  config: DoorScheduleExportConfig,
  projectName: string,
  elevationTypes: ElevationType[] = [],
): void => {
  const workbook = XLSX.utils.book_new();

  // Build main data
  const headers = buildDoorScheduleHeaders(config.columns);
  const dataRows = doors.map(door => buildDoorScheduleRow(door, config.columns, elevationTypes));

  // Create data array for worksheet
  const wsData: unknown[][] = [];

  // Add header rows if requested
  if (config.includeHeader) {
    wsData.push([projectName]);
    wsData.push(['Door-Frame Reports']);
    wsData.push([`Generated: ${new Date().toLocaleDateString()}`]);
    wsData.push([]); // Empty row
  }

  // Add column headers and data
  wsData.push(headers);
  wsData.push(...dataRows);

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  const colWidths = headers.map(() => ({ wch: 15 }));
  worksheet['!cols'] = colWidths;

  // Add to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Door Schedule');

  // Add summary sheet if requested
  if (config.includeSummary) {
    const summaryData: any[][] = [
      ['Door Schedule Summary'],
      [],
      ['Total Doors', doors.length],
      ['Doors with Hardware', doors.filter(d => d.assignedHardwareSet).length],
      ['Doors without Hardware', doors.filter(d => !d.assignedHardwareSet).length],
    ];

    // Add breakdown by type if available
    const typeBreakdown = new Map<string, number>();
    doors.forEach(door => {
      const type = door.type || 'Unknown';
      typeBreakdown.set(type, (typeBreakdown.get(type) || 0) + 1);
    });

    if (typeBreakdown.size > 0) {
      summaryData.push([]);
      summaryData.push(['Breakdown by Type']);
      typeBreakdown.forEach((count, type) => {
        summaryData.push([type, count]);
      });
    }

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 25 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  }

  // Generate filename
  const date = new Date().toISOString().split('T')[0];
  const filename = `DoorSchedule_${projectName.replace(/[^a-z0-9]/gi, '_')}_${date}.xlsx`;

  // Download
  XLSX.writeFile(workbook, filename);
};

// Format usage for Hardware Set reports
const formatUsage = (doorTags: string[], mode: 'all' | 'count' | 'preview'): string => {
  const sorted = [...new Set(doorTags)].sort();

  switch (mode) {
    case 'all':
      return sorted.join(', ');
    case 'count':
      return `Used in ${sorted.length} doors`;
    case 'preview':
      if (sorted.length <= 5) return sorted.join(', ');
      return `${sorted.slice(0, 5).join(', ')}... +${sorted.length - 5} more`;
  }
};

// Build headers for Hardware Set
const buildHardwareSetHeaders = (config: HardwareSetExportConfig): string[] => {
  const headers: string[] = [];

  // Required columns
  headers.push('Item Name');
  headers.push('Description');
  headers.push('Manufacturer');
  headers.push('Finish');
  headers.push('Usage/Location');

  // Optional columns
  if (config.optionalColumns.includes('quantityPerSet')) headers.push('Qty per Set');
  if (config.optionalColumns.includes('totalQuantity')) headers.push('Total Qty');
  if (config.optionalColumns.includes('unitPrice')) headers.push('Unit Price');
  if (config.optionalColumns.includes('extendedPrice')) headers.push('Extended Price');
  if (config.optionalColumns.includes('laborCost')) headers.push('Labor Cost');
  if (config.optionalColumns.includes('installationTime')) headers.push('Install Time (min)');
  if (config.optionalColumns.includes('category')) headers.push('Category');
  if (config.optionalColumns.includes('modelNumber')) headers.push('Model Number');
  if (config.optionalColumns.includes('leadTime')) headers.push('Lead Time');
  if (config.optionalColumns.includes('supplier')) headers.push('Supplier');

  return headers;
};

// Build data row for hardware item
const buildHardwareSetRow = (item: any, config: HardwareSetExportConfig): any[] => {
  const row: any[] = [];

  // Required columns
  row.push(item.item.name || '');
  row.push(item.item.description || '');
  row.push(item.item.manufacturer || '');
  row.push(item.item.finish || '');
  row.push(formatUsage(item.doorTags, config.usageDisplay));

  // Optional columns
  if (config.optionalColumns.includes('quantityPerSet')) row.push(item.item.quantity || 0);
  if (config.optionalColumns.includes('totalQuantity')) row.push(item.totalQuantity || 0);
  if (config.optionalColumns.includes('unitPrice')) row.push(item.item.unitPrice || 0);
  if (config.optionalColumns.includes('extendedPrice')) {
    const extended = (item.item.unitPrice || 0) * (item.totalQuantity || 0);
    row.push(extended);
  }
  if (config.optionalColumns.includes('laborCost')) row.push(item.item.laborCost || 0);
  if (config.optionalColumns.includes('installationTime')) row.push(item.item.installationTime || 0);
  if (config.optionalColumns.includes('category')) row.push(item.item.category || '');
  if (config.optionalColumns.includes('modelNumber')) row.push(item.item.modelNumber || '');
  if (config.optionalColumns.includes('leadTime')) row.push(item.item.leadTime || '');
  if (config.optionalColumns.includes('supplier')) row.push(item.item.supplier || '');

  return row;
};

// Export Hardware Set to Excel
export const exportHardwareSetToExcel = (
  usageStats: any[],
  config: HardwareSetExportConfig,
  projectName: string
): void => {
  const workbook = XLSX.utils.book_new();
  const headers = buildHardwareSetHeaders(config);

  // Build data based on grouping
  const wsData: any[][] = [];

  // Add header rows
  wsData.push([projectName]);
  wsData.push(['Hardware Set Report']);
  wsData.push([`Generated: ${new Date().toLocaleDateString()}`]);
  wsData.push([`Grouping: ${config.groupBy}`]);
  wsData.push([]); // Empty row

  if (config.groupBy === 'flat') {
    // Simple flat list
    wsData.push(headers);
    usageStats.forEach(item => {
      wsData.push(buildHardwareSetRow(item, config));
    });
  } else {
    // Grouped output
    const groups = new Map<string, any[]>();

    usageStats.forEach(item => {
      let key: string;
      switch (config.groupBy) {
        case 'set':
          key = item.sets.join(', ') || 'Unassigned';
          break;
        case 'type':
          key = item.item.category || 'Uncategorized';
          break;
        case 'manufacturer':
          key = item.item.manufacturer || 'Unknown';
          break;
        default:
          key = 'All Items';
      }

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    });

    // Output each group
    groups.forEach((items, groupName) => {
      wsData.push([groupName]); // Group header
      wsData.push(headers);
      items.forEach(item => {
        wsData.push(buildHardwareSetRow(item, config));
      });
      wsData.push([]); // Empty row between groups
    });
  }

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  const colWidths = headers.map((_, idx) => {
    if (idx === 0) return { wch: 30 }; // Item Name
    if (idx === 1) return { wch: 40 }; // Description
    if (idx === 4) return { wch: 50 }; // Usage/Location
    return { wch: 15 };
  });
  worksheet['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Hardware Items');

  // Add cost summary sheet if requested
  if (config.includeCostSummary && config.optionalColumns.includes('extendedCost')) {
    const totalCost = usageStats.reduce((sum, item) => {
      return sum + ((item.item.unitCost || 0) * (item.totalQuantity || 0));
    }, 0);

    const costData: any[][] = [
      ['Hardware Cost Summary'],
      [],
      ['Total Items', usageStats.length],
      ['Total Cost', totalCost],
    ];

    const costSheet = XLSX.utils.aoa_to_sheet(costData);
    costSheet['!cols'] = [{ wch: 20 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, costSheet, 'Cost Summary');
  }

  // Generate filename
  const date = new Date().toISOString().split('T')[0];
  const filename = `HardwareSet_${projectName.replace(/[^a-z0-9]/gi, '_')}_${date}.xlsx`;

  // Download
  XLSX.writeFile(workbook, filename);
};

// ============================================================================
// Phase 23: Multi-Sheet Excel Export
// ============================================================================

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
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const fileName = `${options.projectName.replace(/[^a-z0-9]/gi, '_')}_Complete_Schedule.xlsx`;
    saveAs(blob, fileName);
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

    // Set column widths
    const colWidths = headers.map(h => ({ wch: Math.max(h.length + 2, 12) }));
    worksheet['!cols'] = colWidths;

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
            '', '', '', '', '', '', doorCount.toString(), '', '', '', ''
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
                item.quantity?.toString() || '1',
                doorCount.toString(),
                totalQty.toString(),
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

    // Set column widths
    worksheet['!cols'] = [
        { wch: 20 }, // Hardware Set
        { wch: 25 }, // Item Name
        { wch: 30 }, // Description
        { wch: 15 }, // Manufacturer
        { wch: 15 }, // Model Number
        { wch: 10 }, // Finish
        { wch: 12 }, // Qty per Set
        { wch: 15 }, // Doors Using Set
        { wch: 10 }, // Total Qty
        { wch: 12 }, // ANSI Grade
        { wch: 12 }, // Lead Time
        { wch: 12 }  // CSI Section
    ];

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
            door.silencerQty?.toString() || '',
            door.framePreparationNotes || ''
        ];
        data.push(row);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Set column widths
    const colWidths = headers.map(h => ({ wch: Math.max(h.length + 2, 15) }));
    worksheet['!cols'] = colWidths;

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
                totalQty.toString(),
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

    // Set column widths
    worksheet['!cols'] = [
        { wch: 20 }, // Manufacturer
        { wch: 30 }, // Product Name
        { wch: 20 }, // Model Number
        { wch: 10 }, // Total Qty
        { wch: 15 }, // Lead Time
        { wch: 12 }, // ANSI Grade
        { wch: 12 }, // CSI Section
        { wch: 20 }  // Hardware Sets
    ];

    // Merge title cell
    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Procurement Summary');
}

// Export Door Schedule to PDF
export const exportDoorScheduleToPDF = async (
    doors: Door[],
    selectedColumns: string[],
    projectName: string,
    elevationTypes: ElevationType[] = [],
): Promise<void> => {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    
    // Map selected column IDs to labels
    const columnLabels: Record<string, string> = {
        // Identification
        doorTag: 'Door Mark',
        quantity: 'Qty',
        location: 'Location',
        
        // Dimensions & Rating
        width: 'Width',
        height: 'Height',
        thickness: 'Thickness',
        fireRating: 'Fire Rating',
        fireRatingLabel: 'Label',
        stcRating: 'STC',
        smokeRating: 'Smoke',
        
        // Door Specs
        type: 'Type',
        doorMaterial: 'Door Material',
        doorCoreType: 'Core Type',
        doorFaceType: 'Face Type',
        woodSpecies: 'Wood Species',
        doorFinish: 'Door Finish',
        finishSystem: 'Finish System',
        doorManufacturer: 'Door Mfr',
        doorModelNumber: 'Door Model',
        
        // Frame Specs
        frameMaterial: 'Frame Material',
        frameDepth: 'Frame Depth',
        frameGauge: 'Gauge',
        frameProfile: 'Profile',
        anchorType: 'Anchor',
        anchorSpacing: 'Anchor Spacing',
        silencerQuantity: 'Silencers',
        frameManufacturer: 'Frame Mfr',
        frameModelNumber: 'Frame Model',
        framePreparationNotes: 'Frame Prep Notes',
        
        // Hardware Info
        assignedHardwareSet: 'HW Set',
        providedHardwareSet: 'Provided HW Set',
        hardwarePrep: 'HW Prep',
        hingeType: 'Hinge',
        lockType: 'Lock',
        handing: 'Handing',
        swingDirection: 'Swing',
        operation: 'Operation',
        
        // Placement
        interiorExterior: 'Int/Ext',
        undercut: 'Undercut',
        louvers: 'Louvers',
        visionPanels: 'Vision Panels',
        
        // Pricing
        pricing: 'Door Price',
        framePricing: 'Frame Price',
        totalUnitCost: 'Unit Total',
        
        // Notes
        specialNotes: 'Special Notes',
        csiSection: 'CSI Section',
        // Elevation
        elevationTypeId: 'Elevation Type',
        elevationImageUrl: 'Elevation Image URL',
    };

    // Build headers from selected columns
    const headers = selectedColumns.map(colId => columnLabels[colId] || colId);

    // Build data rows
    const dataRows = doors.map(door => {
        return selectedColumns.map(colId => {
            if (colId === 'elevationImageUrl') {
                return resolveElevationImageUrl(door, elevationTypes) || '-';
            }
            const value = (door as unknown as Record<string, unknown>)[colId];

            // Special handling for complex fields
            if (colId === 'assignedHardwareSet') {
                return (value as { name?: string } | null)?.name || '-';
            } else if (colId === 'pricing' || colId === 'framePricing') {
                if (value && typeof value === 'object') {
                    const v = value as Record<string, number>;
                    const total = v.total || v.unitCost || 0;
                    return total > 0 ? `$${total.toFixed(2)}` : '-';
                }
                return '-';
            } else if (colId === 'totalUnitCost') {
                return typeof value === 'number' ? `$${value.toFixed(2)}` : '-';
            } else if (colId === 'handing' || colId === 'doorCoreType' || colId === 'doorFaceType' ||
                       colId === 'frameMaterial' || colId === 'anchorType' || colId === 'frameProfile') {
                return value?.toString() || '-';
            } else if (typeof value === 'number') {
                return value.toString();
            } else if (typeof value === 'boolean') {
                return value ? 'Yes' : 'No';
            } else {
                return value || '-';
            }
        });
    });
    
    // Add header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(projectName || 'Door-Frame Reports', 14, 15);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);
    doc.text(`Total Doors: ${doors.length}`, 14, 27);
    
    // Add table
    autoTable(doc, {
        head: [headers],
        body: dataRows,
        startY: 32,
        styles: {
            fontSize: 8,
            cellPadding: 2,
            overflow: 'linebreak',
            halign: 'left'
        },
        headStyles: {
            fillColor: [59, 130, 246], // Blue
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center'
        },
        alternateRowStyles: {
            fillColor: [245, 245, 245]
        },
        margin: { left: 14, right: 14 },
        theme: 'striped'
    });
    
    // Add summary page
    doc.addPage();
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Door Schedule Summary', 14, 15);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    let yPos = 25;
    doc.text(`Total Doors: ${doors.length}`, 14, yPos);
    yPos += 7;
    
    const doorsWithHardware = doors.filter(d => d.assignedHardwareSet).length;
    doc.text(`Doors with Hardware: ${doorsWithHardware}`, 14, yPos);
    yPos += 7;
    doc.text(`Doors without Hardware: ${doors.length - doorsWithHardware}`, 14, yPos);
    yPos += 10;
    
    // Type breakdown
    const typeBreakdown = new Map<string, number>();
    doors.forEach(door => {
        const type = door.type || 'Unknown';
        typeBreakdown.set(type, (typeBreakdown.get(type) || 0) + 1);
    });
    
    if (typeBreakdown.size > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('Door Types:', 14, yPos);
        yPos += 7;
        doc.setFont('helvetica', 'normal');
        
        typeBreakdown.forEach((count, type) => {
            doc.text(`  ${type}: ${count}`, 14, yPos);
            yPos += 6;
        });
    }
    
    // Save PDF
    const fileName = `${projectName.replace(/\s+/g, '_')}_Door_Schedule_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
};

