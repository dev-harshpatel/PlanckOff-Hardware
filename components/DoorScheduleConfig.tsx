import React, { useState, useMemo } from 'react';
import { Door, HardwareSet, ElevationType } from '../types';
import ReportDataPreview from './ReportDataPreview';
import { exportDoorScheduleToExcel, exportDoorScheduleToPDF } from '../services/excelExportService';

export interface DoorScheduleExportConfig {
  format?: string;
  columns: {
    basic: string[];
    dimensions: string[];
    materials: string[];
    fireSafety: string[];
    hardware: string[];
    additional: string[];
  };
  includeHeader: boolean;
  includeSummary: boolean;
}

interface DoorScheduleConfigProps {
    doors: Door[];
    hardwareSets?: HardwareSet[];
    elevationTypes?: ElevationType[];
    projectName: string;
    onUpdateDoors?: (doors: Door[]) => void;
    onBack?: () => void;
    onExport?: (config: DoorScheduleExportConfig) => void;
}

const COLUMN_GROUPS = {
    'Identification': [
        { id: 'doorTag', label: 'Door Mark' },
        { id: 'quantity', label: 'Qty' },
        { id: 'location', label: 'Location' },
    ],
    'Dimensions & Rating': [
        { id: 'width', label: 'Width' },
        { id: 'height', label: 'Height' },
        { id: 'thickness', label: 'Thickness' },
        { id: 'fireRating', label: 'Fire Rating' },
        { id: 'fireRatingLabel', label: 'Label' },
        { id: 'stcRating', label: 'STC' },
        { id: 'smokeRating', label: 'Smoke' },
    ],
    'Door Specs': [
        { id: 'type', label: 'Door Type' },
        { id: 'doorMaterial', label: 'Door Material' },
        { id: 'doorCoreType', label: 'Core Type' },
        { id: 'doorFaceType', label: 'Face Type' },
        { id: 'woodSpecies', label: 'Wood Species' },
        { id: 'doorFinish', label: 'Door Finish' },
        { id: 'finishSystem', label: 'Finish System' },
        { id: 'doorManufacturer', label: 'Door Mfr' },
        { id: 'doorModelNumber', label: 'Door Model' },
    ],
    'Frame Specs': [
        { id: 'frameMaterial', label: 'Frame Material' },
        { id: 'frameDepth', label: 'Frame Depth' },
        { id: 'frameGauge', label: 'Gauge' },
        { id: 'frameProfile', label: 'Profile' },
        { id: 'anchorType', label: 'Anchor' },
        { id: 'anchorSpacing', label: 'Anchor Spacing' },
        { id: 'silencerQuantity', label: 'Silencers' },
        { id: 'frameManufacturer', label: 'Frame Mfr' },
        { id: 'frameModelNumber', label: 'Frame Model' },
        { id: 'framePreparationNotes', label: 'Frame Prep Notes' },
    ],
    'Hardware Info': [
        { id: 'assignedHardwareSet', label: 'HW Set' },
        { id: 'providedHardwareSet', label: 'Provided HW Set' },
        { id: 'hardwarePrep', label: 'HW Prep' },
        { id: 'hingeType', label: 'Hinge' },
        { id: 'lockType', label: 'Lock' },
        { id: 'handing', label: 'Handing' },
        { id: 'swingDirection', label: 'Swing' },
        { id: 'operation', label: 'Operation' },
    ],
    'Placement': [
        { id: 'interiorExterior', label: 'Int/Ext' },
        { id: 'undercut', label: 'Undercut' },
        { id: 'louvers', label: 'Louvers' },
        { id: 'visionPanels', label: 'Vision Panels' },
    ],
    'Pricing': [
        { id: 'pricing', label: 'Door Price ($)' },
        { id: 'framePricing', label: 'Frame Price ($)' },
        { id: 'totalUnitCost', label: 'Unit Total ($)' },
    ],
    'Notes': [
        { id: 'specialNotes', label: 'Special Notes' },
        { id: 'csiSection', label: 'CSI Section' },
    ],
    'Elevation': [
        { id: 'elevationTypeId', label: 'Elevation Type' },
        { id: 'elevationImageUrl', label: 'Elevation Image URL' },
    ],
};

const DEFAULT_COLUMNS = ['doorTag', 'quantity', 'width', 'height', 'type', 'frameMaterial', 'assignedHardwareSet', 'pricing', 'framePricing', 'totalUnitCost'];

