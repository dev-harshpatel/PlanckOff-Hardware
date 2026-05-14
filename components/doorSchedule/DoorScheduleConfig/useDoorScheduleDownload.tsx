'use client';

import {
  buildAutoTableOptions,
  addPageNumbers,
  drawPageHeader,
  loadLogoDataUrl,
  DEFAULT_THEME,
  PDF_MARGIN,
  HEADER_BAR_HEIGHT,
} from '@/services/pdfTheme';
import { contentAwareColWidths, buildMetadataRows, applyMetadataStyles, applyHeaderRowAt, applyFreezeAt } from '../../../services/excelTheme';
import type { ExportFormat, DoorGroup } from '../doorScheduleTypes';
import type { Door, ElevationType } from '../../../types';
import type { ImageInfo } from '../../../utils/imageUtils';
import { getDoorQuantity, sumDoorQuantities } from '../../../utils/doorUtils';
import { collectGroupElevationTypes } from '../../../utils/elevationUtils';
import { parseColId, aggregateDoorsBySelectedColumns, getRowValue } from '../../../utils/doorScheduleUtils';

interface UseDoorScheduleDownloadParams {
  selectedColumns: string[];
  groups: DoorGroup[];
  hiddenGroupKeys: Set<string>;
  includedDoors: Door[];
  uniqueData: boolean;
  format: ExportFormat;
  projectName: string;
  showElevationImages: boolean;
  elevationTypes: ElevationType[];
  preloadElevationImages: (groups: DoorGroup[]) => Promise<Map<string, ImageInfo>>;
  setIsDownloading: (v: boolean) => void;
}

interface UseDoorScheduleDownloadReturn {
  handleDownload: () => Promise<void>;
}

