import React, { useState, useEffect } from 'react';
import { Door, HardwareSet } from '../types';
import { exportMultiSheetWorkbook } from '../services/excelExportService';

export interface ExportConfiguration {
    sheets: {
        doorSchedule: boolean;
        hardwareSchedule: boolean;
        frameDetails: boolean;
        procurementSummary: boolean;
    };
    doorScheduleColumns: string[];
    hardwareScheduleColumns: string[];
    frameDetailsColumns: string[];
    procurementSummaryColumns: string[];
    presetName?: string;
}

export interface ExportPreset {
    name: string;
    config: ExportConfiguration;
    createdAt: Date;
}

interface ExportConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    doors: Door[];
    hardwareSets: HardwareSet[];
    projectName: string;
}

type TabView = 'sheets' | 'columns' | 'presets';

const PRESETS_KEY = 'export_config_presets';

// Default presets
const DEFAULT_PRESETS: ExportPreset[] = [
    {
        name: 'Full Export',
        config: {
            sheets: {
                doorSchedule: true,
                hardwareSchedule: true,
                frameDetails: true,
                procurementSummary: true
            },
            doorScheduleColumns: [],
            hardwareScheduleColumns: [],
            frameDetailsColumns: [],
            procurementSummaryColumns: []
        },
        createdAt: new Date()
    },
    {
        name: 'Basic Export',
        config: {
            sheets: {
                doorSchedule: true,
                hardwareSchedule: true,
                frameDetails: false,
                procurementSummary: false
            },
            doorScheduleColumns: [],
            hardwareScheduleColumns: [],
            frameDetailsColumns: [],
            procurementSummaryColumns: []
        },
        createdAt: new Date()
    },
    {
        name: 'Procurement Only',
        config: {
            sheets: {
                doorSchedule: false,
                hardwareSchedule: true,
                frameDetails: false,
                procurementSummary: true
            },
            doorScheduleColumns: [],
            hardwareScheduleColumns: [],
            frameDetailsColumns: [],
            procurementSummaryColumns: []
        },
        createdAt: new Date()
    },
    {
        name: 'Submittal Package',
        config: {
            sheets: {
                doorSchedule: true,
                hardwareSchedule: false,
                frameDetails: true,
                procurementSummary: false
            },
            doorScheduleColumns: [],
            hardwareScheduleColumns: [],
            frameDetailsColumns: [],
            procurementSummaryColumns: []
        },
        createdAt: new Date()
    }
];

