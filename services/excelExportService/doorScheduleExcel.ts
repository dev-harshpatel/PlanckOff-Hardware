import * as XLSX from 'xlsx-js-style';
import { applySheetTheme, contentAwareColWidths, buildMetadataRows, applyMetadataStyles, applyHeaderRowAt, applyFreezeAt } from '../excelTheme';
import { Door, ElevationType } from '../../types';
import type { DoorScheduleExportConfig } from '../../types/doorScheduleTypes';
import { buildExportFilename } from '../../utils/exportFilename';

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

  if (config.includeHeader) {
    wsData.push(...buildMetadataRows({ reportTitle: 'Door Schedule', projectName, itemCount: doors.length }));
  }

  // Add column headers and data
  wsData.push(headers);
  wsData.push(...dataRows);

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);

  worksheet['!cols'] = contentAwareColWidths(headers, dataRows);
  if (config.includeHeader) {
    applyMetadataStyles(worksheet, headers.length);
    applyHeaderRowAt(worksheet, 3, headers.length);
    applyFreezeAt(worksheet, 4);
  } else {
    applyHeaderRowAt(worksheet, 0, headers.length);
    applyFreezeAt(worksheet, 1);
  }

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

  XLSX.writeFile(workbook, buildExportFilename(projectName, 'door-schedule', 'xlsx'), { cellStyles: true });
};
