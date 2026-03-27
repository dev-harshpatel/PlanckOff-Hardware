import React from 'react';
import { DoorFinishSystem } from '../types';

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
            <div className="text-sm font-semibold text-gray-700 border-b pb-2">
                Finish System Specification
            </div>

            {/* Base Preparation */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Base Preparation
                </label>
                <select
                    value={finishSystem?.basePrep || ''}
                    onChange={(e) => updateField('basePrep', e.target.value as DoorFinishSystem['basePrep'])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="">Select Base Prep...</option>
                    {basePrepOptions.map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
            </div>

            {/* Finish Type */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Finish Type
                </label>
                <select
                    value={finishSystem?.finishType || ''}
                    onChange={(e) => updateField('finishType', e.target.value as DoorFinishSystem['finishType'])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="">Select Finish Type...</option>
                    {finishTypeOptions.map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
            </div>

            {/* Detailed Fields (conditional) */}
            {showDetailedFields && (
                <div className="pl-4 border-l-2 border-green-200 bg-green-50/30 p-4 rounded-r-lg space-y-4">
                    {/* Manufacturer */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Manufacturer
                        </label>
                        <input
                            type="text"
                            value={finishSystem?.manufacturer || ''}
                            onChange={(e) => updateField('manufacturer', e.target.value || undefined)}
                            placeholder="e.g., Sherwin Williams, Benjamin Moore..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        />
                    </div>

                    {/* Product Code */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Product Code
                        </label>
                        <input
                            type="text"
                            value={finishSystem?.productCode || ''}
                            onChange={(e) => updateField('productCode', e.target.value || undefined)}
                            placeholder="e.g., SW 7006, BM HC-172..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        />
                    </div>

                    {/* Color Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Color Name
                        </label>
                        <input
                            type="text"
                            value={finishSystem?.colorName || ''}
                            onChange={(e) => updateField('colorName', e.target.value || undefined)}
                            placeholder="e.g., Extra White, Chelsea Gray..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        />
                    </div>

                    {/* Sheen (for paint/stain) */}
                    {(finishSystem?.finishType === 'Paint' || finishSystem?.finishType === 'Stain' || finishSystem?.finishType === 'Clear Coat') && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Sheen Level
                            </label>
                            <div className="grid grid-cols-5 gap-2">
                                {sheenOptions.map((sheen) => (
                                    <button
                                        key={sheen}
                                        type="button"
                                        onClick={() => updateField('sheen', sheen)}
                                        className={`
                                            px-2 py-2 rounded-lg border-2 text-xs font-medium transition-all
                                            ${finishSystem?.sheen === sheen
                                                ? 'border-green-600 bg-green-600 text-white shadow-md'
                                                : 'border-gray-300 bg-white text-gray-700 hover:border-green-300'
                                            }
                                        `}
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
                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Finish Summary
                    </div>
                    <div className="text-sm font-medium text-gray-900">
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

            {/* Helper Text */}
            <div className="text-xs text-gray-500 italic">
                💡 Tip: Complete finish specifications prevent procurement delays and ensure accurate material ordering.
            </div>
        </div>
    );
};

export default FinishSystemEditor;
