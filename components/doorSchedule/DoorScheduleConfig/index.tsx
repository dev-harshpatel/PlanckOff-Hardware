'use client';

import React, { useMemo, useState, useCallback } from 'react';
import {
  FileSpreadsheet, FileText,
  Download, Settings2, Eye, Table2, Image,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import CollapseAllButton from '@/components/ui/CollapseAllButton';
import { Door, HardwareSet, ElevationType } from '../../../types';
import { sumDoorQuantities } from '../../../utils/doorUtils';
import { deriveColumnGroups } from '../../../utils/doorScheduleUtils';
import { useDoorAggregation } from '@/hooks/useDoorAggregation';
import { useElevationImages } from '@/hooks/useElevationImages';
import { DoorGroupingControls } from '../DoorGroupingControls';
import {
  type SectionKey, type ExportFormat,
} from '../doorScheduleTypes';
import type { DoorScheduleExportConfig } from '../../../types/doorScheduleTypes';

import { ColumnAccordion } from './ColumnAccordion';
import { GroupedTable } from './GroupedTable';
import { useDoorScheduleDownload } from './useDoorScheduleDownload';

// ─── Exported types (kept for downstream services) ───────────────────────────

export type { DoorScheduleExportConfig } from '../../../types/doorScheduleTypes';

// ─── Local types ──────────────────────────────────────────────────────────────

interface DoorScheduleConfigProps {
  doors: Door[];
  hardwareSets?: HardwareSet[];
  elevationTypes?: ElevationType[];
  projectName: string;
  projectLocation?: string;
  projectProvince?: string;
  onUpdateDoors?: (doors: Door[]) => void;
  onBack?: () => void;
  onExport?: (config: DoorScheduleExportConfig) => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

const DoorScheduleConfig: React.FC<DoorScheduleConfigProps> = ({
  doors,
  hardwareSets,
  elevationTypes = [],
  projectName,
  projectLocation,
  projectProvince,
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

  const toggleColumn   = useCallback((id: string) => setSelectedColumns(p => {
    if (p.includes(id)) return p.filter(c => c !== id);
    const next = new Set([...p, id]);
    return allColumnIds.filter(colId => next.has(colId));
  }), [allColumnIds]);
  const selectSection  = useCallback((sk: SectionKey) => {
    const g = columnGroups.find(cg => cg.sectionKey === sk);
    if (g) setSelectedColumns(p => {
      const next = new Set([...p, ...g.cols.map(c => c.id)]);
      return allColumnIds.filter(colId => next.has(colId));
    });
  }, [columnGroups, allColumnIds]);
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
  const [zoom, setZoom]                             = useState(1.0);
  const adjustZoom = (delta: number) => setZoom(z => Math.min(2, Math.max(0.4, Math.round((z + delta) * 10) / 10)));

  // ── Grouping ──────────────────────────────────────────────────────────────
  const {
    groupLevels, groups, usedGroupColIds,
    pickerOpen, pickerForLevelId, uniqueData,
    openPicker, handlePickField, setPickerOpen, setUniqueData, removeGroupLevel,
  } = useDoorAggregation({ includedDoors, setPreviewReady });

  // ── Elevation images ──────────────────────────────────────────────────────
  const { showElevationImages, setShowElevationImages, preloadElevationImages } = useElevationImages(elevationTypes);

  // ── Download hook ─────────────────────────────────────────────────────────
  const { handleDownload } = useDoorScheduleDownload({
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
  });

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
            <div className={`p-5 space-y-4 animate-fadeIn ${format === 'pdf' ? 'max-w-[900px] mx-auto' : ''}`} style={{ zoom: zoom }}>
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

// Default export preserved for consumer backward-compatibility — deliberate deviation from
// .claude/skills/code-standards/SKILL.md §3 named-export rule, required for zero-impact
// structural refactor (all 4 consumers default-import this component path).
export default DoorScheduleConfig;
