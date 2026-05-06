'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

export interface MultiFilterSelectProps {
    label: string;
    selected: string[];
    options: string[];
    onChange: (v: string[]) => void;
}

export function MultiFilterSelect({ label, selected, options, onChange }: MultiFilterSelectProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const toggle = (val: string) => {
        onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
    };

    const clearAll = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange([]);
    };

    const triggerLabel = selected.length === 0
        ? 'All'
        : selected.length === 1
            ? selected[0]
            : `${selected.length} selected`;

    return (
        <div className="flex items-center gap-1.5" ref={ref}>
            <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wide whitespace-nowrap">
                {label}
            </span>
            <div className="relative">
                <button
                    onClick={() => setOpen(o => !o)}
                    className={`h-7 min-w-[140px] max-w-[180px] flex items-center justify-between gap-1.5 pl-2.5 pr-2 rounded-md border text-xs transition-colors ${
                        open
                            ? 'border-[var(--primary-action)] bg-[var(--primary-bg)] text-[var(--primary-text)]'
                            : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                    }`}
                >
                    <span className={`truncate ${selected.length > 0 ? 'font-medium text-[var(--text)]' : ''}`}>
                        {triggerLabel}
                    </span>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                        {selected.length > 0 && (
                            <span
                                role="button"
                                tabIndex={0}
                                onClick={clearAll}
                                onKeyDown={e => e.key === 'Enter' && clearAll(e as unknown as React.MouseEvent)}
                                className="p-0.5 rounded hover:bg-[var(--bg-subtle)] text-[var(--text-faint)] hover:text-[var(--text)]"
                            >
                                <X className="w-2.5 h-2.5" />
                            </span>
                        )}
                        <ChevronDown className={`w-3 h-3 text-[var(--text-faint)] transition-transform ${open ? 'rotate-180' : ''}`} />
                    </div>
                </button>

                {open && options.length > 0 && (
                    <div className="absolute top-full left-0 mt-1 z-50 min-w-[180px] bg-[var(--bg)] border border-[var(--border)] rounded-lg shadow-lg py-1 max-h-56 overflow-y-auto">
                        <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-subtle)] cursor-pointer border-b border-[var(--border)] mb-0.5">
                            <input
                                type="checkbox"
                                checked={selected.length === 0}
                                onChange={() => onChange([])}
                                className="w-3.5 h-3.5 rounded border-[var(--border-strong)] text-[var(--primary-action)] focus:ring-[var(--primary-ring)] cursor-pointer flex-shrink-0"
                            />
                            <span className="text-xs font-medium text-[var(--text)]">All</span>
                        </label>
                        {options.map(opt => (
                            <label key={opt} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-subtle)] cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selected.includes(opt)}
                                    onChange={() => toggle(opt)}
                                    className="w-3.5 h-3.5 rounded border-[var(--border-strong)] text-[var(--primary-action)] focus:ring-[var(--primary-ring)] cursor-pointer flex-shrink-0"
                                />
                                <span className="text-xs text-[var(--text-secondary)] truncate">{opt}</span>
                            </label>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
