import React, { useState, useMemo, useCallback } from 'react';
import {
    Settings2, FileSpreadsheet, FileText, Eye, Download,
    ChevronDown, ChevronRight,
} from 'lucide-react';
import { Door, HardwareSet, HardwareItem } from '../types';


// ─── Exported types ───────────────────────────────────────────────────────────

export interface HardwareSetExportConfig {
    requiredColumns: string[];
    optionalColumns: string[];
    groupBy: 'set' | 'type' | 'manufacturer' | 'flat';
    usageDisplay: string[];
    format: 'xlsx' | 'pdf';
    includeSetSummary: boolean;
    includeCostSummary: boolean;
    includeProcurement: boolean;
}

// ─── Local types ──────────────────────────────────────────────────────────────

interface HardwareSetConfigProps {
    doors: Door[];
    hardwareSets: HardwareSet[];
    projectName: string;
    onBack: () => void;
    onExport?: (config: HardwareSetExportConfig) => void;
}

type GroupByOption = 'set' | 'type' | 'manufacturer' | 'flat';
type ExportFormat = 'xlsx' | 'pdf';

interface HardwareItemUsage {
    item: HardwareItem;
    doorTags: string[];
    totalQuantity: number;
    sets: string[];
}

interface HardwareGroup {
    label: string;
    items: HardwareItemUsage[];
    /** Door tags for the whole group — set only in "By Hardware Set" mode */
    groupDoorTags?: string[];
    /** Sum of basic_information.QUANTITY across all doors in the group */
    groupTotalQuantity?: number;
}

// ─── Static config ────────────────────────────────────────────────────────────

// 'usage' is shown in the group header, not as a table column.
const REQUIRED_COLUMN_DEFS = [
    { id: 'name',         label: 'Item Name',    desc: 'Hardware item name/description'          },
    { id: 'description',  label: 'Description',  desc: 'Detailed specifications'                 },
    { id: 'manufacturer', label: 'Manufacturer', desc: 'Brand/supplier name'                     },
    { id: 'finish',       label: 'Finish',       desc: 'Color/coating specification'             },
    { id: 'quantity',     label: 'Quantity',     desc: 'Total qty across all assigned doors'     },
];

const GROUPING_OPTIONS: { id: GroupByOption; label: string; desc: string }[] = [
    { id: 'set',          label: 'By Hardware Set',  desc: 'One table per hardware set'            },
    { id: 'type',         label: 'By Item Type',     desc: 'Group by category (Hinges, Locksets…)' },
    { id: 'manufacturer', label: 'By Manufacturer',  desc: 'Group by brand/supplier'               },
    { id: 'flat',         label: 'Flat List',        desc: 'No grouping, single table'             },
];

const USAGE_OPTIONS = [
    { id: 'all',   label: 'Show all door tags', example: '101, 102, 103, 201...' },
    { id: 'count', label: 'Show count only',    example: 'Used in 6 doors'       },
];

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Extract the hardware set name from a door.
 * Priority: assignedHardwareSet.name (the merged/matched PDF set name) first,
 * then raw schedule values as fallback.
 * This is critical because the Excel schedule may say "AD07b" while the PDF set
 * is named "AD07c" — the merge resolved the correct name into assignedHardwareSet.
 */
function getDoorHwSetName(door: Door): string | null {
    return (
        door.assignedHardwareSet?.name?.trim() ||
        (door.sections as unknown as Record<string, Record<string, string | undefined>> | undefined)
            ?.hardware?.['HARDWARE SET']?.trim() ||
        door.providedHardwareSet?.trim() ||
        null
    );
}

/**
 * Formats door info for the group header.
 *
 * 'all'   → comma-separated door tags: "1109, 1111, 2727A, 2727C"
 * 'count' → sum of basic_information.QUANTITY: "Qty: 4"
 *            (a door with QUANTITY=2 counts as 2, not 1)
 * both    → "1109, 1111, 2727A, 2727C (Qty: 4)"
 * neither → '' (nothing shown)
 */
