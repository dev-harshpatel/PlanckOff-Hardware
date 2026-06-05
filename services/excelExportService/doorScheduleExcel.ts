import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';
import { contentAwareColWidths, buildMetadataRows, applyMetadataStyles, applyHeaderRowAt, applyFreezeAt } from '../excelTheme';
import { Door, ElevationType } from '../../types';
import type { DoorScheduleExportConfig } from '../../types/doorScheduleTypes';
import { buildExportFilename } from '../../utils/exportFilename';
import { toExcelNumber } from '../../utils/excelUtils';
import { collectGroupElevationTypes } from '../../utils/elevationUtils';

function resolveElevationType(door: Door, elevationTypes: ElevationType[]): ElevationType | undefined {
  if (!door.elevationTypeId) return undefined;
  return elevationTypes.find(e =>
    e.id === door.elevationTypeId ||
    e.code === door.elevationTypeId ||
    e.name === door.elevationTypeId
  );
}

// Build headers for Door Schedule
const buildDoorScheduleHeaders = (columns: DoorScheduleExportConfig['columns']): string[] => {
  const headers: string[] = [];

  if (columns.basic.includes('doorTag')) headers.push('Door Tag');
  if (columns.basic.includes('location')) headers.push('Location');
  if (columns.basic.includes('quantity')) headers.push('Quantity');
  if (columns.basic.includes('type')) headers.push('Type');

  if (columns.dimensions.includes('width')) headers.push('Width');
  if (columns.dimensions.includes('height')) headers.push('Height');
  if (columns.dimensions.includes('thickness')) headers.push('Thickness');
  if (columns.dimensions.includes('frameDepth')) headers.push('Frame Depth');

  if (columns.materials.includes('doorMaterial')) headers.push('Door Material');
  if (columns.materials.includes('frameMaterial')) headers.push('Frame Material');
  if (columns.materials.includes('coreType')) headers.push('Core Type');
  if (columns.materials.includes('veneerType')) headers.push('Veneer Type');

  if (columns.fireSafety.includes('fireRating')) headers.push('Fire Rating');
  if (columns.fireSafety.includes('smokeRating')) headers.push('Smoke Rating');
  if (columns.fireSafety.includes('stcRating')) headers.push('STC Rating');
  if (columns.fireSafety.includes('egressRequired')) headers.push('Egress Required');

  if (columns.hardware.includes('assignedHardwareSet')) headers.push('Hardware Set');
  if (columns.hardware.includes('hardwarePrep')) headers.push('Hardware Prep');
  if (columns.hardware.includes('hingeType')) headers.push('Hinge Type');
  if (columns.hardware.includes('lockType')) headers.push('Lock Type');

  if (columns.additional.includes('interiorExterior')) headers.push('Interior/Exterior');
  if (columns.additional.includes('swingDirection')) headers.push('Swing Direction');
  if (columns.additional.includes('undercut')) headers.push('Undercut');
  if (columns.additional.includes('louvers')) headers.push('Louvers');
  if (columns.additional.includes('visionPanels')) headers.push('Vision Panels');
  if (columns.additional.includes('specialNotes')) headers.push('Special Notes');
  if (columns.additional.includes('elevationTypeId')) headers.push('Elevation Type');
  if (columns.additional.includes('elevationImageUrl')) headers.push('Elevation Image');

  return headers;
};

