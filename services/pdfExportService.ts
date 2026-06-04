import { Door, HardwareSet, ElevationType } from '../types';
import type { CompanySettings } from '../lib/db/companySettings';
import type { DoorScheduleExportConfig } from '../types/doorScheduleTypes';
import type { HardwareSetExportConfig } from '../types/hardwareSetTypes';
import { buildExportFilename } from '../utils/exportFilename';
import {
  buildAutoTableOptions,
  addPageNumbers,
  loadLogoDataUrl,
  DEFAULT_THEME,
  PDF_MARGIN,
  HEADER_BAR_HEIGHT,
} from './pdfTheme';

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
  if (columns.basic.includes('quantity')) headers.push('Qty');
  if (columns.basic.includes('type')) headers.push('Type');

  // Dimensions
  if (columns.dimensions.includes('width')) headers.push('Width');
  if (columns.dimensions.includes('height')) headers.push('Height');
  if (columns.dimensions.includes('thickness')) headers.push('Thick');
  if (columns.dimensions.includes('frameDepth')) headers.push('Frame');

  // Materials
  if (columns.materials.includes('doorMaterial')) headers.push('Door Mat');
  if (columns.materials.includes('frameMaterial')) headers.push('Frame Mat');
  if (columns.materials.includes('coreType')) headers.push('Core');
  if (columns.materials.includes('veneerType')) headers.push('Veneer');

  // Fire & Safety
  if (columns.fireSafety.includes('fireRating')) headers.push('Fire');
  if (columns.fireSafety.includes('smokeRating')) headers.push('Smoke');
  if (columns.fireSafety.includes('stcRating')) headers.push('STC');
  if (columns.fireSafety.includes('egressRequired')) headers.push('Egress');

  // Hardware
  if (columns.hardware.includes('assignedHardwareSet')) headers.push('HW Set');
  if (columns.hardware.includes('hardwarePrep')) headers.push('HW Prep');
  if (columns.hardware.includes('hingeType')) headers.push('Hinge');
  if (columns.hardware.includes('lockType')) headers.push('Lock');

  // Additional
  if (columns.additional.includes('interiorExterior')) headers.push('Int/Ext');
  if (columns.additional.includes('swingDirection')) headers.push('Swing');
  if (columns.additional.includes('undercut')) headers.push('Undercut');
  if (columns.additional.includes('louvers')) headers.push('Louvers');
  if (columns.additional.includes('visionPanels')) headers.push('Vision');
  if (columns.additional.includes('specialNotes')) headers.push('Notes');
  if (columns.additional.includes('elevationTypeId')) headers.push('Elevation');
  if (columns.additional.includes('elevationImageUrl')) headers.push('Elevation URL');

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

