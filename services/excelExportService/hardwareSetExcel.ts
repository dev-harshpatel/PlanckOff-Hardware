import * as XLSX from 'xlsx-js-style';
import { contentAwareColWidths, buildMetadataRows, applyMetadataStyles, applyHeaderRowAt, applyFreezeAt } from '../excelTheme';
import type { HardwareSetExportConfig } from '../../types/hardwareSetTypes';
import { buildExportFilename } from '../../utils/exportFilename';

// Format usage for Hardware Set reports
const formatUsage = (doorTags: string[], mode: string | string[]): string => {
  const sorted = [...new Set(doorTags)].sort();
  const modes = Array.isArray(mode) ? mode : [mode];

  if (modes.includes('count')) return `Used in ${sorted.length} doors`;
  if (modes.includes('preview')) {
    if (sorted.length <= 5) return sorted.join(', ');
    return `${sorted.slice(0, 5).join(', ')}... +${sorted.length - 5} more`;
  }
  return sorted.join(', ');
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
  row.push((item.item.userDescription ?? item.item.processedDescription ?? item.item.description) || '');
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

  wsData.push(...buildMetadataRows({
    reportTitle: 'Hardware Set Report',
    projectName,
    itemCount: usageStats.length,
    extraInfo: config.groupBy !== 'flat' ? `Grouped by ${config.groupBy}` : undefined,
  }));

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
      const groupTotalQty = items.reduce((sum: number, item: any) => sum + (item.totalQuantity || 0), 0);
      wsData.push([`${groupName}  —  ${items.length} item${items.length !== 1 ? 's' : ''} · Total Qty: ${groupTotalQty}`]);
      wsData.push(headers);
      items.forEach(item => {
        wsData.push(buildHardwareSetRow(item, config));
      });

      // Subtotal row
      const subtotalRow: any[] = ['', '', '', '', 'SUBTOTAL'];
      if (config.optionalColumns.includes('quantityPerSet')) subtotalRow.push('');
      if (config.optionalColumns.includes('totalQuantity')) subtotalRow.push(groupTotalQty);
      if (config.optionalColumns.includes('unitPrice')) subtotalRow.push('');
      if (config.optionalColumns.includes('extendedPrice')) {
        const groupExtended = items.reduce(
          (sum: number, item: any) => sum + (item.item.unitPrice || 0) * (item.totalQuantity || 0),
          0
        );
        subtotalRow.push(groupExtended);
      }
      if (config.optionalColumns.includes('laborCost')) subtotalRow.push('');
      if (config.optionalColumns.includes('installationTime')) subtotalRow.push('');
      if (config.optionalColumns.includes('category')) subtotalRow.push('');
      if (config.optionalColumns.includes('modelNumber')) subtotalRow.push('');
      if (config.optionalColumns.includes('leadTime')) subtotalRow.push('');
      if (config.optionalColumns.includes('supplier')) subtotalRow.push('');
      wsData.push(subtotalRow);

      wsData.push([]); // Empty row between groups
    });
  }

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);

  worksheet['!cols'] = contentAwareColWidths(headers, wsData.slice(4).filter(r => r.length > 1));
  applyMetadataStyles(worksheet, headers.length);
  if (config.groupBy === 'flat') {
    applyHeaderRowAt(worksheet, 3, headers.length);
    applyFreezeAt(worksheet, 4);
  } else {
    applyFreezeAt(worksheet, 3);
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Hardware Items');

  // Add cost summary sheet if requested
  if (config.optionalColumns.includes('extendedCost')) {
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

  XLSX.writeFile(workbook, buildExportFilename(projectName, 'hardware-set', 'xlsx'), { cellStyles: true });
};
