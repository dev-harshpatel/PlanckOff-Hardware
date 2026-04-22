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
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--text-muted)]">
                        <span className="font-semibold text-[var(--text)]">{selectedColumns.length}</span> columns selected
                    </span>
                    {exportFormat === 'pdf' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-[var(--warning-bg)] text-[var(--warning-text)] border border-[var(--warning-border)]">
                            PDF format
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 border border-[var(--border)] rounded-md px-2 py-1.5">
                        <label className="text-xs text-[var(--text-muted)]">Format:</label>
                        <select
                            value={exportFormat}
                            onChange={(e) => setExportFormat(e.target.value as 'excel' | 'pdf')}
                            className="text-xs bg-transparent text-[var(--text)] border-none outline-none cursor-pointer"
                        >
                            <option value="excel">Excel (.xlsx)</option>
                            <option value="pdf">PDF (.pdf)</option>
                        </select>
                    </div>
                    <button
                        onClick={() => setShowPreview(!showPreview)}
                        className="text-xs px-3 py-1.5 border border-[var(--border)] rounded-md text-[var(--text-secondary)] hover:border-[var(--primary-border)] hover:text-[var(--primary-text)] hover:bg-[var(--primary-bg)] transition-colors"
                    >
                        {showPreview ? 'Hide Preview' : 'Preview Report'}
                    </button>
                    <button
                        onClick={handleGenerate}
                        className="text-xs px-3 py-1.5 rounded-md bg-[var(--primary-action)] text-[var(--text-inverted)] hover:bg-[var(--primary-action-hover)] transition-colors font-semibold"
                    >
                        Export {exportFormat === 'pdf' ? 'PDF' : 'Excel'}
                    </button>
                </div>
            </div>

            <div className="bg-[var(--bg)] rounded-md border border-[var(--border)] overflow-hidden">
                {!showPreview && (
                    <div className="p-5 space-y-5">
                        {/* Preset Buttons */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Presets:</span>
                            {(['basic', 'pricing', 'frame-schedule', 'all'] as const).map((preset) => (
                                <button
                                    key={preset}
                                    onClick={() => handlePreset(preset)}
                                    className="text-xs px-3 py-1.5 border border-[var(--border)] rounded-md text-[var(--text-secondary)] bg-[var(--bg)] hover:border-[var(--primary-border)] hover:text-[var(--primary-text)] hover:bg-[var(--primary-bg)] transition-colors capitalize"
                                >
                                    {preset === 'frame-schedule' ? 'Frame Schedule' : preset === 'all' ? 'Select All' : preset.charAt(0).toUpperCase() + preset.slice(1)}
                                </button>
                            ))}
                        </div>

                        {/* Column Groups */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Object.entries(COLUMN_GROUPS).map(([group, columns]) => {
                                const selectedInGroup = columns.filter(col => selectedColumns.includes(col.id)).length;
                                return (
                                    <div key={group} className="border border-[var(--border)] rounded-md hover:border-[var(--primary-border)] transition-colors">
                                        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-subtle)]">
                                            <h4 className="text-xs font-semibold text-[var(--text)]">{group}</h4>
                                            <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--primary-bg)] text-[var(--primary-text)] font-semibold">
                                                {selectedInGroup}/{columns.length}
                                            </span>
                                        </div>
                                        <div className="p-2 space-y-0.5">
                                            {columns.map(col => (
                                                <label key={col.id} className="flex items-center gap-2.5 cursor-pointer px-2 py-1.5 rounded hover:bg-[var(--primary-bg)] transition-colors group">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedColumns.includes(col.id)}
                                                        onChange={() => toggleColumn(col.id)}
                                                        className="rounded border-[var(--border-strong)] text-[var(--primary-action)] focus:ring-[var(--primary-ring)] w-3.5 h-3.5 cursor-pointer"
                                                    />
                                                    <span className="text-xs text-[var(--text-secondary)] group-hover:text-[var(--primary-text)] transition-colors">{col.label}</span>
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