// Export Door Schedule to PDF
export const exportDoorScheduleToPDF = async (
  doors: Door[],
  config: DoorScheduleExportConfig,
  projectName: string,
  elevationTypes: ElevationType[] = [],
  projectLocation?: string,
  projectProvince?: string,
): Promise<void> => {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const exportDate  = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const pageWidth   = doc.internal.pageSize.getWidth();
  const pageHeight  = doc.internal.pageSize.getHeight();
  const logoDataUrl = await loadLogoDataUrl();

  // Build table data
  const headers = buildDoorScheduleHeaders(config.columns);
  const rows = doors.map(door => buildDoorScheduleRow(door, config.columns, elevationTypes));

  // Create table using shared theme
  autoTable(doc, {
    ...buildAutoTableOptions(DEFAULT_THEME, 'Door Schedule', exportDate, pageWidth, PDF_MARGIN, { projectName, logoDataUrl, projectLocation, projectProvince }),
    head: [headers],
    body: rows,
    startY: HEADER_BAR_HEIGHT + 2,
  });

  // Add summary if requested
  if (config.includeSummary) {
    let yPosition = (doc as any).lastAutoTable.finalY + 10;

    // Check if we need a new page
    if (yPosition > 180) {
      doc.addPage();
      yPosition = HEADER_BAR_HEIGHT + 2;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', PDF_MARGIN, yPosition);
    yPosition += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Doors: ${doors.length}`, PDF_MARGIN, yPosition);
    yPosition += 5;

    const doorsWithHardware = doors.filter(d => d.assignedHardwareSet).length;
    doc.text(`Doors with Hardware: ${doorsWithHardware}`, PDF_MARGIN, yPosition);
    yPosition += 5;

    doc.text(`Doors without Hardware: ${doors.length - doorsWithHardware}`, PDF_MARGIN, yPosition);
  }

  // Add page numbers (two-pass: correct total is known only after autoTable returns)
  addPageNumbers(doc, projectName, pageWidth, pageHeight, PDF_MARGIN);

  doc.save(buildExportFilename(projectName, 'door-schedule', 'pdf'));
};

// Format usage for Hardware Set reports
const formatUsage = (doorTags: string[], mode: string | string[]): string => {
  const sorted = [...new Set(doorTags)].sort();
  const modes = Array.isArray(mode) ? mode : [mode];

  if (modes.includes('count')) return `${sorted.length} doors`;
  if (modes.includes('preview')) {
    if (sorted.length <= 5) return sorted.join(', ');
    return `${sorted.slice(0, 5).join(', ')}... +${sorted.length - 5}`;
  }
  return sorted.join(', ');
};

// Build headers for Hardware Set
const buildHardwareSetHeaders = (config: HardwareSetExportConfig): string[] => {
  const headers: string[] = [];

  // Required columns
  headers.push('Item');
  headers.push('Description');
  headers.push('Mfr');
  headers.push('Finish');
  headers.push('Usage');

  // Optional columns
  if (config.optionalColumns.includes('quantityPerSet')) headers.push('Qty/Set');
  if (config.optionalColumns.includes('totalQuantity')) headers.push('Total');
  if (config.optionalColumns.includes('unitCost')) headers.push('Unit $');
  if (config.optionalColumns.includes('extendedCost')) headers.push('Ext $');
  if (config.optionalColumns.includes('category')) headers.push('Category');
  if (config.optionalColumns.includes('modelNumber')) headers.push('Model');
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
  if (config.optionalColumns.includes('unitCost')) row.push(`$${(item.item.unitCost || 0).toFixed(2)}`);
  if (config.optionalColumns.includes('extendedCost')) {
    const extended = (item.item.unitCost || 0) * (item.totalQuantity || 0);
    row.push(`$${extended.toFixed(2)}`);
  }
  if (config.optionalColumns.includes('category')) row.push(item.item.category || '');
  if (config.optionalColumns.includes('modelNumber')) row.push(item.item.modelNumber || '');
  if (config.optionalColumns.includes('leadTime')) row.push(item.item.leadTime || '');
  if (config.optionalColumns.includes('supplier')) row.push(item.item.supplier || '');

  return row;
};

// Export Hardware Set to PDF
export const exportHardwareSetToPDF = async (
  usageStats: any[],
  config: HardwareSetExportConfig,
  projectName: string,
  projectLocation?: string,
  projectProvince?: string,
): Promise<void> => {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const exportDate  = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const pageWidth   = doc.internal.pageSize.getWidth();
  const pageHeight  = doc.internal.pageSize.getHeight();
  const logoDataUrl = await loadLogoDataUrl();
  const themeOpts   = buildAutoTableOptions(DEFAULT_THEME, 'Hardware Set Report', exportDate, pageWidth, PDF_MARGIN, { projectName, logoDataUrl, projectLocation, projectProvince });

  const headers = buildHardwareSetHeaders(config);

  if (config.groupBy === 'flat') {
    // Simple flat list
    const rows = usageStats.map(item => buildHardwareSetRow(item, config));

    autoTable(doc, {
      ...themeOpts,
      head: [headers],
      body: rows,
      startY: HEADER_BAR_HEIGHT + 2,
    });

    addPageNumbers(doc, projectName, pageWidth, pageHeight, PDF_MARGIN);
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
    let isFirstGroup = true;
    let yPosition = HEADER_BAR_HEIGHT + 2;
    groups.forEach((items, groupName) => {
      // Group header
      if (!isFirstGroup) {
        yPosition = (doc as any).lastAutoTable.finalY + 10;
      }

      const groupTotalQty = items.reduce((sum: number, item: any) => sum + (item.totalQuantity || 0), 0);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(groupName, PDF_MARGIN, yPosition);
      yPosition += 5;

      const rows = items.map((item: any) => buildHardwareSetRow(item, config));

      // Build subtotal foot row aligned to header columns
      const subtotalRow: any[] = ['', '', '', '', 'SUBTOTAL'];
      if (config.optionalColumns.includes('quantityPerSet')) subtotalRow.push('');
      if (config.optionalColumns.includes('totalQuantity')) subtotalRow.push(groupTotalQty);
      if (config.optionalColumns.includes('unitCost')) subtotalRow.push('');
      if (config.optionalColumns.includes('extendedCost')) {
        const groupExtended = items.reduce(
          (sum: number, item: any) => sum + (item.item.unitCost || 0) * (item.totalQuantity || 0),
          0
        );
        subtotalRow.push(`$${groupExtended.toFixed(2)}`);
      }
      if (config.optionalColumns.includes('category')) subtotalRow.push('');
      if (config.optionalColumns.includes('modelNumber')) subtotalRow.push('');
      if (config.optionalColumns.includes('leadTime')) subtotalRow.push('');
      if (config.optionalColumns.includes('supplier')) subtotalRow.push('');

      autoTable(doc, {
        ...themeOpts,
        head: [headers],
        body: rows,
        startY: isFirstGroup ? HEADER_BAR_HEIGHT + 2 : yPosition,
      });

      isFirstGroup = false;
    });

    // Page numbers after all group tables are complete (correct total known now)
    addPageNumbers(doc, projectName, pageWidth, pageHeight, PDF_MARGIN);
  }

  // Add cost summary if requested
  if (config.optionalColumns.includes('extendedCost')) {
    let yPosition = (doc as any).lastAutoTable.finalY + 10;

    if (yPosition > 180) {
      doc.addPage();
      yPosition = HEADER_BAR_HEIGHT + 2;
    }

    const totalCost = usageStats.reduce((sum, item) => {
      return sum + ((item.item.unitCost || 0) * (item.totalQuantity || 0));
    }, 0);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Cost Summary', PDF_MARGIN, yPosition);
    yPosition += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Items: ${usageStats.length}`, PDF_MARGIN, yPosition);
    yPosition += 5;
    doc.text(`Total Cost: $${totalCost.toFixed(2)}`, PDF_MARGIN, yPosition);
  }

  doc.save(buildExportFilename(projectName, 'hardware-set', 'pdf'));
};

