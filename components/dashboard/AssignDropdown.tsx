'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { TeamMember } from '../../types';

const ROLE_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  Administrator:   { label: 'Admin',    bg: 'bg-purple-100',              text: 'text-purple-700' },
  'Team Lead':     { label: 'Lead',     bg: 'bg-[var(--primary-bg-hover)]', text: 'text-[var(--primary-text)]' },
  Estimator:       { label: 'Est.',     bg: 'bg-[var(--success-bg)]',     text: 'text-[var(--success-text)]' },
  Client:          { label: 'Client',   bg: 'bg-blue-100',                text: 'text-blue-700' },
  SeniorEstimator: { label: 'Sr. Est.', bg: 'bg-[var(--success-bg)]',     text: 'text-[var(--success-text)]' },
  Viewer:          { label: 'Viewer',   bg: 'bg-[var(--bg-muted)]',       text: 'text-[var(--text-muted)]' },
};

export interface AssignDropdownProps {
  /** Ref of the trigger button — used to anchor the portal-rendered dropdown. */
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  members: TeamMember[];
  /** Highlighted member (current assignment). */
  selectedId?: string;
  onSelect: (memberId: string) => void;
  /** If provided, renders an "Unassign" footer action. */
  onUnassign?: () => void;
  isLoading?: boolean;
  header: string;
  searchPlaceholder?: string;
}

export function AssignDropdown({
  triggerRef,
  members,
  selectedId,
  onSelect,
  onUnassign,
  isLoading = false,
  header,
  searchPlaceholder = 'Search by name or role…',
}: AssignDropdownProps) {
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Position the panel relative to the trigger button using fixed coords
  const reposition = useCallback(() => {
    const btn = triggerRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const panelHeight = 340;
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - r.bottom;
    const spaceAbove = r.top;

    // Prefer opening below; flip above only when there's not enough room below
    const top =
      spaceBelow >= Math.min(panelHeight, 200) || spaceBelow >= spaceAbove
        ? r.bottom + 6
        : r.top - Math.min(panelHeight, spaceAbove) - 6;

    setPos({ top, left: r.left, width: Math.max(r.width, 288) });
  }, [triggerRef]);

  useEffect(() => {
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [reposition]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  const filtered = query.trim()
    ? members.filter((m) => {
        const q = query.toLowerCase();
        const roleLabel = (ROLE_BADGE[m.role as string]?.label ?? (m.role as string)).toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          (m.role as string).toLowerCase().includes(q) ||
          roleLabel.includes(q)
        );
      })
    : members;

  if (!pos) return null;

  const panel = (
    <div
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: '288px', maxHeight: '340px', zIndex: 9999 }}
      className="bg-[var(--bg)] rounded-lg shadow-xl border border-[var(--border)] overflow-hidden flex flex-col"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-3 py-2 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] flex-shrink-0">
        <p className="text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-wider">
          {header}
        </p>
      </div>

      {/* Search input */}
      <div className="px-2 py-2 border-b border-[var(--border-subtle)] flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-faint)] pointer-events-none" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-7 pr-7 py-1.5 text-xs bg-[var(--bg-muted)] border border-[var(--border)] rounded-md text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--primary-ring)] focus:border-[var(--primary-border)] transition-colors"
          />
          {query && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Member list */}
      <div className="overflow-y-auto flex-1">
        {filtered.length === 0 ? (
          <div className="px-4 py-5 text-xs text-[var(--text-faint)] text-center">
            No members found
          </div>
        ) : (
          filtered.map((m) => {
            const badge = ROLE_BADGE[m.role as string] ?? {
              label: m.role as string,
              bg: 'bg-[var(--bg-muted)]',
              text: 'text-[var(--text-muted)]',
            };
            const isSelected = selectedId === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelect(m.id)}
                disabled={isLoading}
                className={`flex items-center gap-2.5 w-full text-left px-3 py-2 hover:bg-[var(--bg-subtle)] disabled:opacity-50 transition-colors ${
                  isSelected ? 'bg-[var(--primary-bg)] text-[var(--primary-text)]' : 'text-[var(--text-secondary)]'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                  isSelected ? 'bg-[var(--primary-bg-hover)] text-[var(--primary-text)]' : 'bg-[var(--bg-muted)] text-[var(--text-muted)]'
                }`}>
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <span className="flex-1 truncate text-xs font-medium">{m.name}</span>
                <span className={`flex-shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${badge.bg} ${badge.text}`}>
                  {badge.label}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Unassign footer */}
      {onUnassign && (
        <div className="border-t border-[var(--border-subtle)] flex-shrink-0">
          <button
            type="button"
            onClick={onUnassign}
            disabled={isLoading}
            className="w-full text-left px-3 py-2 text-xs text-[var(--error-text)] hover:bg-[var(--error-bg)] disabled:opacity-50 transition-colors"
          >
            Unassign
          </button>
        </div>
      )}
    </div>
  );

  return createPortal(panel, document.body);
}
