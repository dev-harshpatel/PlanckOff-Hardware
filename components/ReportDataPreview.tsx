import React, { useState } from 'react';
import { Door, HardwareSet, ElevationType } from '../types';

interface ReportDataPreviewProps {
    isOpen: boolean;
    onClose: () => void;
    doors?: Door[];
    hardwareSets?: HardwareSet[];
    elevationTypes?: ElevationType[];
    selectedColumns?: any;
    optionalColumns?: string[];
    format: 'xlsx' | 'pdf' | 'csv';
    reportType: 'door-schedule' | 'hardware-set' | 'submittal-package' | 'frame-submittal';
}

const ReportDataPreview: React.FC<ReportDataPreviewProps> = ({
    isOpen,
    onClose,
    doors = [],
    hardwareSets = [],
    elevationTypes = [],
    selectedColumns,
    optionalColumns = [],
    format,
    reportType
}) => {
    if (!isOpen) return null;

    // Get column headers based on report type
    const getHeaders = () => {
        if (reportType === 'door-schedule' && selectedColumns) {
            const headers: string[] = [];
            Object.entries(selectedColumns).forEach(([groupId, cols]: [string, any]) => {
                if (Array.isArray(cols)) {
                    cols.forEach(colId => {
                        // Map column IDs to readable labels  
                        const labelMap: Record<string, string> = {
                            // Identification
                            doorTag: 'Door Mark',
                            quantity: 'Qty',
                            location: 'Location',

                            // Dimensions & Rating
                            width: 'Width',
                            height: 'Height',
                            thickness: 'Thickness',
                            fireRating: 'Fire Rating',
                            fireRatingLabel: 'Label',
                            stcRating: 'STC',
                            smokeRating: 'Smoke',

                            // Door Specs
                            type: 'Type',
                            doorMaterial: 'Door Material',
                            doorCoreType: 'Core Type',
                            doorFaceType: 'Face Type',
                            woodSpecies: 'Wood Species',
                            doorFinish: 'Door Finish',
                            finishSystem: 'Finish System',
                            doorManufacturer: 'Door Mfr',
                            doorModelNumber: 'Door Model',

                            // Frame Specs
                            frameMaterial: 'Frame Material',
                            frameDepth: 'Frame Depth',
                            frameGauge: 'Gauge',
                            frameProfile: 'Profile',
                            anchorType: 'Anchor',
                            anchorSpacing: 'Anchor Spacing',
                            silencerQuantity: 'Silencers',
                            frameManufacturer: 'Frame Mfr',
                            frameModelNumber: 'Frame Model',
                            framePreparationNotes: 'Frame Prep Notes',

                            // Hardware Info
                            assignedHardwareSet: 'HW Set',
                            providedHardwareSet: 'Provided HW Set',
                            hardwarePrep: 'HW Prep',
                            hingeType: 'Hinge',
                            lockType: 'Lock',
                            handing: 'Handing',
                            swingDirection: 'Swing',
                            operation: 'Operation',

                            // Placement
                            interiorExterior: 'Int/Ext',
                            undercut: 'Undercut',
                            louvers: 'Louvers',
                            visionPanels: 'Vision Panels',

                            // Pricing
                            pricing: 'Door Price',
                            framePricing: 'Frame Price',
                            totalUnitCost: 'Unit Total',

                            // Notes
                            specialNotes: 'Special Notes',
                            csiSection: 'CSI Section',

                            // Legacy fields
                            egressRequired: 'Egress'
                        };
                        headers.push(labelMap[colId] || colId);
                    });
                }
            });
            return headers;
        } else if (reportType === 'hardware-set') {
            // Required columns
            const headers = ['Item Name', 'Description', 'Manufacturer', 'Finish', 'Usage/Location'];

            // Add optional columns
            const optionalLabelMap: Record<string, string> = {
                quantityPerSet: 'Qty/Set',
                totalQuantity: 'Total Qty',
                unitCost: 'Unit Cost',
                extendedCost: 'Ext. Cost',
                category: 'Category',
                modelNumber: 'Model #',
                leadTime: 'Lead Time',
                supplier: 'Supplier'
            };

            optionalColumns.forEach(colId => {
                headers.push(optionalLabelMap[colId] || colId);
            });

            return headers;
        }
        return [];
    };

    // Get row data based on report type
    const getRows = () => {
        if (reportType === 'door-schedule' && selectedColumns) {
            return doors.slice(0, 10).map(door => {
                const row: any[] = [];
                Object.entries(selectedColumns).forEach(([groupId, cols]: [string, any]) => {
                    if (Array.isArray(cols)) {
                        cols.forEach(colId => {
                            const value = (door as any)[colId];

                            // Special handling for complex fields
                            if (colId === 'assignedHardwareSet') {
                                row.push(value?.name || '-');
                            } else if (colId === 'pricing' || colId === 'framePricing') {
                                // Handle pricing objects
                                if (value && typeof value === 'object') {
                                    const total = value.total || value.unitCost || 0;
                                    row.push(total > 0 ? `$${total.toFixed(2)}` : '-');
                                } else {
                                    row.push('-');
                                }
                            } else if (colId === 'totalUnitCost') {
                                row.push(value ? `$${value.toFixed(2)}` : '-');
                            } else if (colId === 'handing' || colId === 'doorCoreType' || colId === 'doorFaceType' || colId === 'frameMaterial' || colId === 'anchorType' || colId === 'frameProfile') {
                                // Handle enum/object types - display their value property or toString
                                row.push(value?.toString() || value || '-');
                            } else if (typeof value === 'number') {
                                row.push(value);
                            } else if (typeof value === 'boolean') {
                                row.push(value ? 'Yes' : 'No');
                            } else {
                                row.push(value || '-');
                            }
                        });
                    }
                });
                return row;
            });
        } else if (reportType === 'hardware-set') {
            const rows: any[] = [];
            hardwareSets.slice(0, 5).forEach(set => {
                set.items.slice(0, 3).forEach(item => {
                    const doorsUsingSet = doors.filter(d => d.assignedHardwareSet?.name === set.name);
                    const doorTags = doorsUsingSet.map(d => d.doorTag || d.location || 'Unknown').join(', ');

                    // Required columns
                    const row: any[] = [
                        item.name,
                        item.description || '-',
                        item.manufacturer || '-',
                        item.finish || '-',
                        doorTags || 'Not assigned'
                    ];

                    // Add optional columns
                    optionalColumns.forEach(colId => {
                        switch (colId) {
                            case 'quantityPerSet':
                                row.push(item.quantity || 1);
                                break;
                            case 'totalQuantity':
                                const totalQty = doorsUsingSet.reduce((sum, d) =>
                                    sum + ((d.quantity || 1) * (item.quantity || 1)), 0);
                                row.push(totalQty);
                                break;
                            case 'unitCost':
                                row.push((item as any).unitCost ? `$${(item as any).unitCost.toFixed(2)}` : '-');
                                break;
                            case 'extendedCost':
                                const extCost = doorsUsingSet.reduce((sum, d) =>
                                    sum + ((d.quantity || 1) * (item.quantity || 1) * ((item as any).unitCost || 0)), 0);
                                row.push(extCost > 0 ? `$${extCost.toFixed(2)}` : '-');
                                break;
                            case 'category':
                                row.push((item as any).category || '-');
                                break;
                            case 'modelNumber':
                                row.push(item.modelNumber || '-');
                                break;
                            case 'leadTime':
                                row.push(item.leadTime || '-');
                                break;
                            case 'supplier':
                                row.push((item as any).supplier || '-');
                                break;
                            default:
                                row.push('-');
                        }
                    });

                    rows.push(row);
                });
            });
            return rows.slice(0, 10);
        }
        return [];
    };

    const headers = getHeaders();
    const rows = getRows();
    const totalRecords = reportType === 'door-schedule' ? doors.length :
        reportType === 'submittal-package' ? 0 :
            reportType === 'frame-submittal' ? 0 :
                hardwareSets.reduce((sum, set) => sum + set.items.length, 0);

    const getReportTitle = () => {
        switch (reportType) {
            case 'door-schedule': return '📊 Door Schedule';
            case 'hardware-set': return '⚙️ Hardware Set';
            case 'submittal-package': return '📦 Submittal Package';
            case 'frame-submittal': return '🖼️ Frame Submittal';
            default: return 'Report';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black bg-opacity-50"
                onClick={onClose}
            ></div>

            {/* Modal */}
            <div className="relative bg-[var(--bg)] rounded-2xl shadow-2xl w-full mx-4 max-h-[90vh] overflow-hidden" style={{ maxWidth: '1400px' }}>
                {/* Enhanced Header */}
                <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 px-8 py-6 flex items-center justify-between">
                    <div>
                        <h3 className="text-2xl font-bold text-white flex items-center space-x-3">
                            <span>{getReportTitle()} Preview</span>
                        </h3>
                        {reportType !== 'submittal-package' && reportType !== 'frame-submittal' && (
                            <p className="text-blue-100 text-sm mt-2 flex items-center space-x-2">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                                </svg>
                                <span>Showing first {Math.min(rows.length, 10)} of {totalRecords} records • Format: {format.toUpperCase()}</span>
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white hover:bg-white/20 rounded-lg p-2 transition-all duration-200"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content - Table Preview */}
                <div className="p-6 overflow-auto max-h-[calc(90vh-200px)] bg-[var(--bg-subtle)]">
                    {reportType === 'submittal-package' ? (
                        <div className="flex justify-center p-8">
                            <div className="bg-white shadow-lg border border-gray-200 w-[800px] min-h-[1000px] p-16 relative rounded-xl">
                                <div className="text-center mb-16">
                                    <h1 className="text-4xl font-bold text-gray-900 mb-4 tracking-wider">SUBMITTAL PACKAGE</h1>
                                    <div className="w-32 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 mx-auto mb-8"></div>
                                    <div className="text-gray-500 font-medium">PROJECT DOCUMENTATION PREVIEW</div>
                                </div>

                                <div className="space-y-8">
                                    <div className="border-b border-gray-200 pb-4">
                                        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                                            <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-3 text-sm">1</span>
                                            Door Schedule
                                        </h2>
                                        <div className="ml-11 text-gray-600">
                                            <p>{doors.length} Doors included</p>
                                        </div>
                                    </div>

                                    <div className="border-b border-gray-200 pb-4">
                                        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                                            <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mr-3 text-sm">2</span>
                                            Hardware Sets
                                        </h2>
                                        <div className="ml-11 text-gray-600">
                                            <p>{hardwareSets.length} Hardware Sets</p>
                                        </div>
                                    </div>

                                    <div className="border-b border-gray-200 pb-4">
                                        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                                            <span className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-3 text-sm">3</span>
                                            Elevations
                                        </h2>
                                        <div className="ml-11 text-gray-600">
                                            <p>{elevationTypes?.length || 0} Elevation Types</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="text-center py-12 text-[var(--text-muted)] bg-[var(--bg)] rounded-xl shadow-sm">
                            <svg className="w-16 h-16 mx-auto mb-4 text-[var(--text-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-lg font-medium">No data to preview</p>
                            <p className="text-sm mt-2">Add some {reportType === 'door-schedule' ? 'doors' : 'hardware items'} to see the preview</p>
                        </div>
                    ) : (
                        <div className="border-2 border-[var(--border-strong)] rounded-xl overflow-hidden shadow-lg bg-[var(--bg)]">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y-2 divide-[var(--border-strong)]">
                                    <thead className="bg-[var(--bg-muted)]">
                                        <tr>
                                            {headers.map((header, idx) => (
                                                <th
                                                    key={idx}
                                                    className="px-4 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider border-r-2 border-[var(--border-strong)] last:border-r-0 whitespace-nowrap"
                                                >
                                                    {header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-[var(--bg)] divide-y divide-[var(--border)]">
                                        {rows.map((row, rowIdx) => (
                                            <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-[var(--bg)] hover:bg-[var(--primary-bg)]' : 'bg-[var(--bg-subtle)] hover:bg-[var(--primary-bg-hover)]'}>
                                                {row.map((cell, cellIdx) => (
                                                    <td
                                                        key={cellIdx}
                                                        className="px-4 py-3 text-sm text-[var(--text)] border-r border-[var(--border)] last:border-r-0 whitespace-nowrap font-medium"
                                                    >
                                                        {cell}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Preview Note */}
                    {rows.length > 0 && (
                        <div className="mt-6 p-5 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-xl shadow-sm">
                            <div className="flex items-start">
                                <svg className="w-6 h-6 text-amber-600 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <div>
                                    <p className="text-sm font-bold text-amber-900">Preview Limitation</p>
                                    <p className="text-sm text-amber-800 mt-1">
                                        This preview shows the first {Math.min(rows.length, 10)} records. The actual {format.toUpperCase()} export will include all {totalRecords} records with full formatting, headers, and summaries.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Enhanced Footer */}
                <div className="bg-[var(--bg-muted)] px-8 py-5 flex justify-between items-center border-t-2 border-[var(--border-strong)]">
                    <div className="text-sm text-[var(--text-secondary)] flex items-center space-x-4">
                        <div className="bg-[var(--bg)] px-4 py-2 rounded-lg shadow-sm border border-[var(--border-strong)]">
                            <strong className="text-indigo-600">Total Records:</strong> <span className="font-semibold">{totalRecords}</span>
                        </div>
                        <div className="bg-[var(--bg)] px-4 py-2 rounded-lg shadow-sm border border-[var(--border-strong)]">
                            <strong className="text-indigo-600">Columns:</strong> <span className="font-semibold">{headers.length}</span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                        Close Preview
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReportDataPreview;
