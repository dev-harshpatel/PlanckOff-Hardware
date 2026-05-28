'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Settings2, FileSpreadsheet, FileText, Eye, Download,
} from 'lucide-react';
import CollapseAllButton from '@/components/ui/CollapseAllButton';
import { Door, HardwareSet } from '../../../types';
import { contentAwareColWidths, applyMetadataStyles, buildMetadataRows, applyHeaderRowAt, applyFreezeAt } from '@/services/excelTheme';
import { buildAutoTableOptions, addPageNumbers, loadLogoDataUrl, DEFAULT_THEME, PDF_MARGIN, HEADER_BAR_HEIGHT } from '@/services/pdfTheme';
import type { HardwareSetExportConfig } from '../../../types/hardwareSetTypes';
import { REQUIRED_COLUMN_DEFS, GROUPING_OPTIONS, USAGE_OPTIONS } from './hardwareConstants';
import {
  getDoorHwSetName,
  formatDoorTags,
  getItemValue,
  getUsageCellValue,
  buildHardwareGroups,
  type GroupByOption,
  type HardwareItemUsage,
} from './hardwareHelpers';
import { HardwareGroupTable } from './HardwareGroupTable';

// ─── Exported types (kept for downstream services) ───────────────────────────

export type { HardwareSetExportConfig } from '../../../types/hardwareSetTypes';

// ─── Local types ──────────────────────────────────────────────────────────────

interface HardwareSetConfigProps {
  doors: Door[];
  hardwareSets: HardwareSet[];
  projectName: string;
  onBack: () => void;
  onExport?: (config: HardwareSetExportConfig) => void;
}

