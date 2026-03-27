import React, { useState, useMemo } from 'react';
import { Door, HardwareSet, HardwareItem } from '../types';
import ReportDataPreview from './ReportDataPreview';

interface HardwareSetConfigProps {
    doors: Door[];
    hardwareSets: HardwareSet[];
    projectName: string;
    onBack: () => void;
    onExport: (config: HardwareSetExportConfig) => void;
}

export interface HardwareSetExportConfig {
    requiredColumns: ['name', 'description', 'manufacturer', 'finish', 'usage'];
    optionalColumns: string[];
    groupBy: 'set' | 'type' | 'manufacturer' | 'flat';
    usageDisplay: 'all' | 'count' | 'preview';
    format: 'xlsx' | 'pdf' | 'csv';
    includeSetSummary: boolean;
    includeCostSummary: boolean;
    includeProcurement: boolean;
}

interface HardwareItemUsage {
    item: HardwareItem;
    doorTags: string[];
    totalQuantity: number;
    sets: string[];
}

const OPTIONAL_COLUMNS = [
    { id: 'quantityPerSet', label: 'Quantity per Set' },
    { id: 'totalQuantity', label: 'Total Quantity Needed' },
    { id: 'unitPrice', label: 'Unit Price' },
    { id: 'extendedPrice', label: 'Extended Price' },
    { id: 'laborCost', label: 'Labor Cost' },
    { id: 'installationTime', label: 'Installation Time' },
    { id: 'category', label: 'Category' },
    { id: 'modelNumber', label: 'Model Number' },
    { id: 'leadTime', label: 'Lead Time' },
    { id: 'supplier', label: 'Supplier' }
];

