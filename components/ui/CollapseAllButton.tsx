'use client';

import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapseAllButtonProps {
  allCollapsed: boolean;
  onCollapseAll: () => void;
  onExpandAll: () => void;
}

const CollapseAllButton: React.FC<CollapseAllButtonProps> = ({ allCollapsed, onCollapseAll, onExpandAll }) => (
  <button
    onClick={allCollapsed ? onExpandAll : onCollapseAll}
    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-muted)] text-[var(--text-secondary)] text-xs font-medium transition-all"
  >
    {allCollapsed
      ? <><ChevronDown  className="w-3 h-3" />Expand All</>
      : <><ChevronRight className="w-3 h-3" />Collapse All</>
    }
  </button>
);

export default CollapseAllButton;
