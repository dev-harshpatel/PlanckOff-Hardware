import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';
import { applySheetTheme, contentAwareColWidths, buildMetadataRows, applyMetadataStyles, applyHeaderRowAt, applyFreezeAt } from '../excelTheme';
import { Door, ElevationType } from '../../types';
import type { DoorScheduleExportConfig } from '../../types/doorScheduleTypes';
import { buildExportFilename } from '../../utils/exportFilename';
import { toExcelNumber } from '../../utils/excelUtils';

function resolveElevationType(door: Door, elevationTypes: ElevationType[]): ElevationType | undefined {
  if (!door.elevationTypeId) return undefined;
  return elevationTypes.find(e =>
    e.id === door.elevationTypeId ||
    e.code === door.elevationTypeId ||
    e.name === door.elevationTypeId
  );
}

function resolveElevationImageUrl(door: Door, elevationTypes: ElevationType[]): string {
  return resolveElevationType(door, elevationTypes)?.imageUrl ?? '';
}

// Build headers for Door Schedule
const buildDoorScheduleHeaders = (columns: DoorScheduleExportConfig['columns']): string[] => {
  const headers: string[] = [];

  // Basic Information
  if (columns.basic.includes('doorTag')) headers.push('Door Tag');
  if (columns.basic.includes('location')) headers.push('Location');
  if (columns.basic.includes('quantity')) headers.push('Quantity');
  if (columns.basic.includes('type')) headers.push('Type');

  // Dimensions
  if (columns.dimensions.includes('width')) headers.push('Width');
  if (columns.dimensions.includes('height')) headers.push('Height');
  if (columns.dimensions.includes('thickness')) headers.push('Thickness');
  if (columns.dimensions.includes('frameDepth')) headers.push('Frame Depth');

  // Materials
  if (columns.materials.includes('doorMaterial')) headers.push('Door Material');
  if (columns.materials.includes('frameMaterial')) headers.push('Frame Material');
  if (columns.materials.includes('coreType')) headers.push('Core Type');
  if (columns.materials.includes('veneerType')) headers.push('Veneer Type');

  // Fire & Safety
  if (columns.fireSafety.includes('fireRating')) headers.push('Fire Rating');
  if (columns.fireSafety.includes('smokeRating')) headers.push('Smoke Rating');
  if (columns.fireSafety.includes('stcRating')) headers.push('STC Rating');
  if (columns.fireSafety.includes('egressRequired')) headers.push('Egress Required');

  // Hardware
  if (columns.hardware.includes('assignedHardwareSet')) headers.push('Hardware Set');
  if (columns.hardware.includes('hardwarePrep')) headers.push('Hardware Prep');
  if (columns.hardware.includes('hingeType')) headers.push('Hinge Type');
  if (columns.hardware.includes('lockType')) headers.push('Lock Type');

  // Additional
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

  // Basic Information
  if (columns.basic.includes('doorTag')) row.push(door.doorTag || '');
  if (columns.basic.includes('location')) row.push(door.location || '');
  if (columns.basic.includes('quantity')) row.push(door.quantity || 1);
  if (columns.basic.includes('type')) row.push(door.type || '');

  // Dimensions
  if (columns.dimensions.includes('width')) row.push(toExcelNumber(door.width));
  if (columns.dimensions.includes('height')) row.push(toExcelNumber(door.height));
  if (columns.dimensions.includes('thickness')) row.push(toExcelNumber(door.thickness));
  if (columns.dimensions.includes('frameDepth')) row.push(toExcelNumber(door.frameDepth));

  // Materials
  if (columns.materials.includes('doorMaterial')) row.push(door.doorMaterial || '');
  if (columns.materials.includes('frameMaterial')) row.push(door.frameMaterial || '');
  if (columns.materials.includes('coreType')) row.push(door.coreType || '');
  if (columns.materials.includes('veneerType')) row.push(door.veneerType || '');

  // Fire & Safety
  if (columns.fireSafety.includes('fireRating')) row.push(door.fireRating || '');
  if (columns.fireSafety.includes('smokeRating')) row.push(door.smokeRating || '');
  if (columns.fireSafety.includes('stcRating')) row.push(toExcelNumber(door.stcRating));
  if (columns.fireSafety.includes('egressRequired')) row.push(door.egressRequired ? 'Yes' : 'No');

  // Hardware
  if (columns.hardware.includes('assignedHardwareSet')) row.push(toExcelNumber(door.assignedHardwareSet?.name));
  if (columns.hardware.includes('hardwarePrep')) row.push(door.hardwarePrep || '');
  if (columns.hardware.includes('hingeType')) row.push(door.hingeType || '');
  if (columns.hardware.includes('lockType')) row.push(door.lockType || '');

  // Additional
  if (columns.additional.includes('interiorExterior')) row.push(door.interiorExterior || '');
  if (columns.additional.includes('swingDirection')) row.push(door.swingDirection || '');
  if (columns.additional.includes('undercut')) row.push(toExcelNumber(door.undercut));
  if (columns.additional.includes('louvers')) row.push(door.louvers || '');
  if (columns.additional.includes('visionPanels')) row.push(door.visionPanels || '');
  if (columns.additional.includes('specialNotes')) row.push(door.specialNotes || '');
  if (columns.additional.includes('elevationTypeId')) row.push(door.elevationTypeId || '');
  if (columns.additional.includes('elevationImageUrl')) {
    const et = resolveElevationType(door, elevationTypes);
    // Write the type code (human-readable) — image is embedded in the Elevations sheet
    row.push(et?.code || et?.name || door.elevationTypeId || '');
  }

  return row;
};

