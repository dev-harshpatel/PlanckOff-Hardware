import { useCallback } from 'react';
import type { CompanySettings } from '@/lib/db/companySettings';
import type { DoorPricingGroup, HardwarePricingGroup } from '@/utils/pricingGrouping';
import { buildExportFilename } from '@/utils/exportFilename';
import { PDF_ERRORS } from '@/constants/errors';
import type { ElevationType, Toast } from '@/types';
import type { ImageInfo } from '@/utils/imageUtils';

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
  showElevationImages: boolean;
  elevationTypes: ElevationType[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
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
  showElevationImages,
  elevationTypes,
  addToast,
}: UsePricingExportParams) {
  const handleDownloadExcel = useCallback(async (sections: ExportSections) => {
    try {
      const { utils, write: xlsxWrite } = await import('xlsx-js-style');

      // ── Preload elevation images before building the workbook ──────────────
      // (must happen first so we know sheet numbers when appending elevation rows)
      type ConvertedImg = { base64: string; ext: string; origW: number; origH: number };
      const convertedImgs = new Map<string, ConvertedImg>();

      if (showElevationImages && elevationTypes.length > 0 && (sections.doors || sections.frames)) {
        const { fetchImageInfo } = await import('@/utils/imageUtils');
        const rawMap = new Map<string, ImageInfo>();

        await Promise.all(elevationTypes.map(async et => {
          const src = et.imageData || et.imageUrl;
          if (!src) return;
          const info = await fetchImageInfo(src);
          if (info) rawMap.set(et.id, info);
        }));

        for (const [etId, info] of rawMap) {
          const match = info.dataUrl.match(/^data:image\/(\w+);base64,(.+)$/s);
          if (!match) continue;
          const rawExt = match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase();
          let finalBase64 = match[2];
          let finalExt = rawExt;
          if (!['png', 'jpeg', 'gif'].includes(rawExt)) {
            const pngDataUrl = await new Promise<string>(resolve => {
              const canvas = document.createElement('canvas');
              canvas.width = info.w; canvas.height = info.h;
              const ctx = canvas.getContext('2d');
              if (!ctx) { resolve(''); return; }
              const img = new window.Image();
              img.onload = () => { ctx.drawImage(img, 0, 0); resolve(canvas.toDataURL('image/png')); };
              img.onerror = () => resolve('');
              img.src = info.dataUrl;
            });
            if (!pngDataUrl) continue;
            const pngMatch = pngDataUrl.match(/^data:image\/png;base64,(.+)$/s);
            if (!pngMatch) continue;
            finalBase64 = pngMatch[1];
            finalExt = 'png';
          }
          convertedImgs.set(etId, { base64: finalBase64, ext: finalExt, origW: info.w, origH: info.h });
        }
      }

      const doorElevTypes = elevationTypes.filter(et => et.kind !== 'frame' && convertedImgs.has(et.id));
      const frameElevTypes = elevationTypes.filter(et => et.kind === 'frame' && convertedImgs.has(et.id));

      const IMG_COL     = 1;
      const IMG_MAX_H   = 150;
      const IMG_MAX_W   = 260;
      const IMG_ROW_HPT = 160;

      type ElevPayload = { sheetNum: number; rowIdx: number; colIdx: number; base64: string; ext: string; w: number; h: number };
      const allPayloads: ElevPayload[] = [];

      // Appends elevation rows at the bottom of an existing allRows array (in-place).
      const appendElevSection = (
        allRows: unknown[][],
        rowMetas: { rowIdx: number; hpt: number }[],
        label: string,
        types: ElevationType[],
        sheetNum: number,
      ) => {
        if (types.length === 0) return;
        allRows.push([]); // blank separator row
        allRows.push([label]); // section header
        allRows.push(['Name', 'Image']); // sub-header
        for (const et of types) {
          const img = convertedImgs.get(et.id);
          const dataRowIdx = allRows.length;
          allRows.push([et.code || et.name || et.id, '']);
          if (img) {
            const scale = Math.min(1, IMG_MAX_H / img.origH, IMG_MAX_W / img.origW);
            allPayloads.push({
              sheetNum, rowIdx: dataRowIdx, colIdx: IMG_COL,
              base64: img.base64, ext: img.ext,
              w: Math.round(img.origW * scale), h: Math.round(img.origH * scale),
            });
            rowMetas.push({ rowIdx: dataRowIdx, hpt: IMG_ROW_HPT });
          }
        }
      };

      // Builds a Doors/Frames sheet with optional elevation rows appended at bottom.
      const buildPricingSheet = (
        headers: string[],
        dataRows: (string | number)[][],
        totalRow: (string | number)[],
        elevTypes: ElevationType[],
        elevLabel: string,
        sheetNum: number,
      ) => {
        const allRows: unknown[][] = [headers, ...dataRows, [], totalRow];
        const rowMetas: { rowIdx: number; hpt: number }[] = [];
        if (showElevationImages && elevTypes.length > 0) {
          appendElevSection(allRows, rowMetas, elevLabel, elevTypes, sheetNum);
        }
        const ws = utils.aoa_to_sheet(allRows);
        const colDefs: { wch: number }[] = [{ wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
        // Widen the image column to accommodate embedded images (same logic as Door Schedule)
        if (showElevationImages && elevTypes.length > 0) {
          colDefs[IMG_COL] = { wch: Math.max(colDefs[IMG_COL]?.wch ?? 10, 34) };
        }
        ws['!cols'] = colDefs;
        if (rowMetas.length > 0) {
          const existingRows: Array<{ hpt: number } | undefined> = [];
          for (const { rowIdx, hpt } of rowMetas) {
            while (existingRows.length <= rowIdx) existingRows.push(undefined);
            existingRows[rowIdx] = { hpt };
          }
          ws['!rows'] = existingRows;
        }
        return ws;
      };

      // ── Build workbook ─────────────────────────────────────────────────────
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

      if (sections.doors) {
        const sheetNum = wb.SheetNames.length + 1;
        utils.book_append_sheet(wb, buildPricingSheet(
          ['Description', 'Total Qty', 'Unit Price', 'Total Price'],
          doorGroups.map(g => [withPrep(g), g.totalQty, g.unitPrice, g.totalPrice]),
          ['', '', 'Total', fmt.format(doorTotal)],
          doorElevTypes, 'Door Elevations', sheetNum,
        ), 'Doors');
      }
      if (sections.frames) {
        const sheetNum = wb.SheetNames.length + 1;
        utils.book_append_sheet(wb, buildPricingSheet(
          ['Description', 'Total Qty', 'Unit Price', 'Total Price'],
          frameGroups.map(g => [withPrep(g), g.totalQty, g.unitPrice, g.totalPrice]),
          ['', '', 'Total', fmt.format(frameTotal)],
          frameElevTypes, 'Frame Elevations', sheetNum,
        ), 'Frames');
      }
      if (sections.hardware) {
        const dataRows = hardwareGroups.map(g => ({
          'Item Name':      g.item.name          ?? '',
          'Description':    g.item.description   ?? '',
          'Manufacturer':   g.item.manufacturer  ?? '',
          'Finish':         g.item.finish        ?? '',
          'Total Qty':      g.totalQty,
          'Door Materials': g.doorMaterials.join(', '),
          'Unit Price':     g.unitPrice,
          'Total Price':    g.totalPrice,
        }));
        const ws = utils.json_to_sheet(dataRows);
        utils.sheet_add_aoa(ws, [['', '', '', '', '', '', 'Total', fmt.format(hwTotal)]], { origin: dataRows.length + 2 });
        utils.book_append_sheet(wb, ws, 'Hardware');
      }

      if (wb.SheetNames.length === 0) return; // nothing selected

      // ── Write xlsx bytes and embed images via JSZip ────────────────────────
      const xlsxBytes = xlsxWrite(wb, { type: 'array', bookType: 'xlsx', cellStyles: true }) as Uint8Array;
      let finalBlob: Blob;

      if (allPayloads.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const jszipMod = await import('jszip');
        const JSZip = ((jszipMod as any).default ?? jszipMod) as unknown as typeof import('jszip');

        const payloadsBySheet = new Map<number, ElevPayload[]>();
        for (const p of allPayloads) {
          if (!payloadsBySheet.has(p.sheetNum)) payloadsBySheet.set(p.sheetNum, []);
          payloadsBySheet.get(p.sheetNum)!.push(p);
        }

        const zip = await JSZip.loadAsync(xlsxBytes);
        let ctXml = await zip.file('[Content_Types].xml')!.async('string');
        let globalMediaIdx = 0;

        for (const [sheetNum, payloads] of payloadsBySheet.entries()) {
          const drawingId = sheetNum;
          let anchors = '';
          let relsEntries = '';

          for (const [imgIdx, { rowIdx, colIdx, base64, ext, w, h }] of payloads.entries()) {
            const rId       = `rId${imgIdx + 1}`;
            const mediaFile = `elev_pr_s${sheetNum}_${++globalMediaIdx}.${ext}`;
            const emuW      = w * 9525;
            const emuH      = h * 9525;

            zip.file(`xl/media/${mediaFile}`, base64, { base64: true });

            relsEntries += `<Relationship Id="${rId}" `
              + `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" `
              + `Target="../media/${mediaFile}"/>`;

            anchors += `<xdr:oneCellAnchor>`
              + `<xdr:from><xdr:col>${colIdx}</xdr:col><xdr:colOff>114300</xdr:colOff>`
              + `<xdr:row>${rowIdx}</xdr:row><xdr:rowOff>114300</xdr:rowOff></xdr:from>`
              + `<xdr:ext cx="${emuW}" cy="${emuH}"/>`
              + `<xdr:pic><xdr:nvPicPr>`
              + `<xdr:cNvPr id="${imgIdx + 2}" name="Elev_pr_s${sheetNum}_${imgIdx + 1}"/>`
              + `<xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr>`
              + `</xdr:nvPicPr>`
              + `<xdr:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>`
              + `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emuW}" cy="${emuH}"/></a:xfrm>`
              + `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>`
              + `</xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`;

            const mimeType = ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
            if (!ctXml.includes(`Extension="${ext}"`)) {
              ctXml = ctXml.replace('</Types>',
                `<Default Extension="${ext}" ContentType="${mimeType}"/></Types>`);
            }
          }

          zip.file(`xl/drawings/drawing${drawingId}.xml`,
            `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
            + `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"`
            + ` xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"`
            + ` xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
            + anchors + `</xdr:wsDr>`);

          zip.file(`xl/drawings/_rels/drawing${drawingId}.xml.rels`,
            `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
            + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
            + relsEntries + `</Relationships>`);

          if (!ctXml.includes(`drawing${drawingId}.xml`)) {
            ctXml = ctXml.replace('</Types>',
              `<Override PartName="/xl/drawings/drawing${drawingId}.xml" `
              + `ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);
          }

          const wsFile = zip.file(`xl/worksheets/sheet${sheetNum}.xml`);
          if (wsFile) {
            let wsXml = await wsFile.async('string');
            if (!wsXml.includes('xmlns:r='))
              wsXml = wsXml.replace('<worksheet ', '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');
            if (!wsXml.includes('<drawing '))
              wsXml = wsXml.replace('</worksheet>', `<drawing r:id="rId_draw${drawingId}"/></worksheet>`);
            zip.file(`xl/worksheets/sheet${sheetNum}.xml`, wsXml);
          }

          const wsRelsPath = `xl/worksheets/_rels/sheet${sheetNum}.xml.rels`;
          const drawingRel = `<Relationship Id="rId_draw${drawingId}" `
            + `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" `
            + `Target="../drawings/drawing${drawingId}.xml"/>`;
          const wsRelsFile = zip.file(wsRelsPath);
          if (wsRelsFile) {
            const existing = await wsRelsFile.async('string');
            zip.file(wsRelsPath, existing.replace('</Relationships>', drawingRel + '</Relationships>'));
          } else {
            zip.file(wsRelsPath,
              `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
              + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
              + drawingRel + `</Relationships>`);
          }
        }

        zip.file('[Content_Types].xml', ctXml);
        const buf = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
        finalBlob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      } else {
        finalBlob = new Blob([xlsxBytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      }

      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = url; a.download = buildExportFilename(projectName, 'pricing-report', 'xlsx'); a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[usePricingExport] Excel export failed:', err);
      addToast({
        type: 'error',
        message: PDF_ERRORS.EXPORT_FAILED.message,
        details: PDF_ERRORS.EXPORT_FAILED.action,
      });
    }
  }, [doorGroups, frameGroups, hardwareGroups, doorTotal, frameTotal, hwTotal, companySettings, projectName, showElevationImages, elevationTypes, addToast]);

  const handleDownloadPdf = useCallback(async (sections: ExportSections) => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({ orientation: 'landscape' });
      type DocWithAutoTable = typeof doc & { lastAutoTable?: { finalY: number } };
      const d = doc as DocWithAutoTable;

      const PAGE_W  = doc.internal.pageSize.width;
      const PAGE_H  = doc.internal.pageSize.height;
      const MARGIN  = 14;
      const USABLE_W = PAGE_W - MARGIN * 2;

      const nextY = (offset = 0) => (d.lastAutoTable?.finalY ?? 0) + offset;
      const totalRowStyle = { fontStyle: 'bold' as const, fillColor: [240, 243, 250] as [number, number, number] };

      // ── Preload elevation images ───────────────────────────────────────────
      const imageInfoMap = new Map<string, ImageInfo>();
      if (showElevationImages && elevationTypes.length > 0 && (sections.doors || sections.frames)) {
        const { fetchImageInfo } = await import('@/utils/imageUtils');
        await Promise.all(elevationTypes.map(async et => {
          const src = et.imageData || et.imageUrl;
          if (!src) return;
          const info = await fetchImageInfo(src);
          if (info) imageInfoMap.set(et.id, info);
        }));
      }

      const doorElevTypes = elevationTypes.filter(et => et.kind !== 'frame' && imageInfoMap.has(et.id));
      const frameElevTypes = elevationTypes.filter(et => et.kind === 'frame' && imageInfoMap.has(et.id));

      // ── Elevation thumbnail renderer ───────────────────────────────────────
      const renderElevCards = (types: ElevationType[], title: string) => {
        if (types.length === 0) return;
        const colsPerPage = 3;
        const rowsPerPage = 2;
        const cardsPerPage = colsPerPage * rowsPerPage;
        const HEADER_Y  = 22;
        const FOOTER_Y  = PAGE_H - MARGIN;
        const COL_GAP   = 10;
        const ROW_GAP   = 10;
        const LABEL_H   = 12;
        const cardW     = (USABLE_W - COL_GAP * (colsPerPage - 1)) / colsPerPage;
        const cardH     = (FOOTER_Y - HEADER_Y - ROW_GAP * (rowsPerPage - 1)) / rowsPerPage;
        const INNER_PAD = 4;
        const MAX_IMG_W = Math.max(20, cardW - INNER_PAD * 2);
        const MAX_IMG_H = Math.max(20, cardH - (LABEL_H + 4) - INNER_PAD * 2);

        doc.addPage();
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(title, MARGIN, 14);

        for (const [idx, et] of types.entries()) {
          const info      = imageInfoMap.get(et.id)!;
          const slotIndex = idx % cardsPerPage;
          const row       = Math.floor(slotIndex / colsPerPage);
          const col       = slotIndex % colsPerPage;

          if (idx > 0 && slotIndex === 0) {
            doc.addPage();
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text(`${title} (continued)`, MARGIN, 14);
          }

          const cardX = MARGIN + col * (cardW + COL_GAP);
          const cardY = HEADER_Y + row * (cardH + ROW_GAP);
          const scale = Math.min(MAX_IMG_W / info.w, MAX_IMG_H / info.h, 1);
          const imgW  = info.w * scale;
          const imgH  = info.h * scale;
          const imgX  = cardX + (cardW - imgW) / 2;
          const imgY  = cardY + INNER_PAD;

          doc.setDrawColor(220, 220, 220);
          doc.setLineWidth(0.25);
          doc.setFillColor(250, 250, 250);
          doc.roundedRect(cardX, cardY, cardW, cardH, 1.5, 1.5, 'FD');

          try { doc.addImage(info.dataUrl, imgX, imgY, imgW, imgH); } catch { /* skip broken */ }

          const labelY = cardY + cardH - LABEL_H;
          doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
          doc.text(et.code || et.id, cardX + INNER_PAD, labelY, { maxWidth: cardW - INNER_PAD * 2 });
          if (et.name && et.code && et.name !== et.code) {
            doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(100);
            doc.text(et.name, cardX + INNER_PAD, labelY + 4, { maxWidth: cardW - INNER_PAD * 2 });
          }
          doc.setTextColor(0);
        }
      };

      let currentY = 10;
      // Set to true after renderElevCards so the next section starts on a fresh page
      // instead of drawing on top of the elevation card pages.
      let afterElevCards = false;

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
        currentY = 18 + lines.length * 5 + 4;
        doc.setDrawColor(180, 180, 180);
        doc.line(14, currentY, PAGE_W - 14, currentY);
        currentY += 6;
      }

      // Returns the Y to start a section at, adding a fresh page when elevation cards
      // were just rendered (they leave the cursor on the last card page).
      const getSectionStartY = (isFirst: boolean): number => {
        if (afterElevCards) {
          doc.addPage();
          afterElevCards = false;
          return currentY; // use original top-of-content Y
        }
        return isFirst ? currentY : nextY(12);
      };

      let firstSection = true;

      if (sections.doors) {
        const startY = getSectionStartY(firstSection);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`Doors — Total: ${fmt.format(doorTotal)}`, 14, startY);
        autoTable(doc, {
          startY: startY + 6,
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
        firstSection = false;
        if (showElevationImages && doorElevTypes.length > 0) {
          renderElevCards(doorElevTypes, 'Door Elevations');
          afterElevCards = true;
        }
      }

      if (sections.frames) {
        const startY = getSectionStartY(firstSection);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`Frames — Total: ${fmt.format(frameTotal)}`, 14, startY);
        autoTable(doc, {
          startY: startY + 6,
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
        firstSection = false;
        if (showElevationImages && frameElevTypes.length > 0) {
          renderElevCards(frameElevTypes, 'Frame Elevations');
          afterElevCards = true;
        }
      }

      if (sections.hardware) {
        const startY = getSectionStartY(firstSection);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`Hardware — Total: ${fmt.format(hwTotal)}`, 14, startY);
        autoTable(doc, {
          startY: startY + 6,
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
        firstSection = false;
      }

      if (firstSection) return; // nothing selected
      doc.save(buildExportFilename(projectName, 'pricing-report', 'pdf'));
    } catch (err) {
      console.error('[usePricingExport] PDF export failed:', err);
      addToast({
        type: 'error',
        message: PDF_ERRORS.EXPORT_FAILED.message,
        details: PDF_ERRORS.EXPORT_FAILED.action,
      });
    }
  }, [doorGroups, frameGroups, hardwareGroups, doorTotal, frameTotal, hwTotal, companySettings, projectName, showElevationImages, elevationTypes, addToast]);

  const handleDownloadProposalPdf = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (hiddenProposalTables.has('doors'))    params.set('hideDoors',    '1');
      if (hiddenProposalTables.has('frames'))   params.set('hideFrames',   '1');
      if (hiddenProposalTables.has('hardware')) params.set('hideHardware', '1');

      const res = await fetch(
        `/api/projects/${_projectId}/pricing-proposal/pdf?${params.toString()}`,
        { credentials: 'include' },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `PDF generation failed (${res.status})`);
      }

      const blob     = await res.blob();
      const url      = URL.createObjectURL(blob);
      const a        = document.createElement('a');
      a.href         = url;
      a.download     = buildExportFilename(projectName || 'project', 'proposal', 'pdf');
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[usePricingExport] Proposal PDF export failed:', err);
      addToast({
        type: 'error',
        message: PDF_ERRORS.EXPORT_FAILED.message,
        details: PDF_ERRORS.EXPORT_FAILED.action,
      });
    }
  }, [_projectId, projectName, hiddenProposalTables, addToast]);

  return { handleDownloadExcel, handleDownloadPdf, handleDownloadProposalPdf };
}
