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
import { buildExportFilename } from '../../../utils/exportFilename';

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

// ── Section styling helpers ───────────────────────────────────────────────────

type XLSXWorksheet = Record<string, unknown> & {
  '!ref'?: string;
  '!cols'?: unknown[];
  '!rows'?: unknown[];
  '!merges'?: unknown[];
};

type EncodeCell = (cell: { r: number; c: number }) => string;

function styleSectionHeader(ws: XLSXWorksheet, rowIdx: number, spanCols: number, encodeCell: EncodeCell): void {
  for (let c = 0; c < spanCols; c++) {
    const addr = encodeCell({ r: rowIdx, c });
    if (!ws[addr]) ws[addr] = { t: 's', v: '' };
    (ws[addr] as Record<string, unknown>).s = {
      font:      { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
      fill:      { patternType: 'solid', fgColor: { rgb: '1E3A5F' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };
  }
  ws['!merges'] = ((ws['!merges'] as unknown[]) ?? []).concat([
    { s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: spanCols - 1 } },
  ]);
}

function styleSectionSubHeader(ws: XLSXWorksheet, rowIdx: number, encodeCell: EncodeCell): void {
  for (let c = 0; c < 2; c++) {
    const addr = encodeCell({ r: rowIdx, c });
    if (!ws[addr]) ws[addr] = { t: 's', v: '' };
    (ws[addr] as Record<string, unknown>).s = {
      font:      { bold: true, sz: 10, color: { rgb: '1E293B' } },
      fill:      { patternType: 'solid', fgColor: { rgb: 'E8F0FE' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };
  }
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
      const headers  = selectedColumns.map(col => parseColId(col).colKey);
      const fileName = (projectName || 'Door_Schedule').replace(/[/\\?%*:|"<>]/g, '_');

      const visibleGroups  = groups.filter(g => !hiddenGroupKeys.has(g.breadcrumb.join('||') || 'all'));
      const orderedDoors   = [...includedDoors];
      const groupsToExport = visibleGroups.length > 0 ? visibleGroups : [{ breadcrumb: [], doors: orderedDoors }];
      const rowsByGroup    = groupsToExport.map(group =>
        uniqueData
          ? aggregateDoorsBySelectedColumns(group.doors, selectedColumns)
          : group.doors.map(door => ({
            id: door.id,
            doors: [door],
            quantity: getDoorQuantity(door),
            doorTags: door.doorTag,
          })),
      );

      const imageInfoMap = await preloadElevationImages(groupsToExport);

      if (format === 'excel') {
        const [XLSX, jszipMod] = await Promise.all([
          import('xlsx-js-style'),
          import('jszip'),
        ]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const JSZip = ((jszipMod as any).default ?? jszipMod) as unknown as typeof import('jszip');

        const encodeCell: EncodeCell = XLSX.utils.encode_cell.bind(XLSX.utils);

        // ── Pre-convert all elevation images (deduped by type, stores originals) ──
        type ConvertedImg = { base64: string; ext: string; origW: number; origH: number };
        const convertedImgs = new Map<string, ConvertedImg>();

        if (showElevationImages && imageInfoMap.size > 0) {
          for (const [etId, info] of imageInfoMap) {
            const match = info.dataUrl.match(/^data:image\/(\w+);base64,(.+)$/s);
            if (!match) continue;
            const rawExt  = match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase();

            let finalBase64 = match[2];
            let finalExt    = rawExt;
            if (!['png', 'jpeg', 'gif'].includes(rawExt)) {
              const pngDataUrl = await new Promise<string>(resolve => {
                const canvas = document.createElement('canvas');
                canvas.width  = info.w; canvas.height = info.h;
                const ctx = canvas.getContext('2d');
                if (!ctx) { resolve(''); return; }
                const img = new window.Image();
                img.onload  = () => { ctx.drawImage(img, 0, 0); resolve(canvas.toDataURL('image/png')); };
                img.onerror = () => resolve('');
                img.src = info.dataUrl;
              });
              if (!pngDataUrl) continue;
              const pngMatch = pngDataUrl.match(/^data:image\/png;base64,(.+)$/s);
              if (!pngMatch) continue;
              finalBase64 = pngMatch[1];
              finalExt    = 'png';
            }

            convertedImgs.set(etId, {
              base64: finalBase64,
              ext:    finalExt,
              origW:  info.w,
              origH:  info.h,
            });
          }
        }

        // ── Section image sizing ───────────────────────────────────────────────
        const IMG_COL      = 1;   // Column B carries images (col 0 = Name, col 1 = image)
        const IMG_MAX_H    = 150; // max display height px
        const IMG_MAX_W    = 260; // max display width px
        const IMG_ROW_HPT  = 160; // row height pt (≈ 213px display — comfortable for 150px image)

        const wb = XLSX.utils.book_new();
        const useSingleSheet = groupsToExport.length === 1 && groupsToExport[0].breadcrumb.length === 0;

        type InlinePayload = {
          sheetNum: number; rowIdx: number; colIdx: number;
          base64: string; ext: string; w: number; h: number;
        };
        const allPayloads: InlinePayload[] = [];

        // ── Build one sheet per group ──────────────────────────────────────────
        for (const [i, group] of groupsToExport.entries()) {
          const sheetNum = i + 1;
          const rawName  = useSingleSheet
            ? 'Door Schedule'
            : (group.breadcrumb.join(' - ') || `Group ${i + 1}`);
          const sheetName = rawName.replace(/[\\/*?[\]:]/g, '_').slice(0, 31) || `Sheet${i + 1}`;

          const rows = rowsByGroup[i].map(row =>
            selectedColumns.map(col => toExcelNumber(getRowValue(row, col))),
          );

          // ── Collect elevation types for this group ─────────────────────────
          const groupAllElev   = collectGroupElevationTypes(group.doors, elevationTypes)
            .filter(et => convertedImgs.has(et.id));
          const doorElevTypes  = groupAllElev.filter(et => et.kind !== 'frame');
          const frameElevTypes = groupAllElev.filter(et => et.kind === 'frame');

          // ── Build allRows = meta + headers + data + sections ───────────────
          const metaRows = buildMetadataRows({ reportTitle: 'Door Schedule', projectName });
          const allRows: unknown[][] = [...metaRows, headers, ...rows];

          type RowMeta = { rowIdx: number; hpt: number };
          const rowMetas: RowMeta[] = [];

          type SectionInfo = { headerRowIdx: number; subHeaderRowIdx: number };
          const sectionInfos: SectionInfo[] = [];

          const appendSection = (label: string, types: ElevationType[]): void => {
            if (types.length === 0) return;

            allRows.push([]); // blank gap

            const headerRowIdx = allRows.length;
            allRows.push([label]);
            rowMetas.push({ rowIdx: headerRowIdx, hpt: 22 });

            const subHeaderRowIdx = allRows.length;
            // col 0 = Name, col 1 = image — header matches section label
            allRows.push(['Name', label]);
            rowMetas.push({ rowIdx: subHeaderRowIdx, hpt: 20 });

            sectionInfos.push({ headerRowIdx, subHeaderRowIdx });

            for (const et of types) {
              const img = convertedImgs.get(et.id);
              const dataRowIdx = allRows.length;
              allRows.push([et.name || et.code || et.id, '']);

              if (img) {
                const scale = Math.min(1, IMG_MAX_H / img.origH, IMG_MAX_W / img.origW);
                allPayloads.push({
                  sheetNum,
                  rowIdx:  dataRowIdx,
                  colIdx:  IMG_COL,
                  base64:  img.base64,
                  ext:     img.ext,
                  w:       Math.round(img.origW * scale),
                  h:       Math.round(img.origH * scale),
                });
                rowMetas.push({ rowIdx: dataRowIdx, hpt: IMG_ROW_HPT });
              } else {
                rowMetas.push({ rowIdx: dataRowIdx, hpt: 20 });
              }
            }
          };

          if (showElevationImages) {
            appendSection('Door Elevations', doorElevTypes);
            appendSection('Frame Elevations', frameElevTypes);
          }

          // ── Build worksheet ────────────────────────────────────────────────
          const ws = XLSX.utils.aoa_to_sheet(allRows);

          // Right-align all data cells so string values (e.g. "10.W") align
          // consistently with auto-right-aligned numeric cells (e.g. 10).
          const DATA_START_ROW = 4; // 3 meta rows + 1 header row
          const wsRef = ws['!ref'];
          if (wsRef) {
            const range = XLSX.utils.decode_range(wsRef);
            for (let r = DATA_START_ROW; r <= range.e.r; r++) {
              for (let c = range.s.c; c <= range.e.c; c++) {
                const addr = encodeCell({ r, c });
                const cell = ws[addr] as Record<string, unknown> | undefined;
                if (cell) {
                  cell.s = { ...(cell.s as object || {}), alignment: { horizontal: 'right', vertical: 'center', wrapText: false } };
                }
              }
            }
          }

          // Column widths — ensure col 2 is wide enough for section images
          const colWidths = contentAwareColWidths(headers, rows);
          while (colWidths.length <= IMG_COL) colWidths.push({ wch: 10 });
          colWidths[IMG_COL] = { wch: Math.max((colWidths[IMG_COL] as { wch: number })?.wch ?? 10, 32) };
          ws['!cols'] = colWidths;

          applyMetadataStyles(ws, headers.length); // sets ws['!rows'] for rows 0-2
          applyHeaderRowAt(ws, 3, headers.length);
          applyFreezeAt(ws, 4);

          // Apply section row heights (sparse override)
          if (rowMetas.length > 0) {
            const existingRows = (ws['!rows'] as Array<{ hpt: number } | undefined>) ?? [];
            const maxIdx = Math.max(...rowMetas.map(m => m.rowIdx));
            while (existingRows.length <= maxIdx) existingRows.push(undefined as unknown as { hpt: number });
            for (const { rowIdx, hpt } of rowMetas) {
              existingRows[rowIdx] = { hpt };
            }
            ws['!rows'] = existingRows;
          }

          // Style section headers and sub-headers
          const spanCols = Math.min(headers.length, 6);
          for (const { headerRowIdx, subHeaderRowIdx } of sectionInfos) {
            styleSectionHeader(ws as XLSXWorksheet, headerRowIdx, spanCols, encodeCell);
            styleSectionSubHeader(ws as XLSXWorksheet, subHeaderRowIdx, encodeCell);
          }

          XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }

        // ── Write base xlsx ────────────────────────────────────────────────────
        const xlsxBytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellStyles: true }) as Uint8Array;

        let finalBlob: Blob;

        if (allPayloads.length > 0) {
          // Group payloads by sheet — one drawing XML file per sheet
          const payloadsBySheet = new Map<number, InlinePayload[]>();
          for (const p of allPayloads) {
            if (!payloadsBySheet.has(p.sheetNum)) payloadsBySheet.set(p.sheetNum, []);
            payloadsBySheet.get(p.sheetNum)!.push(p);
          }

          const zip = await JSZip.loadAsync(xlsxBytes);
          let ctXml = await zip.file('[Content_Types].xml')!.async('string');

          let globalMediaIdx = 0;

          for (const [sheetNum, payloads] of payloadsBySheet.entries()) {
            const drawingId = sheetNum;
            let anchors     = '';
            let relsEntries = '';

            for (const [imgIdx, { rowIdx, colIdx, base64, ext, w, h }] of payloads.entries()) {
              const rId       = `rId${imgIdx + 1}`;
              const mediaFile = `elev_s${sheetNum}_${++globalMediaIdx}.${ext}`;
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
                + `<xdr:cNvPr id="${imgIdx + 2}" name="Elev_s${sheetNum}_${imgIdx + 1}"/>`
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
        a.href = url; a.download = buildExportFilename(projectName || '', 'Door Schedule', 'xlsx'); a.click();
        URL.revokeObjectURL(url);

      } else {
        // ── PDF: table + per-group elevation pages ────────────────────────────
        const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
          import('jspdf'),
          import('jspdf-autotable'),
        ]);

        const colCount    = selectedColumns.length;
        const useA3       = colCount > 20;
        const PAGE_W      = useA3 ? 420 : 297;
        const PAGE_H      = useA3 ? 297 : 210;
        const MARGIN      = 14;
        const USABLE_W    = PAGE_W - MARGIN * 2;
        const fontSize    = colCount > 30 ? 4.5 : colCount > 20 ? 5 : colCount > 15 ? 5.5 : 6.5;
        const cellPadding = colCount > 30 ? 0.8 : colCount > 20 ? 1 : colCount > 15 ? 1.4 : 1.8;

        const doc        = new jsPDF({ orientation: 'landscape', unit: 'mm', format: useA3 ? 'a3' : 'a4' });
        const logoDataUrl = await loadLogoDataUrl();

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

        const allExportRows = rowsByGroup.flatMap(r => r);

        // Minimum column width scales down for very wide tables so all columns fit.
        const MIN_COL = colCount > 35 ? 4 : colCount > 25 ? 5.5 : colCount > 15 ? 7 : 10;
        const MAX_COL = USABLE_W * 0.14;

        const rawWeights = selectedColumns.map((col, i) => {
          const hLen = pdfHeaders[i].length;
          const dLen = allExportRows.reduce((mx, row) =>
            Math.max(mx, (getRowValue(row, col) || '').length), 0);
          return Math.max(hLen, Math.min(dLen, 20));
        });
        const totalWeight = rawWeights.reduce((s, w) => s + w, 0);

        // Proportional widths, then clamp each column to [MIN_COL, MAX_COL].
        const clampedWidths = rawWeights.map(w => {
          const prop = totalWeight > 0 ? (w / totalWeight) * USABLE_W : USABLE_W / colCount;
          return Math.min(Math.max(prop, MIN_COL), MAX_COL);
        });

        // After clamping the sum may exceed USABLE_W — scale everything down so
        // columns always fit exactly within the printable area and nothing is cut.
        const clampedTotal = clampedWidths.reduce((s, w) => s + w, 0);
        const scaleFactor  = clampedTotal > USABLE_W ? USABLE_W / clampedTotal : 1;

        const pdfColumnStyles: Record<number, { cellWidth: number }> = Object.fromEntries(
          clampedWidths.map((w, i) => [i, { cellWidth: w * scaleFactor }]),
        );

        for (const [i, group] of groupsToExport.entries()) {
          if (i > 0) doc.addPage();

          const exportDate  = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
          const subtitle    = group.breadcrumb.length > 0 ? group.breadcrumb.join(' › ') : 'All Doors';
          const reportTitle = `Door Schedule — ${subtitle} (${sumDoorQuantities(group.doors)} door${sumDoorQuantities(group.doors) !== 1 ? 's' : ''})`;

          const groupTheme = { ...DEFAULT_THEME, fontSize, cellPadding };

          autoTable(doc, {
            ...buildAutoTableOptions(groupTheme, reportTitle, exportDate, PAGE_W, PDF_MARGIN, { projectName, logoDataUrl, projectLocation, projectProvince }),
            startY:       HEADER_BAR_HEIGHT + 2,
            head:         [pdfHeaders],
            body:         rowsByGroup[i].map(row =>
              selectedColumns.map(col => getRowValue(row, col) || '—'),
            ),
            tableWidth:   USABLE_W,
            columnStyles: pdfColumnStyles,
          });

          if (showElevationImages) {
            const groupElevTypes = collectGroupElevationTypes(group.doors, elevationTypes)
              .filter(et => imageInfoMap.has(et.id));

            if (groupElevTypes.length > 0) {
              const LABEL_H      = 12;
              const ROW_GAP      = 10;
              const COL_GAP      = 10;
              const HEADER_Y     = 26;
              const FOOTER_Y     = PAGE_H - MARGIN;
              const colsPerPage  = useA3 ? 3 : 2;
              const rowsPerPage  = useA3 ? 3 : 2;
              const cardsPerPage = colsPerPage * rowsPerPage;
              const cardW        = (USABLE_W - COL_GAP * (colsPerPage - 1)) / colsPerPage;
              const cardH        = (FOOTER_Y - HEADER_Y - ROW_GAP * (rowsPerPage - 1)) / rowsPerPage;
              const INNER_PAD    = 4;
              const MAX_IMG_W    = Math.max(20, cardW - INNER_PAD * 2);
              const MAX_IMG_H    = Math.max(20, cardH - (LABEL_H + 4) - INNER_PAD * 2);

              const addElevPageHeader = (title: string) =>
                drawPageHeader(doc, title, exportDate, PAGE_W, PDF_MARGIN, projectName, logoDataUrl, projectLocation, projectProvince);

              const renderElevCards = (types: ElevationType[], sectionTitle: string) => {
                if (types.length === 0) return;
                doc.addPage();
                addElevPageHeader(sectionTitle);

                for (const [idx, et] of types.entries()) {
                  const info      = imageInfoMap.get(et.id)!;
                  const slotIndex = idx % cardsPerPage;
                  const row       = Math.floor(slotIndex / colsPerPage);
                  const col       = slotIndex % colsPerPage;

                  if (idx > 0 && slotIndex === 0) {
                    doc.addPage();
                    addElevPageHeader(`${sectionTitle} (continued)`);
                  }

                  const cardX  = MARGIN + col * (cardW + COL_GAP);
                  const cardY  = HEADER_Y + row * (cardH + ROW_GAP);
                  const scale  = Math.min(MAX_IMG_W / info.w, MAX_IMG_H / info.h, 1);
                  const imgW   = info.w * scale;
                  const imgH   = info.h * scale;
                  const imgX   = cardX + (cardW - imgW) / 2;
                  const imgY   = cardY + INNER_PAD;

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

              renderElevCards(groupElevTypes.filter(et => et.kind !== 'frame'), `Door Elevations — ${subtitle}`);
              renderElevCards(groupElevTypes.filter(et => et.kind === 'frame'),  `Frame Elevations — ${subtitle}`);
            }
          }
        }

        addPageNumbers(doc, projectName || 'Door Schedule', PAGE_W, PAGE_H, PDF_MARGIN);
        doc.save(buildExportFilename(projectName || '', 'Door Schedule', 'pdf'));
      }
    } finally {
      setIsDownloading(false);
    }
  };

  return { handleDownload };
}
