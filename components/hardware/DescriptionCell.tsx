'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Pencil, RotateCcw, X } from 'lucide-react';
import type { Door, HardwareItem } from '@/types';
import { resolveDescriptionPlaceholders } from '@/utils/dimensionRules';

interface DescriptionCellProps {
  item: HardwareItem;
  /** Representative door for rerun calculation. Null when no doors are assigned. */
  door: Door | null;
  isPair: boolean;
  onItemPatch: (itemId: string, patch: Partial<HardwareItem>) => void;
}

/**
 * Splits `processed` into plain/highlighted segments relative to `original`.
 * Finds the longest common prefix and suffix; everything in between is highlighted.
 */
function buildHighlightParts(
  original: string,
  processed: string,
): Array<{ text: string; highlight: boolean }> {
  // Find common prefix length
  let prefixLen = 0;
  while (
    prefixLen < original.length &&
    prefixLen < processed.length &&
    original[prefixLen] === processed[prefixLen]
  ) {
    prefixLen++;
  }

  // Find common suffix length (working inward from the ends)
  let origEnd = original.length;
  let procEnd = processed.length;
  while (
    origEnd > prefixLen &&
    procEnd > prefixLen &&
    original[origEnd - 1] === processed[procEnd - 1]
  ) {
    origEnd--;
    procEnd--;
  }

  const prefix = processed.slice(0, prefixLen);
  const highlighted = processed.slice(prefixLen, procEnd);
  const suffix = processed.slice(procEnd);

  const parts: Array<{ text: string; highlight: boolean }> = [];
  if (prefix) parts.push({ text: prefix, highlight: false });
  if (highlighted) parts.push({ text: highlighted, highlight: true });
  if (suffix) parts.push({ text: suffix, highlight: false });

  return parts.length > 0 ? parts : [{ text: processed, highlight: false }];
}

export function DescriptionCell({ item, door, isPair, onItemPatch }: DescriptionCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const isOverridden = item.userDescription !== undefined;
  const hasProcessed =
    !!item.processedDescription && item.processedDescription !== item.description;
  const displayValue = item.userDescription ?? item.processedDescription ?? item.description;

  function startEdit() {
    setDraft(displayValue);
    setEditing(true);
  }

  function commitEdit() {
    const trimmed = draft.trim();
    // Treat empty or identical-to-auto as clearing the override
    const autoValue = item.processedDescription ?? item.description;
    if (!trimmed || trimmed === autoValue) {
      onItemPatch(item.id, { userDescription: undefined });
    } else {
      onItemPatch(item.id, { userDescription: trimmed });
    }
    setEditing(false);
  }

  function cancelEdit() {
    setEditing(false);
  }

  function handleRerun() {
    if (!door) {
      // No door — just clear the override and fall back to stored processedDescription
      onItemPatch(item.id, { userDescription: undefined });
      return;
    }
    const resolved = resolveDescriptionPlaceholders(item.description, item.name, door, isPair);
    onItemPatch(item.id, {
      userDescription: undefined,
      processedDescription: resolved !== item.description ? resolved : undefined,
    });
  }

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (editing) {
    return (
      <div className="flex items-center gap-1 min-w-0">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit();
            if (e.key === 'Escape') cancelEdit();
          }}
          onBlur={commitEdit}
          className="flex-1 min-w-0 text-xs px-2 py-0.5 rounded border border-[var(--primary-border)] bg-[var(--bg)] text-[var(--text)] outline-none focus:ring-1 focus:ring-[var(--primary-border)]"
        />
        <button
          onMouseDown={(e) => { e.preventDefault(); commitEdit(); }}
          className="flex-shrink-0 text-green-600 hover:text-green-700"
          title="Save"
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          onMouseDown={(e) => { e.preventDefault(); cancelEdit(); }}
          className="flex-shrink-0 text-[var(--text-faint)] hover:text-[var(--text-muted)]"
          title="Cancel"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-1 min-w-0">
      <span className="min-w-0 leading-snug">
        {isOverridden ? (
          // User's manual text — show in italic to distinguish from auto
          <span className="italic">{displayValue}</span>
        ) : hasProcessed ? (
          // Auto-calculated — highlight the computed parts
          buildHighlightParts(item.description, item.processedDescription!).map((part, i) =>
            part.highlight ? (
              <mark
                key={i}
                className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 not-italic font-medium rounded px-0.5"
                title="Calculated dimension"
              >
                {part.text}
              </mark>
            ) : (
              <span key={i}>{part.text}</span>
            ),
          )
        ) : (
          // Plain original description
          <span>{displayValue}</span>
        )}
      </span>

      {/* Action buttons — visible on row hover */}
      <div className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
        <button
          onClick={startEdit}
          className="text-[var(--text-faint)] hover:text-[var(--primary-text)] p-0.5 rounded"
          title="Edit description"
        >
          <Pencil className="w-2.5 h-2.5" />
        </button>
        {isOverridden && (
          <button
            onClick={handleRerun}
            className="text-[var(--text-faint)] hover:text-amber-600 p-0.5 rounded"
            title="Recalculate and clear override"
          >
            <RotateCcw className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    </div>
  );
}