function formatDoorTags(doorTags: string[], display: string[], totalQuantity?: number): string {
    if (doorTags.length === 0) return '';
    const showAll   = display.includes('all');
    const showCount = display.includes('count');
    if (!showAll && !showCount) return '';

    const qtyStr = totalQuantity !== undefined ? `Qty: ${totalQuantity}` : `Qty: ${doorTags.length}`;

    if (showAll && showCount) return `${doorTags.join(', ')} (${qtyStr})`;
    if (showAll)              return doorTags.join(', ');
    return qtyStr; // showCount only
}

function getItemValue(usage: HardwareItemUsage, colId: string): string {
    switch (colId) {
        case 'name':         return usage.item.name         || '—';
        case 'description':  return usage.item.description  || '—';
        case 'manufacturer': return usage.item.manufacturer || '—';
        case 'finish':       return usage.item.finish       || '—';
        case 'quantity':     return usage.totalQuantity > 0 ? String(usage.totalQuantity) : '—';
        default:             return '—';
    }
}

/**
 * Build groups for "By Hardware Set" mode.
 * Each set becomes one group; items come directly from set.items with door tags
 * computed only for doors assigned to THAT set (not merged across sets).
 */
function buildSetGroups(hardwareSets: HardwareSet[], doors: Door[]): HardwareGroup[] {
    return hardwareSets
        .map(set => {
            const setName = set.name.toLowerCase();
            const setDoors = doors.filter(d => getDoorHwSetName(d)?.toLowerCase() === setName);
            const doorTags = setDoors.map(d => d.doorTag);
            // Sum of basic_information.QUANTITY across all doors for this set.
            // door.quantity is already parsed from that field by transformFromFinalJson.
            const groupTotalQuantity = setDoors.reduce((sum, d) => sum + (d.quantity || 1), 0);

            const items: HardwareItemUsage[] = set.items.map(item => ({
                item,
                doorTags,
                // multipliedQuantity from the final JSON = qty × door count for this set
                totalQuantity: item.multipliedQuantity ?? item.quantity,
                sets: [set.name],
            }));
            return { label: set.name, items, groupDoorTags: doorTags, groupTotalQuantity };
        })
        .filter(g => g.items.length > 0);
}

