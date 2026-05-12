import { useCallback } from 'react';
import type { CompanySettings } from '@/lib/db/companySettings';
import type { DoorPricingGroup, HardwarePricingGroup } from '@/utils/pricingGrouping';
import { buildExportFilename } from '@/utils/exportFilename';
import { buildMetadataRows, applyMetadataStyles, applyHeaderRowAt, applyFreezeAt, contentAwareColWidths } from '@/services/excelTheme';
import { buildAutoTableOptions, addPageNumbers, loadLogoDataUrl, DEFAULT_THEME, PDF_MARGIN, HEADER_BAR_HEIGHT, BRAND_NAVY, ROW_ALT_FILL } from '@/services/pdfTheme';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

export interface ExportSections {
  doors: boolean;
  frames: boolean;
  hardware: boolean;
}

const withPrep = (g: { description: string; prep: string[] }) =>
  g.prep.length ? `${g.description} | Prep: ${g.prep.join('; ')}` : g.description;

interface UsePricingExportParams {
  projectId: string;
  projectName: string;
  companySettings: CompanySettings | null;
  doorGroups: DoorPricingGroup[];
  frameGroups: DoorPricingGroup[];
  hardwareGroups: HardwarePricingGroup[];
  doorTotal: number;
  frameTotal: number;
  hwTotal: number;
  hwSetList: { name: string; doorCount: number }[];
  hiddenProposalTables: Set<'doors' | 'frames' | 'hardware'>;
  profitPct: { door: string; frame: string; hardware: string };
  proposalDoorBase: number;
  proposalFrameBase: number;
  proposalHwBase: number;
  proposalDoorTotal: number;
  proposalFrameTotal: number;
  proposalHwTotal: number;
  doorAlloc: number;
  frameAlloc: number;
  hwAlloc: number;
  proposalGrandTotal: number;
  allocateExpenses: boolean;
  extraExpenses: Array<{ id: string; delivery: string; totalPrice: string }>;
  extraExpensesTotal: number;
  taxRows: Array<{ id: string; description: string; taxPct: string }>;
  taxSubtotal: number;
  totalAfterTax: number;
  remarks: string;
}