const ExportConfigModal: React.FC<ExportConfigModalProps> = ({
    isOpen,
    onClose,
    doors,
    hardwareSets,
    projectName
}) => {
    const [currentTab, setCurrentTab] = useState<TabView>('sheets');
    const [config, setConfig] = useState<ExportConfiguration>({
        sheets: {
            doorSchedule: true,
            hardwareSchedule: true,
            frameDetails: true,
            procurementSummary: true
        },
        doorScheduleColumns: [],
        hardwareScheduleColumns: [],
        frameDetailsColumns: [],
        procurementSummaryColumns: []
    });
    const [presets, setPresets] = useState<ExportPreset[]>([]);
    const [newPresetName, setNewPresetName] = useState('');

    // Load presets from localStorage
    useEffect(() => {
        const stored = localStorage.getItem(PRESETS_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setPresets([...DEFAULT_PRESETS, ...parsed]);
            } catch (e) {
                setPresets(DEFAULT_PRESETS);
            }
        } else {
            setPresets(DEFAULT_PRESETS);
        }
    }, []);

    const toggleSheet = (sheet: keyof ExportConfiguration['sheets']) => {
        setConfig(prev => ({
            ...prev,
            sheets: {
                ...prev.sheets,
                [sheet]: !prev.sheets[sheet]
            }
        }));
    };

    const handleExport = () => {
        exportMultiSheetWorkbook(doors, hardwareSets, {
            includeDoorSchedule: config.sheets.doorSchedule,
            includeHardwareSchedule: config.sheets.hardwareSchedule,
            includeFrameDetails: config.sheets.frameDetails,
            includeProcurementSummary: config.sheets.procurementSummary,
            projectName
        });
        onClose();
    };

    const savePreset = () => {
        if (!newPresetName.trim()) return;

        const newPreset: ExportPreset = {
            name: newPresetName,
            config: { ...config },
            createdAt: new Date()
        };

        const userPresets = presets.filter(p => !DEFAULT_PRESETS.find(dp => dp.name === p.name));
        const updatedPresets = [...userPresets, newPreset];

        localStorage.setItem(PRESETS_KEY, JSON.stringify(updatedPresets));
        setPresets([...DEFAULT_PRESETS, ...updatedPresets]);
        setNewPresetName('');
    };

    const loadPreset = (preset: ExportPreset) => {
        setConfig(preset.config);
    };

    const deletePreset = (presetName: string) => {
        if (DEFAULT_PRESETS.find(p => p.name === presetName)) return;

        const userPresets = presets.filter(p =>
            !DEFAULT_PRESETS.find(dp => dp.name === p.name) && p.name !== presetName
        );

        localStorage.setItem(PRESETS_KEY, JSON.stringify(userPresets));
        setPresets([...DEFAULT_PRESETS, ...userPresets]);
    };

    const selectedSheetsCount = Object.values(config.sheets).filter(Boolean).length;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[var(--bg)] rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-[var(--primary-action)] to-[var(--primary-action-hover)] text-white p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold">Export Configuration</h2>
                            <p className="text-white/70 mt-1">Customize your multi-sheet Excel export</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-[var(--border)] bg-[var(--bg-subtle)]">
                    <div className="flex gap-1 px-6">
                        <button
                            onClick={() => setCurrentTab('sheets')}
                            className={`py-3 px-6 font-medium border-b-2 transition-colors ${currentTab === 'sheets'
                                    ? 'border-[var(--primary-action)] text-[var(--primary-text)] bg-[var(--bg)]'
                                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
                                }`}
                        >
                            Sheets ({selectedSheetsCount}/4)
                        </button>
                        <button
                            onClick={() => setCurrentTab('columns')}
                            className={`py-3 px-6 font-medium border-b-2 transition-colors ${currentTab === 'columns'
                                    ? 'border-[var(--primary-action)] text-[var(--primary-text)] bg-[var(--bg)]'
                                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
                                }`}
                        >
                            Columns
                        </button>
                        <button
                            onClick={() => setCurrentTab('presets')}
                            className={`py-3 px-6 font-medium border-b-2 transition-colors ${currentTab === 'presets'
                                    ? 'border-[var(--primary-action)] text-[var(--primary-text)] bg-[var(--bg)]'
                                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
                                }`}
                        >
                            Presets
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 220px)' }}>
                    {currentTab === 'sheets' && (
                        <div className="space-y-4">
                            <p className="text-[var(--text-muted)] mb-4">Select which sheets to include in your export</p>

                            {/* Door Schedule */}
                            <div className={`flex items-start gap-3 p-4 border-2 rounded-lg transition-colors ${config.sheets.doorSchedule ? 'border-[var(--primary-ring)] bg-[var(--primary-bg)]' : 'border-[var(--border)]'
                                }`}>
                                <input
                                    type="checkbox"
                                    checked={config.sheets.doorSchedule}
                                    onChange={() => toggleSheet('doorSchedule')}
                                    className="mt-1 w-5 h-5 text-[var(--primary-action)] rounded"
                                />
                                <div className="flex-1">
                                    <h4 className="font-bold text-[var(--text)]">Door Schedule</h4>
                                    <p className="text-sm text-[var(--text-muted)] mt-1">
                                        Complete door specifications with dimensions, materials, fire ratings, and hardware assignments
                                    </p>
                                    <span className="inline-block mt-2 text-xs text-[var(--text-muted)] bg-[var(--bg-muted)] px-2 py-1 rounded">
                                        {doors.length} doors
                                    </span>
                                </div>
                            </div>

                            {/* Hardware Schedule */}
                            <div className={`flex items-start gap-3 p-4 border-2 rounded-lg transition-colors ${config.sheets.hardwareSchedule ? 'border-[var(--primary-ring)] bg-[var(--primary-bg)]' : 'border-[var(--border)]'
                                }`}>
                                <input
                                    type="checkbox"
                                    checked={config.sheets.hardwareSchedule}
                                    onChange={() => toggleSheet('hardwareSchedule')}
                                    className="mt-1 w-5 h-5 text-[var(--primary-action)] rounded"
                                />
                                <div className="flex-1">
                                    <h4 className="font-bold text-[var(--text)]">Hardware Schedule</h4>
                                    <p className="text-sm text-[var(--text-muted)] mt-1">
                                        Detailed hardware items grouped by set with quantities, manufacturers, and specifications
                                    </p>
                                    <span className="inline-block mt-2 text-xs text-[var(--text-muted)] bg-[var(--bg-muted)] px-2 py-1 rounded">
                                        {hardwareSets.length} hardware sets
                                    </span>
                                </div>
                            </div>

                            {/* Frame Details */}
                            <div className={`flex items-start gap-3 p-4 border-2 rounded-lg transition-colors ${config.sheets.frameDetails ? 'border-[var(--primary-ring)] bg-[var(--primary-bg)]' : 'border-[var(--border)]'
                                }`}>
                                <input
                                    type="checkbox"
                                    checked={config.sheets.frameDetails}
                                    onChange={() => toggleSheet('frameDetails')}
                                    className="mt-1 w-5 h-5 text-[var(--primary-action)] rounded"
                                />
                                <div className="flex-1">
                                    <h4 className="font-bold text-[var(--text)]">Frame Details</h4>
                                    <p className="text-sm text-[var(--text-muted)] mt-1">
                                        Frame specifications including materials, profiles, anchors, and preparation notes
                                    </p>
                                    <span className="inline-block mt-2 text-xs text-[var(--text-muted)] bg-[var(--bg-muted)] px-2 py-1 rounded">
                                        {doors.length} frames
                                    </span>
                                </div>
                            </div>

                            {/* Procurement Summary */}
                            <div className={`flex items-start gap-3 p-4 border-2 rounded-lg transition-colors ${config.sheets.procurementSummary ? 'border-[var(--primary-ring)] bg-[var(--primary-bg)]' : 'border-[var(--border)]'
                                }`}>
                                <input
                                    type="checkbox"
                                    checked={config.sheets.procurementSummary}
                                    onChange={() => toggleSheet('procurementSummary')}
                                    className="mt-1 w-5 h-5 text-[var(--primary-action)] rounded"
                                />
                                <div className="flex-1">
                                    <h4 className="font-bold text-[var(--text)]">Procurement Summary</h4>
                                    <p className="text-sm text-[var(--text-muted)] mt-1">
                                        Hardware grouped by manufacturer for efficient ordering and procurement planning
                                    </p>
                                    <span className="inline-block mt-2 text-xs text-[var(--text-muted)] bg-[var(--bg-muted)] px-2 py-1 rounded">
                                        Organized by manufacturer
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {currentTab === 'columns' && (
                        <div>
                            <p className="text-[var(--text-muted)] mb-4">Column customization coming soon</p>
                            <div className="bg-[var(--primary-bg)] border border-[var(--primary-border)] rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <svg className="w-6 h-6 text-[var(--primary-text-muted)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div>
                                        <h4 className="font-bold text-[var(--primary-text)]">Feature Coming Soon</h4>
                                        <p className="text-sm text-[var(--primary-text-muted)] mt-1">
                                            Column customization will allow you to select specific columns for each sheet.
                                            Currently, all columns are included by default.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {currentTab === 'presets' && (
                        <div className="space-y-6">
                            {/* Save New Preset */}
                            <div className="bg-[var(--bg-subtle)] rounded-lg p-4 border border-[var(--border)]">
                                <h4 className="font-bold text-[var(--text)] mb-3">Save Current Configuration</h4>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newPresetName}
                                        onChange={(e) => setNewPresetName(e.target.value)}
                                        placeholder="Preset name..."
                                        className="flex-1 px-3 py-2 border border-[var(--border-strong)] rounded-lg bg-[var(--bg)] text-[var(--text)] focus:ring-2 focus:ring-[var(--primary-ring)] focus:border-transparent"
                                    />
                                    <button
                                        onClick={savePreset}
                                        disabled={!newPresetName.trim()}
                                        className="px-4 py-2 bg-[var(--primary-action)] text-white rounded-lg hover:bg-[var(--primary-action-hover)] disabled:bg-[var(--bg-emphasis)] disabled:text-[var(--text-faint)] disabled:cursor-not-allowed transition-colors"
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>

                            {/* Preset List */}
                            <div>
                                <h4 className="font-bold text-[var(--text)] mb-3">Available Presets</h4>
                                <div className="space-y-2">
                                    {presets.map((preset) => {
                                        const isDefault = DEFAULT_PRESETS.find(p => p.name === preset.name);
                                        const sheetsCount = Object.values(preset.config.sheets).filter(Boolean).length;

                                        return (
                                            <div
                                                key={preset.name}
                                                className="flex items-center justify-between p-3 border border-[var(--border)] rounded-lg hover:bg-[var(--bg-subtle)] transition-colors"
                                            >
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <h5 className="font-medium text-[var(--text)]">{preset.name}</h5>
                                                        {isDefault && (
                                                            <span className="px-2 py-0.5 bg-[var(--primary-bg-hover)] text-[var(--primary-text)] text-xs font-medium rounded">
                                                                Default
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-[var(--text-muted)] mt-1">
                                                        {sheetsCount} sheet{sheetsCount !== 1 ? 's' : ''} selected
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => loadPreset(preset)}
                                                        className="px-3 py-1.5 text-[var(--primary-text-muted)] hover:bg-[var(--primary-bg)] rounded-lg transition-colors text-sm font-medium"
                                                    >
                                                        Load
                                                    </button>
                                                    {!isDefault && (
                                                        <button
                                                            onClick={() => deletePreset(preset.name)}
                                                            className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                                                        >
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-[var(--border)] p-6 bg-[var(--bg-subtle)]">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-[var(--text-muted)]">
                            {selectedSheetsCount} sheet{selectedSheetsCount !== 1 ? 's' : ''} selected
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleExport}
                                disabled={selectedSheetsCount === 0}
                                className="px-6 py-2 bg-[var(--primary-action)] text-white rounded-lg hover:bg-[var(--primary-action-hover)] disabled:bg-[var(--bg-emphasis)] disabled:text-[var(--text-faint)] disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Export Excel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExportConfigModal;
