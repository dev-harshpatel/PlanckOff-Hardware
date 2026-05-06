'use client';

import React from 'react';
import { Ban } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type RawSection = Record<string, string | undefined>;

export interface FieldGroup {
    header: string;
    cols: number;
    keys: string[];
}

const inputCls = 'w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--text)] bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)] focus:border-[var(--primary-ring)] placeholder:text-[var(--text-faint)] transition-colors';

const prettifyKey = (key: string) =>
    key.split(/[\s_]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

export const IncludeExcludeSelect: React.FC<{
    value: string;
    onChange: (val: string) => void;
    disabled?: boolean;
}> = ({ value, onChange, disabled }) => (
    <Select value={value || '__none__'} onValueChange={v => onChange(v === '__none__' ? '' : v)} disabled={disabled}>
        <SelectTrigger className="h-9 text-sm border-[var(--border)] bg-[var(--bg)] text-[var(--text)] focus:ring-[var(--primary-ring)]">
            <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
            <SelectItem value="__none__">—</SelectItem>
            <SelectItem value="INCLUDE">INCLUDE</SelectItem>
            <SelectItem value="EXCLUDE">EXCLUDE</SelectItem>
        </SelectContent>
    </Select>
);

export function SectionHeader({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2 mb-3 mt-5 first:mt-0">
            <span className="text-xs font-bold text-[var(--primary-text-muted)] uppercase tracking-wider">{children}</span>
            <div className="flex-1 h-px bg-[var(--primary-border)]" />
        </div>
    );
}

export function ExcludedBanner({ label }: { label: string }) {
    return (
        <div className="flex items-center gap-2 px-3 py-2.5 mb-4 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 text-xs font-medium">
            <Ban className="w-3.5 h-3.5 flex-shrink-0" />
            This {label} section is marked <span className="font-bold ml-1">EXCLUDE</span>. Fields are locked — change the dropdown below to re-enable editing.
        </div>
    );
}

export interface SectionFieldsProps {
    data: RawSection;
    groups: FieldGroup[];
    onChange: (key: string, value: string) => void;
    dropdownFields?: Record<string, string[]>;
    includeExcludeKey?: string;
    isExcluded?: boolean;
    excludedLabel?: string;
}

export function SectionFields({
    data,
    groups,
    onChange,
    dropdownFields,
    includeExcludeKey,
    isExcluded,
    excludedLabel = 'door',
}: SectionFieldsProps) {
    const allGroupedKeys = new Set(groups.flatMap(g => g.keys));
    const extraKeys = Object.keys(data).filter(k => !allGroupedKeys.has(k));

    const renderField = (key: string) => {
        if (key === includeExcludeKey) {
            return <IncludeExcludeSelect value={data[key] ?? ''} onChange={val => onChange(key, val)} />;
        }

        const isFieldDisabled = isExcluded === true;

        const opts = dropdownFields?.[key];
        if (opts) {
            const currentVal = data[key] ?? '';
            const allOpts = currentVal && !opts.includes(currentVal) ? [...opts, currentVal] : opts;
            return (
                <Select
                    disabled={isFieldDisabled}
                    value={currentVal || '__none__'}
                    onValueChange={v => onChange(key, v === '__none__' ? '' : v)}
                >
                    <SelectTrigger className={`w-full h-9 text-sm ${isFieldDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
                        <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                        {allOpts.map(o => <SelectItem key={o || '__none__'} value={o || '__none__'}>{o || '—'}</SelectItem>)}
                    </SelectContent>
                </Select>
            );
        }
        return (
            <input
                type="text"
                disabled={isFieldDisabled}
                className={`${inputCls} ${isFieldDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                value={data[key] ?? ''}
                onChange={e => onChange(key, e.target.value)}
            />
        );
    };

    return (
        <div className="space-y-1 max-w-2xl">
            {isExcluded && <ExcludedBanner label={excludedLabel} />}
            {groups.map(group => {
                const presentKeys = group.keys.filter(k => k in data);
                if (presentKeys.length === 0) return null;
                return (
                    <React.Fragment key={group.header}>
                        <SectionHeader>{group.header}</SectionHeader>
                        <div className={`grid gap-3 ${group.cols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                            {presentKeys.map(key => (
                                <div key={key}>
                                    <label className="block text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1">
                                        {prettifyKey(key)}
                                    </label>
                                    {renderField(key)}
                                </div>
                            ))}
                        </div>
                    </React.Fragment>
                );
            })}
            {extraKeys.length > 0 && (
                <>
                    <SectionHeader>Other</SectionHeader>
                    <div className="grid grid-cols-2 gap-3">
                        {extraKeys.map(key => (
                            <div key={key}>
                                <label className="block text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1">
                                    {prettifyKey(key)}
                                </label>
                                {renderField(key)}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