// ----------------------------------------------------------------------
// SUBMITTAL PACKAGE EXPORT
// ----------------------------------------------------------------------

import { SubmittalExportConfig } from '../components/submittals/SubmittalPackageConfig';

// Standard columns for Submittal Door Schedule
const SUBMITTAL_DOOR_COLUMNS: DoorScheduleExportConfig['columns'] = {
  basic: ['doorTag', 'location', 'quantity', 'type'],
  dimensions: ['width', 'height', 'thickness', 'frameDepth'],
  materials: ['doorMaterial', 'frameMaterial', 'finish'],
  fireSafety: ['fireRating'],
  hardware: ['assignedHardwareSet'],
  additional: ['swingDirection', 'specialNotes']
};

export const exportSubmittalPackageToPDF = async (
  doors: Door[],
  hardwareSets: HardwareSet[],
  elevationTypes: ElevationType[],
  config: SubmittalExportConfig
): Promise<void> => {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const exportDate  = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const pageWidth   = doc.internal.pageSize.getWidth();
  const pageHeight  = doc.internal.pageSize.getHeight();
  const logoDataUrl = await loadLogoDataUrl();

  // Fetch company settings for cover page
  let companySettings: CompanySettings | null = null;
  try {
    const res = await fetch('/api/settings/company', { credentials: 'include' });
    if (res.ok) {
      const json = await res.json() as { data?: CompanySettings };
      companySettings = json?.data ?? null;
    }
  } catch { /* skip — cover page renders without company info */ }

  const { coverPageDetails, sections } = config;

  // 1. COVER PAGE
  if (sections.coverPage) {
    // Double border
    doc.setLineWidth(0.8);
    doc.setDrawColor(...DEFAULT_THEME.headFill);
    doc.rect(10, 10, 190, 277);
    doc.setLineWidth(0.25);
    doc.setDrawColor(180, 195, 220);
    doc.rect(13, 13, 184, 271);
    doc.setDrawColor(0, 0, 0);

    let y = 26;

    // ── Company section ─────────────────────────────────────────────────
    if (companySettings?.companyName) {
      const co = companySettings;

      // Company logo
      if (co.logoUrl) {
        try {
          const resp    = await fetch(co.logoUrl);
          const blob    = await resp.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader    = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror   = reject;
            reader.readAsDataURL(blob);
          });
          const img = new Image();
          await new Promise<void>(res => { img.onload = () => res(); img.src = dataUrl; });
          const MAX_LOGO_H = 28;
          const scale      = MAX_LOGO_H / img.height;
          const logoW      = Math.min(img.width * scale, 72);
          const canvas     = document.createElement('canvas');
          canvas.width     = logoW;
          canvas.height    = MAX_LOGO_H;
          canvas.getContext('2d')?.drawImage(img, 0, 0, logoW, MAX_LOGO_H);
          doc.addImage(canvas.toDataURL('image/png'), 'PNG', 105 - logoW / 2, y, logoW, MAX_LOGO_H);
          y += MAX_LOGO_H + 8;
        } catch { /* skip logo on error */ }
      }

      // Company name
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(12, 18, 40);
      doc.text(co.companyName, 105, y, { align: 'center' });
      y += 10;

      // Contact details
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(85, 95, 115);
      const contactLines: string[] = [];
      if (co.websiteUrl || co.email)
        contactLines.push([co.websiteUrl, co.email].filter(Boolean).join('   ·   '));
      if (co.phone) contactLines.push(co.phone);
      const addrParts = [co.address, co.province, co.country].filter(Boolean).join(', ');
      if (addrParts) contactLines.push(addrParts);
      for (const line of contactLines) {
        doc.text(line, 105, y, { align: 'center' });
        y += 6;
      }
      doc.setTextColor(0, 0, 0);
      y += 6;

      // Decorative separator
      doc.setDrawColor(...DEFAULT_THEME.headFill);
      doc.setLineWidth(0.7);
      doc.line(28, y, 182, y);
      doc.setLineWidth(0.2);
      doc.setDrawColor(180, 195, 220);
      doc.line(28, y + 1.8, 182, y + 1.8);
      doc.setDrawColor(0, 0, 0);
      y += 14;
    } else {
      y = 72; // original centred position when no company info
    }

    // ── Submittal title section ──────────────────────────────────────────
    // "SUBMITTAL PACKAGE" label
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DEFAULT_THEME.headFill);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).setCharSpace(3);
    doc.text('SUBMITTAL PACKAGE', 105, y, { align: 'center' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).setCharSpace(0);
    doc.setTextColor(0, 0, 0);
    y += 10;

    // Project name
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(10, 15, 35);
    const projLines = doc.splitTextToSize(coverPageDetails.projectName || 'Untitled Project', 168);
    doc.text(projLines, 105, y, { align: 'center' });
    y += (projLines.length as number) * 11 + 5;

    // Submittal number
    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110, 120, 140);
    doc.text(`Submittal  #${coverPageDetails.submittalNumber}`, 105, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 16;

    // ── Details box ──────────────────────────────────────────────────────
    const detailRows: [string, string][] = [
      ['Date', new Date(coverPageDetails.submittalDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
    ];
    if (coverPageDetails.clientName) detailRows.push(['Client', coverPageDetails.clientName]);
    if (coverPageDetails.architect)  detailRows.push(['Architect', coverPageDetails.architect]);
    if (coverPageDetails.contractor) detailRows.push(['Contractor', coverPageDetails.contractor]);

    const ROW_H   = 13;
    const BOX_PAD = 12;
    const BOX_H   = BOX_PAD * 2 + detailRows.length * ROW_H;
    const BOX_X   = 32;
    const BOX_W   = 146;

    doc.setFillColor(244, 247, 253);
    doc.setDrawColor(195, 210, 235);
    doc.setLineWidth(0.4);
    doc.roundedRect(BOX_X, y, BOX_W, BOX_H, 4, 4, 'FD');

    const detailLeftX  = BOX_X + 12;
    const detailRightX = BOX_X + BOX_W - 12;
    y += BOX_PAD;

    doc.setFontSize(12);
    for (const [label, value] of detailRows) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(35, 45, 65);
      doc.text(label, detailLeftX, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 72, 95);
      doc.text(String(value), detailRightX, y, { align: 'right' });
      y += ROW_H;
    }
    doc.setTextColor(0, 0, 0);

    // Footer
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160, 168, 180);
    doc.text('Generated by Planckoff Hardware Estimating', 105, 278, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    doc.addPage();
  }

  // 2. DOOR SCHEDULE
  if (sections.doorSchedule) {
    // Section Title Page (Optional? No, just header)
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('SECTION 1: DOOR SCHEDULE', PDF_MARGIN, 20);

    const headers = buildDoorScheduleHeaders(SUBMITTAL_DOOR_COLUMNS);
    const rows = doors.map(door => buildDoorScheduleRow(door, SUBMITTAL_DOOR_COLUMNS));

    autoTable(doc, {
      ...buildAutoTableOptions(DEFAULT_THEME, 'Submittal Package', exportDate, pageWidth, PDF_MARGIN, { projectName: coverPageDetails.projectName, logoDataUrl }),
      head: [headers],
      body: rows,
      startY: HEADER_BAR_HEIGHT + 2,
    });

    addPageNumbers(doc, coverPageDetails.projectName, pageWidth, pageHeight, PDF_MARGIN);
    doc.addPage();
  }

  // 3. HARDWARE SETS (Detailed Breakdown)
  if (sections.hardwareSets) {
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('SECTION 2: HARDWARE SETS', 14, 20);
    
    let currentY = 30;

    hardwareSets.forEach((set, index) => {
      // Check for page break
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      // Set Header
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(240, 240, 240);
      doc.rect(14, currentY, 182, 8, 'F');
      doc.text(`Hardware Set: ${set.name}`, 16, currentY + 5.5);
      currentY += 10;

      // Doors using this set
      const assignedDoors = doors.filter(d => d.assignedHardwareSet?.name === set.name);
      if (assignedDoors.length > 0) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const count = assignedDoors.length;
        const doorList = assignedDoors.length <= 10 
            ? assignedDoors.map(d => d.doorTag || d.location).join(', ') 
            : `${assignedDoors.slice(0, 10).map(d => d.doorTag || d.location).join(', ')} ... (${count} total)`;
        
        const splitText = doc.splitTextToSize(`Used on ${count} Door(s): ${doorList}`, 180);
        doc.text(splitText, 14, currentY);
        currentY += (splitText.length * 4) + 2;
      }

      // Items Table
      const setHeaders = ['Qty', 'Item', 'Description', 'Mfr', 'Finish'];
      const setRows = set.items.map(item => [
         item.quantity,
         item.name,
         item.userDescription ?? item.processedDescription ?? item.description,
         item.manufacturer,
         item.finish
      ]);

      autoTable(doc, {
        ...buildAutoTableOptions(DEFAULT_THEME, 'Submittal Package', exportDate, pageWidth, PDF_MARGIN, { projectName: coverPageDetails.projectName, logoDataUrl }),
        head: [setHeaders],
        body: setRows,
        startY: currentY,
        styles: { fontSize: 8, cellPadding: 1, overflow: 'linebreak' },
        columnStyles: { 0: { cellWidth: 15 }, 1: { cellWidth: 40 } }, // Optimize widths
      });

      currentY = (doc as any).lastAutoTable.finalY + 10;
    });

    doc.addPage();
  }

  // 4. ELEVATIONS (Images)
  if (sections.elevations && elevationTypes && elevationTypes.length > 0) {
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('SECTION 3: ELEVATIONS & FRAMES', 14, 20);

    let currentY = 30;

    elevationTypes.forEach((type, index) => {
        // If low space, new page
        if (currentY > 200) {
            doc.addPage();
            currentY = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`Type: ${type.code}`, 14, currentY);
        currentY += 7;

        if (type.description) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(type.description, 14, currentY);
            currentY += 8;
        }

        if (type.imageData) {
            try {
                // Calculate aspect ratio to fit within 180mm width vs 120mm height max
                const maxWidth = 180;
                const maxHeight = 120;
                
                // We add the image. type.imageData is base64 string
                // doc.addImage(data, format, x, y, w, h)
                // Detect format from data URI
                const formatMatches = type.imageData.match(/^data:image\/(\w+);base64,/);
                const format = formatMatches ? formatMatches[1].toUpperCase() : 'JPEG';
                
                // We don't know dimensions, so let's check
                // For native JS, we usually load an Image object. 
                // But in jsPDF node context, we assume it just works or we specify layout.
                // We'll constrain it to a box.
                
                doc.addImage(type.imageData, format, 14, currentY, 180, 100, undefined, 'FAST');
                currentY += 110;
            } catch (e) {
                console.warn('Failed to add elevation image', e);
                doc.setTextColor(255, 0, 0);
                doc.text('(Image Error)', 14, currentY + 10);
                doc.setTextColor(0, 0, 0);
                currentY += 20;
            }
        } else {
             doc.text('(No Image Provided)', 14, currentY + 10);
             currentY += 20;
        }
        
        currentY += 10; // Spacing between types
    });
  }

  // Final Output — add page numbers then save
  addPageNumbers(doc, coverPageDetails.projectName, pageWidth, pageHeight, PDF_MARGIN);
  doc.save(buildExportFilename(coverPageDetails.projectName, 'submittal-package', 'pdf'));
};
