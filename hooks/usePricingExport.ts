import { useCallback } from 'react';
import type { CompanySettings } from '@/lib/db/companySettings';
import type { DoorPricingGroup, HardwarePricingGroup } from '@/utils/pricingGrouping';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

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
  const handleDownloadExcel = useCallback(async () => {
    const { utils, writeFile } = await import('xlsx');

    const makeSheet = <T extends { totalPrice: number }>(
      rows: T[],
      total: number,
      toRow: (g: T) => Record<string, string | number>,
    ) => {
      const dataRows = rows.map(toRow);
      const ws = utils.json_to_sheet(dataRows);
      const nextRow = dataRows.length + 2;
      utils.sheet_add_aoa(ws, [['', 'Total', '', fmt.format(total)]], { origin: nextRow });
      return ws;
    };

    const wb = utils.book_new();

    if (companySettings?.companyName) {
      const co = companySettings;
      const coverRows: [string, string][] = [
        ['Project',      projectName],
        ['',             ''],
        ['Company',      co.companyName],
      ];
      if (co.websiteUrl) coverRows.push(['Website', co.websiteUrl]);
      if (co.email)      coverRows.push(['Email',   co.email]);
      if (co.phone)      coverRows.push(['Phone',   co.phone]);
      if (co.address)    coverRows.push(['Address', co.address]);
      const coverParts = [co.province, co.country].filter(Boolean).join(', ');
      if (coverParts)    coverRows.push(['',        coverParts]);
      utils.book_append_sheet(wb, utils.aoa_to_sheet(coverRows), 'Company');
    }

    utils.book_append_sheet(wb,
      makeSheet(doorGroups, doorTotal, g => ({
        'Description': withPrep(g),
        'Total Qty':   g.totalQty,
        'Unit Price':  g.unitPrice,
        'Total Price': g.totalPrice,
      })),
      'Doors',
    );
    utils.book_append_sheet(wb,
      makeSheet(frameGroups, frameTotal, g => ({
        'Description': withPrep(g),
        'Total Qty':   g.totalQty,
        'Unit Price':  g.unitPrice,
        'Total Price': g.totalPrice,
      })),
      'Frames',
    );
    utils.book_append_sheet(wb,
      makeSheet(hardwareGroups, hwTotal, g => ({
        'Item Name':      g.item.name          ?? '',
        'Description':    g.item.description   ?? '',
        'Manufacturer':   g.item.manufacturer  ?? '',
        'Finish':         g.item.finish        ?? '',
        'Total Qty':      g.totalQty,
        'Door Materials': g.doorMaterials.join(', '),
        'Unit Price':     g.unitPrice,
        'Total Price':    g.totalPrice,
      })),
      'Hardware',
    );
    writeFile(wb, 'pricing-report.xlsx');
  }, [doorGroups, frameGroups, hardwareGroups, doorTotal, frameTotal, hwTotal, companySettings, projectName]);

  const handleDownloadPdf = useCallback(async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: 'landscape' });
    type DocWithAutoTable = typeof doc & { lastAutoTable?: { finalY: number } };
    const d = doc as DocWithAutoTable;

    const nextY = (offset = 0) => (d.lastAutoTable?.finalY ?? 0) + offset;

    const totalRowStyle = { fontStyle: 'bold' as const, fillColor: [240, 243, 250] as [number, number, number] };

    let headerBottomY = 10;
    if (companySettings?.companyName) {
      const co = companySettings;
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(co.companyName, 14, 12);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const lines: string[] = [];
      if (co.websiteUrl || co.email) lines.push([co.websiteUrl, co.email].filter(Boolean).join('  |  '));
      if (co.phone) lines.push(co.phone);
      const addrParts = [co.address, co.province, co.country].filter(Boolean).join(', ');
      if (addrParts) lines.push(addrParts);
      lines.forEach((line, i) => doc.text(line, 14, 18 + i * 5));
      headerBottomY = 18 + lines.length * 5 + 4;
      doc.setDrawColor(180, 180, 180);
      doc.line(14, headerBottomY, doc.internal.pageSize.width - 14, headerBottomY);
      headerBottomY += 6;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Doors — Total: ${fmt.format(doorTotal)}`, 14, headerBottomY);
    autoTable(doc, {
      startY: headerBottomY + 6,
      head: [['Description', 'Total Qty', 'Unit Price', 'Total Price']],
      body: [
        ...doorGroups.map(g => [withPrep(g), g.totalQty, fmt.format(g.unitPrice), fmt.format(g.totalPrice)]),
        ['', '', 'Total', fmt.format(doorTotal)],
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [60, 80, 120] },
      didParseCell: (data) => {
        if (data.row.index === doorGroups.length) Object.assign(data.cell.styles, totalRowStyle);
      },
    });

    doc.setFontSize(11);
    doc.text(`Frames — Total: ${fmt.format(frameTotal)}`, 14, nextY(12));
    autoTable(doc, {
      startY: nextY(18),
      head: [['Description', 'Total Qty', 'Unit Price', 'Total Price']],
      body: [
        ...frameGroups.map(g => [withPrep(g), g.totalQty, fmt.format(g.unitPrice), fmt.format(g.totalPrice)]),
        ['', '', 'Total', fmt.format(frameTotal)],
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [60, 80, 120] },
      didParseCell: (data) => {
        if (data.row.index === frameGroups.length) Object.assign(data.cell.styles, totalRowStyle);
      },
    });

    doc.setFontSize(11);
    doc.text(`Hardware — Total: ${fmt.format(hwTotal)}`, 14, nextY(12));
    autoTable(doc, {
      startY: nextY(18),
      head: [['Item Name', 'Description', 'Manufacturer', 'Finish', 'Qty', 'Unit Price', 'Total Price']],
      body: [
        ...hardwareGroups.map(g => [
          g.item.name ?? '', g.item.description ?? '', g.item.manufacturer ?? '', g.item.finish ?? '',
          g.totalQty, fmt.format(g.unitPrice), fmt.format(g.totalPrice),
        ]),
        ['', '', '', '', '', 'Total', fmt.format(hwTotal)],
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [60, 80, 120] },
      didParseCell: (data) => {
        if (data.row.index === hardwareGroups.length) Object.assign(data.cell.styles, totalRowStyle);
      },
    });

    doc.save('pricing-report.pdf');
  }, [doorGroups, frameGroups, hardwareGroups, doorTotal, frameTotal, hwTotal, companySettings]);

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
      headStyles: { fillColor: [45, 60, 100], textColor: 255, fontStyle: 'bold' },
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
        headStyles:   { fillColor: [45, 60, 100], textColor: 255 },
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
      headStyles:   { fillColor: [45, 60, 100], textColor: 255 },
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

    const safeName = (projectName || 'Proposal').replace(/[^a-z0-9]/gi, '_');
    doc.save(`${safeName}_Proposal.pdf`);
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