type ExportFormat = 'xlsx' | 'pdf';

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
  const [groupBy, setGroupBy]                 = useState<GroupByOption[]>(['set']);
  const [usageDisplay, setUsageDisplay]       = useState<string[]>(['all']);
  const [format, setFormat]                   = useState<ExportFormat>('xlsx');
  const [previewReady, setPreviewReady]         = useState(false);
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<Set<string>>(new Set());
  const [zoom, setZoom]                         = useState(1.0);
  const adjustZoom = (delta: number) => setZoom(z => Math.min(2, Math.max(0.4, Math.round((z + delta) * 10) / 10)));

  // ── Usage stats (for flat / manufacturer / type groupings) ───────────────
  // Deduplicates items across all sets using the identifying fields plus Qty/Set.
  // Accumulates multipliedQuantity (qty × doors for that set) so totals
  // reflect the real procurement count across every set the item appears in.
  const usageStats = useMemo(() => {
    const map = new Map<string, HardwareItemUsage>();
    hardwareSets.forEach(set => {
      const setName = set.name.toLowerCase();
      const doorsWithSet = doors.filter(d => getDoorHwSetName(d)?.toLowerCase() === setName);
      set.items.forEach(item => {
        const key = `${item.name}|${item.processedDescription ?? item.description ?? ''}|${item.manufacturer || ''}|${item.finish || ''}|${item.quantity || 0}`;
        if (!map.has(key)) map.set(key, { item, doorTags: [], totalQuantity: 0, sets: [], doorQuantitySum: 0, doorMaterials: [] });
        const usage = map.get(key)!;
        doorsWithSet.forEach(door => {
          if (!usage.doorTags.includes(door.doorTag)) {
            usage.doorTags.push(door.doorTag);
            usage.doorQuantitySum += (door.quantity || 1);
            const mat = door.doorMaterial?.trim();
            if (mat && !usage.doorMaterials.includes(mat)) usage.doorMaterials.push(mat);
          }
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
    setGroupBy(prev => {
      if (val === 'flat') return ['flat'];
      const withoutFlat = prev.filter(v => v !== 'flat');
      if (withoutFlat.includes(val)) {
        const next = withoutFlat.filter(v => v !== val);
        return next.length > 0 ? next : [val];
      }
      return [...withoutFlat, val];
    });
    setPreviewReady(false);
  }, []);

  const handleFormatChange = useCallback((f: ExportFormat) => {
    setFormat(f);
    setPreviewReady(false);
  }, []);

  const handleGeneratePreview = () => { setPreviewReady(true); setCollapsedGroupKeys(new Set()); };
  const handleCollapseAll = () => setCollapsedGroupKeys(new Set(groups.map(g => g.label)));
  const handleExpandAll   = () => setCollapsedGroupKeys(new Set());
  const handleToggleGroup = (label: string) => setCollapsedGroupKeys(prev => {
    const next = new Set(prev);
    if (next.has(label)) next.delete(label); else next.add(label);
    return next;
  });
  const allCollapsed = groups.length > 0 && groups.every(g => collapsedGroupKeys.has(g.label));

  // Download uses the same `groups` memo as the preview — guaranteed identical output.
  const handleDownload = useCallback(async () => {
    const safeProjectName = (projectName || 'Hardware_Set_Report').replace(/[/\\?%*:|"<>]/g, '_');
    const colDefs = REQUIRED_COLUMN_DEFS.filter(c => requiredColumns.includes(c.id));
    const getCellValue = (u: HardwareItemUsage, colId: string): string =>
      colId === 'usage' ? getUsageCellValue(u, usageDisplay) : getItemValue(u, colId);

    const getExcelCellValue = (u: HardwareItemUsage, colId: string): string | number => {
      if (colId === 'qty_per_set') return u.item.quantity > 0 ? u.item.quantity : 0;
      if (colId === 'quantity')    return u.totalQuantity > 0 ? u.totalQuantity : 0;
      return getCellValue(u, colId);
    };

    if (format === 'xlsx') {
      const XLSX = await import('xlsx-js-style');
      const colLabels = colDefs.map(c => c.label);
      const allItemRows = groups.flatMap(g => g.items.map(u => colDefs.map(c => String(getExcelCellValue(u, c.id)))));
      const totalItems  = groups.reduce((n, g) => n + g.items.length, 0);

      // 3 branded metadata rows + data rows
      const metaRows = buildMetadataRows({ reportTitle: 'Hardware Set Report', projectName: projectName || '', itemCount: totalItems });
      const wsData: unknown[][] = [...metaRows];

      for (const group of groups) {
        const doorTagText = group.groupDoorTags
          ? formatDoorTags(group.groupDoorTags, usageDisplay, group.groupTotalQuantity)
          : '';
        wsData.push([doorTagText ? `${group.label}  —  ${doorTagText}` : group.label]);
        wsData.push(colLabels);
        for (const usage of group.items) {
          wsData.push(colDefs.map(c => getExcelCellValue(usage, c.id)));
        }
        wsData.push([]);
      }

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Style metadata banner rows 0–1
      applyMetadataStyles(ws, colLabels.length);

      // Style every column-header row in the sheet (one per group)
      let rowCursor = 3; // after meta rows 0-2
      for (const group of groups) {
        rowCursor++; // group separator label row
        applyHeaderRowAt(ws, rowCursor, colLabels.length);
        rowCursor += group.items.length + 2;
      }

      // Freeze meta + first group header visible at all times
      applyFreezeAt(ws, 3);
      ws['!cols'] = contentAwareColWidths(colLabels, allItemRows);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Hardware Sets');
      XLSX.writeFile(wb, `${safeProjectName}.xlsx`, { cellStyles: true });
      return;
    }

    if (format === 'pdf') {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const doc        = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const headers    = colDefs.map(c => c.label);
      const pageW      = doc.internal.pageSize.getWidth();
      const pageH      = doc.internal.pageSize.getHeight();
      const exportDate = new Date().toLocaleDateString();
      const logoDataUrl = await loadLogoDataUrl();
      let isFirst      = true;

      for (const group of groups) {
        if (!isFirst) doc.addPage();
        isFirst = false;

        const doorTagText = group.groupDoorTags
          ? formatDoorTags(group.groupDoorTags, usageDisplay, group.groupTotalQuantity)
          : '';
        const groupTitle = `${group.label}  ·  ${group.items.length} item${group.items.length !== 1 ? 's' : ''}`;

        // Draw door-tag subtitle below the branded header bar (which didDrawPage handles)
        let startY = HEADER_BAR_HEIGHT + 4;
        if (doorTagText) {
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100);
          const wrappedLines = doc.splitTextToSize(doorTagText, pageW - PDF_MARGIN * 2) as string[];
          doc.text(wrappedLines, PDF_MARGIN, startY);
          startY += wrappedLines.length * 3.5 + 2;
        }
        doc.setTextColor(0);

        autoTable(doc, {
          ...buildAutoTableOptions(DEFAULT_THEME, groupTitle, exportDate, pageW, PDF_MARGIN, { projectName, logoDataUrl }),
          startY,
          head: [headers],
          body: group.items.map(usage =>
            colDefs.map(c => getCellValue(usage, c.id) || '—'),
          ),
          styles: { fontSize: 6.5, cellPadding: 1.8, overflow: 'linebreak' },
        });
      }
      // Two-pass page numbers — called after all autoTable() calls complete (PDF-03)
      addPageNumbers(doc, projectName || 'Hardware Set Report', pageW, pageH, PDF_MARGIN);
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
                    type="checkbox"
                    checked={groupBy.includes(opt.id)}
                    onChange={() => handleGroupByChange(opt.id)}
                    className="w-3.5 h-3.5 rounded border-[var(--border-strong)] text-[var(--primary-action)] focus:ring-[var(--primary-ring)] cursor-pointer flex-shrink-0 mt-0.5"
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
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-5 py-3 border-b border-[var(--border)] flex-shrink-0">
          <div className="flex min-w-0 items-center gap-2">
            {format === 'pdf'
              ? <FileText        className="w-4 h-4 text-[var(--text-muted)]" />
              : <FileSpreadsheet className="w-4 h-4 text-[var(--text-muted)]" />
            }
            <span className="shrink-0 text-xs font-semibold text-[var(--text)]">
              {previewReady
                ? `Preview — ${format === 'pdf' ? 'PDF' : 'Excel'}`
                : 'Preview'
              }
            </span>
            {previewReady && (
              <span className="min-w-0 truncate text-[10px] text-[var(--text-faint)] ml-1">
                {usageStats.length} items · {requiredColumns.length} cols · {groups.length} group{groups.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex justify-self-center">
            {previewReady && groups.length > 0 && (
              <CollapseAllButton
                allCollapsed={allCollapsed}
                onCollapseAll={handleCollapseAll}
                onExpandAll={handleExpandAll}
              />
            )}
          </div>
          <div className="flex justify-self-end items-center gap-2">
            {previewReady && (
              <div className="flex items-center gap-1 border border-[var(--border)] rounded-md overflow-hidden">
                <button
                  onClick={() => adjustZoom(-0.1)}
                  disabled={zoom <= 0.4}
                  className="px-2.5 py-1 text-sm font-bold text-[var(--text-muted)] hover:bg-[var(--bg-muted)] disabled:opacity-30 transition-colors"
                  title="Zoom out"
                >−</button>
                <span className="px-1 text-xs font-medium text-[var(--text-muted)] min-w-[36px] text-center select-none">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => adjustZoom(0.1)}
                  disabled={zoom >= 2}
                  className="px-2.5 py-1 text-sm font-bold text-[var(--text-muted)] hover:bg-[var(--bg-muted)] disabled:opacity-30 transition-colors"
                  title="Zoom in"
                >+</button>
              </div>
            )}
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
            <div className={`p-5 space-y-4 animate-fadeIn ${format === 'pdf' ? 'max-w-[900px] mx-auto' : ''}`} style={{ zoom: zoom }}>
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
                  collapsed={collapsedGroupKeys.has(group.label)}
                  onToggleCollapse={() => handleToggleGroup(group.label)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Default export preserved for consumer backward-compatibility — deliberate deviation from
// .claude/skills/code-standards/SKILL.md §3 named-export rule, required for zero-impact
// structural refactor (all 4 consumers default-import this component path).
export default HardwareSetConfig;
