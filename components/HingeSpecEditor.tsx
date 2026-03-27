import React from 'react';
import { HingeSpec } from '../types';

interface HingeSpecEditorProps {
    value?: HingeSpec;
    onChange: (value: HingeSpec | undefined) => void;
    doorHeight?: number; // For auto-suggestion
}

const HingeSpecEditor: React.FC<HingeSpecEditorProps> = ({ value, onChange, doorHeight }) => {
    const updateField = <K extends keyof HingeSpec>(field: K, fieldValue: HingeSpec[K]) => {
        onChange({
            ...value,
            count: value?.count || getSuggestedHingeCount(),
            size: value?.size || '4.5" x 4.5"',
            type: value?.type || 'Full Mortise',
            material: value?.material || 'Steel',
            [field]: fieldValue
        });
    };

    const getSuggestedHingeCount = (): number => {
        if (!doorHeight) return 3;
        if (doorHeight >= 120) return 5; // 10 feet or taller
        if (doorHeight >= 90) return 4;  // 7.5 feet or taller
        return 3; // Standard
    };

    const handleClearSpec = () => {
        onChange(undefined);
    };

    const getSummary = (): string => {
        if (!value) return 'No hinge specification';

        const parts: string[] = [
            `${value.count} Hinges`,
            value.size,
            value.type,
            value.material
        ];

        if (value.finish) parts.push(value.finish);

        const features: string[] = [];
        if (value.ballBearing) features.push('Ball Bearing');
        if (value.nrp) features.push('NRP');
        if (value.electricWire) features.push('Electric Wire');

        if (features.length > 0) {
            parts.push(`(${features.join(', ')})`);
        }

        return parts.join(' | ');
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-lg font-semibold text-gray-800">Hinge Specification</h3>
                <div className="flex items-center gap-2">
                    {value && (
                        <button
                            onClick={handleClearSpec}
                            className="text-xs text-red-600 hover:text-red-800 underline"
                        >
                            Clear Spec
                        </button>
                    )}
                    <span className="text-xs text-gray-500">🚪 Hardware</span>
                </div>
            </div>

            {/* Auto-suggestion notice */}
            {doorHeight && !value && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                        <span className="text-blue-600 text-lg">💡</span>
                        <div>
                            <div className="text-sm font-semibold text-blue-800">Auto-Suggestion</div>
                            <div className="text-xs text-blue-700">
                                Based on door height ({doorHeight}"), we recommend {getSuggestedHingeCount()} hinges
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hinge Count */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Hinge Count <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="number"
                        min="2"
                        max="10"
                        value={value?.count || getSuggestedHingeCount()}
                        onChange={(e) => updateField('count', parseInt(e.target.value) || 3)}
                        placeholder={`Suggested: ${getSuggestedHingeCount()}`}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Typically 3-5 hinges per door
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Hinge Size <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={value?.size || '4.5" x 4.5"'}
                        onChange={(e) => updateField('size', e.target.value as HingeSpec['size'])}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value='4.5" x 4.5"'>4.5" x 4.5" (Standard)</option>
                        <option value='5" x 5"'>5" x 5" (Heavy Duty)</option>
                        <option value='4" x 4"'>4" x 4" (Light Duty)</option>
                        <option value="Custom">Custom Size</option>
                    </select>
                </div>
            </div>

            {/* Hinge Type & Material */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Hinge Type <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={value?.type || 'Full Mortise'}
                        onChange={(e) => updateField('type', e.target.value as HingeSpec['type'])}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="Full Mortise">Full Mortise (Most Common)</option>
                        <option value="Half Mortise">Half Mortise</option>
                        <option value="Half Surface">Half Surface</option>
                        <option value="Full Surface">Full Surface</option>
                        <option value="Continuous">Continuous / Piano Hinge</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Material <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={value?.material || 'Steel'}
                        onChange={(e) => updateField('material', e.target.value as HingeSpec['material'])}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="Steel">Steel (Standard)</option>
                        <option value="Stainless Steel">Stainless Steel (Exterior/Moisture)</option>
                        <option value="Brass">Brass</option>
                        <option value="Bronze">Bronze</option>
                    </select>
                </div>
            </div>

            {/* Finish */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Finish / Color</label>
                <input
                    type="text"
                    value={value?.finish || ''}
                    onChange={(e) => updateField('finish', e.target.value || undefined)}
                    placeholder="e.g., US26D (Satin Chrome), US32D (Satin Stainless)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                    Use ANSI/BHMA finish codes (e.g., US26D, US32D) or color names
                </p>
            </div>

            {/* Special Features */}
            <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 border-b pb-1">Special Features</h4>

                <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="ballBearing"
                            checked={value?.ballBearing || false}
                            onChange={(e) => updateField('ballBearing', e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="ballBearing" className="ml-2 text-sm text-gray-700">
                            Ball Bearing
                            <span className="text-xs text-gray-500 block">Recommended for heavy/high-traffic doors</span>
                        </label>
                    </div>

                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="nrp"
                            checked={value?.nrp || false}
                            onChange={(e) => updateField('nrp', e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="nrp" className="ml-2 text-sm text-gray-700">
                            Non-Removable Pin (NRP)
                            <span className="text-xs text-gray-500 block">Security feature for outswing doors</span>
                        </label>
                    </div>

                    <div className="flex items-center col-span-2">
                        <input
                            type="checkbox"
                            id="electricWire"
                            checked={value?.electricWire || false}
                            onChange={(e) => updateField('electricWire', e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="electricWire" className="ml-2 text-sm text-gray-700">
                            Electric Wire Through Hinge
                            <span className="text-xs text-gray-500 block">For electrified hardware (EPT alternative)</span>
                        </label>
                    </div>
                </div>
            </div>

            {/* Live Summary Preview */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">
                    Hinge Summary
                </div>
                <div className="text-sm text-green-900 font-medium">
                    {getSummary()}
                </div>
            </div>
        </div>
    );
};

export default HingeSpecEditor;
