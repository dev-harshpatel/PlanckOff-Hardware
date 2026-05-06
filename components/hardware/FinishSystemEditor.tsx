import React from 'react';
import { DoorFinishSystem } from '../../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FinishSystemEditorProps {
    finishSystem?: DoorFinishSystem;
    onChange: (finishSystem: DoorFinishSystem | undefined) => void;
}

const FinishSystemEditor: React.FC<FinishSystemEditorProps> = ({ finishSystem, onChange }) => {
    const updateField = <K extends keyof DoorFinishSystem>(
        field: K,
        value: DoorFinishSystem[K]
    ) => {
        onChange({
            ...finishSystem,
            basePrep: finishSystem?.basePrep || 'Unfinished',
            finishType: finishSystem?.finishType || 'None',
            [field]: value
        } as DoorFinishSystem);
    };

    const basePrepOptions: DoorFinishSystem['basePrep'][] = [
        'Factory Primed',
        'Unfinished',
        'Pre-finished',
        'Field Applied'
    ];

    const finishTypeOptions: DoorFinishSystem['finishType'][] = [
        'Paint',
        'Stain',
        'Clear Coat',
        'Powder Coat',
        'Anodized',
        'Mill Finish',
        'None'
    ];

    const sheenOptions: DoorFinishSystem['sheen'][] = [
        'Flat',
        'Eggshell',
        'Satin',
        'Semi-Gloss',
        'Gloss'
    ];

    const showDetailedFields = finishSystem?.finishType && finishSystem.finishType !== 'None';

    return (
        <div className="space-y-4">
            <div className="text-sm font-semibold text-[var(--text-secondary)] border-b border-[var(--border)] pb-2">
                Finish System Specification
            </div>

            {/* Base Preparation */}
            <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Base Preparation
                </label>
                <Select
                    value={finishSystem?.basePrep || '__none__'}
                    onValueChange={v => updateField('basePrep', (v === '__none__' ? undefined : v) as DoorFinishSystem['basePrep'])}
                >
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select Base Prep..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__none__">Select Base Prep...</SelectItem>
                        {basePrepOptions.map(opt => (
                            <SelectItem key={opt} value={opt!}>{opt}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Finish Type */}
            <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Finish Type
                </label>
                <Select
                    value={finishSystem?.finishType || '__none__'}
                    onValueChange={v => updateField('finishType', (v === '__none__' ? undefined : v) as DoorFinishSystem['finishType'])}
                >
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select Finish Type..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__none__">Select Finish Type...</SelectItem>
                        {finishTypeOptions.map(opt => (
                            <SelectItem key={opt} value={opt!}>{opt}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Detailed Fields (conditional) */}
            {showDetailedFields && (
                <div className="pl-4 border-l-2 border-green-500/40 bg-green-500/5 p-4 rounded-r-lg space-y-4">
                    {/* Manufacturer */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                            Manufacturer
                        </label>
                        <input
                            type="text"
                            value={finishSystem?.manufacturer || ''}
                            onChange={(e) => updateField('manufacturer', e.target.value || undefined)}
                            placeholder="e.g., Sherwin Williams, Benjamin Moore..."
                            className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-lg bg-[var(--bg)] text-[var(--text)] focus:ring-2 focus:ring-[var(--primary-ring)] focus:border-[var(--primary-ring)]"
                        />
                    </div>

                    {/* Product Code */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                            Product Code
                        </label>
                        <input
                            type="text"
                            value={finishSystem?.productCode || ''}
                            onChange={(e) => updateField('productCode', e.target.value || undefined)}
                            placeholder="e.g., SW 7006, BM HC-172..."
                            className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-lg bg-[var(--bg)] text-[var(--text)] focus:ring-2 focus:ring-[var(--primary-ring)] focus:border-[var(--primary-ring)]"
                        />
                    </div>

                    {/* Color Name */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                            Color Name
                        </label>
                        <input
                            type="text"
                            value={finishSystem?.colorName || ''}
                            onChange={(e) => updateField('colorName', e.target.value || undefined)}
                            placeholder="e.g., Extra White, Chelsea Gray..."
                            className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-lg bg-[var(--bg)] text-[var(--text)] focus:ring-2 focus:ring-[var(--primary-ring)] focus:border-[var(--primary-ring)]"
                        />
                    </div>

                    {/* Sheen (for paint/stain) */}
                    {(finishSystem?.finishType === 'Paint' || finishSystem?.finishType === 'Stain' || finishSystem?.finishType === 'Clear Coat') && (
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                                Sheen Level
                            </label>
                            <div className="grid grid-cols-5 gap-2">
                                {sheenOptions.map((sheen) => (
                                    <button
                                        key={sheen}
                                        type="button"
                                        onClick={() => updateField('sheen', sheen)}
                                        className={`px-2 py-2 rounded-lg border-2 text-xs font-medium transition-all ${
                                            finishSystem?.sheen === sheen
                                                ? 'border-green-600 bg-green-600 text-white shadow-md'
                                                : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)] hover:border-green-500/50'
                                        }`}
                                    >
                                        {sheen}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Finish Summary */}
            {finishSystem && finishSystem.finishType !== 'None' && (
                <div className="mt-4 p-3 bg-[var(--bg-subtle)] rounded-lg border border-[var(--border)]">
                    <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">
                        Finish Summary
                    </div>
                    <div className="text-sm font-medium text-[var(--text)]">
                        {[
                            finishSystem.basePrep,
                            finishSystem.finishType,
                            finishSystem.sheen && `(${finishSystem.sheen})`,
                            finishSystem.colorName && `- ${finishSystem.colorName}`,
                            finishSystem.manufacturer && `by ${finishSystem.manufacturer}`,
                            finishSystem.productCode && `[${finishSystem.productCode}]`
                        ].filter(Boolean).join(' ')}
                    </div>
                </div>
            )}

            <div className="text-xs text-[var(--text-muted)] italic">
                💡 Tip: Complete finish specifications prevent procurement delays and ensure accurate material ordering.
            </div>
        </div>
    );
};

export default FinishSystemEditor;