function buildHardwareGroups(
    hardwareSets: HardwareSet[],
    doors: Door[],
    usageStats: HardwareItemUsage[],
    groupBy: GroupByOption,
): HardwareGroup[] {
    if (groupBy === 'set')  return buildSetGroups(hardwareSets, doors);
    if (groupBy === 'flat') return [{ label: 'All Items', items: usageStats }];

    if (groupBy === 'manufacturer') {
        const map = new Map<string, HardwareItemUsage[]>();
        for (const u of usageStats) {
            const key = u.item.manufacturer?.trim() || '(No Manufacturer)';
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(u);
        }
        return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
    }

    // groupBy === 'type' — derive from first word of item name
    const map = new Map<string, HardwareItemUsage[]>();
    for (const u of usageStats) {
        const key = u.item.name?.split(' ')[0]?.toUpperCase() || '(Other)';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(u);
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const HardwareGroupTable: React.FC<{
    group: HardwareGroup;
    requiredColumns: string[];
    usageDisplay: string[];
    index: number;
    total: number;
    format: ExportFormat;
}> = ({ group, requiredColumns, usageDisplay, index, total, format }) => {
    const [collapsed, setCollapsed] = useState(false);
    const isPdf = format === 'pdf';

    // Door tags for this group (only populated for "By Hardware Set" grouping).
    // groupTotalQuantity is the sum of basic_information.QUANTITY across all doors.
    const doorTagText = group.groupDoorTags
        ? formatDoorTags(group.groupDoorTags, usageDisplay, group.groupTotalQuantity)
        : '';

    // 'usage' is shown in the header — exclude it from table columns
    const tableColumns = requiredColumns.filter(c => c !== 'usage');

    return (
        <div className={`rounded-lg overflow-hidden border ${
            isPdf ? 'border-gray-200 bg-white shadow-md' : 'border-[var(--border)] bg-[var(--bg)]'
        }`}>
            {/* Group header */}
            <button
                onClick={() => setCollapsed(c => !c)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                    isPdf
                        ? 'bg-gray-50 hover:bg-gray-100 border-b border-gray-200'
                        : 'bg-[var(--primary-bg)] hover:bg-[var(--primary-bg-hover)] border-b border-[var(--primary-border)]'
                }`}
            >
                {/* Left: set name + door tags */}
                <div className="flex items-center gap-2.5 min-w-0">
                    {collapsed
                        ? <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${isPdf ? 'text-gray-400' : 'text-[var(--primary-text-muted)]'}`} />
                        : <ChevronDown  className={`w-3.5 h-3.5 flex-shrink-0 ${isPdf ? 'text-gray-400' : 'text-[var(--primary-text-muted)]'}`} />
                    }
                    <span className={`text-xs font-semibold flex-shrink-0 ${isPdf ? 'text-gray-700' : 'text-[var(--primary-text)]'}`}>
                        {group.label}
                    </span>
                    {doorTagText && (
                        <>
                            <span className={`text-[10px] flex-shrink-0 ${isPdf ? 'text-gray-300' : 'text-[var(--primary-border)]'}`}>|</span>
                            <span className={`text-[10px] truncate ${isPdf ? 'text-gray-500' : 'text-[var(--primary-text-muted)]'}`}>
                                {doorTagText}
                            </span>
                        </>
                    )}
                </div>
                {/* Right: position + item count */}
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <span className={`text-[10px] ${isPdf ? 'text-gray-400' : 'text-[var(--text-faint)]'}`}>{index + 1} / {total}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isPdf
                            ? 'bg-white border border-gray-200 text-gray-500'
                            : 'bg-[var(--bg)] border border-[var(--primary-border)] text-[var(--primary-text-muted)]'
                    }`}>
                        {group.items.length} item{group.items.length !== 1 ? 's' : ''}
                    </span>
                </div>
            </button>

            {/* Table */}
            {!collapsed && (
                <div className="overflow-x-auto animate-fadeIn">
                    {tableColumns.length === 0 ? (
                        <p className="px-4 py-6 text-xs text-center text-[var(--text-faint)]">No columns selected.</p>
                    ) : (
                        <table className="min-w-full border-collapse text-xs">
                            <thead>
                                <tr className={isPdf ? 'bg-gray-100' : 'bg-[var(--bg-subtle)]'}>
                                    {tableColumns.map(col => {
                                        const def = REQUIRED_COLUMN_DEFS.find(d => d.id === col);
                                        return (
                                            <th key={col} className={`px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider whitespace-nowrap border-b ${
                                                isPdf
                                                    ? 'text-gray-500 border-gray-200'
                                                    : 'text-[var(--text-faint)] border-[var(--border)]'
                                            }`}>
                                                {def?.label ?? col}
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {group.items.map((usage, idx) => (
                                    <tr key={idx} className={
                                        isPdf
                                            ? idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                            : idx % 2 === 0 ? 'bg-[var(--bg)]' : 'bg-[var(--bg-subtle)]/50'
                                    }>
                                        {tableColumns.map(col => {
                                            const val = getItemValue(usage, col);
                                            return (
                                                <td key={col} className={`px-3 py-2 whitespace-nowrap border-b ${
                                                    isPdf
                                                        ? 'text-gray-700 border-gray-100'
                                                        : 'text-[var(--text-secondary)] border-[var(--border-subtle)]'
                                                }`}>
                                                    {val === '—'
                                                        ? <span className={isPdf ? 'text-gray-300' : 'text-[var(--text-faint)]'}>—</span>
                                                        : val
                                                    }
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

const HardwareSetConfig: React.FC<HardwareSetConfigProps> = ({
    doors,
    hardwareSets,
    projectName,
    onExport,
}) => {
    // ── State ─────────────────────────────────────────────────────────────────
    const [requiredColumns, setRequiredColumns] = useState<string[]>(
        REQUIRED_COLUMN_DEFS.map(c => c.id),
    );
    const [groupBy, setGroupBy]                 = useState<GroupByOption>('set');
    const [usageDisplay, setUsageDisplay]       = useState<string[]>(['all']);
    const [format, setFormat]                   = useState<ExportFormat>('xlsx');
    const [includeSetSummary, setIncludeSetSummary]   = useState(true);
    const [includeCostSummary, setIncludeCostSummary] = useState(true);
    const [includeProcurement, setIncludeProcurement] = useState(false);
    const [previewReady, setPreviewReady]       = useState(false);

    // ── Usage stats (for flat / manufacturer / type groupings) ───────────────
    // Deduplicates items across all sets using all 4 identifying fields.
    // Accumulates multipliedQuantity (qty × doors for that set) so totals
    // reflect the real procurement count across every set the item appears in.
    const usageStats = useMemo(() => {
        const map = new Map<string, HardwareItemUsage>();
        hardwareSets.forEach(set => {
            const setName = set.name.toLowerCase();
            const doorsWithSet = doors.filter(d => getDoorHwSetName(d)?.toLowerCase() === setName);
            set.items.forEach(item => {
                const key = `${item.name}|${item.description || ''}|${item.manufacturer || ''}|${item.finish || ''}`;
                if (!map.has(key)) map.set(key, { item, doorTags: [], totalQuantity: 0, sets: [] });
                const usage = map.get(key)!;
                doorsWithSet.forEach(door => {
                    if (!usage.doorTags.includes(door.doorTag)) usage.doorTags.push(door.doorTag);
                });
                // Sum multipliedQuantity (qty × door count for this set), falling back to
                // qty × matched door count if multipliedQuantity isn't available.
                usage.totalQuantity += item.multipliedQuantity ?? (item.quantity * doorsWithSet.length);
                if (!usage.sets.includes(set.name)) usage.sets.push(set.name);
            });
        });
        return Array.from(map.values());
    }, [doors, hardwareSets]);

    // ── Derived groups ────────────────────────────────────────────────────────
    const groups = useMemo(
        () => buildHardwareGroups(hardwareSets, doors, usageStats, groupBy),
        [hardwareSets, doors, usageStats, groupBy],
    );

    // ── Handlers ──────────────────────────────────────────────────────────────
    const toggleRequiredColumn = useCallback((id: string) => {
        setRequiredColumns(p => p.includes(id) ? p.filter(c => c !== id) : [...p, id]);
        setPreviewReady(false);
    }, []);

    const toggleUsageDisplay = useCallback((id: string) => {
        setUsageDisplay(p => p.includes(id) ? p.filter(c => c !== id) : [...p, id]);
        setPreviewReady(false);
    }, []);

    const handleGroupByChange = useCallback((val: GroupByOption) => {
        setGroupBy(val);
        setPreviewReady(false);
    }, []);

    const handleFormatChange = useCallback((f: ExportFormat) => {
        setFormat(f);
        setPreviewReady(false);
    }, []);

    const handleGeneratePreview = () => setPreviewReady(true);

    // Download uses the same `groups` memo as the preview — guaranteed identical output.
    const handleDownload = useCallback(async () => {
        const safeProjectName = (projectName || 'Hardware_Set_Report').replace(/[/\\?%*:|"<>]/g, '_');
        const tableCols = requiredColumns.filter(c => c !== 'usage');
        const colDefs = REQUIRED_COLUMN_DEFS.filter(c => tableCols.includes(c.id));

        if (format === 'xlsx') {
            const XLSX = await import('xlsx');
            const wsData: unknown[][] = [
                [projectName || 'Hardware Set Report'],
                [`Generated: ${new Date().toLocaleDateString()}`],
                [],
            ];
            for (const group of groups) {
                const doorTagText = group.groupDoorTags
                    ? formatDoorTags(group.groupDoorTags, usageDisplay, group.groupTotalQuantity)
                    : '';
                wsData.push([doorTagText ? `${group.label}  —  ${doorTagText}` : group.label]);
                wsData.push(colDefs.map(c => c.label));
                for (const usage of group.items) {
                    wsData.push(colDefs.map(c => getItemValue(usage, c.id)));
                }
                wsData.push([]);
            }
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            ws['!cols'] = colDefs.map(c => ({
                wch: c.id === 'description' ? 45 : c.id === 'name' ? 35 : 18,
            }));
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Hardware Sets');
            XLSX.writeFile(wb, `${safeProjectName}.xlsx`);
            return;
        }

        if (format === 'pdf') {
            const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
                import('jspdf'),
                import('jspdf-autotable'),
            ]);
            const doc     = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const headers = colDefs.map(c => c.label);
            let isFirst   = true;

            for (const group of groups) {
                if (!isFirst) doc.addPage();
                isFirst = false;

                const doorTagText = group.groupDoorTags
                    ? formatDoorTags(group.groupDoorTags, usageDisplay, group.groupTotalQuantity)
                    : '';

                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.text(projectName || 'Hardware Set Report', 14, 14);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100);
                const subtitle = doorTagText ? `${group.label}  —  ${doorTagText}` : group.label;
                doc.text(`${subtitle}  ·  ${group.items.length} item${group.items.length !== 1 ? 's' : ''}`, 14, 20);
                doc.setTextColor(0);

                autoTable(doc, {
                    startY: 25,
                    head: [headers],
                    body: group.items.map(usage =>
                        colDefs.map(c => getItemValue(usage, c.id) || '—'),
                    ),
                    styles:      { fontSize: 6.5, cellPadding: 1.8, overflow: 'linebreak' },
                    headStyles:  { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 6.5 },
                    alternateRowStyles: { fillColor: [248, 250, 252] },
                    margin: { left: 14, right: 14 },
                });
            }
            doc.save(`${safeProjectName}.pdf`);
        }
    }, [groups, requiredColumns, usageDisplay, format, projectName]);

    // ─────────────────────────────────────────────────────────────────────────

    return (
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
                            {([
                                { id: 'xlsx' as const, Icon: FileSpreadsheet, label: 'Excel' },
                                { id: 'pdf'  as const, Icon: FileText,        label: 'PDF'   },
                            ]).map(({ id, Icon, label }, idx) => (
                                <button
                                    key={id}
                                    onClick={() => handleFormatChange(id)}
                                    className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold transition-all ${
                                        idx > 0 ? 'border-l border-[var(--border)]' : ''
                                    } ${
                                        format === id
                                            ? 'bg-[var(--primary-action)] text-white border-l-transparent'
                                            : 'bg-[var(--bg)] text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]'
                                    }`}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Columns ── */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Columns</p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => { setRequiredColumns(REQUIRED_COLUMN_DEFS.map(c => c.id)); setPreviewReady(false); }}
                                    className="text-[10px] text-[var(--primary-text)] hover:underline font-medium"
                                >
                                    All
                                </button>
                                <span className="text-[var(--border-strong)] text-[10px]">·</span>
                                <button
                                    onClick={() => { setRequiredColumns([]); setPreviewReady(false); }}
                                    className="text-[10px] text-[var(--text-faint)] hover:underline"
                                >
                                    None
                                </button>
                            </div>
                        </div>
                        <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--bg)]">
                            {REQUIRED_COLUMN_DEFS.map(col => (
                                <label key={col.id} className="flex items-start gap-2.5 cursor-pointer px-3 py-2 hover:bg-[var(--primary-bg)] transition-colors group border-b border-[var(--border)] last:border-b-0">
                                    <input
                                        type="checkbox"
                                        checked={requiredColumns.includes(col.id)}
                                        onChange={() => toggleRequiredColumn(col.id)}
                                        className="w-3.5 h-3.5 rounded border-[var(--border-strong)] text-[var(--primary-action)] focus:ring-[var(--primary-ring)] cursor-pointer flex-shrink-0 mt-0.5"
                                    />
                                    <div className="min-w-0">
                                        <span className="text-xs font-medium text-[var(--text-secondary)] group-hover:text-[var(--primary-text)] transition-colors block truncate">{col.label}</span>
                                        <span className="text-[10px] text-[var(--text-faint)] block truncate">{col.desc}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* ── Group By ── */}
                    <div>
                        <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider mb-2">Group By</p>
                        <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--bg)]">
                            {GROUPING_OPTIONS.map(opt => (
                                <label key={opt.id} className="flex items-start gap-2.5 cursor-pointer px-3 py-2 hover:bg-[var(--primary-bg)] transition-colors group border-b border-[var(--border)] last:border-b-0">
                                    <input
                                        type="radio"
                                        name="groupBy"
                                        value={opt.id}
                                        checked={groupBy === opt.id}
                                        onChange={() => handleGroupByChange(opt.id)}
                                        className="w-3.5 h-3.5 border-[var(--border-strong)] text-[var(--primary-action)] focus:ring-[var(--primary-ring)] cursor-pointer flex-shrink-0 mt-0.5"
                                    />
                                    <div className="min-w-0">
                                        <span className="text-xs font-medium text-[var(--text-secondary)] group-hover:text-[var(--primary-text)] transition-colors block">{opt.label}</span>
                                        <span className="text-[10px] text-[var(--text-faint)] block">{opt.desc}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* ── Usage Display ── */}
                    <div>
                        <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider mb-2">Usage Display</p>
                        <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--bg)]">
                            {USAGE_OPTIONS.map(opt => (
                                <label key={opt.id} className="flex items-start gap-2.5 cursor-pointer px-3 py-2 hover:bg-[var(--primary-bg)] transition-colors group border-b border-[var(--border)] last:border-b-0">
                                    <input
                                        type="checkbox"
                                        checked={usageDisplay.includes(opt.id)}
                                        onChange={() => toggleUsageDisplay(opt.id)}
                                        className="w-3.5 h-3.5 rounded border-[var(--border-strong)] text-[var(--primary-action)] focus:ring-[var(--primary-ring)] cursor-pointer flex-shrink-0 mt-0.5"
                                    />
                                    <div className="min-w-0">
                                        <span className="text-xs font-medium text-[var(--text-secondary)] group-hover:text-[var(--primary-text)] transition-colors block">{opt.label}</span>
                                        <span className="text-[10px] font-mono bg-[var(--bg-muted)] text-[var(--text-faint)] px-1.5 py-0.5 rounded mt-0.5 inline-block">{opt.example}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* ── Include ── */}
                    <div>
                        <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider mb-2">Include</p>
                        <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--bg)]">
                            {[
                                { key: 'setSum',  label: 'Hardware Set Summary',  checked: includeSetSummary,  onChange: setIncludeSetSummary  },
                                { key: 'costSum', label: 'Total Cost Summary',    checked: includeCostSummary, onChange: setIncludeCostSummary },
                                { key: 'proc',    label: 'Procurement Checklist', checked: includeProcurement, onChange: setIncludeProcurement },
                            ].map(opt => (
                                <label key={opt.key} className="flex items-center gap-2.5 cursor-pointer px-3 py-2 hover:bg-[var(--primary-bg)] transition-colors group border-b border-[var(--border)] last:border-b-0">
                                    <input
                                        type="checkbox"
                                        checked={opt.checked}
                                        onChange={(e) => opt.onChange(e.target.checked)}
                                        className="w-3.5 h-3.5 rounded border-[var(--border-strong)] text-[var(--primary-action)] focus:ring-[var(--primary-ring)] cursor-pointer flex-shrink-0"
                                    />
                                    <span className="text-xs text-[var(--text-secondary)] group-hover:text-[var(--primary-text)] transition-colors">{opt.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Sticky footer actions */}
                <div className="border-t border-[var(--border)] p-4 space-y-2 bg-[var(--bg-subtle)]">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--bg-muted)] text-[var(--text-muted)]">
                            {requiredColumns.length} col{requiredColumns.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--bg-muted)] text-[var(--text-muted)]">
                            {usageStats.length} item{usageStats.length !== 1 ? 's' : ''}
                        </span>
                        {groups.length > 1 && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--primary-bg)] border border-[var(--primary-border)] text-[var(--primary-text)]">
                                {groups.length} group{groups.length !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={handleGeneratePreview}
                        disabled={requiredColumns.length === 0 || usageStats.length === 0}
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
                <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)] flex-shrink-0">
                    <div className="flex items-center gap-2">
                        {format === 'pdf'
                            ? <FileText        className="w-4 h-4 text-[var(--text-muted)]" />
                            : <FileSpreadsheet className="w-4 h-4 text-[var(--text-muted)]" />
                        }
                        <span className="text-xs font-semibold text-[var(--text)]">
                            {previewReady
                                ? `Preview — ${format === 'pdf' ? 'PDF' : 'Excel'}`
                                : 'Preview'
                            }
                        </span>
                        {previewReady && (
                            <span className="text-[10px] text-[var(--text-faint)] ml-1">
                                {usageStats.length} items · {requiredColumns.length} cols · {groups.length} group{groups.length !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                    {previewReady && (
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--primary-action)] hover:bg-[var(--primary-action-hover)] text-white text-xs font-semibold transition-all shadow-sm"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Export {format === 'pdf' ? 'PDF' : 'Excel'}
                        </button>
                    )}
                </div>

                {/* Preview content area */}
                <div className={`flex-1 overflow-y-auto ${previewReady && format === 'pdf' ? 'bg-[#f0f0f0] dark:bg-[#1a1a1a]' : 'bg-[var(--bg)]'}`}>
                    {!previewReady ? (
                        /* ── Empty state ── */
                        <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 px-8 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-[var(--bg-muted)] flex items-center justify-center">
                                {format === 'pdf'
                                    ? <FileText        className="w-7 h-7 text-[var(--text-faint)]" />
                                    : <FileSpreadsheet className="w-7 h-7 text-[var(--text-faint)]" />
                                }
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-sm font-semibold text-[var(--text)]">
                                    {usageStats.length === 0 ? 'No hardware data loaded' : 'Ready to preview'}
                                </p>
                                <p className="text-xs text-[var(--text-faint)] max-w-xs leading-relaxed">
                                    {usageStats.length === 0
                                        ? 'Assign hardware sets to doors in this project first.'
                                        : 'Configure your columns and grouping on the left, then click Generate Preview.'
                                    }
                                </p>
                            </div>
                            {usageStats.length > 0 && requiredColumns.length > 0 && (
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
                                    <p className="text-base font-bold text-gray-800 dark:text-[var(--text)]">{projectName || 'Hardware Set Report'}</p>
                                    <p className="text-xs text-gray-400 dark:text-[var(--text-faint)] mt-0.5">
                                        {usageStats.length} items · {hardwareSets.length} sets · Generated {new Date().toLocaleDateString()}
                                    </p>
                                </div>
                            )}
                            {groups.map((group, idx) => (
                                <HardwareGroupTable
                                    key={group.label}
                                    group={group}
                                    requiredColumns={requiredColumns}
                                    usageDisplay={usageDisplay}
                                    index={idx}
                                    total={groups.length}
                                    format={format}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HardwareSetConfig;
