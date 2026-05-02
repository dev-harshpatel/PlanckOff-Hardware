import React from 'react';
import { ElectrificationSpec } from '../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ElectrificationEditorProps {
    value?: ElectrificationSpec;
    onChange: (value: ElectrificationSpec | undefined) => void;
}

const ElectrificationEditor: React.FC<ElectrificationEditorProps> = ({ value, onChange }) => {
    const updateField = <K extends keyof ElectrificationSpec>(field: K, fieldValue: ElectrificationSpec[K]) => {
        onChange({
            ...value,
            isElectrified: value?.isElectrified || false,
            [field]: fieldValue
        });
    };

    const handleElectrifiedToggle = (isElectrified: boolean) => {
        if (!isElectrified) {
            onChange(undefined);
        } else {
            onChange({
                isElectrified: true,
                voltage: '24V DC', // Default
                accessControlType: 'None'
            });
        }
    };

    const getSummary = (): string => {
        if (!value || !value.isElectrified) return 'Not electrified';

        const parts: string[] = ['Electrified'];
        if (value.voltage) parts.push(value.voltage);
        if (value.accessControlType && value.accessControlType !== 'None') {
            parts.push(value.accessControlType);
        }
        if (value.eptRequired) parts.push('EPT Required');
        if (value.requestToExit) parts.push('REX');
        if (value.doorContact) parts.push('Door Contact');
        if (value.wiringMethod) parts.push(`Wiring: ${value.wiringMethod}`);

        return parts.join(' | ');
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-lg font-semibold text-[var(--text)]">Electrification</h3>
                <span className="text-xs text-[var(--text-muted)]">⚡ Power & Access Control</span>
            </div>

            {/* Main Toggle */}
            <div className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-lg p-4">
                <div className="flex items-center">
                    <input
                        type="checkbox"
                        id="isElectrified"
                        checked={value?.isElectrified || false}
                        onChange={(e) => handleElectrifiedToggle(e.target.checked)}
                        className="w-5 h-5 text-[var(--primary-action)] border-[var(--border-strong)] rounded focus:ring-[var(--primary-ring)]"
                    />
                    <label htmlFor="isElectrified" className="ml-3">
                        <span className="text-base font-semibold text-[var(--text)]">
                            This door is electrified
                        </span>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            Requires power for locks, strikes, access control, or monitoring
                        </p>
                    </label>
                </div>
            </div>

            {/* Conditional Fields - Only show if electrified */}
            {value?.isElectrified && (
                <>
                    {/* Power Requirements */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)] pb-1">Power Requirements</h4>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                                    Voltage <span className="text-red-500">*</span>
                                </label>
                                <Select
                                    value={value.voltage || '__none__'}
                                    onValueChange={v => updateField('voltage', (v === '__none__' ? undefined : v) as ElectrificationSpec['voltage'])}
                                >
                                    <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">Select...</SelectItem>
                                        <SelectItem value="12V DC">12V DC</SelectItem>
                                        <SelectItem value="24V DC">24V DC (Most Common)</SelectItem>
                                        <SelectItem value="120V AC">120V AC</SelectItem>
                                        <SelectItem value="POE">POE (Power over Ethernet)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Wiring Method</label>
                                <Select
                                    value={value.wiringMethod || '__none__'}
                                    onValueChange={v => updateField('wiringMethod', (v === '__none__' ? undefined : v) as ElectrificationSpec['wiringMethod'])}
                                >
                                    <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">Select...</SelectItem>
                                        <SelectItem value="EPT">EPT (Electric Power Transfer)</SelectItem>
                                        <SelectItem value="Loop">Loop / Conduit</SelectItem>
                                        <SelectItem value="Wireless">Wireless / Battery</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="eptRequired"
                                checked={value.eptRequired || false}
                                onChange={(e) => updateField('eptRequired', e.target.checked)}
                                className="w-4 h-4 text-[var(--primary-action)] border-[var(--border-strong)] rounded focus:ring-[var(--primary-ring)]"
                            />
                            <label htmlFor="eptRequired" className="ml-2 text-sm text-[var(--text-secondary)]">
                                EPT (Electric Power Transfer) Required
                                <span className="text-xs text-[var(--text-muted)] ml-1">(for continuous hinges with power)</span>
                            </label>
                        </div>
                    </div>

                    {/* Access Control */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)] pb-1">Access Control</h4>

                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Access Control Type</label>
                            <Select
                                value={value.accessControlType || 'None'}
                                onValueChange={v => updateField('accessControlType', v as ElectrificationSpec['accessControlType'])}
                            >
                                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="None">None / Mechanical Only</SelectItem>
                                    <SelectItem value="Card Reader">Card Reader (Proximity/RFID)</SelectItem>
                                    <SelectItem value="Keypad">Keypad / PIN Entry</SelectItem>
                                    <SelectItem value="Biometric">Biometric (Fingerprint/Facial)</SelectItem>
                                    <SelectItem value="Mobile Credential">Mobile Credential (Bluetooth/NFC)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="requestToExit"
                                    checked={value.requestToExit || false}
                                    onChange={(e) => updateField('requestToExit', e.target.checked)}
                                    className="w-4 h-4 text-[var(--primary-action)] border-[var(--border-strong)] rounded focus:ring-[var(--primary-ring)]"
                                />
                                <label htmlFor="requestToExit" className="ml-2 text-sm text-[var(--text-secondary)]">
                                    Request to Exit (REX)
                                </label>
                            </div>

                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="doorContact"
                                    checked={value.doorContact || false}
                                    onChange={(e) => updateField('doorContact', e.target.checked)}
                                    className="w-4 h-4 text-[var(--primary-action)] border-[var(--border-strong)] rounded focus:ring-[var(--primary-ring)]"
                                />
                                <label htmlFor="doorContact" className="ml-2 text-sm text-[var(--text-secondary)]">
                                    Door Contact / Position Switch
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Warning for missing voltage */}
                    {!value.voltage && (
                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                                <span className="text-amber-600 text-lg">⚠️</span>
                                <div>
                                    <div className="text-sm font-semibold text-amber-800 dark:text-amber-400">Voltage Required</div>
                                    <div className="text-xs text-amber-700 dark:text-amber-500">
                                        Electrified doors must specify voltage for proper power supply planning
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Live Summary Preview */}
            <div className={`border rounded-lg p-3 ${value?.isElectrified ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' : 'bg-[var(--bg-subtle)] border-[var(--border)]'}`}>
                <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${value?.isElectrified ? 'text-amber-700 dark:text-amber-400' : 'text-[var(--text-muted)]'}`}>
                    Electrification Summary
                </div>
                <div className={`text-sm font-medium ${value?.isElectrified ? 'text-amber-900 dark:text-amber-300' : 'text-[var(--text-secondary)]'}`}>
                    {getSummary()}
                </div>
            </div>
        </div>
    );
};

export default ElectrificationEditor;
