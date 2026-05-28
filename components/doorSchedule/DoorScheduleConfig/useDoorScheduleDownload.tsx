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
import { toExcelNumber } from '../../../utils/excelUtils';

interface UseDoorScheduleDownloadParams {
  selectedColumns: string[];
  groups: DoorGroup[];
  hiddenGroupKeys: Set<string>;
  includedDoors: Door[];
  uniqueData: boolean;
  format: ExportFormat;
  projectName: string;
  projectLocation?: string;
  projectProvince?: string;
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
    projectLocation,
    projectProvince,
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
        const JSZip = ((jszipMod as any).default ?? jszipMod) as unknown as typeof import('jszip');

        const wb = XLSX.utils.book_new();
        const useSingleSheet = groupsToExport.length === 1 && groupsToExport[0].breadcrumb.length === 0;

        for (const [i, group] of groupsToExport.entries()) {
          const rawName = useSingleSheet
            ? 'Door Schedule'
            : (group.breadcrumb.join(' - ') || `Group ${i + 1}`);
          const sheetName = rawName.replace(/[\\/*?[\]:]/g, '_').slice(0, 31) || `Sheet${i + 1}`;

          const rows = rowsByGroup[i].map(row =>
            selectedColumns.map(col => toExcelNumber(getRowValue(row, col))),
          );
          const metaRows = buildMetadataRows({ reportTitle: 'Door Schedule', projectName });
          const ws = XLSX.utils.aoa_to_sheet([...metaRows, headers, ...rows]);
          ws['!cols'] = contentAwareColWidths(headers, rows);
          applyMetadataStyles(ws, headers.length);
          applyHeaderRowAt(ws, 3, headers.length);
          applyFreezeAt(ws, 4);

          XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }

        // ── Elevation Types sheet ─────────────────────────────────────────────
        // One dedicated sheet listing every project elevation type with its image.
        type ElevImgPayload = { base64: string; ext: string; w: number; h: number; rowIdx: number };
        const elevImgPayloads: ElevImgPayload[] = [];

        if (showElevationImages && imageInfoMap.size > 0) {
          const elevTypes    = elevationTypes.filter(et => imageInfoMap.has(et.id));
          const doorElevTypes  = elevTypes.filter(et => et.kind !== 'frame');
          const frameElevTypes = elevTypes.filter(et => et.kind === 'frame');

          if (elevTypes.length > 0) {
            const DISPLAY_H = 100; // px — max display height per image row
            const ROW_HPT   = Math.ceil(DISPLAY_H * 0.75) + 6;

            // Build sheet rows with section headers so row indices stay exact
            const sheetRows: string[][] = [];
            const imgMeta: { et: ElevationType; rowIdx: number }[] = [];

            sheetRows.push(['Code', '']); // row 0 — column header

            const appendSection = (label: string, types: ElevationType[]) => {
              if (types.length === 0) return;
              sheetRows.push([label, '']); // section label row
              for (const et of types) {
                imgMeta.push({ et, rowIdx: sheetRows.length });
                sheetRows.push([et.code || '', '']);
              }
            };

            appendSection('Door Elevations', doorElevTypes);
            if (doorElevTypes.length > 0 && frameElevTypes.length > 0) {
              sheetRows.push(['', '']); // blank gap between sections
            }
            appendSection('Frame Elevations', frameElevTypes);

            // Row heights: header=20, section-label=15, data=ROW_HPT, blank=8
            const sectionLabelRows = new Set<number>();
            const blankRows        = new Set<number>();
            let cursor = 1;
            const buildHeights = (types: ElevationType[], hasLabel: boolean) => {
              if (types.length === 0) return;
              if (hasLabel) { sectionLabelRows.add(cursor); cursor++; }
              cursor += types.length;
            };
            buildHeights(doorElevTypes, true);
            if (doorElevTypes.length > 0 && frameElevTypes.length > 0) {
              blankRows.add(cursor); cursor++;
            }
            buildHeights(frameElevTypes, doorElevTypes.length > 0);

            const rowHeights = sheetRows.map((_, r) =>
              r === 0 ? { hpt: 20 }
              : sectionLabelRows.has(r) ? { hpt: 15 }
              : blankRows.has(r) ? { hpt: 8 }
              : { hpt: ROW_HPT },
            );

            const elevSheet = XLSX.utils.aoa_to_sheet(sheetRows);
            elevSheet['!cols'] = [{ wch: 18 }, { wch: 28 }];
            elevSheet['!rows'] = rowHeights;
            applyHeaderRowAt(elevSheet, 0, 2);

            // Bold the section label cells
            for (const r of sectionLabelRows) {
              const addr = XLSX.utils.encode_cell({ r, c: 0 });
              if (elevSheet[addr]) {
                elevSheet[addr].s = {
                  font: { bold: true, sz: 10, color: { rgb: '1E3A5F' } },
                  fill: { fgColor: { rgb: 'E8F0FE' }, patternType: 'solid' },
                };
              }
            }

            XLSX.utils.book_append_sheet(wb, elevSheet, 'Elevation Types');

            // Collect OOXML image payloads using the exact row indices computed above
            for (const { et, rowIdx } of imgMeta) {
              const info = imageInfoMap.get(et.id)!;
              const match = info.dataUrl.match(/^data:image\/(\w+);base64,(.+)$/s);
              if (!match) continue;
              const rawExt = match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase();

              // Excel only supports png/jpeg/gif — convert webp/avif/etc. to PNG via canvas.
              let finalBase64 = match[2];
              let finalExt    = rawExt;
              if (!['png', 'jpeg', 'gif'].includes(rawExt)) {
                const pngDataUrl = await new Promise<string>(resolve => {
                  const canvas = document.createElement('canvas');
                  canvas.width  = info.w;
                  canvas.height = info.h;
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
                finalExt    = 'png';
              }

              const scale = Math.min(1, DISPLAY_H / info.h);
              elevImgPayloads.push({
                base64: finalBase64, ext: finalExt,
                w: Math.round(info.w * scale), h: Math.round(info.h * scale),
                rowIdx,
              });
            }
          }
        }

        // Write base xlsx (data only)
        const xlsxBytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellStyles: true }) as Uint8Array;

        let finalBlob: Blob;

        if (elevImgPayloads.length > 0) {
          // Inject elevation images into the "Elevation Types" sheet via OOXML
          const zip = await JSZip.loadAsync(xlsxBytes);
          let ctXml = await zip.file('[Content_Types].xml')!.async('string');

          const elevSheetNum = wb.SheetNames.length; // 1-indexed position of the last (Elevation Types) sheet
          const drawingId    = elevSheetNum;
          const IMG_COL      = 1; // column B (0-indexed)

          let anchors     = '';
          let relsEntries = '';

          for (const [imgIdx, img] of elevImgPayloads.entries()) {
            const rId       = `rId${imgIdx + 1}`;
            const mediaFile = `elev_${imgIdx + 1}.${img.ext}`;
            const emuW      = img.w * 9525;
            const emuH      = img.h * 9525;

            zip.file(`xl/media/${mediaFile}`, img.base64, { base64: true });

            relsEntries += `<Relationship Id="${rId}" `
              + `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" `
              + `Target="../media/${mediaFile}"/>`;

            anchors += `<xdr:oneCellAnchor>`
              + `<xdr:from><xdr:col>${IMG_COL}</xdr:col><xdr:colOff>114300</xdr:colOff>`
              + `<xdr:row>${img.rowIdx}</xdr:row><xdr:rowOff>114300</xdr:rowOff></xdr:from>`
              + `<xdr:ext cx="${emuW}" cy="${emuH}"/>`
              + `<xdr:pic><xdr:nvPicPr>`
              + `<xdr:cNvPr id="${imgIdx + 2}" name="ElevType${imgIdx + 1}"/>`
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

          const wsFile = zip.file(`xl/worksheets/sheet${elevSheetNum}.xml`);
          if (wsFile) {
            let wsXml = await wsFile.async('string');
            if (!wsXml.includes('xmlns:r='))
              wsXml = wsXml.replace('<worksheet ', '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');
            if (!wsXml.includes('<drawing '))
              wsXml = wsXml.replace('</worksheet>', `<drawing r:id="rId_draw${drawingId}"/></worksheet>`);
            zip.file(`xl/worksheets/sheet${elevSheetNum}.xml`, wsXml);
          }

          const wsRelsPath = `xl/worksheets/_rels/sheet${elevSheetNum}.xml.rels`;
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
            ...buildAutoTableOptions(groupTheme, reportTitle, exportDate, PAGE_W, PDF_MARGIN, { projectName, logoDataUrl, projectLocation, projectProvince }),
            startY:       HEADER_BAR_HEIGHT + 2,  // leave room for branded header (replaces hardcoded 25)
            head:         [pdfHeaders],
            body:         rowsByGroup[i].map(row =>
              selectedColumns.map(col => getRowValue(row, col) || '—'),
            ),
            tableWidth:   USABLE_W,
            columnStyles: pdfColumnStyles,
            // fontSize/cellPadding already in groupTheme via buildAutoTableOptions → styles
          });

          // ── Elevation images for this group (door + frame sections) ─────
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

              const exportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

              const addElevPageHeader = (title: string) =>
                drawPageHeader(doc, title, exportDate, PAGE_W, PDF_MARGIN, projectName, logoDataUrl, projectLocation, projectProvince);

              const renderElevCards = (types: ElevationType[], sectionTitle: string) => {
                if (types.length === 0) return;
                doc.addPage();
                addElevPageHeader(sectionTitle);

                for (const [idx, et] of types.entries()) {
                  const info = imageInfoMap.get(et.id)!;
                  const slotIndex = idx % cardsPerPage;
                  const row = Math.floor(slotIndex / colsPerPage);
                  const col = slotIndex % colsPerPage;

                  if (idx > 0 && slotIndex === 0) {
                    doc.addPage();
                    addElevPageHeader(`${sectionTitle} (continued)`);
                  }

                  const cardX = MARGIN + col * (cardW + COL_GAP);
                  const cardY = HEADER_Y + row * (cardH + ROW_GAP);
                  const scale = Math.min(MAX_IMG_W / info.w, MAX_IMG_H / info.h, 1);
                  const imgW = info.w * scale;
                  const imgH = info.h * scale;
                  const imgX = cardX + (cardW - imgW) / 2;
                  const imgY = cardY + INNER_PAD;

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

              const doorElev  = groupElevTypes.filter(et => et.kind !== 'frame');
              const frameElev = groupElevTypes.filter(et => et.kind === 'frame');

              renderElevCards(doorElev,  `Door Elevations — ${subtitle}`);
              renderElevCards(frameElev, `Frame Elevations — ${subtitle}`);
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
