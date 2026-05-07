import React, { useMemo, useState, useCallback } from 'react';
import {
    Plus, X, ChevronDown, ChevronRight,
    FileSpreadsheet, FileText,
    Download, Settings2, Eye, Table2, Image,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import CollapseAllButton from '@/components/ui/CollapseAllButton';
import { Door, HardwareSet, ElevationType } from '../../types';
import { getDoorQuantity, sumDoorQuantities } from '../../utils/doorUtils';
import { collectGroupElevationTypes } from '../../utils/elevationUtils';
import {
    parseColId, aggregateDoorsBySelectedColumns, getRowValue, deriveColumnGroups,
} from '../../utils/doorScheduleUtils';
import { useDoorAggregation } from '@/hooks/useDoorAggregation';
import { useElevationImages } from '@/hooks/useElevationImages';
import { DoorGroupingControls } from './DoorGroupingControls';
import {
    type SectionKey, type ExportFormat, type DynamicColumnGroup, type DoorGroup, type AggregatedDoorRow,
} from './doorScheduleTypes';


// ─── Exported types (kept for downstream services) ───────────────────────────

export interface DoorScheduleExportConfig {
    format?: string;
    columns: {
        basic: string[];
        dimensions: string[];
        materials: string[];
        fireSafety: string[];
        hardware: string[];
        additional: string[];
    };
    includeHeader: boolean;
    includeSummary: boolean;
}

// ─── Local types ──────────────────────────────────────────────────────────────

interface DoorScheduleConfigProps {
    doors: Door[];
    hardwareSets?: HardwareSet[];
    elevationTypes?: ElevationType[];
    projectName: string;
    onUpdateDoors?: (doors: Door[]) => void;
    onBack?: () => void;
    onExport?: (config: DoorScheduleExportConfig) => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Collapsible accordion section for the left panel column picker. */
const ColumnAccordion: React.FC<{
    group: DynamicColumnGroup;
    selectedColumns: string[];
    onToggle: (id: string) => void;
    onSelectAll: (sectionKey: SectionKey) => void;
    onClearAll: (sectionKey: SectionKey) => void;
}> = ({ group, selectedColumns, onToggle, onSelectAll, onClearAll }) => {
    const [open, setOpen] = useState(false);
    const selected = group.cols.filter(c => selectedColumns.includes(c.id)).length;
    const allSelected = selected === group.cols.length;

    return (
        <div className="border border-[var(--border)] rounded-lg overflow-hidden">
            {/* Accordion header */}
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] hover:bg-[var(--bg-subtle)] transition-colors text-left"
            >
                <div className="flex items-center gap-2">
                    {open
                        ? <ChevronDown  className="w-3.5 h-3.5 text-[var(--text-faint)]" />
                        : <ChevronRight className="w-3.5 h-3.5 text-[var(--text-faint)]" />
                    }
                    <span className="text-xs font-semibold text-[var(--text)]">{group.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        selected > 0
                            ? 'bg-[var(--primary-bg)] text-[var(--primary-text)] border border-[var(--primary-border)]'
                            : 'bg-[var(--bg-muted)] text-[var(--text-faint)]'
                    }`}>
                        {selected}/{group.cols.length}
                    </span>
                </div>
            </button>

            {/* Expanded content */}
            {open && (
                <div className="animate-fadeIn">
                    {/* Quick actions */}
                    <div className="flex items-center gap-2 px-3 py-1.5 border-t border-b border-[var(--border)] bg-[var(--bg-subtle)]">
                        <button
                            onClick={() => allSelected ? onClearAll(group.sectionKey) : onSelectAll(group.sectionKey)}
                            className="text-[10px] font-medium text-[var(--primary-text)] hover:underline"
                        >
                            {allSelected ? 'Clear' : 'Select All'}
                        </button>
                    </div>
                    {/* Checkboxes */}
                    <div className="max-h-44 overflow-y-auto bg-[var(--bg)]">
                        {group.cols.map(col => (
                            <label key={col.id} className="flex items-center gap-2.5 cursor-pointer px-3 py-1.5 hover:bg-[var(--primary-bg)] transition-colors group">
                                <input
                                    type="checkbox"
                                    checked={selectedColumns.includes(col.id)}
                                    onChange={() => onToggle(col.id)}
                                    className="w-3.5 h-3.5 rounded border-[var(--border-strong)] text-[var(--primary-action)] focus:ring-[var(--primary-ring)] cursor-pointer flex-shrink-0"
                                />
                                <span className="text-xs text-[var(--text-secondary)] group-hover:text-[var(--primary-text)] transition-colors truncate">
                                    {col.label}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

/** A single collapsible grouped table in the preview panel. */
const GroupedTable: React.FC<{
    group: DoorGroup;
    selectedColumns: string[];
    uniqueData: boolean;
    index: number;
    total: number;
    format: ExportFormat;
    onHide: () => void;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
}> = ({ group, selectedColumns, uniqueData, index, total, format, onHide, isCollapsed, onToggleCollapse }) => {
    const isPdf = format === 'pdf';
    const rows = useMemo(
        () => uniqueData ? aggregateDoorsBySelectedColumns(group.doors, selectedColumns) : group.doors.map(door => ({
            id: door.id,
            doors: [door],
            quantity: getDoorQuantity(door),
            doorTags: door.doorTag,
        })),
        [group.doors, selectedColumns, uniqueData],
    );

    return (
        <div className={`rounded-lg overflow-hidden border ${
            isPdf
                ? 'border-gray-200 bg-white shadow-md'
                : 'border-[var(--border)] bg-[var(--bg)]'
        }`}>
            {/* Group header — div instead of button to allow the inner X button */}
            <div
                role="button"
                tabIndex={0}
                onClick={onToggleCollapse}
                onKeyDown={e => e.key === 'Enter' || e.key === ' ' ? onToggleCollapse() : undefined}
                className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors cursor-pointer ${
                    isPdf
                        ? 'bg-gray-50 hover:bg-gray-100 border-b border-gray-200'
                        : 'bg-[var(--primary-bg)] hover:bg-[var(--primary-bg-hover)] border-b border-[var(--primary-border)]'
                }`}
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    {isCollapsed
                        ? <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${isPdf ? 'text-gray-400' : 'text-[var(--primary-text-muted)]'}`} />
                        : <ChevronDown  className={`w-3.5 h-3.5 flex-shrink-0 ${isPdf ? 'text-gray-400' : 'text-[var(--primary-text-muted)]'}`} />
                    }
                    {group.breadcrumb.length === 0 ? (
                        <span className={`text-xs font-semibold ${isPdf ? 'text-gray-700' : 'text-[var(--primary-text)]'}`}>All Doors</span>
                    ) : (
                        <span className={`text-xs font-semibold truncate ${isPdf ? 'text-gray-700' : 'text-[var(--primary-text)]'}`}>
                            {group.breadcrumb.map((c, i) => (
                                <React.Fragment key={i}>
                                    {i > 0 && <span className={`mx-1.5 font-normal ${isPdf ? 'text-gray-400' : 'text-[var(--primary-text-muted)]'}`}>›</span>}
                                    {c}
                                </React.Fragment>
                            ))}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <span className={`text-[10px] ${isPdf ? 'text-gray-400' : 'text-[var(--text-faint)]'}`}>{index + 1} / {total}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isPdf
                            ? 'bg-white border border-gray-200 text-gray-500'
                            : 'bg-[var(--bg)] border border-[var(--primary-border)] text-[var(--primary-text-muted)]'
                    }`}>
                        {sumDoorQuantities(group.doors)} door{sumDoorQuantities(group.doors) !== 1 ? 's' : ''}
                    </span>
                    <button
                        onClick={e => { e.stopPropagation(); onHide(); }}
                        className={`p-0.5 rounded transition-colors ${
                            isPdf
                                ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
                                : 'text-[var(--text-faint)] hover:text-[var(--text)] hover:bg-[var(--bg-subtle)]'
                        }`}
                        title="Remove this group from preview"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Table */}
            {!isCollapsed && (
                <div className="overflow-x-auto animate-fadeIn">
                    {selectedColumns.length === 0 ? (
                        <p className="px-4 py-6 text-xs text-center text-[var(--text-faint)]">No columns selected.</p>
                    ) : (
                        <table className="min-w-full border-collapse text-xs">
                            <thead>
                                <tr className={isPdf ? 'bg-gray-100' : 'bg-[var(--bg-subtle)]'}>
                                    {selectedColumns.map(col => {
                                        const { colKey } = parseColId(col);
                                        return (
                                            <th key={col} className={`px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider whitespace-nowrap border-b ${
                                                isPdf
                                                    ? 'text-gray-500 border-gray-200'
                                                    : 'text-[var(--text-faint)] border-[var(--border)]'
                                            }`}>
                                                {colKey}
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, idx) => (
                                    <tr key={row.id} className={
                                        isPdf
                                            ? idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                            : idx % 2 === 0 ? 'bg-[var(--bg)]' : 'bg-[var(--bg-subtle)]/50'
                                    }>
                                        {selectedColumns.map(col => {
                                            const val = getRowValue(row as AggregatedDoorRow, col);
                                            return (
                                                <td key={col} className={`px-3 py-2 whitespace-nowrap border-b ${
                                                    isPdf
                                                        ? 'text-gray-700 border-gray-100'
                                                        : 'text-[var(--text-secondary)] border-[var(--border-subtle)]'
                                                }`}>
                                                    {val || <span className={isPdf ? 'text-gray-300' : 'text-[var(--text-faint)]'}>—</span>}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────

const DoorScheduleConfig: React.FC<DoorScheduleConfigProps> = ({
    doors,
    hardwareSets,
    elevationTypes = [],
    projectName,
}) => {
    // ── Filter out excluded doors ─────────────────────────────────────────────
    // A door is only fully excluded from the report when BOTH the door section
    // AND the frame section are set to 'EXCLUDE'. If only the door leaf is
    // excluded, the frame data must still be visible.
    const includedDoors = useMemo(() => doors.filter(d => {
        const sec = (d.sections as unknown as Record<string, Record<string, string | undefined>> | undefined);
        const doorExcluded = (sec?.door?.['DOOR INCLUDE/EXCLUDE'] ?? d.doorIncludeExclude ?? '').toUpperCase() === 'EXCLUDE';
        const frameExcluded = (sec?.frame?.['FRAME INCLUDE/EXCLUDE'] ?? d.frameIncludeExclude ?? '').toUpperCase() === 'EXCLUDE';
        return !(doorExcluded && frameExcluded);
    }), [doors]);

    const excludedCount = sumDoorQuantities(doors) - sumDoorQuantities(includedDoors);

    // ── Column selection ──────────────────────────────────────────────────────
    const columnGroups  = useMemo(() => deriveColumnGroups(includedDoors), [includedDoors]);
    const allColumnIds  = useMemo(() => columnGroups.flatMap(g => g.cols.map(c => c.id)), [columnGroups]);
    const hasSectionData = allColumnIds.length > 0;

    const [selectedColumns, setSelectedColumns] = useState<string[]>(() => {
        const defaults: string[] = [];
        for (const g of columnGroups) defaults.push(...g.cols.slice(0, 3).map(c => c.id));
        return defaults.length > 0 ? defaults : allColumnIds;
    });

    const toggleColumn   = useCallback((id: string) => setSelectedColumns(p => p.includes(id) ? p.filter(c => c !== id) : [...p, id]), []);
    const selectSection  = useCallback((sk: SectionKey) => {
        const g = columnGroups.find(cg => cg.sectionKey === sk);
        if (g) setSelectedColumns(p => [...new Set([...p, ...g.cols.map(c => c.id)])]);
    }, [columnGroups]);
    const clearSection   = useCallback((sk: SectionKey) => {
        const g = columnGroups.find(cg => cg.sectionKey === sk);
        if (g) { const ids = new Set(g.cols.map(c => c.id)); setSelectedColumns(p => p.filter(c => !ids.has(c))); }
    }, [columnGroups]);

    // ── Export / preview state ────────────────────────────────────────────────
    const [format, setFormat]                         = useState<ExportFormat>('excel');
    const [previewReady, setPreviewReady]             = useState(false);
    const [hiddenGroupKeys, setHiddenGroupKeys]       = useState<Set<string>>(new Set());
    const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<Set<string>>(new Set());
    const [isDownloading, setIsDownloading]           = useState(false);

    // ── Grouping ──────────────────────────────────────────────────────────────
    const {
        groupLevels, groups, usedGroupColIds,
        pickerOpen, pickerForLevelId, uniqueData,
        openPicker, handlePickField, setPickerOpen, setUniqueData, removeGroupLevel,
    } = useDoorAggregation({ includedDoors, setPreviewReady });

    // ── Elevation images ──────────────────────────────────────────────────────
    const { showElevationImages, setShowElevationImages, preloadElevationImages } = useElevationImages(elevationTypes);

    const handleGeneratePreview = () => { setHiddenGroupKeys(new Set()); setCollapsedGroupKeys(new Set()); setPreviewReady(true); };
    const handleHideGroup = (key: string) => setHiddenGroupKeys(prev => new Set([...prev, key]));

    const visibleGroupKeys = useMemo(
        () => groups.filter(g => !hiddenGroupKeys.has(g.breadcrumb.join('||') || 'all')).map(g => g.breadcrumb.join('||') || 'all'),
        [groups, hiddenGroupKeys],
    );
    const handleCollapseAll = () => setCollapsedGroupKeys(new Set(visibleGroupKeys));
    const handleExpandAll   = () => setCollapsedGroupKeys(new Set());
    const handleToggleGroup = (key: string) => setCollapsedGroupKeys(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
    });
    const allCollapsed = visibleGroupKeys.length > 0 && visibleGroupKeys.every(k => collapsedGroupKeys.has(k));

    // Reset preview whenever config changes
    const handleColumnChange = (id: string) => { toggleColumn(id); setPreviewReady(false); };
    const handleFormatChange = (f: ExportFormat) => { setFormat(f); setPreviewReady(false); };

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
        const headers = selectedColumns.map(col => parseColId(col).colKey);
        const fileName = (projectName || 'Door_Schedule').replace(/[/\\?%*:|"<>]/g, '_');

        // Respect the same hidden-group filter as the preview panel
        const visibleGroups = groups.filter(g => !hiddenGroupKeys.has(g.breadcrumb.join('||') || 'all'));
        const groupsToExport = visibleGroups.length > 0 ? visibleGroups : [{ breadcrumb: [], doors: includedDoors }];
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
                import('xlsx'),
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
                const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

                // Bold header row
                const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
                for (let c = range.s.c; c <= range.e.c; c++) {
                    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
                    if (cell) cell.s = { font: { bold: true } };
                }

                XLSX.utils.book_append_sheet(wb, ws, sheetName);

                // Collect elevation images for this sheet
                const imgs: ImgPayload[] = [];
                if (showElevationImages) {
                    const groupElevTypes = collectGroupElevationTypes(group.doors, elevationTypes)
                        .filter(et => imageInfoMap.has(et.id));

                    if (groupElevTypes.length > 0) {
                        // Images start 2 rows below the data table (0-indexed for OOXML)
                        let currentRow = group.doors.length + 1 + 2; // header + data + gap
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
            const xlsxBytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array;

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

                const title    = projectName || 'Door-Frame Reports';
                const subtitle = group.breadcrumb.length > 0 ? group.breadcrumb.join(' › ') : 'All Doors';

                doc.setFontSize(11); doc.setFont('helvetica', 'bold');
                doc.text(title, MARGIN, 14);
                doc.setFontSize(8);  doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
                doc.text(`${subtitle}  —  ${sumDoorQuantities(group.doors)} door${sumDoorQuantities(group.doors) !== 1 ? 's' : ''}`, MARGIN, 20);
                doc.setTextColor(0);

                autoTable(doc, {
                    startY: 25,
                    head: [pdfHeaders],
                    body: rowsByGroup[i].map(row =>
                        selectedColumns.map(col => getRowValue(row, col) || '—'),
                    ),
                    tableWidth: USABLE_W,
                    columnStyles: pdfColumnStyles,
                    styles: {
                        fontSize,
                        cellPadding,
                        overflow: 'linebreak',
                    },
                    headStyles: {
                        fillColor: [30, 41, 59],
                        textColor: 255,
                        fontStyle: 'bold',
                        fontSize,
                        halign: 'center',
                    },
                    alternateRowStyles: { fillColor: [248, 250, 252] },
                    margin: { left: MARGIN, right: MARGIN },
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
                            doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
                            doc.text(title, MARGIN, 14);
                            doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
                            doc.text(`${sub}  —  Elevation Types`, MARGIN, 20);
                            doc.setTextColor(0);
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

            doc.save(`${fileName}.pdf`);
        }
        } finally {
            setIsDownloading(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────

    return (
        /* Stretch to fill parent card by negating its p-5 padding */
        <div className="-mx-5 -mb-5 flex h-[78vh]" style={{ borderTop: '1px solid var(--border)' }}>

            {/* ══ LEFT CONFIG SIDEBAR ══════════════════════════════════════════ */}
            <div className="w-72 flex-shrink-0 flex flex-col border-r border-[var(--border)] bg-[var(--bg-subtle)]">

                {/* Sidebar header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
                    <Settings2 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <span className="text-xs font-bold text-[var(--text)] uppercase tracking-wide">Report Settings</span>
                </div>

                {/* Scrollable config area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-5">

                    {/* ── Format toggle ── */}
                    <div>
                        <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider mb-2">Format</p>
                        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
                            <button
                                onClick={() => handleFormatChange('excel')}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-all ${
                                    format === 'excel'
                                        ? 'bg-[var(--primary-action)] text-white'
                                        : 'bg-[var(--bg)] text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]'
                                }`}
                            >
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                                Excel
                            </button>
                            <button
                                onClick={() => handleFormatChange('pdf')}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-all border-l border-[var(--border)] ${
                                    format === 'pdf'
                                        ? 'bg-[var(--primary-action)] text-white border-l-transparent'
                                        : 'bg-[var(--bg)] text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]'
                                }`}
                            >
                                <FileText className="w-3.5 h-3.5" />
                                PDF
                            </button>
                        </div>
                    </div>

                    {/* ── Options ── */}
                    <div>
                        <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider mb-2">Options</p>
                        <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--bg)]">
                            <label className={`flex items-start gap-2.5 px-3 py-2.5 transition-colors group ${
                                elevationTypes.length > 0
                                    ? 'cursor-pointer hover:bg-[var(--primary-bg)]'
                                    : 'cursor-not-allowed opacity-50'
                            }`}>
                                <input
                                    type="checkbox"
                                    checked={showElevationImages}
                                    disabled={elevationTypes.length === 0}
                                    onChange={e => setShowElevationImages(e.target.checked)}
                                    className="w-3.5 h-3.5 rounded border-[var(--border-strong)] text-[var(--primary-action)] focus:ring-[var(--primary-ring)] cursor-pointer flex-shrink-0 mt-0.5 disabled:cursor-not-allowed"
                                />
                                <div className="min-w-0">
                                    <span className="text-xs font-medium text-[var(--text-secondary)] group-hover:text-[var(--primary-text)] transition-colors flex items-center gap-1.5">
                                        <Image className="w-3 h-3 flex-shrink-0" />
                                        Include Elevation Images
                                    </span>
                                    <span className="text-[10px] text-[var(--text-faint)] block mt-0.5">
                                        {elevationTypes.length === 0
                                            ? 'No elevation types configured for this project'
                                            : format === 'pdf'
                                                ? `Thumbnail page appended · ${elevationTypes.length} type${elevationTypes.length !== 1 ? 's' : ''}`
                                                : `Adds "Elevation Types" sheet · ${elevationTypes.length} type${elevationTypes.length !== 1 ? 's' : ''}`
                                        }
                                    </span>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* ── Column picker ── */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Columns</p>
                            <div className="flex items-center gap-2">
                                <button onClick={() => { setSelectedColumns(allColumnIds); setPreviewReady(false); }} className="text-[10px] text-[var(--primary-text)] hover:underline font-medium">All</button>
                                <span className="text-[var(--border-strong)] text-[10px]">·</span>
                                <button onClick={() => { setSelectedColumns([]); setPreviewReady(false); }} className="text-[10px] text-[var(--text-faint)] hover:underline">None</button>
                            </div>
                        </div>

                        {!hasSectionData ? (
                            <div className="text-xs text-[var(--text-faint)] text-center py-6 border border-dashed border-[var(--border)] rounded-lg">
                                Upload an Excel schedule to see columns.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {columnGroups.map(group => group.cols.length > 0 && (
                                    <ColumnAccordion
                                        key={group.sectionKey}
                                        group={group}
                                        selectedColumns={selectedColumns}
                                        onToggle={handleColumnChange}
                                        onSelectAll={selectSection}
                                        onClearAll={clearSection}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── Group By ── */}
                    <DoorGroupingControls
                        groupLevels={groupLevels}
                        groups={groups}
                        pickerOpen={pickerOpen}
                        pickerForLevelId={pickerForLevelId}
                        usedGroupColIds={usedGroupColIds}
                        openPicker={openPicker}
                        removeGroupLevel={removeGroupLevel}
                        handlePickField={handlePickField}
                        onPickerClose={() => setPickerOpen(false)}
                        uniqueData={uniqueData}
                        onUniqueDataChange={setUniqueData}
                        onPreviewReset={() => setPreviewReady(false)}
                    />
                </div>

                {/* Sticky footer actions */}
                <div className="border-t border-[var(--border)] p-4 space-y-2 bg-[var(--bg-subtle)]">
                    {/* Summary pill */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--bg-muted)] text-[var(--text-muted)]">
                            {selectedColumns.length} col{selectedColumns.length !== 1 ? 's' : ''}
                        </span>
                        {groupLevels.length > 0 && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--primary-bg)] border border-[var(--primary-border)] text-[var(--primary-text)]">
                                {groups.length} table{groups.length !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>

                    {excludedCount > 0 && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 text-center">
                            {excludedCount} door{excludedCount !== 1 ? 's' : ''} excluded from report
                        </p>
                    )}
                    <button
                        onClick={handleGeneratePreview}
                        disabled={selectedColumns.length === 0 || includedDoors.length === 0}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[var(--primary-action)] hover:bg-[var(--primary-action-hover)] text-white text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                    >
                        <Eye className="w-3.5 h-3.5" />
                        Generate Preview
                    </button>
                </div>
            </div>

            {/* ══ RIGHT PREVIEW PANEL ══════════════════════════════════════════ */}
            <div className="flex-1 min-w-0 flex flex-col bg-[var(--bg)]">

                {/* Preview panel header */}
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-5 py-3 border-b border-[var(--border)] flex-shrink-0">
                    <div className="flex min-w-0 items-center gap-2">
                        {format === 'pdf'
                            ? <FileText className="w-4 h-4 text-[var(--text-muted)]" />
                            : <Table2   className="w-4 h-4 text-[var(--text-muted)]" />
                        }
                        <span className="shrink-0 text-xs font-semibold text-[var(--text)]">
                            {previewReady ? `Preview — ${format === 'pdf' ? 'PDF' : 'Excel'}` : 'Preview'}
                        </span>
                        {previewReady && (
                            <span className="min-w-0 truncate text-[10px] text-[var(--text-faint)] ml-1">
                                {sumDoorQuantities(includedDoors)} doors · {selectedColumns.length} cols · {groups.length} table{groups.length !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                    <div className="flex justify-self-center">
                        {previewReady && visibleGroupKeys.length > 0 && (
                            <CollapseAllButton
                                allCollapsed={allCollapsed}
                                onCollapseAll={handleCollapseAll}
                                onExpandAll={handleExpandAll}
                            />
                        )}
                    </div>
                    <div className="flex justify-self-end">
                        {previewReady && (
                            <button
                                onClick={handleDownload}
                                disabled={isDownloading}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--primary-action)] hover:bg-[var(--primary-action-hover)] text-white text-xs font-semibold transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed min-w-[120px] justify-center"
                            >
                                {isDownloading
                                    ? <><Spinner size="xs" className="text-white" />Preparing…</>
                                    : <><Download className="w-3.5 h-3.5" />Download {format === 'pdf' ? 'PDF' : 'Excel'}</>
                                }
                            </button>
                        )}
                    </div>
                </div>

                {/* Preview content area */}
                <div className={`flex-1 overflow-y-auto ${previewReady && format === 'pdf' ? 'bg-[#f0f0f0] dark:bg-[#1a1a1a]' : 'bg-[var(--bg)]'}`}>
                    {!previewReady ? (
                        /* ── Empty state ── */
                        <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 px-8 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-[var(--bg-muted)] flex items-center justify-center">
                                {format === 'pdf'
                                    ? <FileText       className="w-7 h-7 text-[var(--text-faint)]" />
                                    : <FileSpreadsheet className="w-7 h-7 text-[var(--text-faint)]" />
                                }
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-sm font-semibold text-[var(--text)]">
                                    {doors.length === 0 ? 'No door data loaded' : 'Ready to preview'}
                                </p>
                                <p className="text-xs text-[var(--text-faint)] max-w-xs leading-relaxed">
                                    {doors.length === 0
                                        ? 'Upload an Excel door schedule to this project first.'
                                        : `Select your columns and grouping on the left, then click Generate Preview to see your ${format === 'pdf' ? 'PDF' : 'Excel'} report.`
                                    }
                                </p>
                            </div>
                            {includedDoors.length > 0 && selectedColumns.length > 0 && (
                                <button
                                    onClick={handleGeneratePreview}
                                    className="mt-1 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--primary-action)] hover:bg-[var(--primary-action-hover)] text-white text-xs font-semibold transition-all shadow-sm"
                                >
                                    <Eye className="w-3.5 h-3.5" />
                                    Generate Preview
                                </button>
                            )}
                        </div>
                    ) : (
                        /* ── Preview tables ── */
                        <div className={`p-5 space-y-4 animate-fadeIn ${format === 'pdf' ? 'max-w-[900px] mx-auto' : ''}`}>
                            {/* PDF header banner */}
                            {format === 'pdf' && (
                                <div className="bg-white dark:bg-[#1e1e1e] rounded-lg border border-gray-200 dark:border-[var(--border)] shadow-sm px-5 py-4 mb-5">
                                    <p className="text-base font-bold text-gray-800 dark:text-[var(--text)]">{projectName || 'Door-Frame Reports'}</p>
                                    <p className="text-xs text-gray-400 dark:text-[var(--text-faint)] mt-0.5">
                                        {sumDoorQuantities(includedDoors)} doors · Generated {new Date().toLocaleDateString()}
                                        {excludedCount > 0 && ` · ${excludedCount} excluded`}
                                    </p>
                                </div>
                            )}

                            {groups
                                .filter(g => !hiddenGroupKeys.has(g.breadcrumb.join('||') || 'all'))
                                .map((group, idx, visible) => {
                                    const key = group.breadcrumb.join('||') || 'all';
                                    return (
                                        <GroupedTable
                                            key={key}
                                            group={group}
                                            selectedColumns={selectedColumns}
                                            uniqueData={uniqueData}
                                            index={idx}
                                            total={visible.length}
                                            format={format}
                                            onHide={() => handleHideGroup(key)}
                                            isCollapsed={collapsedGroupKeys.has(key)}
                                            onToggleCollapse={() => handleToggleGroup(key)}
                                        />
                                    );
                                })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DoorScheduleConfig;
