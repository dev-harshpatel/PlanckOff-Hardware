import { Door, HardwareSet, ElevationType } from '../types';
import { DoorScheduleExportConfig } from '../components/doorSchedule/DoorScheduleConfig';
import { HardwareSetExportConfig } from '../components/hardware/HardwareSetConfig';

function resolveElevationImageUrl(door: Door, elevationTypes: ElevationType[]): string {
  if (!door.elevationTypeId) return '';
  const et = elevationTypes.find(e =>
    e.id === door.elevationTypeId ||
    e.code === door.elevationTypeId ||
    e.name === door.elevationTypeId
  );
  return et?.imageUrl ?? '';
}

// Helper to escape CSV values
const escapeCSV = (value: any): string => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

// Helper to download file
const downloadFile = (content: string, filename: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

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

// Export Door Schedule to CSV
export const exportDoorScheduleToCSV = (
  doors: Door[],
  config: DoorScheduleExportConfig,
  projectName: string,
  elevationTypes: ElevationType[] = [],
): void => {
  const headers = buildDoorScheduleHeaders(config.columns);
  const rows = doors.map(door => buildDoorScheduleRow(door, config.columns, elevationTypes));

  // Build CSV content
  let csv = '';

  // Add header if requested
  if (config.includeHeader) {
    csv += `${projectName}\n`;
    csv += `Door-Frame Reports\n`;
    csv += `Generated: ${new Date().toLocaleDateString()}\n`;
    csv += `\n`;
  }

  // Add column headers
  csv += headers.map(escapeCSV).join(',') + '\n';

  // Add data rows
  rows.forEach(row => {
    csv += row.map(escapeCSV).join(',') + '\n';
  });

  // Add summary if requested
  if (config.includeSummary) {
    csv += '\n';
    csv += 'Summary\n';
    csv += `Total Doors,${doors.length}\n`;
    const doorsWithHardware = doors.filter(d => d.assignedHardwareSet).length;
    csv += `Doors with Hardware,${doorsWithHardware}\n`;
  }

  // Generate filename
  const date = new Date().toISOString().split('T')[0];
  const filename = `DoorSchedule_${projectName.replace(/[^a-z0-9]/gi, '_')}_${date}.csv`;

  // Download
  downloadFile(csv, filename, 'text/csv');
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
  if (config.optionalColumns.includes('unitCost')) headers.push('Unit Cost');
  if (config.optionalColumns.includes('extendedCost')) headers.push('Extended Cost');
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
  if (config.optionalColumns.includes('unitCost')) row.push(item.item.unitCost || '');
  if (config.optionalColumns.includes('extendedCost')) {
    const extended = (item.item.unitCost || 0) * (item.totalQuantity || 0);
    row.push(extended.toFixed(2));
  }
  if (config.optionalColumns.includes('category')) row.push(item.item.category || '');
  if (config.optionalColumns.includes('modelNumber')) row.push(item.item.modelNumber || '');
  if (config.optionalColumns.includes('leadTime')) row.push(item.item.leadTime || '');
  if (config.optionalColumns.includes('supplier')) row.push(item.item.supplier || '');

  return row;
};

// Export Hardware Set to CSV
export const exportHardwareSetToCSV = (
  usageStats: any[],
  config: HardwareSetExportConfig,
  projectName: string
): void => {
  const headers = buildHardwareSetHeaders(config);

  // Build CSV content
  let csv = '';

  // Add header
  csv += `${projectName}\n`;
  csv += `Hardware Set Report\n`;
  csv += `Generated: ${new Date().toLocaleDateString()}\n`;
  csv += `Grouping: ${config.groupBy}\n`;
  csv += `\n`;

  // Group items if needed
  if (config.groupBy === 'flat') {
    // Simple flat list
    csv += headers.map(escapeCSV).join(',') + '\n';
    usageStats.forEach(item => {
      const row = buildHardwareSetRow(item, config);
      csv += row.map(escapeCSV).join(',') + '\n';
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
      csv += `\n${groupName}\n`;
      csv += headers.map(escapeCSV).join(',') + '\n';
      items.forEach(item => {
        const row = buildHardwareSetRow(item, config);
        csv += row.map(escapeCSV).join(',') + '\n';
      });
    });
  }

  // Add summary if requested
  if (config.optionalColumns.includes('extendedCost')) {
    csv += '\n';
    csv += 'Cost Summary\n';
    const totalCost = usageStats.reduce((sum, item) => {
      return sum + ((item.item.unitCost || 0) * (item.totalQuantity || 0));
    }, 0);
    csv += `Total Cost,$${totalCost.toFixed(2)}\n`;
  }

  // Generate filename
  const date = new Date().toISOString().split('T')[0];
  const filename = `HardwareSet_${projectName.replace(/[^a-z0-9]/gi, '_')}_${date}.csv`;

  // Download
  downloadFile(csv, filename, 'text/csv');
};
