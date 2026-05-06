'use client';

import React from 'react';

export interface PriceInputProps {
    value: number;
    onChange: (v: string) => void;
}

export function PriceInput({ value, onChange }: PriceInputProps) {
    return (
        <input
            type="number"
            min={0}
            step={0.01}
            value={value || ''}
            placeholder="0.00"
            onChange={e => onChange(e.target.value)}
            className="w-24 text-right text-xs bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-[var(--text)] focus:border-[var(--primary-action)] focus:ring-1 focus:ring-[var(--primary-ring)] outline-none"
        />
    );
}
