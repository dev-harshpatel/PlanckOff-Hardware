import React, { useState } from 'react';
import { Door, HardwareSet } from '../../types';

interface EstimatingReportBannerProps {
    doors: Door[];
    hardwareSets: HardwareSet[];
    onExportPDF?: () => void;
    onExportExcel?: () => void;
    onPrint?: () => void;
}

interface CostBreakdown {
    material: number;
    labor: number;
    equipment: number;
    subtotal: number;
    tax: number;
    total: number;
}

const EstimatingReportBanner: React.FC<EstimatingReportBannerProps> = ({
    doors,
    hardwareSets,
    onExportPDF,
    onExportExcel,
    onPrint
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Calculate real-time costs
    const calculateCosts = (): CostBreakdown => {
        const doorsWithHardware = doors.filter(d => d.status === 'complete' && d.assignedHardwareSet);

        let materialCost = 0;
        let laborCost = 0;
        let equipmentCost = 0;

        doorsWithHardware.forEach(door => {
            const totalLeaves = (door.quantity || 1) * (door.liftCount || 1);
            const hardwareSet = door.assignedHardwareSet;

            if (hardwareSet) {
                hardwareSet.items.forEach(item => {
                    const totalItemQty = item.quantity * totalLeaves;
                    const itemCost = (item.unitCost || 0) * totalItemQty;

                    // Categorize by item type (simplified - you may want more sophisticated logic)
                    if (item.category?.toLowerCase().includes('labor')) {
                        laborCost += itemCost;
                    } else if (item.category?.toLowerCase().includes('equipment')) {
                        equipmentCost += itemCost;
                    } else {
                        materialCost += itemCost;
                    }
                });
            }
        });

        const subtotal = materialCost + laborCost + equipmentCost;
        const tax = subtotal * 0.085; // 8.5% tax rate
        const total = subtotal + tax;

        return {
            material: materialCost,
            labor: laborCost,
            equipment: equipmentCost,
            subtotal,
            tax,
            total
        };
    };

    const costs = calculateCosts();
    const hasData = doors.length > 0;

    const formatCurrency = (amount: number): string => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    const calculatePercentage = (part: number, total: number): number => {
        if (total === 0) return 0;
        return Math.round((part / costs.subtotal) * 100);
    };

    return (
        <div className="bg-[var(--bg)] border-b border-[var(--border)] sticky top-0 z-30 shadow-sm">
            {/* Collapsed View */}
            <div
                className="px-6 py-3 flex items-center justify-between cursor-pointer hover:bg-[var(--bg-subtle)] transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <h2 className="text-lg font-semibold text-[var(--text)]">Estimating Report</h2>
                    </div>

                    {hasData && (
                        <div className="flex items-center space-x-6 text-sm">
                            <span className="text-[var(--text-muted)]">
                                {doors.filter(d => d.status === 'complete').length} / {doors.length} doors
                            </span>
                            <span className="text-2xl font-bold text-blue-600">
                                {formatCurrency(costs.total)}
                            </span>
                        </div>
                    )}
                </div>

                <button
                    className="p-1 hover:bg-[var(--bg-emphasis)] rounded transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(!isExpanded);
                    }}
                >
                    <svg
                        className={`w-5 h-5 text-[var(--text-muted)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </div>

            {/* Expanded View */}
            {isExpanded && hasData && (
                <div className="px-6 py-4 bg-[var(--bg-subtle)] border-t border-[var(--border)]">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                        {/* Material Cost */}
                        <div className="bg-[var(--bg)] p-4 rounded-lg border border-[var(--border)]">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-[var(--text-muted)]">Material</span>
                                <span className="text-xs text-[var(--text-muted)]">{calculatePercentage(costs.material, costs.subtotal)}%</span>
                            </div>
                            <div className="text-2xl font-bold text-[var(--text)]">{formatCurrency(costs.material)}</div>
                            <div className="mt-2 w-full bg-[var(--bg-emphasis)] rounded-full h-2">
                                <div
                                    className="bg-blue-600 h-2 rounded-full"
                                    style={{ width: `${calculatePercentage(costs.material, costs.subtotal)}%` }}
                                />
                            </div>
                        </div>

                        {/* Labor Cost */}
                        <div className="bg-[var(--bg)] p-4 rounded-lg border border-[var(--border)]">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-[var(--text-muted)]">Labor</span>
                                <span className="text-xs text-[var(--text-muted)]">{calculatePercentage(costs.labor, costs.subtotal)}%</span>
                            </div>
                            <div className="text-2xl font-bold text-[var(--text)]">{formatCurrency(costs.labor)}</div>
                            <div className="mt-2 w-full bg-[var(--bg-emphasis)] rounded-full h-2">
                                <div
                                    className="bg-green-600 h-2 rounded-full"
                                    style={{ width: `${calculatePercentage(costs.labor, costs.subtotal)}%` }}
                                />
                            </div>
                        </div>

                        {/* Equipment Cost */}
                        <div className="bg-[var(--bg)] p-4 rounded-lg border border-[var(--border)]">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-[var(--text-muted)]">Equipment</span>
                                <span className="text-xs text-[var(--text-muted)]">{calculatePercentage(costs.equipment, costs.subtotal)}%</span>
                            </div>
                            <div className="text-2xl font-bold text-[var(--text)]">{formatCurrency(costs.equipment)}</div>
                            <div className="mt-2 w-full bg-[var(--bg-emphasis)] rounded-full h-2">
                                <div
                                    className="bg-purple-600 h-2 rounded-full"
                                    style={{ width: `${calculatePercentage(costs.equipment, costs.subtotal)}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Totals Row */}
                    <div className="flex items-center justify-between bg-[var(--bg)] p-4 rounded-lg border border-[var(--border)]">
                        <div className="flex items-center space-x-8">
                            <div>
                                <span className="text-sm text-[var(--text-muted)]">Subtotal:</span>
                                <span className="ml-2 text-lg font-semibold text-[var(--text)]">{formatCurrency(costs.subtotal)}</span>
                            </div>
                            <div>
                                <span className="text-sm text-[var(--text-muted)]">Tax (8.5%):</span>
                                <span className="ml-2 text-lg font-semibold text-[var(--text)]">{formatCurrency(costs.tax)}</span>
                            </div>
                            <div className="pl-8 border-l border-[var(--border-strong)]">
                                <span className="text-sm text-[var(--text-muted)]">TOTAL:</span>
                                <span className="ml-2 text-2xl font-bold text-blue-600">{formatCurrency(costs.total)}</span>
                            </div>
                        </div>

                        {/* Export Buttons */}
                        <div className="flex items-center space-x-2">
                            {onExportPDF && (
                                <button
                                    onClick={onExportPDF}
                                    className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg)] border border-[var(--border-strong)] rounded-md hover:bg-[var(--bg-subtle)] transition-colors"
                                >
                                    Export PDF
                                </button>
                            )}
                            {onExportExcel && (
                                <button
                                    onClick={onExportExcel}
                                    className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg)] border border-[var(--border-strong)] rounded-md hover:bg-[var(--bg-subtle)] transition-colors"
                                >
                                    Export Excel
                                </button>
                            )}
                            {onPrint && (
                                <button
                                    onClick={onPrint}
                                    className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg)] border border-[var(--border-strong)] rounded-md hover:bg-[var(--bg-subtle)] transition-colors"
                                >
                                    Print
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* No Data State */}
            {isExpanded && !hasData && (
                <div className="px-6 py-8 bg-[var(--bg-subtle)] border-t border-[var(--border)] text-center">
                    <svg className="mx-auto h-12 w-12 text-[var(--text-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="mt-2 text-sm text-[var(--text-muted)]">No doors with assigned hardware yet</p>
                    <p className="text-xs text-[var(--text-muted)]">Upload a door schedule and assign hardware sets to generate estimates</p>
                </div>
            )}
        </div>
    );
};

export default EstimatingReportBanner;