// Build data row for a door
const buildDoorScheduleRow = (
  door: Door,
  columns: DoorScheduleExportConfig['columns'],
  elevationTypes: ElevationType[] = [],
): unknown[] => {
  const row: unknown[] = [];

  if (columns.basic.includes('doorTag')) row.push(door.doorTag || '');
  if (columns.basic.includes('location')) row.push(door.location || '');
  if (columns.basic.includes('quantity')) row.push(door.quantity || 1);
  if (columns.basic.includes('type')) row.push(door.type || '');

  if (columns.dimensions.includes('width')) row.push(toExcelNumber(door.width));
  if (columns.dimensions.includes('height')) row.push(toExcelNumber(door.height));
  if (columns.dimensions.includes('thickness')) row.push(toExcelNumber(door.thickness));
  if (columns.dimensions.includes('frameDepth')) row.push(toExcelNumber(door.frameDepth));

  if (columns.materials.includes('doorMaterial')) row.push(door.doorMaterial || '');
  if (columns.materials.includes('frameMaterial')) row.push(door.frameMaterial || '');
  if (columns.materials.includes('coreType')) row.push(door.coreType || '');
  if (columns.materials.includes('veneerType')) row.push(door.veneerType || '');

  if (columns.fireSafety.includes('fireRating')) row.push(door.fireRating || '');
  if (columns.fireSafety.includes('smokeRating')) row.push(door.smokeRating || '');
  if (columns.fireSafety.includes('stcRating')) row.push(toExcelNumber(door.stcRating));
  if (columns.fireSafety.includes('egressRequired')) row.push(door.egressRequired ? 'Yes' : 'No');

  if (columns.hardware.includes('assignedHardwareSet')) row.push(toExcelNumber(door.assignedHardwareSet?.name));
  if (columns.hardware.includes('hardwarePrep')) row.push(door.hardwarePrep || '');
  if (columns.hardware.includes('hingeType')) row.push(door.hingeType || '');
  if (columns.hardware.includes('lockType')) row.push(door.lockType || '');

  if (columns.additional.includes('interiorExterior')) row.push(door.interiorExterior || '');
  if (columns.additional.includes('swingDirection')) row.push(door.swingDirection || '');
  if (columns.additional.includes('undercut')) row.push(toExcelNumber(door.undercut));
  if (columns.additional.includes('louvers')) row.push(door.louvers || '');
  if (columns.additional.includes('visionPanels')) row.push(door.visionPanels || '');
  if (columns.additional.includes('specialNotes')) row.push(door.specialNotes || '');
  if (columns.additional.includes('elevationTypeId')) row.push(door.elevationTypeId || '');
  if (columns.additional.includes('elevationImageUrl')) {
    const et = resolveElevationType(door, elevationTypes);
    row.push(et?.code || et?.name || door.elevationTypeId || '');
  }

  return row;
};

// ── Image data types ──────────────────────────────────────────────────────────

type ElevImgData = { base64: string; ext: string; origW: number; origH: number; et: ElevationType };

// Fetches and converts (webp→png) images for a list of elevation types.
// Returns a Map keyed by elevation type ID, storing original (unscaled) dimensions.
async function fetchElevTypeImages(
  elevTypes: ElevationType[],
): Promise<Map<string, ElevImgData>> {
  const result = new Map<string, ElevImgData>();

  await Promise.all(elevTypes.map(async et => {
    const src = et.imageData || et.imageUrl;
    if (!src) return;
    try {
      let dataUrl: string;
      if (src.startsWith('data:')) {
        dataUrl = src;
      } else {
        const resp = await fetch(src);
        if (!resp.ok) return;
        const blob = await resp.blob();
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
      const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/s);
      if (!match) return;
      const rawExt   = match[1].toLowerCase();
      const normalExt = rawExt === 'jpg' ? 'jpeg' : rawExt;

      const info = await new Promise<{ w: number; h: number } | null>(resolve => {
        const img = new window.Image();
        img.onload  = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = dataUrl;
      });
      if (!info) return;

      let finalBase64 = match[2];
      let finalExt    = normalExt;
      if (!['png', 'jpeg', 'gif'].includes(normalExt)) {
        const pngDataUrl = await new Promise<string>(resolve => {
          const canvas = document.createElement('canvas');
          canvas.width  = info.w;
          canvas.height = info.h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(''); return; }
          const img = new window.Image();
          img.onload  = () => { ctx.drawImage(img, 0, 0); resolve(canvas.toDataURL('image/png')); };
          img.onerror = () => resolve('');
          img.src = dataUrl;
        });
        if (!pngDataUrl) return;
        const pngMatch = pngDataUrl.match(/^data:image\/png;base64,(.+)$/s);
        if (!pngMatch) return;
        finalBase64 = pngMatch[1];
        finalExt    = 'png';
      }

      result.set(et.id, { base64: finalBase64, ext: finalExt, origW: info.w, origH: info.h, et });
    } catch { /* skip broken images */ }
  }));

  return result;
}

// ── OOXML image injection ─────────────────────────────────────────────────────

type InlineElevPayload = { rowIdx: number; colIdx: number; base64: string; ext: string; w: number; h: number };