export function useDoorScheduleDownload(params: UseDoorScheduleDownloadParams): UseDoorScheduleDownloadReturn {
  const {
    selectedColumns,
    groups,
    hiddenGroupKeys,
    includedDoors,
    uniqueData,
    format,
    projectName,
    showElevationImages,
    elevationTypes,
    preloadElevationImages,
    setIsDownloading,
  } = params;

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const headers = selectedColumns.map(col => parseColId(col).colKey);
      const fileName = (projectName || 'Door_Schedule').replace(/[/\\?%*:|"<>]/g, '_');

      // Respect the same hidden-group filter as the preview panel
      const visibleGroups = groups.filter(g => !hiddenGroupKeys.has(g.breadcrumb.join('||') || 'all'));
      // ORD-04: explicit spread preserves call-site array order — no implicit reordering
      const orderedDoors = [...includedDoors];
      // ORD-01/03: visibleGroups preserves UI display order from useDoorAggregation
      const groupsToExport = visibleGroups.length > 0 ? visibleGroups : [{ breadcrumb: [], doors: orderedDoors }];
      const rowsByGroup = groupsToExport.map(group =>
        uniqueData
          ? aggregateDoorsBySelectedColumns(group.doors, selectedColumns)
          : group.doors.map(door => ({
            id: door.id,
            doors: [door],
            quantity: getDoorQuantity(door),
            doorTags: door.doorTag,
          })),
      );

      // ── Pre-load elevation images for all groups ──────────────────────────
      const imageInfoMap = await preloadElevationImages(groupsToExport);

      if (format === 'excel') {
        // ── xlsx (data) + jszip (OOXML image injection) ───────────────────
        // ExcelJS has bundling issues in Next.js browser context; direct OOXML
        // injection via JSZip is the most reliable cross-environment approach.
        const [XLSX, jszipMod] = await Promise.all([
          import('xlsx-js-style'),
          import('jszip'),
        ]);
        // jszip ships as CJS (module.exports = JSZip, no .default at runtime).
        // Webpack wraps CJS so .default may equal the constructor — guard both ways.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const JSZip = ((jszipMod as any).default ?? jszipMod) as typeof import('jszip')['default'];

        const wb = XLSX.utils.book_new();
        const useSingleSheet = groupsToExport.length === 1 && groupsToExport[0].breadcrumb.length === 0;

        // Per-sheet image payloads collected alongside sheet creation
        type ImgPayload = { base64: string; ext: string; w: number; h: number; startRow: number };
        const sheetImageData: ImgPayload[][] = [];

        for (const [i, group] of groupsToExport.entries()) {
          const rawName = useSingleSheet
            ? 'Door Schedule'
            : (group.breadcrumb.join(' - ') || `Group ${i + 1}`);
          const sheetName = rawName.replace(/[\\/*?[\]:]/g, '_').slice(0, 31) || `Sheet${i + 1}`;

          const rows = rowsByGroup[i].map(row =>
            selectedColumns.map(col => getRowValue(row, col) || ''),
          );
          const metaRows = buildMetadataRows({ reportTitle: 'Door Schedule', projectName });
          const ws = XLSX.utils.aoa_to_sheet([...metaRows, headers, ...rows]);
          ws['!cols'] = contentAwareColWidths(headers, rows);
          applyMetadataStyles(ws, headers.length);
          applyHeaderRowAt(ws, 3, headers.length);
          applyFreezeAt(ws, 4);

          XLSX.utils.book_append_sheet(wb, ws, sheetName);

          // Collect elevation images for this sheet
          const imgs: ImgPayload[] = [];
          if (showElevationImages) {
            const groupElevTypes = collectGroupElevationTypes(group.doors, elevationTypes)
              .filter(et => imageInfoMap.has(et.id));

            if (groupElevTypes.length > 0) {
              // Images start 2 rows below the data table (0-indexed for OOXML)
              // 3 metadata rows + 1 header row + data rows + 2-row gap
              let currentRow = group.doors.length + 4 + 2;
              for (const et of groupElevTypes) {
                const info = imageInfoMap.get(et.id)!;
                const match = info.dataUrl.match(/^data:image\/(\w+);base64,(.+)$/s);
                if (!match) continue;
                const rawExt = match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase();
                if (!['png', 'jpeg', 'gif'].includes(rawExt)) continue;

                imgs.push({ base64: match[2], ext: rawExt, w: info.w, h: info.h, startRow: currentRow });

                // Advance past this image (each Excel row ≈ 20px at default height)
                currentRow += Math.ceil(info.h / 20) + 3;
              }
            }
          }
          sheetImageData.push(imgs);
        }

        // Write base xlsx (data only)
        const xlsxBytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellStyles: true }) as Uint8Array;

        const hasImages = sheetImageData.some(imgs => imgs.length > 0);
        let finalBlob: Blob;

        if (hasImages) {
          // Inject images via OOXML manipulation
          const zip = await JSZip.loadAsync(xlsxBytes);
          let ctXml = await zip.file('[Content_Types].xml')!.async('string');

          for (const [sheetIdx, imgs] of sheetImageData.entries()) {
            if (imgs.length === 0) continue;
            const sheetNum  = sheetIdx + 1;
            const drawingId = sheetIdx + 1;

            let anchors = '';
            let relsEntries = '';

            for (const [imgIdx, img] of imgs.entries()) {
              const rId       = `rId${imgIdx + 1}`;
              const mediaFile = `image_s${sheetNum}_${imgIdx + 1}.${img.ext}`;
              const emuW      = img.w * 9525; // 1 px = 9525 EMU at 96 DPI
              const emuH      = img.h * 9525;

              zip.file(`xl/media/${mediaFile}`, img.base64, { base64: true });

              relsEntries += `<Relationship Id="${rId}" `
                + `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" `
                + `Target="../media/${mediaFile}"/>`;

              anchors += `<xdr:oneCellAnchor>`
                + `<xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff>`
                + `<xdr:row>${img.startRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>`
                + `<xdr:ext cx="${emuW}" cy="${emuH}"/>`
                + `<xdr:pic><xdr:nvPicPr>`
                + `<xdr:cNvPr id="${imgIdx + 2}" name="Elevation${imgIdx + 1}"/>`
                + `<xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr>`
                + `</xdr:nvPicPr>`
                + `<xdr:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>`
                + `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emuW}" cy="${emuH}"/></a:xfrm>`
                + `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>`
                + `</xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`;

              const mimeType = img.ext === 'jpeg' ? 'image/jpeg' : `image/${img.ext}`;
              if (!ctXml.includes(`Extension="${img.ext}"`)) {
                ctXml = ctXml.replace('</Types>',
                  `<Default Extension="${img.ext}" ContentType="${mimeType}"/></Types>`);
              }
            }

            // drawing XML
            zip.file(`xl/drawings/drawing${drawingId}.xml`,
              `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
              + `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"`
              + ` xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"`
              + ` xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
              + anchors + `</xdr:wsDr>`);

            // drawing rels
            zip.file(`xl/drawings/_rels/drawing${drawingId}.xml.rels`,
              `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
              + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
              + relsEntries + `</Relationships>`);

            // drawing content type
            if (!ctXml.includes(`drawing${drawingId}.xml`)) {
              ctXml = ctXml.replace('</Types>',
                `<Override PartName="/xl/drawings/drawing${drawingId}.xml" `
                + `ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);
            }

            // Patch worksheet: add xmlns:r + <drawing> ref
            const wsFile = zip.file(`xl/worksheets/sheet${sheetNum}.xml`);
            if (wsFile) {
              let wsXml = await wsFile.async('string');
              if (!wsXml.includes('xmlns:r='))
                wsXml = wsXml.replace('<worksheet ', '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');
              if (!wsXml.includes('<drawing '))
                wsXml = wsXml.replace('</worksheet>', `<drawing r:id="rId_draw${drawingId}"/></worksheet>`);
              zip.file(`xl/worksheets/sheet${sheetNum}.xml`, wsXml);
            }

            // Patch worksheet rels
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
        a.href = url; a.download = `${fileName}.xlsx`; a.click();
        URL.revokeObjectURL(url);

      } else {
        // ── PDF: table + per-group elevation pages ────────────────────────
        const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
          import('jspdf'),
          import('jspdf-autotable'),
        ]);

        const colCount = selectedColumns.length;
        // A3 landscape (420×297mm) gives ~40% more horizontal space than A4 (297×210mm)
        const useA3    = colCount > 15;
        const PAGE_W   = useA3 ? 420 : 297;
        const PAGE_H   = useA3 ? 297 : 210;
        const MARGIN   = 14;
        const USABLE_W = PAGE_W - MARGIN * 2;
        // Scale down density for crowded tables
        const fontSize    = colCount > 25 ? 5 : colCount > 15 ? 5.5 : 6.5;
        const cellPadding = colCount > 25 ? 1 : colCount > 15 ? 1.4 : 1.8;

        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: useA3 ? 'a3' : 'a4' });
        const logoDataUrl = await loadLogoDataUrl();

        // Abbreviated headers so common long names don't blow up column widths
        const PDF_ABBREV: Record<string, string> = {
          'BUILDING LOCATION':        'BLDG LOC',
          'BUILDING TAG':             'BLDG TAG',
          'BUILDING AREA':            'BLDG AREA',
          'DOOR OPERATION':           'DR OPER',
          'DOOR MATERIAL':            'DR MAT',
          'DOOR ELEVATION TYPE':      'DR ELEV',
          'DOOR INCLUDE/EXCLUDE':     'DR INCL',
          'DOOR UNDERCUT':            'UNDERCUT',
          'FRAME MATERIAL':           'FR MAT',
          'FRAME ELEVATION TYPE':     'FR ELEV',
          'FRAME INCLUDE/EXCLUDE':    'FR INCL',
          'FRAME ASSEMBLY':           'FR ASSEM',
          'FRAME ANCHOR':             'FR ANCHR',
          'FRAME PROFILE':            'FR PROF',
          'FRAME GUAGE':              'FR GAUGE',
          'FRAME FINISH':             'FR FIN',
          'HARDWARE INCLUDE/EXCLUDE': 'HW INCL',
          'HARDWARE PREP':            'HW PREP',
          'INTERIOR/EXTERIOR':        'INT/EXT',
          'HAND OF OPENINGS':         'HAND',
          'THROAT THICKNESS':         'THROAT',
          'BASE ANCHOR':              'BASE ANC',
          'NO OF ANCHOR':             '# ANCHR',
          'EXCLUDE REASON':           'EXCL RSN',
          'GLAZING TYPE':             'GLAZING',
          'LEAF COUNT':               'LEAVES',
        };
        const pdfHeaders = headers.map(h => PDF_ABBREV[h] ?? h);

        // Proportional column widths: longer content and header → wider column
        const allExportRows = rowsByGroup.flatMap(r => r);
        const MIN_COL = Math.max(10, USABLE_W * 0.025);
        const MAX_COL = USABLE_W * 0.14;
        const rawWeights = selectedColumns.map((col, i) => {
          const hLen = pdfHeaders[i].length;
          const dLen = allExportRows.reduce((mx, row) =>
            Math.max(mx, (getRowValue(row, col) || '').length), 0);
          // Weight = max of header length vs data length (cap data at 20 chars)
          return Math.max(hLen, Math.min(dLen, 20));
        });
        const totalWeight = rawWeights.reduce((s, w) => s + w, 0);
        const pdfColumnStyles: Record<number, { cellWidth: number }> = Object.fromEntries(
          rawWeights.map((w, i) => {
            const prop = totalWeight > 0 ? (w / totalWeight) * USABLE_W : USABLE_W / colCount;
            return [i, { cellWidth: Math.min(Math.max(prop, MIN_COL), MAX_COL) }];
          }),
        );

        for (const [i, group] of groupsToExport.entries()) {
          if (i > 0) doc.addPage();

          const exportDate  = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
          const subtitle    = group.breadcrumb.length > 0 ? group.breadcrumb.join(' › ') : 'All Doors';
          const reportTitle = `Door Schedule — ${subtitle} (${sumDoorQuantities(group.doors)} door${sumDoorQuantities(group.doors) !== 1 ? 's' : ''})`;

          // Build a custom theme to preserve the dynamic fontSize/cellPadding for this column density
          const groupTheme = {
            ...DEFAULT_THEME,
            fontSize,
            cellPadding,
          };

          autoTable(doc, {
            ...buildAutoTableOptions(groupTheme, reportTitle, exportDate, PAGE_W, PDF_MARGIN, { projectName, logoDataUrl }),
            startY:       HEADER_BAR_HEIGHT + 2,  // leave room for branded header (replaces hardcoded 25)
            head:         [pdfHeaders],
            body:         rowsByGroup[i].map(row =>
              selectedColumns.map(col => getRowValue(row, col) || '—'),
            ),
            tableWidth:   USABLE_W,
            columnStyles: pdfColumnStyles,
            // fontSize/cellPadding already in groupTheme via buildAutoTableOptions → styles
          });

          // ── Elevation images for this group (new page per group) ───────
          if (showElevationImages) {
            const groupElevTypes = collectGroupElevationTypes(group.doors, elevationTypes)
              .filter(et => imageInfoMap.has(et.id));

            if (groupElevTypes.length > 0) {
              const LABEL_H = 12;
              const ROW_GAP = 10;
              const COL_GAP = 10;
              const HEADER_Y = 26;
              const FOOTER_Y = PAGE_H - MARGIN;
              const colsPerPage = useA3 ? 3 : 2;
              const rowsPerPage = useA3 ? 3 : 2;
              const cardsPerPage = colsPerPage * rowsPerPage;
              const cardW = (USABLE_W - COL_GAP * (colsPerPage - 1)) / colsPerPage;
              const cardH = (FOOTER_Y - HEADER_Y - ROW_GAP * (rowsPerPage - 1)) / rowsPerPage;
              const INNER_PAD = 4;
              const CARD_LABEL_SPACE = LABEL_H + 4;
              const MAX_IMG_W = Math.max(20, cardW - INNER_PAD * 2);
              const MAX_IMG_H = Math.max(20, cardH - CARD_LABEL_SPACE - INNER_PAD * 2);

              const addElevPageHeader = (sub: string) => {
                const elevExportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                drawPageHeader(doc, `Elevation Types — ${sub}`, elevExportDate, PAGE_W, PDF_MARGIN, projectName, logoDataUrl);
              };

              doc.addPage();
              addElevPageHeader(subtitle);

              for (const [idx, et] of groupElevTypes.entries()) {
                const info = imageInfoMap.get(et.id)!;
                const slotIndex = idx % cardsPerPage;
                const row = Math.floor(slotIndex / colsPerPage);
                const col = slotIndex % colsPerPage;

                if (idx > 0 && slotIndex === 0) {
                  doc.addPage();
                  addElevPageHeader(`${subtitle} (continued)`);
                }

                const cardX = MARGIN + col * (cardW + COL_GAP);
                const cardY = HEADER_Y + row * (cardH + ROW_GAP);
                const scale = Math.min(MAX_IMG_W / info.w, MAX_IMG_H / info.h, 1);
                const imgW = info.w * scale;
                const imgH = info.h * scale;
                const imgX = cardX + (cardW - imgW) / 2;
                const imgY = cardY + INNER_PAD;

                // Subtle card background
                doc.setDrawColor(220, 220, 220);
                doc.setLineWidth(0.25);
                doc.setFillColor(250, 250, 250);
                doc.roundedRect(cardX, cardY, cardW, cardH, 1.5, 1.5, 'FD');

                // Image at natural aspect ratio
                try {
                  doc.addImage(info.dataUrl, imgX, imgY, imgW, imgH);
                } catch { /* skip broken */ }

                // Label below image
                const labelY = cardY + cardH - LABEL_H;
                doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
                doc.text(et.code || et.id, cardX + INNER_PAD, labelY, { maxWidth: cardW - INNER_PAD * 2 });
                if (et.name && et.code && et.name !== et.code) {
                  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(100);
                  doc.text(et.name, cardX + INNER_PAD, labelY + 4, { maxWidth: cardW - INNER_PAD * 2 });
                }
                doc.setTextColor(0);
              }
            }
          }
        }

        // Add page numbers to all pages (two-pass: autoTable is fully rendered now)
        addPageNumbers(doc, projectName || 'Door Schedule', PAGE_W, PAGE_H, PDF_MARGIN);

        doc.save(`${fileName}.pdf`);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  return { handleDownload };
}