const DoorScheduleConfig: React.FC<DoorScheduleConfigProps> = ({
    doors,
    hardwareSets,
    elevationTypes = [],
    projectName,
    onUpdateDoors
}) => {
    // Flatten groups for easy access
    const allColumnIds = useMemo(() => {
        return Object.values(COLUMN_GROUPS).flat().map(c => c.id);
    }, []);

    const allColumnLabels = useMemo(() => {
        const acc: Record<string, string> = {};
        Object.values(COLUMN_GROUPS).flat().forEach(c => {
            acc[c.id] = c.label;
        });
        return acc;
    }, []);

    const [selectedColumns, setSelectedColumns] = useState<string[]>(DEFAULT_COLUMNS);
    const [showPreview, setShowPreview] = useState(false);
    const [exportFormat, setExportFormat] = useState<'excel' | 'pdf'>('excel');

    const toggleColumn = (colId: string) => {
        setSelectedColumns(prev =>
            prev.includes(colId)
                ? prev.filter(c => c !== colId)
                : [...prev, colId]
        );
    };

    const handleGenerate = () => {
        if (exportFormat === 'pdf') {
            exportDoorScheduleToPDF(doors, selectedColumns, projectName || "Door_Schedule_Export", elevationTypes);
        } else {
            const tempConfig: DoorScheduleExportConfig = {
                columns: {
                    basic: selectedColumns.filter(c => ['doorTag', 'location', 'quantity', 'type'].includes(c)),
                    dimensions: selectedColumns.filter(c => ['width', 'height', 'thickness', 'frameDepth'].includes(c)),
                    materials: selectedColumns.filter(c => ['doorMaterial', 'frameMaterial', 'doorCoreType', 'woodSpecies'].includes(c)),
                    fireSafety: selectedColumns.filter(c => ['fireRating', 'smokeRating', 'stcRating', 'egressRequired'].includes(c)),
                    hardware: selectedColumns.filter(c => ['assignedHardwareSet', 'hardwarePrep', 'hingeType', 'lockType'].includes(c)),
                    additional: selectedColumns.filter(c => ['interiorExterior', 'swingDirection', 'undercut', 'louvers', 'visionPanels', 'specialNotes', 'elevationTypeId', 'elevationImageUrl'].includes(c)),
                },
                includeHeader: true,
                includeSummary: true,
            };
            exportDoorScheduleToExcel(doors, tempConfig, projectName || "Door_Schedule_Export", elevationTypes);
        }
    };

    const handlePreset = (preset: 'basic' | 'pricing' | 'frame-schedule' | 'all') => {
        if (preset === 'basic') {
            setSelectedColumns(['doorTag', 'quantity', 'width', 'height', 'type', 'frameMaterial', 'assignedHardwareSet', 'handing']);
        } else if (preset === 'pricing') {
            setSelectedColumns(['doorTag', 'quantity', 'type', 'frameMaterial', 'pricing', 'framePricing', 'totalUnitCost']);
        } else if (preset === 'frame-schedule') {
            // Frame Only Report Preset
            setSelectedColumns(['doorTag', 'quantity', 'frameMaterial', 'frameDepth', 'frameGauge', 'frameProfile', 'anchorType', 'handing', 'framePricing']);
        } else if (preset === 'all') {
            setSelectedColumns(allColumnIds);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-[var(--bg)] rounded-2xl shadow-lg border border-[var(--border)] overflow-hidden">
                {/* Gradient Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-white">Configure Door Schedule Report</h2>
                            <p className="text-blue-100 text-sm mt-1">Select the columns you want to include in your report</p>
                        </div>
                        <div className="flex space-x-3">
                            {/* Format Selector */}
                            <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/30">
                                <label className="text-white text-sm font-medium">Format:</label>
                                <select
                                    value={exportFormat}
                                    onChange={(e) => setExportFormat(e.target.value as 'excel' | 'pdf')}
                                    className="bg-white/90 text-gray-900 dark:text-gray-900 text-sm font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-white cursor-pointer"
                                >
                                    <option value="excel">Excel (.xlsx)</option>
                                    <option value="pdf">PDF (.pdf)</option>
                                </select>
                            </div>

                            <button
                                onClick={() => setShowPreview(!showPreview)}
                                className="px-5 py-2.5 bg-white/20 backdrop-blur-sm text-white rounded-xl hover:bg-white/30 text-sm font-semibold transition-all duration-200 border border-white/30 flex items-center space-x-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                <span>{showPreview ? "Hide Preview" : "Preview Report"}</span>
                            </button>
                            <button
                                onClick={handleGenerate}
                                className="px-6 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span>Export {exportFormat === 'pdf' ? 'PDF' : 'Excel'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Column Count Indicator */}
                    <div className="mt-4 flex items-center space-x-2 text-white text-sm">
                        <div className="bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/30">
                            <span className="font-semibold">{selectedColumns.length}</span> columns selected
                        </div>
                        {exportFormat === 'pdf' && (
                            <div className="bg-amber-500/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-amber-400/50 flex items-center space-x-1">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <span className="text-xs font-medium">PDF format selected</span>
                            </div>
                        )}
                    </div>
                </div>

                {!showPreview && (
                    <div className="p-8 space-y-6">
                        {/* Preset Buttons */}
                        <div className="bg-[var(--bg-subtle)] rounded-xl p-5 border border-[var(--border)]">
                            <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-2">
                                    <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                    </svg>
                                    <span className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide">Quick Presets:</span>
                                </div>
                                <div className="flex space-x-2">
                                    <button onClick={() => handlePreset('basic')} className="px-4 py-2 text-sm bg-[var(--bg)] border-2 border-[var(--border-strong)] text-[var(--text-secondary)] rounded-lg hover:bg-blue-50 hover:border-blue-500 hover:text-blue-700 font-medium transition-all duration-200 shadow-sm">
                                        📋 Basic
                                    </button>
                                    <button onClick={() => handlePreset('pricing')} className="px-4 py-2 text-sm bg-[var(--bg)] border-2 border-[var(--border-strong)] text-[var(--text-secondary)] rounded-lg hover:bg-green-50 hover:border-green-500 hover:text-green-700 font-medium transition-all duration-200 shadow-sm">
                                        💰 Pricing
                                    </button>
                                    <button onClick={() => handlePreset('frame-schedule')} className="px-4 py-2 text-sm bg-[var(--bg)] border-2 border-[var(--border-strong)] text-[var(--text-secondary)] rounded-lg hover:bg-purple-50 hover:border-purple-500 hover:text-purple-700 font-medium transition-all duration-200 shadow-sm">
                                        🖼️ Frame Schedule
                                    </button>
                                    <button onClick={() => handlePreset('all')} className="px-4 py-2 text-sm bg-[var(--bg)] border-2 border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-50 hover:border-indigo-600 font-medium transition-all duration-200 shadow-sm">
                                        ✅ Select All
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Column Groups */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {Object.entries(COLUMN_GROUPS).map(([group, columns]) => {
                                const selectedInGroup = columns.filter(col => selectedColumns.includes(col.id)).length;
                                return (
                                    <div key={group} className="bg-[var(--bg)] rounded-xl p-5 border-2 border-[var(--border)] hover:border-indigo-300 transition-all duration-200 shadow-sm hover:shadow-md">
                                        <div className="flex items-center justify-between mb-3 pb-3 border-b-2 border-[var(--border)]">
                                            <h4 className="font-bold text-base text-[var(--text)]">{group}</h4>
                                            <span className="bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full text-xs font-semibold">
                                                {selectedInGroup}/{columns.length}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2.5">
                                            {columns.map(col => (
                                                <label key={col.id} className="flex items-center space-x-3 cursor-pointer group hover:bg-indigo-50 p-2 rounded-lg transition-all duration-150">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedColumns.includes(col.id)}
                                                        onChange={() => toggleColumn(col.id)}
                                                        className="rounded border-2 border-[var(--border-strong)] text-indigo-600 focus:ring-2 focus:ring-indigo-500 w-5 h-5 cursor-pointer transition-all duration-150"
                                                    />
                                                    <span className="text-sm text-[var(--text-secondary)] group-hover:text-indigo-900 font-medium">{col.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {showPreview && (
                <ReportDataPreview
                    isOpen={showPreview}
                    onClose={() => setShowPreview(false)}
                    doors={doors}
                    hardwareSets={hardwareSets}
                    selectedColumns={{
                        basic: selectedColumns.filter(c => ['doorTag', 'location', 'quantity', 'type'].includes(c)),
                        dimensions: selectedColumns.filter(c => ['width', 'height', 'thickness', 'frameDepth'].includes(c)),
                        materials: selectedColumns.filter(c => ['doorMaterial', 'frameMaterial', 'doorCoreType', 'doorFaceType', 'woodSpecies'].includes(c)),
                        fireSafety: selectedColumns.filter(c => ['fireRating', 'smokeRating', 'stcRating', 'egressRequired', 'fireRatingLabel'].includes(c)),
                        hardware: selectedColumns.filter(c => ['assignedHardwareSet', 'providedHardwareSet', 'hardwarePrep', 'hingeType', 'lockType'].includes(c)),
                        additional: selectedColumns.filter(c => ['interiorExterior', 'swingDirection', 'undercut', 'louvers', 'visionPanels', 'specialNotes', 'operation', 'handing'].includes(c))
                    }}
                    format="xlsx"
                    reportType="door-schedule"
                />
            )}
        </div>
    );
};

export default DoorScheduleConfig;