// Injects images into the specified sheet of an xlsx file via OOXML.
// `payloads` carry pre-scaled display dimensions (w × h in pixels).
async function injectElevationsInline(
  xlsxBytes: Uint8Array,
  sheetNum: number,
  payloads: InlineElevPayload[],
): Promise<Blob> {
  const jszipMod = await import('jszip');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const JSZip = ((jszipMod as any).default ?? jszipMod) as unknown as typeof import('jszip');

  const zip = await JSZip.loadAsync(xlsxBytes);
  let ctXml = await zip.file('[Content_Types].xml')!.async('string');

  const drawingId = sheetNum;
  let anchors     = '';
  let relsEntries = '';

  for (const [imgIdx, { rowIdx, colIdx, base64, ext, w, h }] of payloads.entries()) {
    const rId       = `rId${imgIdx + 1}`;
    const mediaFile = `elev_img_${imgIdx + 1}.${ext}`;
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
      + `<xdr:cNvPr id="${imgIdx + 2}" name="ElevImg${imgIdx + 1}"/>`
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

  zip.file('[Content_Types].xml', ctXml);
  const buf = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ── Styling helpers for elevation sections ────────────────────────────────────

const XLS_SECTION_FILL    = '1E3A5F'; // dark navy — section header
const XLS_SUBHEADER_FILL  = 'E8F0FE'; // light blue — column sub-header
const XLS_SUBHEADER_TEXT  = '1E293B';

function styleSectionHeader(ws: XLSX.WorkSheet, rowIdx: number, spanCols: number): void {
  for (let c = 0; c < spanCols; c++) {
    const addr = XLSX.utils.encode_cell({ r: rowIdx, c });
    if (!ws[addr]) ws[addr] = { t: 's', v: '' };
    ws[addr].s = {
      font:      { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
      fill:      { patternType: 'solid', fgColor: { rgb: XLS_SECTION_FILL } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };
  }
  ws['!merges'] = (ws['!merges'] ?? []).concat([
    { s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: spanCols - 1 } },
  ]);
}

function styleSectionSubHeader(ws: XLSX.WorkSheet, rowIdx: number): void {
  for (let c = 0; c < 2; c++) {
    const addr = XLSX.utils.encode_cell({ r: rowIdx, c });
    if (!ws[addr]) ws[addr] = { t: 's', v: '' };
    ws[addr].s = {
      font:      { bold: true, sz: 10, color: { rgb: XLS_SUBHEADER_TEXT } },
      fill:      { patternType: 'solid', fgColor: { rgb: XLS_SUBHEADER_FILL } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };
  }
}

// ── Main export function ──────────────────────────────────────────────────────

export const exportDoorScheduleToExcel = async (
  doors: Door[],
  config: DoorScheduleExportConfig,
  projectName: string,
  elevationTypes: ElevationType[] = [],
): Promise<void> => {
  const workbook = XLSX.utils.book_new();

  const headers  = buildDoorScheduleHeaders(config.columns);
  const dataRows = doors.map(door => buildDoorScheduleRow(door, config.columns, elevationTypes));

  // ── Table rows ─────────────────────────────────────────────────────────────
  const wsData: unknown[][] = [];
  if (config.includeHeader) {
    wsData.push(...buildMetadataRows({ reportTitle: 'Door Schedule', projectName, itemCount: doors.length }));
  }
  wsData.push(headers);
  wsData.push(...dataRows);

  // ── Elevation sections below the table ────────────────────────────────────
  const needSections = elevationTypes.length > 0 && (
    config.columns.additional.includes('elevationTypeId') ||
    config.columns.additional.includes('elevationImageUrl')
  );

  // Image sizing for sections
  const IMG_MAX_H   = 150; // max display height px
  const IMG_MAX_W   = 260; // max display width px
  const IMG_ROW_HPT = 160; // row height in pt (≈ 213px display — comfortable for 150px image)
  const IMG_COL     = 1;   // Column B carries images (col 0 = Name, col 1 = image)

  type ImgPayload = { rowIdx: number; colIdx: number; base64: string; ext: string; w: number; h: number };
  const imgPayloads: ImgPayload[] = [];

  // Track rows that need styling or non-default heights: [wsRowIdx, hpt]
  type RowMeta = { wsRowIdx: number; hpt: number };
  const sectionRowMeta: RowMeta[] = [];

  // Track section header / sub-header row indices for post-creation styling
  type SectionInfo = { headerRowIdx: number; subHeaderRowIdx: number };
  const sectionInfos: SectionInfo[] = [];

  let imgMap = new Map<string, ElevImgData>();

  if (needSections) {
    const allElevTypes   = collectGroupElevationTypes(doors, elevationTypes);
    const doorElevTypes  = allElevTypes.filter(et => et.kind !== 'frame');
    const frameElevTypes = allElevTypes.filter(et => et.kind === 'frame');

    imgMap = await fetchElevTypeImages(allElevTypes);

    const appendSection = (label: string, types: ElevationType[]): void => {
      if (types.length === 0) return;

      wsData.push([]); // blank gap row before section

      const headerRowIdx = wsData.length;
      wsData.push([label]);
      sectionRowMeta.push({ wsRowIdx: headerRowIdx, hpt: 22 });

      const subHeaderRowIdx = wsData.length;
      // col 0 = Name, col 1 = image column — header matches section label
      wsData.push(['Name', label]);
      sectionRowMeta.push({ wsRowIdx: subHeaderRowIdx, hpt: 20 });

      sectionInfos.push({ headerRowIdx, subHeaderRowIdx });

      for (const et of types) {
        const imgData   = imgMap.get(et.id);
        const dataRowIdx = wsData.length;
        wsData.push([et.name || et.code || et.id, '']);

        if (imgData) {
          const scale = Math.min(1, IMG_MAX_H / imgData.origH, IMG_MAX_W / imgData.origW);
          imgPayloads.push({
            rowIdx: dataRowIdx,
            colIdx: IMG_COL,
            base64: imgData.base64,
            ext:    imgData.ext,
            w:      Math.round(imgData.origW * scale),
            h:      Math.round(imgData.origH * scale),
          });
          sectionRowMeta.push({ wsRowIdx: dataRowIdx, hpt: IMG_ROW_HPT });
        } else {
          sectionRowMeta.push({ wsRowIdx: dataRowIdx, hpt: 20 });
        }
      }
    };

    appendSection('Door Elevations', doorElevTypes);
    appendSection('Frame Elevations', frameElevTypes);
  }

  // ── Build worksheet ────────────────────────────────────────────────────────
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);

  // Right-align all data cells so string values (e.g. "10.W") align
  // consistently with auto-right-aligned numeric cells (e.g. 10).
  const DATA_START_ROW = config.includeHeader ? 4 : 1;
  const wsRef = worksheet['!ref'];
  if (wsRef) {
    const range = XLSX.utils.decode_range(wsRef);
    for (let r = DATA_START_ROW; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = worksheet[addr] as Record<string, unknown> | undefined;
        if (cell) {
          cell.s = { ...(cell.s as object || {}), alignment: { horizontal: 'right', vertical: 'center', wrapText: false } };
        }
      }
    }
  }

  // Column widths — ensure col 1 (image column in sections) is wide enough
  const colWidths = contentAwareColWidths(headers, dataRows);
  while (colWidths.length <= IMG_COL) colWidths.push({ wch: 10 });
  colWidths[IMG_COL] = { wch: Math.max((colWidths[IMG_COL] as { wch: number }).wch ?? 10, 32) };
  worksheet['!cols'] = colWidths;

  if (config.includeHeader) {
    applyMetadataStyles(worksheet, headers.length); // also sets !rows[0-2]
    applyHeaderRowAt(worksheet, 3, headers.length);
    applyFreezeAt(worksheet, 4);
  } else {
    applyHeaderRowAt(worksheet, 0, headers.length);
    applyFreezeAt(worksheet, 1);
  }

  // Apply section row heights (sparse override on top of whatever applyMetadataStyles set)
  if (sectionRowMeta.length > 0) {
    const existingRows = (worksheet['!rows'] as Array<{ hpt: number } | undefined>) ?? [];
    const maxIdx = Math.max(...sectionRowMeta.map(m => m.wsRowIdx));
    while (existingRows.length <= maxIdx) existingRows.push(undefined as unknown as { hpt: number });
    for (const { wsRowIdx, hpt } of sectionRowMeta) {
      existingRows[wsRowIdx] = { hpt };
    }
    worksheet['!rows'] = existingRows;
  }

  // Style section headers and sub-headers
  const spanCols = Math.min(headers.length, 6);
  for (const { headerRowIdx, subHeaderRowIdx } of sectionInfos) {
    styleSectionHeader(worksheet, headerRowIdx, spanCols);
    styleSectionSubHeader(worksheet, subHeaderRowIdx);
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Door Schedule');

  // ── Optional summary sheet ─────────────────────────────────────────────────
  if (config.includeSummary) {
    const summaryData: unknown[][] = [
      ['Door Schedule Summary'],
      [],
      ['Total Doors', doors.length],
      ['Doors with Hardware', doors.filter(d => d.assignedHardwareSet).length],
      ['Doors without Hardware', doors.filter(d => !d.assignedHardwareSet).length],
    ];

    const typeBreakdown = new Map<string, number>();
    doors.forEach(door => {
      const type = door.type || 'Unknown';
      typeBreakdown.set(type, (typeBreakdown.get(type) || 0) + 1);
    });

    if (typeBreakdown.size > 0) {
      summaryData.push([]);
      summaryData.push(['Breakdown by Type']);
      typeBreakdown.forEach((count, type) => {
        summaryData.push([type, count]);
      });
    }

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 25 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  }

  // ── Write + inject ─────────────────────────────────────────────────────────
  const filename = buildExportFilename(projectName, 'door-schedule', 'xlsx');

  if (imgPayloads.length === 0) {
    XLSX.writeFile(workbook, filename, { cellStyles: true });
    return;
  }

  const xlsxBytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx', cellStyles: true }) as Uint8Array;
  const finalBlob = await injectElevationsInline(xlsxBytes, 1, imgPayloads);
  saveAs(finalBlob, filename);
};
