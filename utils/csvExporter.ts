
import { Report, HardwareItem } from '../types';
import { buildExportFilename } from './exportFilename';

// Helper to escape CSV fields to handle commas, quotes, and newlines.
// Numbers are written bare (no quotes) so Excel treats them as numeric cells.
const escapeCsvField = (field: string | number): string => {
    if (typeof field === 'number') return isNaN(field) ? '' : String(field);
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
};

/**
 * Generates a CSV file from the estimation report and triggers a download.
 * @param report The generated estimation report.
 * @param projectName The name of the project for the filename.
 */
export const exportReportToCSV = (report: Report, projectName: string) => {
    if (!report) return;

    // Create the prominent main header
    const projectTitle = `PROJECT NAME: ${projectName.toUpperCase()}`;

    const headers = ['Item', 'Manufacturer', 'Description', 'Finish', 'Door Material', 'Total Qty', 'Source Set(s)'];

    const sortedHardware = Object.values(report.hardwareSummary).sort((a, b) =>
        a.item.name.localeCompare(b.item.name)
    );

    const rows = sortedHardware.map(summary => [
        escapeCsvField(summary.item.name),
        escapeCsvField(summary.item.manufacturer),
        escapeCsvField(summary.item.description),
        escapeCsvField(summary.item.finish),
        escapeCsvField(summary.item.doorMaterial || 'N/A'),
        escapeCsvField(summary.totalQuantity),
        escapeCsvField((summary.sourceSets || []).join(', ')),
    ]);

    const csvContent = [
        escapeCsvField(projectTitle), // Row 1: Project Name (uppercase)
        '',                           // Row 2: Empty for separation
        headers.join(','),            // Row 3: Headers
        ...rows.map(row => row.join(',')) // Row 4+: Data
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.setAttribute('download', buildExportFilename(projectName, 'estimation-report', 'csv'));
    link.setAttribute('href', url);
    document.body.appendChild(link);
    
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/**
 * Exports the Master Database Inventory to CSV.
 * @param inventory The list of hardware items.
 */
export const exportInventoryToCSV = (inventory: HardwareItem[]) => {
    if (!inventory || inventory.length === 0) return;

    const title = "MASTER HARDWARE DATABASE";
    const headers = ['Item Name', 'Manufacturer', 'Description', 'Finish', 'Quantity'];

    const rows = inventory.map(item => [
        escapeCsvField(item.name),
        escapeCsvField(item.manufacturer),
        escapeCsvField(item.description),
        escapeCsvField(item.finish),
        escapeCsvField(item.quantity || 0),
    ]);

    const csvContent = [
        escapeCsvField(title),
        '',
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.setAttribute('download', buildExportFilename('', 'master-hardware-database', 'csv'));
    link.setAttribute('href', url);
    document.body.appendChild(link);
    
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
