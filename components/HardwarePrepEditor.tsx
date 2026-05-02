import React from 'react';
import { HardwarePrepSpec } from '../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
                backset: prepType === 'Mortise' ? '2-3/4"' : prepType === 'Cylindrical' ? '2-3/8"' : undefined,
                strikeType: prepType === 'Mortise' ? 'Box Strike' : 'Standard'
            });
        }
    };

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
                <h3 className="text-lg font-semibold text-[var(--text)]">Hardware Preparation</h3>
                <span className="text-xs text-[var(--text-muted)]">🔧 Structured Spec</span>
            </div>

            {/* Prep Type */}
            <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Prep Type <span className="text-red-500">*</span>
                </label>
                <Select value={value?.prepType || 'None'} onValueChange={v => handlePrepTypeChange(v as HardwarePrepSpec['prepType'])}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="None">None / Not Specified</SelectItem>
                        <SelectItem value="Cylindrical">Cylindrical Lock</SelectItem>
                        <SelectItem value="Mortise">Mortise Lock</SelectItem>
                        <SelectItem value="Exit Device">Exit Device / Panic Hardware</SelectItem>
                        <SelectItem value="Multipoint">Multipoint Lock</SelectItem>
                        <SelectItem value="Electrified">Electrified Hardware</SelectItem>
                    </SelectContent>
                </Select>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                    Select the primary lock/latch preparation type
                </p>
            </div>

            {/* Conditional Fields - Only show if prep type is selected */}
            {value && value.prepType !== 'None' && (
                <>
                    {/* Backset & Strike Type */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Backset</label>
                            <Select
                                value={value.backset || '__none__'}
                                onValueChange={v => updateField('backset', (v === '__none__' ? undefined : v) as HardwarePrepSpec['backset'])}
                            >
                                <SelectTrigger className="w-full"><SelectValue placeholder="Not Specified" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">Not Specified</SelectItem>
                                    <SelectItem value='2-3/4"'>2-3/4" (Standard Mortise)</SelectItem>
                                    <SelectItem value='2-3/8"'>2-3/8" (Standard Cylindrical)</SelectItem>
                                    <SelectItem value='5"'>5" (Extended)</SelectItem>
                                    <SelectItem value="Custom">Custom</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Strike Type</label>
                            <Select
                                value={value.strikeType || '__none__'}
                                onValueChange={v => updateField('strikeType', (v === '__none__' ? undefined : v) as HardwarePrepSpec['strikeType'])}
                            >
                                <SelectTrigger className="w-full"><SelectValue placeholder="Not Specified" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">Not Specified</SelectItem>
                                    <SelectItem value="Standard">Standard Strike</SelectItem>
                                    <SelectItem value="Box Strike">Box Strike</SelectItem>
                                    <SelectItem value="Electric Strike">Electric Strike</SelectItem>
                                    <SelectItem value="Magnetic">Magnetic Lock</SelectItem>
                                    <SelectItem value="Roller Latch">Roller Latch</SelectItem>
                                </SelectContent>
                            </Select>
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
                                className="w-4 h-4 text-[var(--primary-action)] border-[var(--border-strong)] rounded focus:ring-[var(--primary-ring)]"
                            />
                            <label htmlFor="closerPrep" className="ml-2 text-sm font-medium text-[var(--text-secondary)]">
                                Door Closer Preparation Required
                            </label>
                        </div>

                        {value.closerPrep && (
                            <div className="grid grid-cols-2 gap-4 ml-6">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Closer Type</label>
                                    <Select
                                        value={value.closerType || '__none__'}
                                        onValueChange={v => updateField('closerType', (v === '__none__' ? undefined : v) as HardwarePrepSpec['closerType'])}
                                    >
                                        <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">Select...</SelectItem>
                                            <SelectItem value="Surface">Surface Mounted</SelectItem>
                                            <SelectItem value="Concealed">Concealed</SelectItem>
                                            <SelectItem value="Overhead">Overhead Concealed</SelectItem>
                                            <SelectItem value="Floor">Floor Closer</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Arm Type</label>
                                    <Select
                                        value={value.closerArmType || '__none__'}
                                        onValueChange={v => updateField('closerArmType', (v === '__none__' ? undefined : v) as HardwarePrepSpec['closerArmType'])}
                                    >
                                        <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">Select...</SelectItem>
                                            <SelectItem value="Regular Arm">Regular Arm</SelectItem>
                                            <SelectItem value="Parallel Arm">Parallel Arm</SelectItem>
                                            <SelectItem value="Top Jamb">Top Jamb</SelectItem>
                                            <SelectItem value="Slide Track">Slide Track</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Live Summary Preview */}
            <div className="bg-[var(--primary-bg)] border border-[var(--primary-border)] rounded-lg p-3">
                <div className="text-xs font-semibold text-[var(--primary-text-muted)] uppercase tracking-wide mb-1">
                    Summary Preview
                </div>
                <div className="text-sm text-[var(--primary-text)] font-medium">
                    {getSummary()}
                </div>
                <div className="text-xs text-[var(--primary-text-muted)] mt-1">
                    This will auto-populate the legacy "Hardware Prep" field
                </div>
            </div>
        </div>
    );
};

export default HardwarePrepEditor;
