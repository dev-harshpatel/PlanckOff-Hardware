
import { Report, HardwareItem } from '../types';

// Helper to escape CSV fields to handle commas, quotes, and newlines
const escapeCsvField = (field: string | number): string => {
    const stringField = String(field);
    // If the field contains a comma, double quote, or newline, enclose it in double quotes
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
        // Inside a double-quoted field, any double quote must be escaped by another double quote
        return `"${stringField.replace(/"/g, '""')}"`;
    }
    return stringField;
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

    // Sanitize project name for a clean filename
    const sanitizedProjectName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.setAttribute('download', `TVE-Report-${sanitizedProjectName}.csv`);
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
    
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `TVE-Master-Inventory-${dateStr}.csv`);
    link.setAttribute('href', url);
    document.body.appendChild(link);
    
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