const HardwareSetConfig: React.FC<HardwareSetConfigProps> = ({
    doors,
    hardwareSets,
    projectName,
    onBack,
    onExport
}) => {
    const [optionalColumns, setOptionalColumns] = useState<string[]>([
        'quantityPerSet',
        'totalQuantity',
        'unitPrice',
        'extendedPrice'
    ]);
    const [groupBy, setGroupBy] = useState<'set' | 'type' | 'manufacturer' | 'flat'>('set');
    const [usageDisplay, setUsageDisplay] = useState<'all' | 'count' | 'preview'>('all');
    const [format, setFormat] = useState<'xlsx' | 'pdf' | 'csv'>('pdf');
    const [includeSetSummary, setIncludeSetSummary] = useState(true);
    const [includeCostSummary, setIncludeCostSummary] = useState(true);
    const [includeProcurement, setIncludeProcurement] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    // Calculate usage statistics
    const usageStats = useMemo(() => {
        const itemUsageMap = new Map<string, HardwareItemUsage>();

        hardwareSets.forEach(set => {
            set.items.forEach(item => {
                const key = `${item.name}|${item.manufacturer || ''}|${item.finish || ''}`;

                if (!itemUsageMap.has(key)) {
                    itemUsageMap.set(key, {
                        item,
                        doorTags: [],
                        totalQuantity: 0,
                        sets: []
                    });
                }

                const usage = itemUsageMap.get(key)!;

                // Find all doors using this set
                const doorsWithSet = doors.filter(d =>
                    d.assignedHardwareSet?.name === set.name
                );

                doorsWithSet.forEach(door => {
                    const doorTag = door.doorTag || door.location || 'Unknown';
                    if (!usage.doorTags.includes(doorTag)) {
                        usage.doorTags.push(doorTag);
                    }
                    const doorQty = (door.quantity || 1) * (door.liftCount || 1);
                    usage.totalQuantity += item.quantity * doorQty;
                });

                if (!usage.sets.includes(set.name)) {
                    usage.sets.push(set.name);
                }
            });
        });

        return Array.from(itemUsageMap.values());
    }, [doors, hardwareSets]);

    const handleOptionalColumnToggle = (columnId: string) => {
        setOptionalColumns(prev =>
            prev.includes(columnId)
                ? prev.filter(id => id !== columnId)
                : [...prev, columnId]
        );
    };

    const handleExport = () => {
        const config: HardwareSetExportConfig = {
            requiredColumns: ['name', 'description', 'manufacturer', 'finish', 'usage'],
            optionalColumns,
            groupBy,
            usageDisplay,
            format,
            includeSetSummary,
            includeCostSummary,
            includeProcurement
        };
        onExport(config);
    };

    const getTotalItems = () => usageStats.length;
    const getTotalColumns = () => 5 + optionalColumns.length; // 5 required + optional

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <button
                        onClick={onBack}
                        className="flex items-center text-blue-600 hover:text-blue-800 mb-2 transition-colors"
                    >
                        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Reports
                    </button>
                    <h3 className="text-2xl font-bold text-gray-900">Hardware Set Report</h3>
                    <p className="text-sm text-gray-600 mt-1">
                        {getTotalItems()} unique items • {getTotalColumns()} columns • {hardwareSets.length} sets
                    </p>
                </div>
            </div>

            <div className="flex-grow overflow-auto">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Configuration - Left 2/3 */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Required Columns */}
                        <div className="bg-white border border-gray-200 rounded-lg p-6">
                            <h4 className="text-lg font-semibold text-gray-900 mb-4">Required Columns</h4>
                            <p className="text-sm text-gray-600 mb-4">These columns are always included in the report</p>

                            <div className="space-y-2">
                                {[
                                    { id: 'name', label: 'Item Name', desc: 'Hardware item name/description' },
                                    { id: 'description', label: 'Description', desc: 'Detailed specifications' },
                                    { id: 'manufacturer', label: 'Manufacturer', desc: 'Brand/supplier name' },
                                    { id: 'finish', label: 'Finish', desc: 'Color/coating specification' },
                                    { id: 'usage', label: 'Usage/Location', desc: 'Door tags using this item' }
                                ].map(col => (
                                    <div key={col.id} className="flex items-start p-3 bg-blue-50 rounded-lg">
                                        <svg className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <div className="flex-grow">
                                            <div className="font-medium text-gray-900">{col.label}</div>
                                            <div className="text-xs text-gray-600">{col.desc}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Optional Columns */}
                        <div className="bg-white border border-gray-200 rounded-lg p-6">
                            <h4 className="text-lg font-semibold text-gray-900 mb-4">Optional Columns</h4>
                            <p className="text-sm text-gray-600 mb-4">Select additional columns to include</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {OPTIONAL_COLUMNS.map(col => (
                                    <label key={col.id} className="flex items-center cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={optionalColumns.includes(col.id)}
                                            onChange={() => handleOptionalColumnToggle(col.id)}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="ml-3 text-sm text-gray-700">{col.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Grouping Options */}
                        <div className="bg-white border border-gray-200 rounded-lg p-6">
                            <h4 className="text-lg font-semibold text-gray-900 mb-4">Grouping Options</h4>
                            <p className="text-sm text-gray-600 mb-4">How to organize items in the report</p>

                            <div className="space-y-2">
                                {[
                                    { id: 'set', label: 'By Hardware Set', desc: 'Group items by their hardware set' },
                                    { id: 'type', label: 'By Item Type', desc: 'Group by category (Hinges, Locksets, etc.)' },
                                    { id: 'manufacturer', label: 'By Manufacturer', desc: 'Group by brand/supplier' },
                                    { id: 'flat', label: 'Flat List', desc: 'No grouping, simple list' }
                                ].map(option => (
                                    <label key={option.id} className="flex items-start cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                        <input
                                            type="radio"
                                            name="groupBy"
                                            value={option.id}
                                            checked={groupBy === option.id}
                                            onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
                                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 mt-0.5"
                                        />
                                        <div className="ml-3 flex-grow">
                                            <div className="text-sm font-medium text-gray-900">{option.label}</div>
                                            <div className="text-xs text-gray-600">{option.desc}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Usage Display Options */}
                        <div className="bg-white border border-gray-200 rounded-lg p-6">
                            <h4 className="text-lg font-semibold text-gray-900 mb-4">Usage/Location Display</h4>
                            <p className="text-sm text-gray-600 mb-4">How to show which doors use each item</p>

                            <div className="space-y-2">
                                {[
                                    { id: 'all', label: 'Show all door tags', desc: 'e.g., "101, 102, 103, 201, 202..."', example: '101, 102, 103, 201, 202, 203' },
                                    { id: 'count', label: 'Show count only', desc: 'e.g., "Used in 24 doors"', example: 'Used in 6 doors' },
                                    { id: 'preview', label: 'Show first 5 + count', desc: 'e.g., "101, 102... +22 more"', example: '101, 102, 103... +3 more' }
                                ].map(option => (
                                    <label key={option.id} className="flex items-start cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                        <input
                                            type="radio"
                                            name="usageDisplay"
                                            value={option.id}
                                            checked={usageDisplay === option.id}
                                            onChange={(e) => setUsageDisplay(e.target.value as typeof usageDisplay)}
                                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 mt-0.5"
                                        />
                                        <div className="ml-3 flex-grow">
                                            <div className="text-sm font-medium text-gray-900">{option.label}</div>
                                            <div className="text-xs text-gray-600 mb-1">{option.desc}</div>
                                            <div className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-1 rounded">{option.example}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Export Options - Right 1/3 */}
                    <div className="lg:col-span-1">
                        <div className="bg-white border border-gray-200 rounded-lg p-6 sticky top-0">
                            <h4 className="text-lg font-semibold text-gray-900 mb-4">Export Options</h4>

                            {/* Format Selection */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
                                <div className="space-y-2">
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="radio"
                                            name="format"
                                            value="xlsx"
                                            checked={format === 'xlsx'}
                                            onChange={(e) => setFormat(e.target.value as 'xlsx')}
                                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                        />
                                        <span className="ml-2 text-sm text-gray-700">Excel (.xlsx)</span>
                                    </label>
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="radio"
                                            name="format"
                                            value="pdf"
                                            checked={format === 'pdf'}
                                            onChange={(e) => setFormat(e.target.value as 'pdf')}
                                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                        />
                                        <span className="ml-2 text-sm text-gray-700">PDF</span>
                                    </label>
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="radio"
                                            name="format"
                                            value="csv"
                                            checked={format === 'csv'}
                                            onChange={(e) => setFormat(e.target.value as 'csv')}
                                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                        />
                                        <span className="ml-2 text-sm text-gray-700">CSV</span>
                                    </label>
                                </div>
                            </div>

                            {/* Include Options */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Include</label>
                                <div className="space-y-2">
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={includeSetSummary}
                                            onChange={(e) => setIncludeSetSummary(e.target.checked)}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="ml-2 text-sm text-gray-700">Hardware Set Summary</span>
                                    </label>
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={includeCostSummary}
                                            onChange={(e) => setIncludeCostSummary(e.target.checked)}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="ml-2 text-sm text-gray-700">Total Cost Summary</span>
                                    </label>
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={includeProcurement}
                                            onChange={(e) => setIncludeProcurement(e.target.checked)}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="ml-2 text-sm text-gray-700">Procurement Checklist</span>
                                    </label>
                                </div>
                            </div>

                            {/* Usage Preview */}
                            <div className="mb-6 p-3 bg-purple-50 rounded-lg border border-purple-200">
                                <div className="text-xs font-semibold text-purple-900 mb-2">Usage Tracking</div>
                                <div className="text-xs text-purple-800">
                                    {usageStats.length > 0 ? (
                                        <>
                                            <div className="mb-1">• {usageStats.length} unique items</div>
                                            <div className="mb-1">• {doors.filter(d => d.assignedHardwareSet).length} doors with hardware</div>
                                            <div>• Cross-referenced across {hardwareSets.length} sets</div>
                                        </>
                                    ) : (
                                        <div>No hardware items to track</div>
                                    )}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="space-y-2">
                                <button
                                    onClick={handleExport}
                                    disabled={usageStats.length === 0}
                                    className="w-full px-4 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                                >
                                    Export Report
                                </button>
                                <button
                                    onClick={() => setIsPreviewOpen(true)}
                                    className="w-full px-4 py-2 bg-white text-gray-700 font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Preview
                                </button>
                            </div>

                            {/* Info */}
                            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                                <p className="text-xs text-blue-800">
                                    <strong>Tip:</strong> The Usage/Location column shows which door tags use each hardware item for procurement planning.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Data Preview Modal */}
            <ReportDataPreview
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                doors={doors}
                hardwareSets={hardwareSets}
                optionalColumns={optionalColumns}
                format={format}
                reportType="hardware-set"
            />
        </div>
    );
};

export default HardwareSetConfig;