type ElevImgData = { base64: string; ext: string; w: number; h: number; et: ElevationType };

async function fetchElevationImages(
  doors: Door[],
  elevationTypes: ElevationType[],
): Promise<ElevImgData[]> {
  const seen = new Set<string>();
  const toFetch: ElevationType[] = [];

  for (const door of doors) {
    if (!door.elevationTypeId) continue;
    const et = elevationTypes.find(e =>
      e.id === door.elevationTypeId ||
      e.code === door.elevationTypeId ||
      e.name === door.elevationTypeId,
    );
    if (!et || seen.has(et.id)) continue;
    const src = et.imageData || et.imageUrl;
    if (!src) continue;
    seen.add(et.id);
    toFetch.push(et);
  }

  const results: ElevImgData[] = [];

  await Promise.all(toFetch.map(async et => {
    const src = et.imageData || et.imageUrl!;
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
      const rawExt = match[1].toLowerCase();
      const normalExt = rawExt === 'jpg' ? 'jpeg' : rawExt;

      // Get image dimensions (needed for both conversion and EMU calculation)
      const info = await new Promise<{ w: number; h: number } | null>(resolve => {
        const img = new window.Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = dataUrl;
      });
      if (!info) return;

      // Excel only supports png/jpeg/gif — convert webp/avif/svg/etc. to PNG via canvas
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
          img.onload = () => { ctx.drawImage(img, 0, 0); resolve(canvas.toDataURL('image/png')); };
          img.onerror = () => resolve('');
          img.src = dataUrl;
        });
        if (!pngDataUrl) return;
        const pngMatch = pngDataUrl.match(/^data:image\/png;base64,(.+)$/s);
        if (!pngMatch) return;
        finalBase64 = pngMatch[1];
        finalExt    = 'png';
      }

      results.push({ base64: finalBase64, ext: finalExt, w: info.w, h: info.h, et });
    } catch { /* skip broken images */ }
  }));

  return results;
}

