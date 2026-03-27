import React, { useState, useMemo } from 'react';
import { HardwareSet, Door } from '../types';
import {
    generateProcurementSummary,
    ManufacturerGroup,
    LeadTimeGroup,
    CriticalPathItem
} from '../services/procurementSummaryService';
import { exportMultiSheetWorkbook } from '../services/excelExportService';

interface ProcurementSummaryViewProps {
    hardwareSets: HardwareSet[];
    doors: Door[];
    projectName: string;
}

type TabView = 'manufacturer' | 'leadtime' | 'critical';

const ProcurementSummaryView: React.FC<ProcurementSummaryViewProps> = ({
    hardwareSets,
    doors,
    projectName
}) => {
    const [currentTab, setCurrentTab] = useState<TabView>('manufacturer');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    // Generate procurement summary
    const summary = useMemo(() =>
        generateProcurementSummary(hardwareSets, doors),
        [hardwareSets, doors]
    );

    const toggleGroup = (groupId: string) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(groupId)) {
            newExpanded.delete(groupId);
        } else {
            newExpanded.add(groupId);
        }
        setExpandedGroups(newExpanded);
    };

    const handleExportExcel = () => {
        exportMultiSheetWorkbook(doors, hardwareSets, {
            includeDoorSchedule: false,
            includeHardwareSchedule: true,
            includeFrameDetails: false,
            includeProcurementSummary: true,
            projectName
        });
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Header */}
            <div className="border-b border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Procurement Summary</h2>
                        <p className="text-gray-600 mt-1">Hardware grouped for efficient ordering</p>
                    </div>
                    <button
                        onClick={handleExportExcel}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Export to Excel
                    </button>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                        <div className="text-sm text-blue-600 font-medium">Total Items</div>
                        <div className="text-2xl font-bold text-blue-900">{summary.totalItems}</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                        <div className="text-sm text-green-600 font-medium">Total Cost</div>
                        <div className="text-2xl font-bold text-green-900">
                            ${summary.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4">
                        <div className="text-sm text-orange-600 font-medium">Avg Lead Time</div>
                        <div className="text-2xl font-bold text-orange-900">{summary.averageLeadTime}</div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <div className="flex gap-4 px-6">
                    <button
                        onClick={() => setCurrentTab('manufacturer')}
                        className={`py-3 px-4 font-medium border-b-2 transition-colors ${currentTab === 'manufacturer'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        By Manufacturer
                    </button>
                    <button
                        onClick={() => setCurrentTab('leadtime')}
                        className={`py-3 px-4 font-medium border-b-2 transition-colors ${currentTab === 'leadtime'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        By Lead Time
                    </button>
                    <button
                        onClick={() => setCurrentTab('critical')}
                        className={`py-3 px-4 font-medium border-b-2 transition-colors ${currentTab === 'critical'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        Critical Path
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-6">
                {currentTab === 'manufacturer' && (
                    <ManufacturerView
                        groups={summary.byManufacturer}
                        expandedGroups={expandedGroups}
                        onToggleGroup={toggleGroup}
                    />
                )}
                {currentTab === 'leadtime' && (
                    <LeadTimeView
                        groups={summary.byLeadTime}
                        expandedGroups={expandedGroups}
                        onToggleGroup={toggleGroup}
                    />
                )}
                {currentTab === 'critical' && (
                    <CriticalPathView items={summary.criticalPath} />
                )}
            </div>
        </div>
    );
};

// Manufacturer View Component
const ManufacturerView: React.FC<{
    groups: ManufacturerGroup[];
    expandedGroups: Set<string>;
    onToggleGroup: (id: string) => void;
}> = ({ groups, expandedGroups, onToggleGroup }) => {
    return (
        <div className="space-y-4">
            {groups.map(group => {
                const isExpanded = expandedGroups.has(group.manufacturer);
                return (
                    <div key={group.manufacturer} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* Group Header */}
                        <div
                            onClick={() => onToggleGroup(group.manufacturer)}
                            className="bg-gray-50 p-4 cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-between"
                        >
                            <div className="flex items-center gap-3">
                                <svg
                                    className={`w-5 h-5 text-gray-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <div>
                                    <h3 className="font-bold text-gray-900">{group.manufacturer}</h3>
                                    <p className="text-sm text-gray-600">
                                        {group.items.length} items • {group.totalQuantity} total qty
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-bold text-gray-900">
                                    ${group.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                                <div className="text-sm text-gray-600">Lead: {group.longestLeadTime}</div>
                            </div>
                        </div>

                        {/* Group Items */}
                        {isExpanded && (
                            <div className="p-4 bg-white">
                                <table className="w-full">
                                    <thead>
                                        <tr className="text-left text-sm text-gray-600 border-b">
                                            <th className="pb-2">Product</th>
                                            <th className="pb-2">Model</th>
                                            <th className="pb-2">Qty</th>
                                            <th className="pb-2">Lead Time</th>
                                            <th className="pb-2">ANSI Grade</th>
                                            <th className="pb-2 text-right">Total Cost</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {group.items.map((item, idx) => (
                                            <tr key={idx} className="border-b last:border-0">
                                                <td className="py-2 font-medium">{item.name}</td>
                                                <td className="py-2 text-gray-600">{item.model}</td>
                                                <td className="py-2">{item.quantity}</td>
                                                <td className="py-2 text-gray-600">{item.leadTime}</td>
                                                <td className="py-2">
                                                    {item.ansiGrade && (
                                                        <span className={`px-2 py-1 rounded text-xs font-medium ${item.ansiGrade === 'Grade 1' ? 'bg-green-100 text-green-800' :
                                                                item.ansiGrade === 'Grade 2' ? 'bg-yellow-100 text-yellow-800' :
                                                                    'bg-gray-100 text-gray-800'
                                                            }`}>
                                                            {item.ansiGrade}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-2 text-right font-medium">
                                                    ${(item.totalCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// Lead Time View Component
const LeadTimeView: React.FC<{
    groups: LeadTimeGroup[];
    expandedGroups: Set<string>;
    onToggleGroup: (id: string) => void;
}> = ({ groups, expandedGroups, onToggleGroup }) => {
    return (
        <div className="space-y-4">
            {groups.map(group => {
                const isExpanded = expandedGroups.has(group.leadTime);
                return (
                    <div key={group.leadTime} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* Group Header */}
                        <div
                            onClick={() => onToggleGroup(group.leadTime)}
                            className="bg-gray-50 p-4 cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-between"
                        >
                            <div className="flex items-center gap-3">
                                <svg
                                    className={`w-5 h-5 text-gray-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <div>
                                    <h3 className="font-bold text-gray-900">{group.leadTime}</h3>
                                    <p className="text-sm text-gray-600">
                                        {group.items.length} items • {group.manufacturers.length} manufacturers
                                    </p>
                                </div>
                            </div>
                            <div className="text-sm text-gray-600">
                                {group.manufacturers.join(', ')}
                            </div>
                        </div>

                        {/* Group Items */}
                        {isExpanded && (
                            <div className="p-4 bg-white">
                                <table className="w-full">
                                    <thead>
                                        <tr className="text-left text-sm text-gray-600 border-b">
                                            <th className="pb-2">Product</th>
                                            <th className="pb-2">Model</th>
                                            <th className="pb-2">Qty</th>
                                            <th className="pb-2">Hardware Set</th>
                                            <th className="pb-2">CSI Section</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {group.items.map((item, idx) => (
                                            <tr key={idx} className="border-b last:border-0">
                                                <td className="py-2 font-medium">{item.name}</td>
                                                <td className="py-2 text-gray-600">{item.model}</td>
                                                <td className="py-2">{item.quantity}</td>
                                                <td className="py-2 text-gray-600">{item.setName}</td>
                                                <td className="py-2 text-gray-600">{item.csiSection}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// Critical Path View Component
const CriticalPathView: React.FC<{
    items: CriticalPathItem[];
}> = ({ items }) => {
    return (
        <div>
            <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                        <h3 className="font-bold text-orange-900">Critical Path Items</h3>
                        <p className="text-sm text-orange-700 mt-1">
                            These items have the longest lead times and should be ordered first to avoid project delays.
                        </p>
                    </div>
                </div>
            </div>

            <table className="w-full">
                <thead>
                    <tr className="text-left text-sm text-gray-600 border-b">
                        <th className="pb-2">Product</th>
                        <th className="pb-2">Manufacturer</th>
                        <th className="pb-2">Model</th>
                        <th className="pb-2">Qty</th>
                        <th className="pb-2">Lead Time</th>
                        <th className="pb-2">ANSI Grade</th>
                        <th className="pb-2 text-right">Total Cost</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, idx) => (
                        <tr key={idx} className="border-b last:border-0">
                            <td className="py-3 font-medium">{item.name}</td>
                            <td className="py-3 text-gray-600">{item.manufacturer}</td>
                            <td className="py-3 text-gray-600">{item.model}</td>
                            <td className="py-3">{item.quantity}</td>
                            <td className="py-3">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${item.leadTimeWeeks >= 8 ? 'bg-red-100 text-red-800' :
                                        item.leadTimeWeeks >= 4 ? 'bg-orange-100 text-orange-800' :
                                            'bg-green-100 text-green-800'
                                    }`}>
                                    {item.leadTime}
                                </span>
                            </td>
                            <td className="py-3">
                                {item.ansiGrade && (
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${item.ansiGrade === 'Grade 1' ? 'bg-green-100 text-green-800' :
                                            item.ansiGrade === 'Grade 2' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-gray-100 text-gray-800'
                                        }`}>
                                        {item.ansiGrade}
                                    </span>
                                )}
                            </td>
                            <td className="py-3 text-right font-medium">
                                ${(item.totalCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {items.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                    No critical path items found. All items have standard lead times.
                </div>
            )}
        </div>
    );
};

export default ProcurementSummaryView;
