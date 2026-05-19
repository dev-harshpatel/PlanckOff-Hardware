'use client';

import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { REQUIRED_COLUMN_DEFS } from './hardwareConstants';
import { formatDoorTags, getUsageCellValue, getItemValue, type HardwareGroup } from './hardwareHelpers';

type ExportFormat = 'xlsx' | 'pdf';

export const HardwareGroupTable: React.FC<{
  group: HardwareGroup;
  requiredColumns: string[];
  usageDisplay: string[];
  index: number;
  total: number;
  format: ExportFormat;
  collapsed: boolean;
  onToggleCollapse: () => void;
}> = ({ group, requiredColumns, usageDisplay, index, total, format, collapsed, onToggleCollapse }) => {
  const isPdf = format === 'pdf';

  // Door tags for this group (only populated for "By Hardware Set" grouping).
  // groupTotalQuantity is the sum of basic_information.QUANTITY across all doors.
  const doorTagText = group.groupDoorTags
    ? formatDoorTags(group.groupDoorTags, usageDisplay, group.groupTotalQuantity)
    : '';

  const tableColumns = requiredColumns;

  return (
    <div className={`rounded-lg overflow-hidden border ${
      isPdf ? 'border-gray-200 bg-white shadow-md' : 'border-[var(--border)] bg-[var(--bg)]'
    }`}>
      {/* Group header */}
      <button
        onClick={onToggleCollapse}
        className={`w-full flex items-start justify-between px-4 py-3 text-left transition-colors ${
          isPdf
            ? 'bg-gray-50 hover:bg-gray-100 border-b border-gray-200'
            : 'bg-[var(--primary-bg)] hover:bg-[var(--primary-bg-hover)] border-b border-[var(--primary-border)]'
        }`}
      >
        {/* Left: set name + door tags (wraps to second line) */}
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          {collapsed
            ? <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${isPdf ? 'text-gray-400' : 'text-[var(--primary-text-muted)]'}`} />
            : <ChevronDown  className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${isPdf ? 'text-gray-400' : 'text-[var(--primary-text-muted)]'}`} />
          }
          <div className="min-w-0 flex-1">
            <span className={`text-xs font-semibold ${isPdf ? 'text-gray-700' : 'text-[var(--primary-text)]'}`}>
              {group.label}
            </span>
            {doorTagText && (
              <p className={`text-[10px] mt-0.5 break-words leading-relaxed ${isPdf ? 'text-gray-500' : 'text-[var(--primary-text-muted)]'}`}>
                {doorTagText}
              </p>
            )}
          </div>
        </div>
        {/* Right: position + item count + total quantity */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-3 mt-0.5">
          <span className={`text-[10px] ${isPdf ? 'text-gray-400' : 'text-[var(--text-faint)]'}`}>{index + 1} / {total}</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            isPdf
              ? 'bg-white border border-gray-200 text-gray-500'
              : 'bg-[var(--bg)] border border-[var(--primary-border)] text-[var(--primary-text-muted)]'
          }`}>
            {group.items.length} item{group.items.length !== 1 ? 's' : ''}
            {' · '}
            Total Qty: {group.items.reduce((sum, u) => sum + (u.totalQuantity || 0), 0)}
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
                      const val = col === 'usage'
                        ? getUsageCellValue(usage, usageDisplay)
                        : getItemValue(usage, col);
                      return (
                        <td key={col} className={`px-3 py-2 border-b ${
                          ['usage', 'door_material', 'hw_set_name'].includes(col) ? 'max-w-[200px] break-words' : 'whitespace-nowrap'
                        } ${
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
