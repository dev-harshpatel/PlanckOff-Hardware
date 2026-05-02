import React, { useState, useMemo } from 'react';
import { HardwareSet, Door } from '../types';
import { getCSISectionDescription } from '../utils/csiMasterFormat';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface HardwareScheduleViewProps {
    hardwareSets: HardwareSet[];
    doors: Door[];
}

type GroupBy = 'none' | 'doorMaterial';

interface MaterialGroup {
    material: string;
    sets: { set: HardwareSet; doorCount: number }[];
}

const HardwareScheduleView: React.FC<HardwareScheduleViewProps> = ({ hardwareSets, doors }) => {
    const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());
    const [filterManufacturer, setFilterManufacturer] = useState<string>('');
    const [sortBy, setSortBy] = useState<'name' | 'leadTime' | 'quantity'>('name');
    const [groupBy, setGroupBy] = useState<GroupBy>('none');

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

    const toggleSetExpansion = (key: string) => {
        const newExpanded = new Set(expandedSets);
        if (newExpanded.has(key)) {
            newExpanded.delete(key);
        } else {
            newExpanded.add(key);
        }
        setExpandedSets(newExpanded);
    };

    const filteredSets = useMemo(() => {
        return hardwareSets.filter(set => {
            if (!filterManufacturer) return true;
            return set.items.some(item => item.manufacturer === filterManufacturer);
        });
    }, [hardwareSets, filterManufacturer]);

    // Group by door material: material → { set, doorCount }[]
    const materialGroups = useMemo((): MaterialGroup[] => {
        if (groupBy !== 'doorMaterial') return [];

        // Build map: setId → (material → count)
        const setMaterialCount = new Map<string, Map<string, number>>();
        doors.forEach(door => {
            if (!door.assignedHardwareSet) return;
            const setId = door.assignedHardwareSet.id;
            const material = door.doorMaterial?.trim() || 'No Material';
            if (!setMaterialCount.has(setId)) setMaterialCount.set(setId, new Map());
            const matMap = setMaterialCount.get(setId)!;
            matMap.set(material, (matMap.get(material) ?? 0) + 1);
        });

        // Build map: material → { set, doorCount }[]
        const materialMap = new Map<string, { set: HardwareSet; doorCount: number }[]>();
        filteredSets.forEach(set => {
            const matMap = setMaterialCount.get(set.id);
            if (!matMap || matMap.size === 0) {
                // Set has no doors — put it under "No Material"
                const key = 'No Material';
                if (!materialMap.has(key)) materialMap.set(key, []);
                materialMap.get(key)!.push({ set, doorCount: 0 });
                return;
            }
            matMap.forEach((count, material) => {
                if (!materialMap.has(material)) materialMap.set(material, []);
                materialMap.get(material)!.push({ set, doorCount: count });
            });
        });

        // Sort materials: real materials alphabetically, "No Material" last
        const sorted = Array.from(materialMap.entries())
            .sort(([a], [b]) => {
                if (a === 'No Material') return 1;
                if (b === 'No Material') return -1;
                return a.localeCompare(b);
            })
            .map(([material, sets]) => ({ material, sets }));

        return sorted;
    }, [groupBy, doors, filteredSets]);

    const exportToExcel = () => {
        alert('Excel export functionality coming soon!');
    };

    const renderSetCard = (set: HardwareSet, doorCount: number, expandKey: string) => {
        const isExpanded = expandedSets.has(expandKey);
        const csiSection = set.division || '08 71 00';

        return (
            <div key={expandKey} className="bg-[var(--bg)]">
                {/* Set Header */}
                <div
                    className="p-4 hover:bg-[var(--bg-subtle)] cursor-pointer transition-colors"
                    onClick={() => toggleSetExpansion(expandKey)}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                            <button className="text-[var(--text-faint)] hover:text-[var(--text-muted)]">
                                {isExpanded ? '▼' : '▶'}
                            </button>
                            <div className="flex-1">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-lg font-semibold text-[var(--text)]">
                                        {set.name}
                                    </h3>
                                    <span className="px-2 py-1 bg-[var(--primary-bg-hover)] text-[var(--primary-text)] text-xs font-medium rounded">
                                        {csiSection}
                                    </span>
                                </div>
                                <div className="text-sm text-[var(--text-muted)] mt-1">
                                    {getCSISectionDescription(csiSection)}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                            <div className="text-center">
                                <div className="text-[var(--text-muted)]">Items</div>
                                <div className="font-semibold text-[var(--text)]">{set.items.length}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-[var(--text-muted)]">Doors</div>
                                <div className="font-semibold text-[var(--text)]">{doorCount}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Set Items (Expanded) */}
                {isExpanded && (
                    <div className="bg-[var(--bg-subtle)] border-t border-[var(--border)]">
                        <table className="w-full">
                            <thead className="bg-[var(--bg-muted)]">
                                <tr className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
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
                            <tbody className="divide-y divide-[var(--border)]">
                                {set.items.map(item => {
                                    const totalQty = item.quantity * doorCount;

                                    return (
                                        <tr key={item.id} className="hover:bg-[var(--bg)] transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-[var(--text)]">{item.name}</div>
                                                {item.description && (
                                                    <div className="text-xs text-[var(--text-muted)] mt-1">{item.description}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-[var(--text-secondary)]">{item.manufacturer}</td>
                                            <td className="px-4 py-3 text-[var(--text-secondary)] font-mono text-sm">
                                                {item.modelNumber || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-[var(--text-secondary)]">{item.finish}</td>
                                            <td className="px-4 py-3">
                                                {item.ansiGrade ? (
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                        item.ansiGrade === 'Grade 1' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                                                        item.ansiGrade === 'Grade 2' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
                                                        'bg-[var(--bg-muted)] text-[var(--text-secondary)]'
                                                    }`}>
                                                        {item.ansiGrade}
                                                    </span>
                                                ) : (
                                                    <span className="text-[var(--text-faint)]">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center font-semibold text-[var(--text)]">
                                                {item.quantity}
                                            </td>
                                            <td className="px-4 py-3 text-center font-bold text-blue-600 dark:text-blue-400">
                                                {totalQty}
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.leadTime ? (
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                        item.leadTime.toLowerCase().includes('stock')
                                                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                                            : 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'
                                                    }`}>
                                                        {item.leadTime}
                                                    </span>
                                                ) : (
                                                    <span className="text-[var(--text-faint)]">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Set Footer */}
                        <div className="bg-[var(--bg-muted)] px-4 py-3 border-t border-[var(--border)]">
                            <div className="flex justify-between items-center text-sm">
                                <div className="text-[var(--text-muted)]">
                                    {set.description && (
                                        <span><strong>Notes:</strong> {set.description}</span>
                                    )}
                                </div>
                                <div className="font-semibold text-[var(--text)]">
                                    Total Items: {set.items.length} | Total Doors: {doorCount}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bg-[var(--bg)] rounded-lg shadow-sm border border-[var(--border)]">
            {/* Header */}
            <div className="border-b border-[var(--border)] p-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-[var(--text)]">Hardware Schedule</h2>
                        <p className="text-sm text-[var(--text-muted)] mt-1">
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
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                            Filter by Manufacturer
                        </label>
                        <Select value={filterManufacturer || '__none__'} onValueChange={v => setFilterManufacturer(v === '__none__' ? '' : v)}>
                            <SelectTrigger className="w-full"><SelectValue placeholder="All Manufacturers" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">All Manufacturers</SelectItem>
                                {manufacturers.map(mfr => (
                                    <SelectItem key={mfr} value={mfr}>{mfr}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex-1">
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                            Sort By
                        </label>
                        <Select value={sortBy} onValueChange={v => setSortBy(v as 'name' | 'leadTime' | 'quantity')}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="name">Set Name</SelectItem>
                                <SelectItem value="leadTime">Lead Time</SelectItem>
                                <SelectItem value="quantity">Total Quantity</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex-1">
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                            Group By
                        </label>
                        <Select value={groupBy} onValueChange={v => setGroupBy(v as GroupBy)}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No Grouping</SelectItem>
                                <SelectItem value="doorMaterial">Door Material</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Hardware Sets */}
            <div className="divide-y divide-[var(--border)]">
                {filteredSets.length === 0 ? (
                    <div className="p-12 text-center text-[var(--text-muted)]">
                        <div className="text-4xl mb-2">🔧</div>
                        <div className="font-medium">No hardware sets found</div>
                        <div className="text-sm">Try adjusting your filters</div>
                    </div>
                ) : groupBy === 'doorMaterial' ? (
                    materialGroups.map(({ material, sets }) => (
                        <div key={material}>
                            {/* Material Group Header */}
                            <div className="px-6 py-3 bg-[var(--bg-muted)] border-b border-[var(--border)] flex items-center gap-3">
                                <span className="text-base font-semibold text-[var(--text)]">{material}</span>
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border)]">
                                    {sets.reduce((sum, s) => sum + s.doorCount, 0)} doors · {sets.length} {sets.length === 1 ? 'set' : 'sets'}
                                </span>
                            </div>
                            {/* Sets within this material group */}
                            <div className="divide-y divide-[var(--border)]">
                                {sets.map(({ set, doorCount }) =>
                                    renderSetCard(set, doorCount, `${material}::${set.id}`)
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    filteredSets.map(set => {
                        const doorCount = setDoorCounts.get(set.id) || 0;
                        return renderSetCard(set, doorCount, set.id);
                    })
                )}
            </div>

            {/* Summary Footer */}
            <div className="border-t border-[var(--border)] bg-[var(--bg-subtle)] p-6">
                <div className="grid grid-cols-3 gap-6 text-center">
                    <div>
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{filteredSets.length}</div>
                        <div className="text-sm text-[var(--text-muted)]">Hardware Sets</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {filteredSets.reduce((sum, set) => sum + set.items.length, 0)}
                        </div>
                        <div className="text-sm text-[var(--text-muted)]">Total Items</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{doors.length}</div>
                        <div className="text-sm text-[var(--text-muted)]">Total Doors</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HardwareScheduleView;
