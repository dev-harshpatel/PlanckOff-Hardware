'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  initial?: string;
  badgeLabel?: string;
  badgeBg?: string;
  badgeText?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  header?: string;
  disabled?: boolean;
  /** Extra className applied to the trigger button (e.g. "pl-9" when a leading icon is present). */
  className?: string;
  id?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  header,
  disabled = false,
  className = '',
  id,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const reposition = useCallback(() => {
    const btn = triggerRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();

    // Radix Dialog uses `transform: translate(-50%, -50%)` which makes
    // `position: fixed` children position relative to the dialog, not the
    // viewport. Walk up to find the nearest transformed ancestor and subtract
    // its origin so the panel lands directly below the trigger.
    let cursor: HTMLElement | null = btn.parentElement;
    let transformedAncestor: HTMLElement | null = null;
    let ox = 0;
    let oy = 0;
    while (cursor && cursor !== document.documentElement) {
      const t = window.getComputedStyle(cursor).transform;
      if (t && t !== 'none') {
        transformedAncestor = cursor;
        const ar = cursor.getBoundingClientRect();
        ox = ar.left;
        oy = ar.top;
        break;
      }
      cursor = cursor.parentElement;
    }

    const panelHeight = 320;
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const openDown = spaceBelow >= Math.min(panelHeight, 200) || spaceBelow >= spaceAbove;

    // Cap maxHeight to the space available inside the modal so the panel never
    // overflows outside the dialog's bottom edge.
    const dialogBottom = transformedAncestor
      ? transformedAncestor.getBoundingClientRect().bottom
      : window.innerHeight;
    const availableBelow = dialogBottom - r.bottom - 12; // 12px breathing room
    const maxHeight = openDown
      ? Math.max(120, Math.min(panelHeight, availableBelow))
      : Math.min(panelHeight, spaceAbove - 12);

    setPos({
      top: openDown ? r.bottom - oy + 4 : r.top - oy - maxHeight - 4,
      left: r.left - ox,
      width: Math.max(r.width, 240),
      maxHeight,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [isOpen, reposition]);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      )
        return;
      setIsOpen(false);
      setQuery('');
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const filtered = query.trim()
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          o.sublabel?.toLowerCase().includes(query.toLowerCase()) ||
          o.badgeLabel?.toLowerCase().includes(query.toLowerCase()),
      )
    : options;

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setIsOpen(false);
    setQuery('');
  };

  const panel =
    isOpen && pos ? (
      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          width: `${pos.width}px`,
          maxHeight: `${pos.maxHeight}px`,
          zIndex: 9999,
        }}
        className="flex flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {header && (
          <div className="flex-shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
              {header}
            </p>
          </div>
        )}

        <div className="flex-shrink-0 border-b border-[var(--border-subtle)] px-2 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-faint)]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-muted)] py-1.5 pl-7 pr-7 text-xs text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--primary-border)] focus:outline-none focus:ring-1 focus:ring-[var(--primary-ring)] transition-colors"
            />
            {query && (
              <button
                type="button"
                tabIndex={-1}
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-5 text-center text-xs text-[var(--text-faint)]">
              No results found
            </div>
          ) : (
            filtered.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[var(--bg-subtle)] ${
                    isSelected
                      ? 'bg-[var(--primary-bg)] text-[var(--primary-text)]'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {option.initial && (
                    <div
                      className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        isSelected
                          ? 'bg-[var(--primary-bg-hover)] text-[var(--primary-text)]'
                          : 'bg-[var(--bg-muted)] text-[var(--text-muted)]'
                      }`}
                    >
                      {option.initial}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{option.label}</span>
                    {option.sublabel && (
                      <span className="block truncate text-[10px] text-[var(--text-faint)]">
                        {option.sublabel}
                      </span>
                    )}
                  </div>
                  {option.badgeLabel && (
                    <span
                      className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${option.badgeBg ?? 'bg-[var(--bg-muted)]'} ${option.badgeText ?? 'text-[var(--text-muted)]'}`}
                    >
                      {option.badgeLabel}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setIsOpen((prev) => {
            if (prev) setQuery('');
            return !prev;
          });
        }}
        className={`flex h-11 w-full items-center rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm transition-colors hover:bg-[var(--bg-subtle)] focus:outline-none focus:ring-1 focus:ring-[var(--primary-ring)] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        <span
          className={`flex-1 truncate text-left ${!selectedOption ? 'text-[var(--text-faint)]' : 'text-[var(--text)]'}`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-[var(--text-faint)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {panel}
    </>
  );
}
