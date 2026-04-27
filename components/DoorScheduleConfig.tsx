import React, { useMemo, useState, useCallback } from 'react';
import {
    Plus, X, ChevronDown, ChevronRight,
    Layers, FileSpreadsheet, FileText,
    Download, Settings2, Eye, Table2, Image,
} from 'lucide-react';
import { Door, HardwareSet, ElevationType } from '../types';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

// ─── Elevation image helpers ──────────────────────────────────────────────────

async function imageToDataUrl(src: string): Promise<string | null> {
    try {
        if (src.startsWith('data:')) return src;
        const resp = await fetch(src);
        if (!resp.ok) return null;
        const blob = await resp.blob();
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch { return null; }
}

function resolveElevationType(door: Door, types: ElevationType[]): ElevationType | undefined {
    const id = door.elevationTypeId;
    if (!id) return undefined;
    return types.find(t => t.id === id || t.code === id || t.name === id);
}

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

type SectionKey = 'basic_information' | 'door' | 'frame' | 'hardware';
type ExportFormat = 'excel' | 'pdf';

interface DynamicColumnGroup {
    sectionKey: SectionKey;
    label: string;
    cols: { id: string; label: string }[];
}

interface GroupLevel {
    id: string;
    colId: string;  // sectionKey::colKey — derived from actual data, not hardcoded
    label: string;
}

interface DoorGroup {
    breadcrumb: string[];
    doors: Door[];
}

// ─── Static config ────────────────────────────────────────────────────────────

const SECTION_DEFS: { key: SectionKey; label: string }[] = [
    { key: 'basic_information', label: 'Basic Information' },
    { key: 'door',              label: 'Doors'             },
    { key: 'frame',             label: 'Frame'             },
    { key: 'hardware',          label: 'Hardware'          },
];

// Grouping fields — colId matches exact keys verified from parsed JSON
const GROUPING_FIELDS: { colId: string; label: string; section: string }[] = [
    { colId: 'basic_information::BUILDING TAG',       label: 'Building Tag',        section: 'Basic Information' },
    { colId: 'basic_information::BUILDING LOCATION',  label: 'Building Location',   section: 'Basic Information' },
    { colId: 'basic_information::DOOR OPERATION',     label: 'Door Operation',      section: 'Basic Information' },
    { colId: 'basic_information::FIRE RATING',        label: 'Fire Rating',         section: 'Basic Information' },
    { colId: 'door::DOOR MATERIAL',                   label: 'Door Material',       section: 'Doors'             },
    { colId: 'door::DOOR ELEVATION TYPE',             label: 'Door Elevation Type', section: 'Doors'             },
    { colId: 'door::DOOR CORE',                       label: 'Door Core',           section: 'Doors'             },
    { colId: 'frame::FRAME MATERIAL',                 label: 'Frame Material',      section: 'Frame'             },
    { colId: 'frame::FRAME ELEVATION TYPE',           label: 'Frame Elevation Type',section: 'Frame'             },
    { colId: 'frame::FRAME ASSEMBLY',                 label: 'Frame Assembly',      section: 'Frame'             },
    { colId: 'frame::PREHUNG',                        label: 'Prehung',             section: 'Frame'             },
];

// Grouped by section for the picker modal
const GROUPING_SECTIONS = Array.from(
    GROUPING_FIELDS.reduce((map, gf) => {
        if (!map.has(gf.section)) map.set(gf.section, []);
        map.get(gf.section)!.push(gf);
        return map;
    }, new Map<string, typeof GROUPING_FIELDS>()),
);


// ─── Canonical column order per section ──────────────────────────────────────
// Matches the left-to-right header sequence of the Excel template.
// Keys not in this list are appended at the end in the order they appear in the data.

const CANONICAL_COLUMN_ORDER: Partial<Record<SectionKey, string[]>> = {
    basic_information: [
        'DOOR TAG', 'BUILDING TAG', 'BUILDING LOCATION', 'DOOR LOCATION',
        'QUANTITY', 'HAND OF OPENINGS', 'DOOR OPERATION', 'LEAF COUNT',
        'INTERIOR/EXTERIOR', 'EXCLUDE REASON', 'WIDTH', 'HEIGHT', 'THICKNESS', 'FIRE RATING',
        'BUILDING AREA',
    ],
    door: [
        'DOOR MATERIAL', 'DOOR ELEVATION TYPE', 'DOOR CORE', 'DOOR FACE',
        'DOOR EDGE', 'DOOR GUAGE', 'DOOR FINISH', 'STC RATING',
        'DOOR UNDERCUT', 'GLAZING TYPE', 'DOOR INCLUDE/EXCLUDE',
    ],
    frame: [
        'FRAME MATERIAL', 'WALL TYPE', 'THROAT THICKNESS',
        'FRAME ANCHOR', 'BASE ANCHOR', 'NO OF ANCHOR',
        'FRAME PROFILE', 'FRAME ELEVATION TYPE', 'FRAME ASSEMBLY', 'FRAME GUAGE',
        'FRAME FINISH', 'PREHUNG', 'FRAME HEAD', 'CASING', 'FRAME INCLUDE/EXCLUDE',
    ],
    hardware: [
        'HARDWARE SET', 'HW SET', 'HARDWARE PREP', 'HARDWARE ON DOOR',
        'HARDWARE INCLUDE/EXCLUDE',
    ],
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function buildColId(sectionKey: SectionKey, colKey: string): string {
    return `${sectionKey}::${colKey}`;
}

function parseColId(colId: string): { sectionKey: SectionKey; colKey: string } {
    const idx = colId.indexOf('::');
    return { sectionKey: colId.slice(0, idx) as SectionKey, colKey: colId.slice(idx + 2) };
}

function getSectionValue(door: Door, colId: string): string {
    const { sectionKey, colKey } = parseColId(colId);
    if (sectionKey === 'basic_information' && colKey === 'DOOR TAG') return door.doorTag;
    const sec = (door.sections as unknown as Record<string, Record<string, string | undefined>> | undefined)?.[sectionKey];
    return sec?.[colKey] ?? '';
}

function getGroupValue(door: Door, sectionKey: SectionKey, field: string): string {
    const sec = (door.sections as unknown as Record<string, Record<string, string | undefined>> | undefined)?.[sectionKey];
    if (!sec) return '(No Value)';
    // Exact match first, then case-insensitive fallback
    const exactVal = sec[field];
    if (exactVal !== undefined && exactVal.trim() !== '') return exactVal.trim();
    const lower = field.toLowerCase();
    const matchedKey = Object.keys(sec).find(k => k.toLowerCase() === lower);
    const val = matchedKey ? sec[matchedKey] : undefined;
    return val?.trim() || '(No Value)';
}

function deriveColumnGroups(doors: Door[]): DynamicColumnGroup[] {
    return SECTION_DEFS.map(({ key, label }) => {
        // Collect every key that appears across all doors for this section.
        const allKeys = new Set<string>();
        for (const d of doors) {
            const sec = (d.sections as unknown as Record<string, Record<string, string | undefined>> | undefined)?.[key];
            if (sec) Object.keys(sec).forEach(k => allKeys.add(k));
        }

        const canonical = CANONICAL_COLUMN_ORDER[key] ?? [];
        const canonicalIndex = new Map(canonical.map((k, i) => [k, i]));

        // Keys in the canonical list come first (in template order).
        // Keys not in the canonical list are appended in the order first seen in data.
        const sorted = Array.from(allKeys).sort((a, b) => {
            const ai = canonicalIndex.get(a) ?? Infinity;
            const bi = canonicalIndex.get(b) ?? Infinity;
            return ai - bi;
        });

        return { sectionKey: key, label, cols: sorted.map(k => ({ id: buildColId(key, k), label: k })) };
    });
}

function groupDoors(doors: Door[], levels: GroupLevel[]): DoorGroup[] {
    if (levels.length === 0) return [{ breadcrumb: [], doors }];
    function recurse(subset: Door[], remaining: GroupLevel[], crumb: string[]): DoorGroup[] {
        if (remaining.length === 0) return [{ breadcrumb: crumb, doors: subset }];
        const [cur, ...rest] = remaining;
        const { sectionKey, colKey } = parseColId(cur.colId);
        const buckets = new Map<string, Door[]>();
        for (const door of subset) {
            const val = getGroupValue(door, sectionKey, colKey);
            if (!buckets.has(val)) buckets.set(val, []);
            buckets.get(val)!.push(door);
        }
        return Array.from(buckets.entries()).flatMap(([val, sub]) => recurse(sub, rest, [...crumb, val]));
    }
    return recurse(doors, levels, []);
}

function makeId(): string {
    return `gl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Modal for picking a grouping field from the curated list of 11 options. */
const GroupFieldPickerModal: React.FC<{
    open: boolean;
    onClose: () => void;
    onSelect: (colId: string) => void;
    usedColIds: Set<string>;
    currentColId: string | null;
    multiSelect: boolean;
}> = ({ open, onClose, onSelect, usedColIds, currentColId, multiSelect }) => (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
        <DialogContent className="max-w-xs p-0">
            <DialogHeader className="px-5 pt-5 pb-3 border-b border-[var(--border)]">
                <DialogTitle className="text-sm">Group By Field</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                    {multiSelect
                        ? 'Pick one or more fields to split the report into separate tables.'
                        : 'Pick a field to replace this grouping level.'}
                </DialogDescription>
            </DialogHeader>
            <div className="px-4 py-3 space-y-4 max-h-[60vh] overflow-y-auto">
                {GROUPING_SECTIONS.map(([sectionLabel, fields]) => (
                    <div key={sectionLabel}>
                        <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider mb-1.5">
                            {sectionLabel}
                        </p>
                        <div className="space-y-0.5">
                            {fields.map(gf => {
                                const isUsed = usedColIds.has(gf.colId) && gf.colId !== currentColId;
                                const isActive = gf.colId === currentColId || (multiSelect && usedColIds.has(gf.colId));
                                return (
                                    <button
                                        key={gf.colId}
                                        disabled={isUsed && !multiSelect}
                                        onClick={() => !isUsed && onSelect(gf.colId)}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                                            isActive
                                                ? 'bg-[var(--primary-action)] text-white cursor-default'
                                                : 'text-[var(--text)] hover:bg-[var(--primary-bg)] hover:text-[var(--primary-text)]'
                                        }`}
                                    >
                                        {gf.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
            {multiSelect && (
                <DialogFooter className="px-5 pb-4 pt-3 border-t border-[var(--border)]">
                    <button
                        onClick={onClose}
                        className="w-full py-2 rounded-lg text-xs font-semibold bg-[var(--primary-action)] text-white hover:opacity-90 transition-opacity"
                    >
                        Done
                    </button>
                </DialogFooter>
            )}
        </DialogContent>
    </Dialog>
);

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
    index: number;
    total: number;
    format: ExportFormat;
    onHide: () => void;
}> = ({ group, selectedColumns, index, total, format, onHide }) => {
    const [collapsed, setCollapsed] = useState(false);

    const isPdf = format === 'pdf';

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
                onClick={() => setCollapsed(c => !c)}
                onKeyDown={e => e.key === 'Enter' || e.key === ' ' ? setCollapsed(c => !c) : undefined}
                className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors cursor-pointer ${
                    isPdf
                        ? 'bg-gray-50 hover:bg-gray-100 border-b border-gray-200'
                        : 'bg-[var(--primary-bg)] hover:bg-[var(--primary-bg-hover)] border-b border-[var(--primary-border)]'
                }`}
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    {collapsed
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
                        {group.doors.length} door{group.doors.length !== 1 ? 's' : ''}
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
            {!collapsed && (
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
                                {group.doors.map((door, idx) => (
                                    <tr key={door.id} className={
                                        isPdf
                                            ? idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                            : idx % 2 === 0 ? 'bg-[var(--bg)]' : 'bg-[var(--bg-subtle)]/50'
                                    }>
                                        {selectedColumns.map(col => {
                                            const val = getSectionValue(door, col);
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
    // A door is excluded when its DOOR INCLUDE/EXCLUDE section field is 'EXCLUDE'.
    const includedDoors = useMemo(() => doors.filter(d => {
        const sec = (d.sections as unknown as Record<string, Record<string, string | undefined>> | undefined);
        const val = sec?.door?.['DOOR INCLUDE/EXCLUDE'] ?? d.doorIncludeExclude ?? '';
        return val.toUpperCase() !== 'EXCLUDE';
    }), [doors]);

    const excludedCount = doors.length - includedDoors.length;

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

    // ── Grouping ──────────────────────────────────────────────────────────────
    const [groupLevels, setGroupLevels] = useState<GroupLevel[]>([]);

    // Picker modal state: null = adding new level, string = editing that level id
    const [pickerOpen, setPickerOpen]         = useState(false);
    const [pickerForLevelId, setPickerForLevelId] = useState<string | null>(null);

    const openPicker = useCallback((levelId: string | null = null) => {
        setPickerForLevelId(levelId);
        setPickerOpen(true);
    }, []);

    const handlePickField = useCallback((colId: string) => {
        const gf = GROUPING_FIELDS.find(f => f.colId === colId);
        if (!gf) return;
        if (pickerForLevelId === null) {
            // Multi-select add mode — stay open so user can pick more
            setGroupLevels(p => [...p, { id: makeId(), colId: gf.colId, label: gf.label }]);
        } else {
            // Edit mode — replace one level and close
            setGroupLevels(p => p.map(l => l.id === pickerForLevelId ? { ...l, colId: gf.colId, label: gf.label } : l));
            setPickerOpen(false);
        }
        setPreviewReady(false);
    }, [pickerForLevelId]);

    const removeGroupLevel = useCallback((id: string) => {
        setGroupLevels(p => p.filter(l => l.id !== id));
        setPreviewReady(false);
    }, []);

    const groups = useMemo(() => groupDoors(includedDoors, groupLevels), [includedDoors, groupLevels]);

    const usedGroupColIds = useMemo(() => new Set(groupLevels.map(l => l.colId)), [groupLevels]);

    // ── Export / preview state ────────────────────────────────────────────────
    const [format, setFormat]                         = useState<ExportFormat>('excel');
    const [showElevationImages, setShowElevationImages] = useState(false);
    const [previewReady, setPreviewReady]             = useState(false);
    const [hiddenGroupKeys, setHiddenGroupKeys]       = useState<Set<string>>(new Set());

    const handleGeneratePreview = () => { setHiddenGroupKeys(new Set()); setPreviewReady(true); };
    const handleHideGroup = (key: string) => setHiddenGroupKeys(prev => new Set([...prev, key]));

    // Reset preview whenever config changes
    const handleColumnChange = (id: string) => { toggleColumn(id); setPreviewReady(false); };
    const handleFormatChange = (f: ExportFormat) => { setFormat(f); setPreviewReady(false); };

    const handleDownload = async () => {
        const headers = selectedColumns.map(col => parseColId(col).colKey);
        const fileName = (projectName || 'Door_Schedule').replace(/[/\\?%*:|"<>]/g, '_');

        // Respect the same hidden-group filter as the preview panel
        const visibleGroups = groups.filter(g => !hiddenGroupKeys.has(g.breadcrumb.join('||') || 'all'));

        // Collect unique elevation types used by included doors
        const usedElevationTypes: ElevationType[] = [];
        if (showElevationImages && elevationTypes.length > 0) {
            const seen = new Set<string>();
            for (const door of includedDoors) {
                const et = resolveElevationType(door, elevationTypes);
                if (et && !seen.has(et.id)) {
                    seen.add(et.id);
                    usedElevationTypes.push(et);
                }
            }
        }

        if (format === 'excel') {
            const XLSX = await import('xlsx');
            const wb = XLSX.utils.book_new();

            const groupsToExport = visibleGroups.length > 0 ? visibleGroups : [{ breadcrumb: [], doors: includedDoors }];
            const useSingleSheet = groupsToExport.length === 1 && groupsToExport[0].breadcrumb.length === 0;

            for (const [i, group] of groupsToExport.entries()) {
                const rows = group.doors.map(door =>
                    selectedColumns.map(col => getSectionValue(door, col) || ''),
                );
                const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

                // Style header row bold
                const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
                for (let c = range.s.c; c <= range.e.c; c++) {
                    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
                    if (cell) cell.s = { font: { bold: true } };
                }

                const rawName = useSingleSheet
                    ? 'Door Schedule'
                    : (group.breadcrumb.join(' - ') || `Group ${i + 1}`);
                const sheetName = rawName.replace(/[\\/*?[\]:]/g, '_').slice(0, 31);
                XLSX.utils.book_append_sheet(wb, ws, sheetName || `Sheet${i + 1}`);
            }

            // Elevation types reference sheet
            if (usedElevationTypes.length > 0) {
                const etRows = usedElevationTypes.map(et => [
                    et.code || et.id,
                    et.name,
                    et.description || '',
                    et.imageUrl || '',
                ]);
                const etWs = XLSX.utils.aoa_to_sheet([
                    ['Code', 'Name', 'Description', 'Image URL'],
                    ...etRows,
                ]);
                etWs['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 35 }, { wch: 70 }];
                XLSX.utils.book_append_sheet(wb, etWs, 'Elevation Types');
            }

            XLSX.writeFile(wb, `${fileName}.xlsx`);

        } else {
            const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
                import('jspdf'),
                import('jspdf-autotable'),
            ]);

            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const groupsToExport = visibleGroups.length > 0 ? visibleGroups : [{ breadcrumb: [], doors: includedDoors }];

            for (const [i, group] of groupsToExport.entries()) {
                if (i > 0) doc.addPage();

                const title = projectName || 'Door Schedule Report';
                const subtitle = group.breadcrumb.length > 0
                    ? group.breadcrumb.join(' › ')
                    : 'All Doors';

                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.text(title, 14, 14);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100);
                doc.text(`${subtitle}  —  ${group.doors.length} door${group.doors.length !== 1 ? 's' : ''}`, 14, 20);
                doc.setTextColor(0);

                autoTable(doc, {
                    startY: 25,
                    head: [headers],
                    body: group.doors.map(door =>
                        selectedColumns.map(col => getSectionValue(door, col) || '—'),
                    ),
                    styles: { fontSize: 6.5, cellPadding: 1.8, overflow: 'linebreak' },
                    headStyles: {
                        fillColor: [30, 41, 59],
                        textColor: 255,
                        fontStyle: 'bold',
                        fontSize: 6.5,
                    },
                    alternateRowStyles: { fillColor: [248, 250, 252] },
                    margin: { left: 14, right: 14 },
                });
            }

            // ── Elevation images appendix ─────────────────────────────────────
            if (usedElevationTypes.length > 0) {
                // Pre-load all images in parallel
                const imageDataMap = new Map<string, string | null>();
                await Promise.all(usedElevationTypes.map(async et => {
                    const src = et.imageData || et.imageUrl;
                    imageDataMap.set(et.id, src ? await imageToDataUrl(src) : null);
                }));

                const typesWithImages = usedElevationTypes.filter(et => imageDataMap.get(et.id));

                if (typesWithImages.length > 0) {
                    // Layout constants (landscape A4: 297 × 210 mm)
                    const MARGIN    = 14;
                    const IMG_W     = 50;   // thumbnail width mm
                    const IMG_H     = 35;   // thumbnail height mm
                    const LABEL_H   = 9;    // space below image for label
                    const COL_GAP   = 5;
                    const ROW_GAP   = 4;
                    const CELL_H    = IMG_H + LABEL_H + ROW_GAP;
                    const COLS      = Math.floor((297 - MARGIN * 2 + COL_GAP) / (IMG_W + COL_GAP)); // 4
                    const HEADER_Y  = 26;   // first row top Y

                    let colIdx  = 0;
                    let rowTop  = HEADER_Y;
                    let isFirstPage = true;

                    const addElevationPageHeader = () => {
                        doc.setFontSize(11);
                        doc.setFont('helvetica', 'bold');
                        doc.setTextColor(0);
                        doc.text(projectName || 'Door Schedule Report', MARGIN, 14);
                        doc.setFontSize(8);
                        doc.setFont('helvetica', 'normal');
                        doc.setTextColor(100);
                        doc.text(
                            isFirstPage
                                ? `Elevation Types Reference  ·  ${typesWithImages.length} type${typesWithImages.length !== 1 ? 's' : ''}`
                                : 'Elevation Types Reference (continued)',
                            MARGIN, 20,
                        );
                        doc.setTextColor(0);
                        isFirstPage = false;
                    };

                    doc.addPage();
                    addElevationPageHeader();

                    for (const et of typesWithImages) {
                        // Overflow: start a new page
                        if (rowTop + CELL_H > 210 - MARGIN) {
                            doc.addPage();
                            addElevationPageHeader();
                            colIdx = 0;
                            rowTop = HEADER_Y;
                        }

                        const x = MARGIN + colIdx * (IMG_W + COL_GAP);
                        const y = rowTop;

                        // Thin border rect
                        doc.setDrawColor(220, 220, 220);
                        doc.setLineWidth(0.3);
                        doc.setFillColor(248, 248, 248);
                        doc.roundedRect(x, y, IMG_W, IMG_H, 1, 1, 'FD');

                        // Image
                        try {
                            doc.addImage(imageDataMap.get(et.id)!, x, y, IMG_W, IMG_H);
                        } catch { /* skip broken images silently */ }

                        // Label: code (bold) + name (normal)
                        const labelY = y + IMG_H + 3;
                        doc.setFontSize(6.5);
                        doc.setFont('helvetica', 'bold');
                        doc.setTextColor(30, 41, 59);
                        doc.text(et.code || et.name, x + 1, labelY, { maxWidth: IMG_W - 2 });
                        if (et.name && et.code && et.name !== et.code) {
                            doc.setFont('helvetica', 'normal');
                            doc.setFontSize(5.5);
                            doc.setTextColor(100);
                            doc.text(et.name, x + 1, labelY + 3.5, { maxWidth: IMG_W - 2 });
                        }
                        doc.setTextColor(0);

                        colIdx++;
                        if (colIdx >= COLS) {
                            colIdx = 0;
                            rowTop += CELL_H;
                        }
                    }
                }
            }

            doc.save(`${fileName}.pdf`);
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
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                                <Layers className="w-3 h-3 text-[var(--text-faint)]" />
                                <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Group By</p>
                            </div>
                            <button
                                onClick={() => openPicker(null)}
                                disabled={groupLevels.length >= GROUPING_FIELDS.length}
                                className="flex items-center gap-0.5 text-[10px] font-medium text-[var(--primary-text)] hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                            >
                                <Plus className="w-3 h-3" />
                                Add
                            </button>
                        </div>

                        {groupLevels.length === 0 ? (
                            <button
                                onClick={() => openPicker(null)}
                                className="w-full text-[11px] text-[var(--text-faint)] py-3 text-center border border-dashed border-[var(--border)] rounded-lg hover:border-[var(--primary-border)] hover:text-[var(--primary-text)] transition-colors"
                            >
                                + Add grouping to split into tables
                            </button>
                        ) : (
                            <div className="space-y-1.5">
                                {groupLevels.map((level, idx) => (
                                    <div key={level.id} className="flex items-center gap-2">
                                        <span className="flex-shrink-0 w-[18px] h-[18px] rounded-full bg-[var(--primary-action)] text-white text-[9px] font-bold flex items-center justify-center">
                                            {idx + 1}
                                        </span>
                                        {/* Clickable pill — opens picker to change field */}
                                        <button
                                            onClick={() => openPicker(level.id)}
                                            className="flex-1 flex items-center justify-between gap-1 text-xs px-2.5 py-1.5 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] hover:border-[var(--primary-border)] hover:bg-[var(--primary-bg)] hover:text-[var(--primary-text)] transition-colors min-w-0 group"
                                        >
                                            <span className="truncate font-medium">{level.label}</span>
                                            <ChevronDown className="w-3 h-3 text-[var(--text-faint)] group-hover:text-[var(--primary-text)] flex-shrink-0" />
                                        </button>
                                        <button
                                            onClick={() => removeGroupLevel(level.id)}
                                            className="p-1 text-[var(--text-faint)] hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 rounded transition-colors flex-shrink-0"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                                {/* Path summary */}
                                <div className="text-[10px] text-[var(--text-faint)] pt-1 pl-1 flex items-center flex-wrap gap-0.5">
                                    {groupLevels.map((l, i) => (
                                        <React.Fragment key={l.id}>
                                            {i > 0 && <span className="text-[var(--border-strong)] mx-0.5">›</span>}
                                            <span className="text-[var(--text-muted)] font-medium">{l.label}</span>
                                        </React.Fragment>
                                    ))}
                                    <span className="ml-1.5 text-[var(--primary-text-muted)] font-semibold">→ {groups.length} table{groups.length !== 1 ? 's' : ''}</span>
                                </div>
                            </div>
                        )}
                    </div>
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
                <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)] flex-shrink-0">
                    <div className="flex items-center gap-2">
                        {format === 'pdf'
                            ? <FileText className="w-4 h-4 text-[var(--text-muted)]" />
                            : <Table2   className="w-4 h-4 text-[var(--text-muted)]" />
                        }
                        <span className="text-xs font-semibold text-[var(--text)]">
                            {previewReady ? `Preview — ${format === 'pdf' ? 'PDF' : 'Excel'}` : 'Preview'}
                        </span>
                        {previewReady && (
                            <span className="text-[10px] text-[var(--text-faint)] ml-1">
                                {includedDoors.length} doors · {selectedColumns.length} cols · {groups.length} table{groups.length !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                    {previewReady && (
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--primary-action)] hover:bg-[var(--primary-action-hover)] text-white text-xs font-semibold transition-all shadow-sm"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Download {format === 'pdf' ? 'PDF' : 'Excel'}
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
                                    <p className="text-base font-bold text-gray-800 dark:text-[var(--text)]">{projectName || 'Door Schedule Report'}</p>
                                    <p className="text-xs text-gray-400 dark:text-[var(--text-faint)] mt-0.5">
                                        {includedDoors.length} doors · Generated {new Date().toLocaleDateString()}
                                        {excludedCount > 0 && ` · ${excludedCount} excluded`}
                                    </p>
                                </div>
                            )}

                            {groups
                                .filter(g => !hiddenGroupKeys.has(g.breadcrumb.join('||') || 'all'))
                                .map((group, idx, visible) => (
                                    <GroupedTable
                                        key={group.breadcrumb.join('||') || 'all'}
                                        group={group}
                                        selectedColumns={selectedColumns}
                                        index={idx}
                                        total={visible.length}
                                        format={format}
                                        onHide={() => handleHideGroup(group.breadcrumb.join('||') || 'all')}
                                    />
                                ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Group field picker modal */}
            <GroupFieldPickerModal
                open={pickerOpen}
                onClose={() => setPickerOpen(false)}
                onSelect={handlePickField}
                usedColIds={usedGroupColIds}
                currentColId={pickerForLevelId ? (groupLevels.find(l => l.id === pickerForLevelId)?.colId ?? null) : null}
                multiSelect={pickerForLevelId === null}
            />
        </div>
    );
};

export default DoorScheduleConfig;