export function usePricingExport({
  projectId: _projectId,
  projectName,
  companySettings,
  doorGroups,
  frameGroups,
  hardwareGroups,
  doorTotal,
  frameTotal,
  hwTotal,
  hwSetList,
  hiddenProposalTables,
  profitPct,
  proposalDoorBase,
  proposalFrameBase,
  proposalHwBase,
  proposalDoorTotal,
  proposalFrameTotal,
  proposalHwTotal,
  doorAlloc,
  frameAlloc,
  hwAlloc,
  proposalGrandTotal,
  allocateExpenses,
  extraExpenses,
  extraExpensesTotal,
  taxRows,
  taxSubtotal,
  totalAfterTax,
  remarks,
}: UsePricingExportParams) {
  const handleDownloadExcel = useCallback(async (sections: ExportSections) => {
    const { utils, writeFile } = await import('xlsx-js-style');

    const makeSheet = (
      headers: string[],
      dataRows: unknown[][],
      total: number,
      reportTitle: string,
    ) => {
      const totalRow = Array<unknown>(headers.length).fill('');
      totalRow[headers.length - 2] = 'Total';
      totalRow[headers.length - 1] = fmt.format(total);

      const metaRows = buildMetadataRows({ reportTitle, projectName, itemCount: dataRows.length });
      const wsData = [...metaRows, headers, ...dataRows, totalRow];
      const ws = utils.aoa_to_sheet(wsData);

      applyMetadataStyles(ws, headers.length);
      applyHeaderRowAt(ws, 3, headers.length);
      applyFreezeAt(ws, 4);
      ws['!cols'] = contentAwareColWidths(headers, dataRows);
      return ws;
    };

    const wb = utils.book_new();

    if (sections.doors) {
      const headers = ['Description', 'Total Qty', 'Unit Price', 'Total Price'];
      const rows = doorGroups.map(g => [withPrep(g), g.totalQty, g.unitPrice, g.totalPrice]);
      utils.book_append_sheet(wb, makeSheet(headers, rows, doorTotal, 'Pricing Report — Doors'), 'Doors');
    }
    if (sections.frames) {
      const headers = ['Description', 'Total Qty', 'Unit Price', 'Total Price'];
      const rows = frameGroups.map(g => [withPrep(g), g.totalQty, g.unitPrice, g.totalPrice]);
      utils.book_append_sheet(wb, makeSheet(headers, rows, frameTotal, 'Pricing Report — Frames'), 'Frames');
    }
    if (sections.hardware) {
      const headers = ['Item Name', 'Description', 'Manufacturer', 'Finish', 'Total Qty', 'Door Materials', 'Unit Price', 'Total Price'];
      const rows = hardwareGroups.map(g => [
        g.item.name ?? '', g.item.description ?? '', g.item.manufacturer ?? '', g.item.finish ?? '',
        g.totalQty, g.doorMaterials.join(', '), g.unitPrice, g.totalPrice,
      ]);
      utils.book_append_sheet(wb, makeSheet(headers, rows, hwTotal, 'Pricing Report — Hardware'), 'Hardware');
    }

    if (wb.SheetNames.length === 0) return;
    writeFile(wb, buildExportFilename(projectName, 'pricing-report', 'xlsx'), { cellStyles: true });
  }, [doorGroups, frameGroups, hardwareGroups, doorTotal, frameTotal, hwTotal, companySettings, projectName]);

  const handleDownloadPdf = useCallback(async (sections: ExportSections) => {
    const { default: jsPDF }     = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc        = new jsPDF({ orientation: 'landscape' });
    const pageW      = doc.internal.pageSize.getWidth();
    const pageH      = doc.internal.pageSize.getHeight();
    const exportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const logoDataUrl = await loadLogoDataUrl();
    const headerMeta  = { projectName, logoDataUrl };
    const totalStyle  = { fontStyle: 'bold' as const, fillColor: [240, 243, 250] as [number, number, number] };

    let added = 0;

    if (sections.doors) {
      if (added > 0) doc.addPage();
      autoTable(doc, {
        ...buildAutoTableOptions(DEFAULT_THEME, 'Pricing Report — Doors', exportDate, pageW, PDF_MARGIN, headerMeta),
        startY: HEADER_BAR_HEIGHT + 2,
        head: [['Description', 'Total Qty', 'Unit Price', 'Total Price']],
        body: [
          ...doorGroups.map(g => [withPrep(g), g.totalQty, fmt.format(g.unitPrice), fmt.format(g.totalPrice)]),
          ['', '', 'Total', fmt.format(doorTotal)],
        ],
        didParseCell: (data: any) => {
          if (data.row.index === doorGroups.length) Object.assign(data.cell.styles, totalStyle);
        },
      });
      added++;
    }

    if (sections.frames) {
      if (added > 0) doc.addPage();
      autoTable(doc, {
        ...buildAutoTableOptions(DEFAULT_THEME, 'Pricing Report — Frames', exportDate, pageW, PDF_MARGIN, headerMeta),
        startY: HEADER_BAR_HEIGHT + 2,
        head: [['Description', 'Total Qty', 'Unit Price', 'Total Price']],
        body: [
          ...frameGroups.map(g => [withPrep(g), g.totalQty, fmt.format(g.unitPrice), fmt.format(g.totalPrice)]),
          ['', '', 'Total', fmt.format(frameTotal)],
        ],
        didParseCell: (data: any) => {
          if (data.row.index === frameGroups.length) Object.assign(data.cell.styles, totalStyle);
        },
      });
      added++;
    }

    if (sections.hardware) {
      if (added > 0) doc.addPage();
      autoTable(doc, {
        ...buildAutoTableOptions(DEFAULT_THEME, 'Pricing Report — Hardware', exportDate, pageW, PDF_MARGIN, headerMeta),
        startY: HEADER_BAR_HEIGHT + 2,
        head: [['Item Name', 'Description', 'Manufacturer', 'Finish', 'Total Qty', 'Door Materials', 'Unit Price', 'Total Price']],
        body: [
          ...hardwareGroups.map(g => [
            g.item.name ?? '', g.item.description ?? '', g.item.manufacturer ?? '', g.item.finish ?? '',
            g.totalQty, g.doorMaterials.join(', '), fmt.format(g.unitPrice), fmt.format(g.totalPrice),
          ]),
          ['', '', '', '', '', '', 'Total', fmt.format(hwTotal)],
        ],
        didParseCell: (data: any) => {
          if (data.row.index === hardwareGroups.length) Object.assign(data.cell.styles, totalStyle);
        },
      });
      added++;
    }

    if (added === 0) return;
    addPageNumbers(doc, projectName, pageW, pageH, PDF_MARGIN);
    doc.save(buildExportFilename(projectName, 'pricing-report', 'pdf'));
  }, [doorGroups, frameGroups, hardwareGroups, doorTotal, frameTotal, hwTotal, projectName]);

  const handleDownloadProposalPdf = useCallback(async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    type DocWithAutoTable = typeof doc & { lastAutoTable?: { finalY: number } };
    const d = doc as DocWithAutoTable;

    const pageW  = doc.internal.pageSize.width;
    const pageH  = doc.internal.pageSize.height;
    const margin = 40;
    let y = margin;

    if (companySettings?.companyName) {
      const co = companySettings;
      let textX = margin;

      if (co.logoUrl) {
        try {
          const resp    = await fetch(co.logoUrl);
          const blob    = await resp.blob();
          const dataUrl = await new Promise<string>((res, rej) => {
            const reader    = new FileReader();
            reader.onloadend = () => res(reader.result as string);
            reader.onerror   = rej;
            reader.readAsDataURL(blob);
          });
          const img = new Image();
          await new Promise<void>(res => { img.onload = () => res(); img.src = dataUrl; });
          const maxLogoH = 40;
          const scale    = maxLogoH / img.height;
          const logoW    = Math.min(img.width * scale, 120);
          const canvas   = document.createElement('canvas');
          canvas.width   = logoW;
          canvas.height  = maxLogoH;
          canvas.getContext('2d')?.drawImage(img, 0, 0, logoW, maxLogoH);
          doc.addImage(canvas.toDataURL('image/png'), 'PNG', margin, y, logoW, maxLogoH);
          textX = margin + logoW + 12;
        } catch { /* skip logo on error */ }
      }

      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 20, 20);
      doc.text(co.companyName, textX, y + 14);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      const contactLines: string[] = [];
      if (co.websiteUrl || co.email) contactLines.push([co.websiteUrl, co.email].filter(Boolean).join('  ·  '));
      if (co.phone) contactLines.push(co.phone);
      const addr = [co.address, co.province, co.country].filter(Boolean).join(', ');
      if (addr) contactLines.push(addr);
      contactLines.forEach((line, i) => doc.text(line, textX, y + 26 + i * 10));

      y += 54;
      doc.setDrawColor(210, 215, 225);
      doc.line(margin, y, pageW - margin, y);
      y += 16;
    }

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(130, 140, 160);
    doc.text('PROPOSAL', margin, y);
    y += 14;

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 20, 30);
    doc.text(projectName || 'Untitled Project', margin, y);
    y += 14;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110, 110, 120);
    doc.text(
      `Prepared on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      margin, y,
    );
    y += 22;

    doc.setDrawColor(225, 228, 235);
    doc.line(margin, y, pageW - margin, y);
    y += 16;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 35, 45);
    doc.text('Pricing Summary', margin, y);
    y += 8;

    const summaryRows = [
      { label: 'Doors',    base: proposalDoorBase,  pct: profitPct.door,     total: proposalDoorTotal,  alloc: doorAlloc   },
      { label: 'Frames',   base: proposalFrameBase, pct: profitPct.frame,    total: proposalFrameTotal, alloc: frameAlloc  },
      { label: 'Hardware', base: proposalHwBase,    pct: profitPct.hardware, total: proposalHwTotal,    alloc: hwAlloc     },
    ];
    const grandLabel = allocateExpenses && extraExpensesTotal > 0
      ? `${fmt.format(proposalGrandTotal)} + ${fmt.format(extraExpensesTotal)} exp.`
      : '';

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Category', 'Base Cost', 'Profit %', 'Total']],
      body: [
        ...summaryRows.map(r => [
          r.label,
          fmt.format(r.base),
          r.pct ? `${r.pct}%` : '—',
          fmt.format(r.total + r.alloc),
        ]),
        ['Grand Total', grandLabel, '', fmt.format(proposalGrandTotal + (allocateExpenses ? extraExpensesTotal : 0))],
      ],
      styles:     { fontSize: 8, cellPadding: 5 },
      headStyles: { fillColor: BRAND_NAVY, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: ROW_ALT_FILL },
      repeatHeaders: true,
      rowPageBreak: 'avoid',
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (data) => {
        if (data.row.index === summaryRows.length) {
          Object.assign(data.cell.styles, { fontStyle: 'bold', fillColor: [235, 240, 252] });
        }
      },
    });
    y = (d.lastAutoTable?.finalY ?? y) + 20;

    if (!hiddenProposalTables.has('doors') && doorGroups.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 35, 45);
      doc.text('Doors', margin, y);
      y += 8;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Description', 'Total Qty']],
        body: [
          ...doorGroups.map(g => [g.description, g.totalQty]),
          ['Total', doorGroups.reduce((s, g) => s + g.totalQty, 0)],
        ],
        styles:       { fontSize: 8, cellPadding: 5 },
        headStyles:   { fillColor: [45, 60, 100], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'right' } },
        didParseCell: (data) => {
          if (data.row.index === doorGroups.length) {
            Object.assign(data.cell.styles, { fontStyle: 'bold', fillColor: [235, 240, 252] });
          }
        },
      });
      y = (d.lastAutoTable?.finalY ?? y) + 20;
    }

    if (!hiddenProposalTables.has('frames') && frameGroups.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 35, 45);
      doc.text('Frames', margin, y);
      y += 8;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Description', 'Total Qty']],
        body: [
          ...frameGroups.map(g => [g.description, g.totalQty]),
          ['Total', frameGroups.reduce((s, g) => s + g.totalQty, 0)],
        ],
        styles:       { fontSize: 8, cellPadding: 5 },
        headStyles:   { fillColor: [45, 60, 100], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'right' } },
        didParseCell: (data) => {
          if (data.row.index === frameGroups.length) {
            Object.assign(data.cell.styles, { fontStyle: 'bold', fillColor: [235, 240, 252] });
          }
        },
      });
      y = (d.lastAutoTable?.finalY ?? y) + 20;
    }

    if (!hiddenProposalTables.has('hardware') && hwSetList.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 35, 45);
      doc.text('Hardware', margin, y);
      y += 8;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Hardware Set', 'Doors Used In']],
        body: hwSetList.map(s => [s.name, s.doorCount]),
        styles:       { fontSize: 8, cellPadding: 5 },
        headStyles:   { fillColor: [45, 60, 100], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'right' } },
      });
      y = (d.lastAutoTable?.finalY ?? y) + 20;
    }

    if (extraExpenses.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 35, 45);
      doc.text('Extra Expenses', margin, y);
      y += 8;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Description', 'Total Price']],
        body: [
          ...extraExpenses.map(e => [e.delivery || '—', fmt.format(parseFloat(e.totalPrice) || 0)]),
          ['Total', fmt.format(extraExpensesTotal)],
        ],
        styles:       { fontSize: 8, cellPadding: 5 },
        headStyles:   { fillColor: BRAND_NAVY, textColor: 255 },
      alternateRowStyles: { fillColor: ROW_ALT_FILL },
      repeatHeaders: true,
      rowPageBreak: 'avoid',
        columnStyles: { 1: { halign: 'right' } },
        didParseCell: (data) => {
          if (data.row.index === extraExpenses.length) {
            Object.assign(data.cell.styles, { fontStyle: 'bold', fillColor: [235, 240, 252] });
          }
        },
      });
      y = (d.lastAutoTable?.finalY ?? y) + 20;
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 35, 45);
    doc.text('Tax', margin, y);
    y += 8;

    const taxBody: string[][] = [
      ['Pricing Summary Total', fmt.format(proposalGrandTotal)],
      ['Extra Expense Total',   fmt.format(extraExpensesTotal)],
      ['Subtotal',              fmt.format(taxSubtotal)],
      ...taxRows.map(r => [
        r.description || '(Tax)',
        `${fmt.format(taxSubtotal * (Math.max(0, parseFloat(r.taxPct) || 0) / 100))} (${r.taxPct || 0}%)`,
      ]),
      ['Total After Tax', fmt.format(totalAfterTax)],
    ];

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Description', 'Amount']],
      body: taxBody,
      styles:       { fontSize: 8, cellPadding: 5 },
      headStyles:   { fillColor: BRAND_NAVY, textColor: 255 },
      alternateRowStyles: { fillColor: ROW_ALT_FILL },
      repeatHeaders: true,
      rowPageBreak: 'avoid',
      columnStyles: {
        0: { halign: 'left' },
        1: { halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === taxBody.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [235, 240, 252];
        }
      },
    });
    y = (d.lastAutoTable?.finalY ?? y) + 20;

    if (remarks.trim()) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 35, 45);
      doc.text('Remarks', margin, y);
      y += 12;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 65, 75);
      const splitText = doc.splitTextToSize(remarks, pageW - margin * 2);
      doc.text(splitText, margin, y);
    }

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(160, 165, 175);
      doc.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 20, { align: 'right' });
    }

    doc.save(buildExportFilename(projectName || 'project', 'proposal', 'pdf'));
  }, [
    companySettings, projectName,
    proposalDoorBase, proposalFrameBase, proposalHwBase,
    profitPct, proposalDoorTotal, proposalFrameTotal, proposalHwTotal,
    doorAlloc, frameAlloc, hwAlloc,
    proposalGrandTotal, allocateExpenses,
    extraExpenses, extraExpensesTotal,
    taxRows, taxSubtotal, totalAfterTax,
    remarks,
    hiddenProposalTables, doorGroups, frameGroups, hwSetList,
  ]);

  return { handleDownloadExcel, handleDownloadPdf, handleDownloadProposalPdf };
}
