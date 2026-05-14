'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { DynamicColumnGroup, SectionKey } from '../doorScheduleTypes';

/** Collapsible accordion section for the left panel column picker. */
export const ColumnAccordion: React.FC<{
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
