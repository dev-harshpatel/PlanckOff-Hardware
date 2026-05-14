'use client';

import React, { useMemo } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import type { DoorGroup, DynamicColumnGroup, AggregatedDoorRow, ExportFormat } from '../doorScheduleTypes';
import { getDoorQuantity, sumDoorQuantities } from '../../../utils/doorUtils';
import { aggregateDoorsBySelectedColumns, getRowValue, parseColId } from '../../../utils/doorScheduleUtils';

/** A single collapsible grouped table in the preview panel. */
export const GroupedTable: React.FC<{
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
