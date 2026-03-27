import React, { useState, useMemo } from 'react';
import { HardwareSet, Door } from '../types';
import { getCSISectionDescription } from '../utils/csiMasterFormat';

interface HardwareScheduleViewProps {
    hardwareSets: HardwareSet[];
    doors: Door[];
}

const HardwareScheduleView: React.FC<HardwareScheduleViewProps> = ({ hardwareSets, doors }) => {
    const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());
    const [filterManufacturer, setFilterManufacturer] = useState<string>('');
    const [sortBy, setSortBy] = useState<'name' | 'leadTime' | 'quantity'>('name');

    // Calculate door counts for each hardware set
    const setDoorCounts = useMemo(() => {
        const counts = new Map<string, number>();
        doors.forEach(door => {
            if (door.assignedHardwareSet) {
                const count = counts.get(door.assignedHardwareSet.id) || 0;
                counts.set(door.assignedHardwareSet.id, count + 1);
            }
        });
        return counts;
    }, [doors]);

    // Get unique manufacturers
    const manufacturers = useMemo(() => {
        const mfrs = new Set<string>();
        hardwareSets.forEach(set => {
            set.items.forEach(item => {
                if (item.manufacturer) mfrs.add(item.manufacturer);
            });
        });
        return Array.from(mfrs).sort();
    }, [hardwareSets]);

    const toggleSetExpansion = (setId: string) => {
        const newExpanded = new Set(expandedSets);
        if (newExpanded.has(setId)) {
            newExpanded.delete(setId);
        } else {
            newExpanded.add(setId);
        }
        setExpandedSets(newExpanded);
    };

    const filteredSets = useMemo(() => {
        return hardwareSets.filter(set => {
            if (!filterManufacturer) return true;
            return set.items.some(item => item.manufacturer === filterManufacturer);
        });
    }, [hardwareSets, filterManufacturer]);

    const exportToExcel = () => {
        // TODO: Implement Excel export
        alert('Excel export functionality coming soon!');
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Header */}
            <div className="border-b border-gray-200 p-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Hardware Schedule</h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Procurement-focused hardware specification by set
                        </p>
                    </div>
                    <button
                        onClick={exportToExcel}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
                    >
                        📊 Export to Excel
                    </button>
                </div>

                {/* Filters */}
                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Filter by Manufacturer
                        </label>
                        <select
                            value={filterManufacturer}
                            onChange={(e) => setFilterManufacturer(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All Manufacturers</option>
                            {manufacturers.map(mfr => (
                                <option key={mfr} value={mfr}>{mfr}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Sort By
                        </label>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="name">Set Name</option>
                            <option value="leadTime">Lead Time</option>
                            <option value="quantity">Total Quantity</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Hardware Sets */}
            <div className="divide-y divide-gray-200">
                {filteredSets.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <div className="text-4xl mb-2">🔧</div>
                        <div className="font-medium">No hardware sets found</div>
                        <div className="text-sm">Try adjusting your filters</div>
                    </div>
                ) : (
                    filteredSets.map(set => {
                        const doorCount = setDoorCounts.get(set.id) || 0;
                        const isExpanded = expandedSets.has(set.id);
                        const csiSection = set.division || '08 71 00';

                        return (
                            <div key={set.id} className="bg-white">
                                {/* Set Header */}
                                <div
                                    className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                                    onClick={() => toggleSetExpansion(set.id)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 flex-1">
                                            <button className="text-gray-400 hover:text-gray-600">
                                                {isExpanded ? '▼' : '▶'}
                                            </button>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-lg font-semibold text-gray-900">
                                                        {set.name}
                                                    </h3>
                                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                                                        {csiSection}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-gray-600 mt-1">
                                                    {getCSISectionDescription(csiSection)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6 text-sm">
                                            <div className="text-center">
                                                <div className="text-gray-500">Items</div>
                                                <div className="font-semibold text-gray-900">{set.items.length}</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-gray-500">Doors</div>
                                                <div className="font-semibold text-gray-900">{doorCount}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Set Items (Expanded) */}
                                {isExpanded && (
                                    <div className="bg-gray-50 border-t border-gray-200">
                                        <table className="w-full">
                                            <thead className="bg-gray-100">
                                                <tr className="text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                    <th className="px-4 py-3">Item</th>
                                                    <th className="px-4 py-3">Manufacturer</th>
                                                    <th className="px-4 py-3">Model</th>
                                                    <th className="px-4 py-3">Finish</th>
                                                    <th className="px-4 py-3">ANSI Grade</th>
                                                    <th className="px-4 py-3 text-center">Qty/Set</th>
                                                    <th className="px-4 py-3 text-center">Total Qty</th>
                                                    <th className="px-4 py-3">Lead Time</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {set.items.map(item => {
                                                    const totalQty = item.quantity * doorCount;

                                                    return (
                                                        <tr key={item.id} className="hover:bg-white transition-colors">
                                                            <td className="px-4 py-3">
                                                                <div className="font-medium text-gray-900">{item.name}</div>
                                                                {item.description && (
                                                                    <div className="text-xs text-gray-500 mt-1">{item.description}</div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-gray-700">{item.manufacturer}</td>
                                                            <td className="px-4 py-3 text-gray-700 font-mono text-sm">
                                                                {item.modelNumber || '-'}
                                                            </td>
                                                            <td className="px-4 py-3 text-gray-700">{item.finish}</td>
                                                            <td className="px-4 py-3">
                                                                {item.ansiGrade ? (
                                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${item.ansiGrade === 'Grade 1' ? 'bg-green-100 text-green-800' :
                                                                            item.ansiGrade === 'Grade 2' ? 'bg-yellow-100 text-yellow-800' :
                                                                                'bg-gray-100 text-gray-800'
                                                                        }`}>
                                                                        {item.ansiGrade}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-gray-400">-</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-semibold text-gray-900">
                                                                {item.quantity}
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-bold text-blue-600">
                                                                {totalQty}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {item.leadTime ? (
                                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${item.leadTime.toLowerCase().includes('stock') ? 'bg-green-100 text-green-800' :
                                                                            'bg-orange-100 text-orange-800'
                                                                        }`}>
                                                                        {item.leadTime}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-gray-400">-</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>

                                        {/* Set Footer */}
                                        <div className="bg-gray-100 px-4 py-3 border-t border-gray-200">
                                            <div className="flex justify-between items-center text-sm">
                                                <div className="text-gray-600">
                                                    {set.description && (
                                                        <span><strong>Notes:</strong> {set.description}</span>
                                                    )}
                                                </div>
                                                <div className="font-semibold text-gray-900">
                                                    Total Items: {set.items.length} | Total Doors: {doorCount}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Summary Footer */}
            <div className="border-t border-gray-200 bg-gray-50 p-6">
                <div className="grid grid-cols-3 gap-6 text-center">
                    <div>
                        <div className="text-2xl font-bold text-blue-600">{filteredSets.length}</div>
                        <div className="text-sm text-gray-600">Hardware Sets</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-green-600">
                            {filteredSets.reduce((sum, set) => sum + set.items.length, 0)}
                        </div>
                        <div className="text-sm text-gray-600">Total Items</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-purple-600">{doors.length}</div>
                        <div className="text-sm text-gray-600">Total Doors</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HardwareScheduleView;