async function injectElevationsSheet(
  xlsxBytes: Uint8Array,
  workbook: XLSX.WorkBook,
  imgDataList: ElevImgData[],
): Promise<Blob> {
  const jszipMod = await import('jszip');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const JSZip = ((jszipMod as any).default ?? jszipMod) as unknown as typeof import('jszip');

  const zip = await JSZip.loadAsync(xlsxBytes);
  let ctXml = await zip.file('[Content_Types].xml')!.async('string');

  const sheetNum = workbook.SheetNames.indexOf('Elevations') + 1;
  const drawingId = sheetNum; // use sheet number as drawing ID to avoid collisions

  let anchors = '';
  let relsEntries = '';

  const IMG_MAX_PX = 180; // max image width in pixels

  for (const [imgIdx, { base64, ext, w, h, et }] of imgDataList.entries()) {
    const rId = `rId${imgIdx + 1}`;
    const mediaFile = `elev_img_${imgIdx + 1}.${ext}`;

    const scale = Math.min(1, IMG_MAX_PX / w);
    const emuW = Math.round(w * scale) * 9525;
    const emuH = Math.round(h * scale) * 9525;

    zip.file(`xl/media/${mediaFile}`, base64, { base64: true });

    relsEntries += `<Relationship Id="${rId}" `
      + `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" `
      + `Target="../media/${mediaFile}"/>`;

    // Row imgIdx+1 (0-indexed), column 3 (D column = "Image")
    const rowIdx = imgIdx + 1;
    anchors += `<xdr:twoCellAnchor editAs="oneCell">`
      + `<xdr:from><xdr:col>3</xdr:col><xdr:colOff>114300</xdr:colOff>`
      + `<xdr:row>${rowIdx}</xdr:row><xdr:rowOff>114300</xdr:rowOff></xdr:from>`
      + `<xdr:to><xdr:col>4</xdr:col><xdr:colOff>0</xdr:colOff>`
      + `<xdr:row>${rowIdx + 1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>`
      + `<xdr:pic><xdr:nvPicPr>`
      + `<xdr:cNvPr id="${imgIdx + 2}" name="${(et.code || et.name || `Elev${imgIdx + 1}`).replace(/[^A-Za-z0-9_]/g, '_')}"/>`
      + `<xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr>`
      + `</xdr:nvPicPr>`
      + `<xdr:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>`
      + `<xdr:spPr><a:xfrm><a:off x="0" y="0"/>`
      + `<a:ext cx="${emuW}" cy="${emuH}"/></a:xfrm>`
      + `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>`
      + `</xdr:pic><xdr:clientData/></xdr:twoCellAnchor>`;

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

// Export Door Schedule to Excel
export const exportDoorScheduleToExcel = async (
  doors: Door[],
  config: DoorScheduleExportConfig,
  projectName: string,
  elevationTypes: ElevationType[] = [],
): Promise<void> => {
  const workbook = XLSX.utils.book_new();

  // Build main data
  const headers = buildDoorScheduleHeaders(config.columns);
  const dataRows = doors.map(door => buildDoorScheduleRow(door, config.columns, elevationTypes));

  const wsData: unknown[][] = [];

  if (config.includeHeader) {
    wsData.push(...buildMetadataRows({ reportTitle: 'Door Schedule', projectName, itemCount: doors.length }));
  }

  wsData.push(headers);
  wsData.push(...dataRows);

  const worksheet = XLSX.utils.aoa_to_sheet(wsData);

  worksheet['!cols'] = contentAwareColWidths(headers, dataRows);
  if (config.includeHeader) {
    applyMetadataStyles(worksheet, headers.length);
    applyHeaderRowAt(worksheet, 3, headers.length);
    applyFreezeAt(worksheet, 4);
  } else {
    applyHeaderRowAt(worksheet, 0, headers.length);
    applyFreezeAt(worksheet, 1);
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Door Schedule');

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

  const filename = buildExportFilename(projectName, 'door-schedule', 'xlsx');
  const needElevations = config.columns.additional.includes('elevationImageUrl') && elevationTypes.length > 0;

  if (!needElevations) {
    XLSX.writeFile(workbook, filename, { cellStyles: true });
    return;
  }

  // Fetch elevation images used by these doors
  const imgDataList = await fetchElevationImages(doors, elevationTypes);

  if (imgDataList.length === 0) {
    XLSX.writeFile(workbook, filename, { cellStyles: true });
    return;
  }

  // Add "Elevations" sheet with one row per elevation type (images injected via OOXML below)
  const elevHeaders = ['ID', 'Code', 'Name', 'Image'];
  const elevRows = imgDataList.map(({ et }) => [et.id, et.code || '', et.name || '', '← see image']);
  const elevSheetData = [elevHeaders, ...elevRows];
  const elevSheet = XLSX.utils.aoa_to_sheet(elevSheetData);
  elevSheet['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 28 }, { wch: 28 }];
  // Row height ~135pt ≈ 180px so images have room
  const ROW_PT = 135;
  elevSheet['!rows'] = [{ hpt: 20 }, ...imgDataList.map(() => ({ hpt: ROW_PT }))];
  applyHeaderRowAt(elevSheet, 0, elevHeaders.length);
  XLSX.utils.book_append_sheet(workbook, elevSheet, 'Elevations');

  // Write workbook to bytes (includes the Elevations sheet skeleton)
  const xlsxBytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx', cellStyles: true }) as Uint8Array;

  // Inject actual images into the Elevations sheet via OOXML
  const finalBlob = await injectElevationsSheet(xlsxBytes, workbook, imgDataList);
  saveAs(finalBlob, filename);
};
