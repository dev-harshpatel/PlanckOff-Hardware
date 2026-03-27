import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
    Door,
    HardwareSet,
    PriceBookEntry,
    PricingSettings,
    PricingReport,
    DoorLineItem,
    HardwareLineItem
} from '../types';
import { generatePricingReport, DEFAULT_PRICING_SETTINGS } from './pricingService';

/**
 * Pricing Report Export Service
 * 
 * Generates professional pricing reports and cost estimates in Excel and PDF formats.
 * Includes detailed line items, cost breakdowns, and project summaries.
 */

// ===== EXCEL EXPORT =====

/**
 * Export pricing report to Excel
 */
export function exportPricingReportToExcel(
    doors: Door[],
    hardwareSets: HardwareSet[],
    priceBook: PriceBookEntry[] = [],
    settings: PricingSettings = DEFAULT_PRICING_SETTINGS,
    metadata: {
        projectName: string;
        projectNumber?: string;
        clientName?: string;
        preparedBy: string;
        validUntil?: Date;
        notes?: string;
        terms?: string;
    }
): void {
    // Generate pricing report
    const report = generatePricingReport(doors, hardwareSets, priceBook, settings, metadata);

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Sheet 1: Cover Page
    addCoverSheet(wb, report, metadata);

    // Sheet 2: Door Line Items
    addDoorLineItemsSheet(wb, report);

    // Sheet 3: Hardware Line Items
    addHardwareLineItemsSheet(wb, report);

    // Sheet 4: Cost Summary
    addCostSummarySheet(wb, report);

    // Sheet 5: Price Book (if available)
    if (priceBook.length > 0) {
        addPriceBookSheet(wb, priceBook);
    }

    // Export
    const fileName = `${metadata.projectName.replace(/[^a-z0-9]/gi, '_')}_Pricing_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

/**
 * Add cover sheet
 */
function addCoverSheet(
    wb: XLSX.WorkBook,
    report: PricingReport,
    metadata: any
): void {
    const data = [
        ['PRICING REPORT'],
        [''],
        ['Project Information'],
        ['Project Name:', metadata.projectName],
        ['Project Number:', metadata.projectNumber || 'N/A'],
        ['Client:', metadata.clientName || 'N/A'],
        [''],
        ['Report Details'],
        ['Generated Date:', report.generatedDate.toLocaleDateString()],
        ['Prepared By:', report.generatedBy],
        ['Valid Until:', report.validUntil ? report.validUntil.toLocaleDateString() : 'N/A'],
        [''],
        ['Project Summary'],
        ['Total Doors:', report.doorLineItems.length],
        ['Hardware Sets:', report.hardwareLineItems.length],
        ['Total Cost:', `$${report.pricing.totalCost.toLocaleString()}`],
        ['Total Sell Price:', `$${report.pricing.totalSellPrice.toLocaleString()}`],
        ['Total Profit:', `$${report.pricing.totalProfit.toLocaleString()}`],
        ['Profit Margin:', `${report.pricing.profitMarginPercentage.toFixed(2)}%`],
        [''],
        ['Notes'],
        [metadata.notes || 'No additional notes'],
        [''],
        ['Terms & Conditions'],
        [metadata.terms || 'Standard terms apply']
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Styling
    ws['!cols'] = [{ wch: 20 }, { wch: 40 }];

    XLSX.utils.book_append_sheet(wb, ws, 'Cover');
}

/**
 * Add door line items sheet
 */
function addDoorLineItemsSheet(
    wb: XLSX.WorkBook,
    report: PricingReport
): void {
    const headers = [
        'Door Tag',
        'Description',
        'Quantity',
        'Door Price',
        'Frame Price',
        'Prep Price',
        'Finish Price',
        'Fire Rating Upcharge',
        'Unit Price',
        'Extended Price'
    ];

    const data = report.doorLineItems.map(item => [
        item.doorTag,
        item.description,
        item.quantity,
        item.pricing ? `$${item.pricing.baseDoorPrice.toFixed(2)}` : 'N/A',
        item.pricing ? `$${item.pricing.framePrice.toFixed(2)}` : 'N/A',
        item.pricing ? `$${item.pricing.prepPrice.toFixed(2)}` : 'N/A',
        item.pricing ? `$${item.pricing.finishPrice.toFixed(2)}` : 'N/A',
        item.pricing ? `$${item.pricing.fireRatingUpcharge.toFixed(2)}` : 'N/A',
        `$${item.unitPrice.toFixed(2)}`,
        `$${item.extendedPrice.toFixed(2)}`
    ]);

    // Add totals row
    const totalExtended = report.doorLineItems.reduce((sum, item) => sum + item.extendedPrice, 0);
    data.push([
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'TOTAL:',
        `$${totalExtended.toFixed(2)}`
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

    // Column widths
    ws['!cols'] = [
        { wch: 12 }, // Door Tag
        { wch: 30 }, // Description
        { wch: 10 }, // Quantity
        { wch: 12 }, // Door Price
        { wch: 12 }, // Frame Price
        { wch: 12 }, // Prep Price
        { wch: 12 }, // Finish Price
        { wch: 18 }, // Fire Rating
        { wch: 12 }, // Unit Price
        { wch: 15 }  // Extended Price
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Door Line Items');
}

/**
 * Add hardware line items sheet
 */
function addHardwareLineItemsSheet(
    wb: XLSX.WorkBook,
    report: PricingReport
): void {
    const headers = [
        'Hardware Set',
        'Description',
        'Doors Using Set',
        'Material Cost',
        'Labor Cost',
        'Total Cost',
        'Markup %',
        'Unit Sell Price',
        'Extended Price'
    ];

    const data = report.hardwareLineItems.map(item => [
        item.hardwareSetName,
        item.description,
        item.doorsUsingSet,
        item.pricing ? `$${item.pricing.materialCost.toFixed(2)}` : 'N/A',
        item.pricing ? `$${item.pricing.laborCost.toFixed(2)}` : 'N/A',
        item.pricing ? `$${item.pricing.totalCost.toFixed(2)}` : 'N/A',
        item.pricing ? `${item.pricing.markup.toFixed(1)}%` : 'N/A',
        `$${item.unitPrice.toFixed(2)}`,
        `$${item.extendedPrice.toFixed(2)}`
    ]);

    // Add totals row
    const totalExtended = report.hardwareLineItems.reduce((sum, item) => sum + item.extendedPrice, 0);
    data.push([
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'TOTAL:',
        `$${totalExtended.toFixed(2)}`
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

    // Column widths
    ws['!cols'] = [
        { wch: 20 }, // Hardware Set
        { wch: 30 }, // Description
        { wch: 15 }, // Doors Using
        { wch: 14 }, // Material Cost
        { wch: 12 }, // Labor Cost
        { wch: 12 }, // Total Cost
        { wch: 10 }, // Markup
        { wch: 15 }, // Unit Price
        { wch: 15 }  // Extended Price
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Hardware Line Items');
}

/**
 * Add cost summary sheet
 */
function addCostSummarySheet(
    wb: XLSX.WorkBook,
    report: PricingReport
): void {
    const data = [
        ['COST SUMMARY'],
        [''],
        ['Component Costs'],
        ['Doors:', `$${report.pricing.totalDoorsCost.toLocaleString()}`],
        ['Frames:', `$${report.pricing.totalFramesCost.toLocaleString()}`],
        ['Hardware:', `$${report.pricing.totalHardwareCost.toLocaleString()}`],
        ['Subtotal:', `$${report.pricing.subtotal.toLocaleString()}`],
        [''],
        ['Adjustments'],
        [`Tax (${report.pricing.taxRate}%):`, `$${report.pricing.taxAmount.toLocaleString()}`],
        ['Shipping:', `$${report.pricing.shippingCost.toLocaleString()}`],
        ['Discount:', `$${report.pricing.discountAmount.toLocaleString()}`],
        [''],
        ['Markups & Margins'],
        ['Material Markup:', `${report.pricing.materialMarkup}%`],
        ['Labor Markup:', `${report.pricing.laborMarkup}%`],
        ['Overhead:', `${report.pricing.overheadPercentage}%`],
        ['Profit Margin:', `${report.pricing.profitMargin}%`],
        [''],
        ['Final Totals'],
        ['Total Cost:', `$${report.pricing.totalCost.toLocaleString()}`],
        ['Total Sell Price:', `$${report.pricing.totalSellPrice.toLocaleString()}`],
        ['Total Profit:', `$${report.pricing.totalProfit.toLocaleString()}`],
        ['Profit Margin %:', `${report.pricing.profitMarginPercentage.toFixed(2)}%`]
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Column widths
    ws['!cols'] = [{ wch: 25 }, { wch: 20 }];

    XLSX.utils.book_append_sheet(wb, ws, 'Cost Summary');
}

/**
 * Add price book sheet
 */
function addPriceBookSheet(
    wb: XLSX.WorkBook,
    priceBook: PriceBookEntry[]
): void {
    const headers = [
        'Category',
        'Item Type',
        'Manufacturer',
        'Model Number',
        'Description',
        'Unit Price',
        'UOM',
        'Labor Hours',
        'Labor Rate',
        'Supplier',
        'Lead Time'
    ];

    const data = priceBook.map(entry => [
        entry.category,
        entry.itemType,
        entry.manufacturer || '',
        entry.modelNumber || '',
        entry.description,
        `$${entry.unitPrice.toFixed(2)}`,
        entry.unitOfMeasure,
        entry.laborHours || '',
        entry.laborRate ? `$${entry.laborRate.toFixed(2)}` : '',
        entry.supplier || '',
        entry.leadTime || ''
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

    // Column widths
    ws['!cols'] = [
        { wch: 12 }, // Category
        { wch: 20 }, // Item Type
        { wch: 18 }, // Manufacturer
        { wch: 15 }, // Model
        { wch: 35 }, // Description
        { wch: 12 }, // Price
        { wch: 8 },  // UOM
        { wch: 12 }, // Labor Hours
        { wch: 12 }, // Labor Rate
        { wch: 18 }, // Supplier
        { wch: 12 }  // Lead Time
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Price Book');
}

// ===== QUICK EXPORT FUNCTIONS =====

/**
 * Export simple pricing summary to CSV
 */
export function exportPricingSummaryToCSV(
    doors: Door[],
    hardwareSets: HardwareSet[],
    priceBook: PriceBookEntry[] = [],
    settings: PricingSettings = DEFAULT_PRICING_SETTINGS,
    projectName: string
): void {
    const report = generatePricingReport(doors, hardwareSets, priceBook, settings, {
        projectName,
        generatedBy: 'System'
    });

    const headers = ['Category', 'Item', 'Quantity', 'Unit Price', 'Extended Price'];
    
    const rows: string[][] = [headers];

    // Add door items
    report.doorLineItems.forEach(item => {
        rows.push([
            'Door',
            `${item.doorTag} - ${item.description}`,
            item.quantity.toString(),
            `$${item.unitPrice.toFixed(2)}`,
            `$${item.extendedPrice.toFixed(2)}`
        ]);
    });

    // Add hardware items
    report.hardwareLineItems.forEach(item => {
        rows.push([
            'Hardware',
            `${item.hardwareSetName} - ${item.description}`,
            item.doorsUsingSet.toString(),
            `$${item.unitPrice.toFixed(2)}`,
            `$${item.extendedPrice.toFixed(2)}`
        ]);
    });

    // Add summary
    rows.push(['', '', '', '', '']);
    rows.push(['SUMMARY', '', '', '', '']);
    rows.push(['Total Cost', '', '', '', `$${report.pricing.totalCost.toFixed(2)}`]);
    rows.push(['Total Sell Price', '', '', '', `$${report.pricing.totalSellPrice.toFixed(2)}`]);
    rows.push(['Total Profit', '', '', '', `$${report.pricing.totalProfit.toFixed(2)}`]);

    // Convert to CSV
    const csv = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const fileName = `${projectName.replace(/[^a-z0-9]/gi, '_')}_Pricing_Summary.csv`;
    saveAs(blob, fileName);
}

/**
 * Generate pricing report data for PDF export
 */
export function generatePricingReportData(
    doors: Door[],
    hardwareSets: HardwareSet[],
    priceBook: PriceBookEntry[] = [],
    settings: PricingSettings = DEFAULT_PRICING_SETTINGS,
    metadata: {
        projectName: string;
        projectNumber?: string;
        clientName?: string;
        preparedBy: string;
        validUntil?: Date;
        notes?: string;
        terms?: string;
    }
): PricingReport {
    return generatePricingReport(doors, hardwareSets, priceBook, settings, metadata);
}

// ===== EXPORT =====

export default {
    exportPricingReportToExcel,
    exportPricingSummaryToCSV,
    generatePricingReportData
};
