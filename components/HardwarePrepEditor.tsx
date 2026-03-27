import React from 'react';
import { HardwarePrepSpec } from '../types';

interface HardwarePrepEditorProps {
    value?: HardwarePrepSpec;
    onChange: (value: HardwarePrepSpec | undefined) => void;
}

const HardwarePrepEditor: React.FC<HardwarePrepEditorProps> = ({ value, onChange }) => {
    const updateField = <K extends keyof HardwarePrepSpec>(field: K, fieldValue: HardwarePrepSpec[K]) => {
        onChange({
            ...value,
            prepType: value?.prepType || 'None',
            [field]: fieldValue
        });
    };

    const handlePrepTypeChange = (prepType: HardwarePrepSpec['prepType']) => {
        if (prepType === 'None') {
            onChange(undefined);
        } else {
            onChange({
                prepType,
                // Auto-suggest defaults based on prep type
                backset: prepType === 'Mortise' ? '2-3/4"' : prepType === 'Cylindrical' ? '2-3/8"' : undefined,
                strikeType: prepType === 'Mortise' ? 'Box Strike' : 'Standard'
            });
        }
    };

    // Generate summary text
    const getSummary = (): string => {
        if (!value || value.prepType === 'None') return 'No hardware prep specified';

        const parts: string[] = [value.prepType];
        if (value.backset) parts.push(`${value.backset} BS`);
        if (value.strikeType) parts.push(value.strikeType);
        if (value.closerPrep && value.closerType) {
            parts.push(`${value.closerType} Closer`);
            if (value.closerArmType) parts.push(`(${value.closerArmType})`);
        }
        return parts.join(', ');
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-lg font-semibold text-gray-800">Hardware Preparation</h3>
                <span className="text-xs text-gray-500">🔧 Structured Spec</span>
            </div>

            {/* Prep Type */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prep Type <span className="text-red-500">*</span>
                </label>
                <select
                    value={value?.prepType || 'None'}
                    onChange={(e) => handlePrepTypeChange(e.target.value as HardwarePrepSpec['prepType'])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="None">None / Not Specified</option>
                    <option value="Cylindrical">Cylindrical Lock</option>
                    <option value="Mortise">Mortise Lock</option>
                    <option value="Exit Device">Exit Device / Panic Hardware</option>
                    <option value="Multipoint">Multipoint Lock</option>
                    <option value="Electrified">Electrified Hardware</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                    Select the primary lock/latch preparation type
                </p>
            </div>

            {/* Conditional Fields - Only show if prep type is selected */}
            {value && value.prepType !== 'None' && (
                <>
                    {/* Backset */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Backset</label>
                            <select
                                value={value.backset || ''}
                                onChange={(e) => updateField('backset', e.target.value as HardwarePrepSpec['backset'])}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">Not Specified</option>
                                <option value='2-3/4"'>2-3/4" (Standard Mortise)</option>
                                <option value='2-3/8"'>2-3/8" (Standard Cylindrical)</option>
                                <option value='5"'>5" (Extended)</option>
                                <option value="Custom">Custom</option>
                            </select>
                        </div>

                        {/* Strike Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Strike Type</label>
                            <select
                                value={value.strikeType || ''}
                                onChange={(e) => updateField('strikeType', e.target.value as HardwarePrepSpec['strikeType'])}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">Not Specified</option>
                                <option value="Standard">Standard Strike</option>
                                <option value="Box Strike">Box Strike</option>
                                <option value="Electric Strike">Electric Strike</option>
                                <option value="Magnetic">Magnetic Lock</option>
                                <option value="Roller Latch">Roller Latch</option>
                            </select>
                        </div>
                    </div>

                    {/* Closer Prep */}
                    <div className="border-t pt-4">
                        <div className="flex items-center mb-3">
                            <input
                                type="checkbox"
                                id="closerPrep"
                                checked={value.closerPrep || false}
                                onChange={(e) => {
                                    updateField('closerPrep', e.target.checked);
                                    if (!e.target.checked) {
                                        updateField('closerType', undefined);
                                        updateField('closerArmType', undefined);
                                    }
                                }}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="closerPrep" className="ml-2 text-sm font-medium text-gray-700">
                                Door Closer Preparation Required
                            </label>
                        </div>

                        {value.closerPrep && (
                            <div className="grid grid-cols-2 gap-4 ml-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Closer Type</label>
                                    <select
                                        value={value.closerType || ''}
                                        onChange={(e) => updateField('closerType', e.target.value as HardwarePrepSpec['closerType'])}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">Select...</option>
                                        <option value="Surface">Surface Mounted</option>
                                        <option value="Concealed">Concealed</option>
                                        <option value="Overhead">Overhead Concealed</option>
                                        <option value="Floor">Floor Closer</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Arm Type</label>
                                    <select
                                        value={value.closerArmType || ''}
                                        onChange={(e) => updateField('closerArmType', e.target.value as HardwarePrepSpec['closerArmType'])}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">Select...</option>
                                        <option value="Regular Arm">Regular Arm</option>
                                        <option value="Parallel Arm">Parallel Arm</option>
                                        <option value="Top Jamb">Top Jamb</option>
                                        <option value="Slide Track">Slide Track</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Live Summary Preview */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">
                    Summary Preview
                </div>
                <div className="text-sm text-blue-900 font-medium">
                    {getSummary()}
                </div>
                <div className="text-xs text-blue-600 mt-1">
                    This will auto-populate the legacy "Hardware Prep" field
                </div>
            </div>
        </div>
    );
};

export default HardwarePrepEditor;
