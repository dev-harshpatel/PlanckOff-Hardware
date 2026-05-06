import React, { useState, useMemo } from 'react';
import { Door, HardwareSet, PriceBookEntry, ProjectPricing, PricingSettings } from '../types';
import { calculateProjectPricing, DEFAULT_PRICING_SETTINGS } from '../services/pricingService';
import PriceBookManager from '../components/pricing/PriceBookManager';

interface PricingViewProps {
    doors: Door[];
    hardwareSets: HardwareSet[];
    projectName: string;
}

const PricingView: React.FC<PricingViewProps> = ({ doors, hardwareSets, projectName }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'pricebook'>('dashboard');
    const [priceBook, setPriceBook] = useState<PriceBookEntry[]>([]);
    const [settings, setSettings] = useState<PricingSettings>(DEFAULT_PRICING_SETTINGS);
    const [showSettings, setShowSettings] = useState(false);

    // Calculate project pricing
    const projectPricing = useMemo(() => {
        return calculateProjectPricing(doors, hardwareSets, priceBook, settings);
    }, [doors, hardwareSets, priceBook, settings]);

    // Price Book CRUD operations
    const handleAddEntry = (entry: Omit<PriceBookEntry, 'id'>) => {
        const newEntry: PriceBookEntry = {
            ...entry,
            id: `pb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
        setPriceBook([...priceBook, newEntry]);
    };

    const handleUpdateEntry = (id: string, updates: Partial<PriceBookEntry>) => {
        setPriceBook(priceBook.map(entry =>
            entry.id === id ? { ...entry, ...updates } : entry
        ));
    };

    const handleDeleteEntry = (id: string) => {
        setPriceBook(priceBook.filter(entry => entry.id !== id));
    };

    return (
        <div className="h-full flex flex-col bg-[var(--bg-subtle)]">
            {/* Header */}
            <div className="bg-[var(--bg)] border-b border-[var(--border)] px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--text)]">Pricing Dashboard</h1>
                        <p className="text-sm text-[var(--text-muted)] mt-1">{projectName}</p>
                    </div>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="px-4 py-2 bg-[var(--bg)] border border-[var(--border-strong)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-subtle)] transition-colors flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Pricing Settings
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 border-b border-[var(--border)]">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'dashboard'
                                ? 'border-blue-600 text-[var(--primary-text-muted)]'
                                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
                            }`}
                    >
                        Dashboard
                    </button>
                    <button
                        onClick={() => setActiveTab('pricebook')}
                        className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'pricebook'
                                ? 'border-blue-600 text-[var(--primary-text-muted)]'
                                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
                            }`}
                    >
                        Price Book ({priceBook.length})
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
                {activeTab === 'dashboard' ? (
                    <PricingDashboard
                        projectPricing={projectPricing}
                        doors={doors}
                        hardwareSets={hardwareSets}
                        settings={settings}
                    />
                ) : (
                    <PriceBookManager
                        priceBook={priceBook}
                        onAddEntry={handleAddEntry}
                        onUpdateEntry={handleUpdateEntry}
                        onDeleteEntry={handleDeleteEntry}
                    />
                )}
            </div>

            {/* Settings Modal */}
            {showSettings && (
                <PricingSettingsModal
                    settings={settings}
                    onSave={(newSettings) => {
                        setSettings(newSettings);
                        setShowSettings(false);
                    }}
                    onClose={() => setShowSettings(false)}
                />
            )}
        </div>
    );
};

// Pricing Dashboard Component
interface PricingDashboardProps {
    projectPricing: ProjectPricing;
    doors: Door[];
    hardwareSets: HardwareSet[];
    settings: PricingSettings;
}

const PricingDashboard: React.FC<PricingDashboardProps> = ({ projectPricing, doors, hardwareSets, settings }) => {
    return (
        <div className="p-6 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-[var(--bg)] bg-opacity-20 rounded-lg">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="text-right">
                            <div className="text-sm opacity-90">Total Cost</div>
                            <div className="text-3xl font-bold">${projectPricing.totalCost.toLocaleString()}</div>
                        </div>
                    </div>
                    <div className="text-sm opacity-75">Material + Labor + Tax + Shipping</div>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-[var(--bg)] bg-opacity-20 rounded-lg">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="text-right">
                            <div className="text-sm opacity-90">Sell Price</div>
                            <div className="text-3xl font-bold">${projectPricing.totalSellPrice.toLocaleString()}</div>
                        </div>
                    </div>
                    <div className="text-sm opacity-75">With {projectPricing.profitMargin}% profit margin</div>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-[var(--bg)] bg-opacity-20 rounded-lg">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                        <div className="text-right">
                            <div className="text-sm opacity-90">Profit</div>
                            <div className="text-3xl font-bold">${projectPricing.totalProfit.toLocaleString()}</div>
                        </div>
                    </div>
                    <div className="text-sm opacity-75">{projectPricing.profitMarginPercentage.toFixed(1)}% margin</div>
                </div>
            </div>

            {/* Cost Breakdown */}
            <div className="bg-[var(--bg)] rounded-xl shadow-md p-6">
                <h2 className="text-xl font-bold text-[var(--text)] mb-6">Cost Breakdown</h2>

                <div className="space-y-4">
                    {/* Doors */}
                    <div className="flex items-center justify-between py-3 border-b border-[var(--border)]">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-[var(--success-bg)]0 rounded-full"></div>
                            <span className="font-medium text-[var(--text)]">Doors ({doors.length})</span>
                        </div>
                        <span className="text-lg font-semibold text-[var(--text)]">
                            ${projectPricing.totalDoorsCost.toLocaleString()}
                        </span>
                    </div>

                    {/* Frames */}
                    <div className="flex items-center justify-between py-3 border-b border-[var(--border)]">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                            <span className="font-medium text-[var(--text)]">Frames ({doors.length})</span>
                        </div>
                        <span className="text-lg font-semibold text-[var(--text)]">
                            ${projectPricing.totalFramesCost.toLocaleString()}
                        </span>
                    </div>

                    {/* Hardware */}
                    <div className="flex items-center justify-between py-3 border-b border-[var(--border)]">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                            <span className="font-medium text-[var(--text)]">Hardware ({hardwareSets.length} sets)</span>
                        </div>
                        <span className="text-lg font-semibold text-[var(--text)]">
                            ${projectPricing.totalHardwareCost.toLocaleString()}
                        </span>
                    </div>

                    {/* Subtotal */}
                    <div className="flex items-center justify-between py-3 border-b-2 border-[var(--border-strong)]">
                        <span className="font-bold text-[var(--text)]">Subtotal</span>
                        <span className="text-xl font-bold text-[var(--text)]">
                            ${projectPricing.subtotal.toLocaleString()}
                        </span>
                    </div>

                    {/* Tax */}
                    <div className="flex items-center justify-between py-2">
                        <span className="text-[var(--text-secondary)]">Tax ({projectPricing.taxRate}%)</span>
                        <span className="font-semibold text-[var(--text)]">
                            ${projectPricing.taxAmount.toLocaleString()}
                        </span>
                    </div>

                    {/* Shipping */}
                    <div className="flex items-center justify-between py-2">
                        <span className="text-[var(--text-secondary)]">Shipping</span>
                        <span className="font-semibold text-[var(--text)]">
                            ${projectPricing.shippingCost.toLocaleString()}
                        </span>
                    </div>

                    {/* Overhead */}
                    <div className="flex items-center justify-between py-2">
                        <span className="text-[var(--text-secondary)]">Overhead ({projectPricing.overheadPercentage}%)</span>
                        <span className="font-semibold text-[var(--text)]">
                            ${((projectPricing.totalCost * projectPricing.overheadPercentage) / 100).toLocaleString()}
                        </span>
                    </div>

                    {/* Profit */}
                    <div className="flex items-center justify-between py-3 border-t-2 border-[var(--border-strong)] mt-2">
                        <span className="font-bold text-[var(--text)]">Profit ({projectPricing.profitMargin}%)</span>
                        <span className="text-xl font-bold text-green-600">
                            ${projectPricing.totalProfit.toLocaleString()}
                        </span>
                    </div>

                    {/* Total Sell Price */}
                    <div className="flex items-center justify-between py-4 bg-[var(--primary-bg)] rounded-lg px-4 mt-4">
                        <span className="text-lg font-bold text-[var(--text)]">Total Sell Price</span>
                        <span className="text-2xl font-bold text-[var(--primary-text-muted)]">
                            ${projectPricing.totalSellPrice.toLocaleString()}
                        </span>
                    </div>
                </div>
            </div>

            {/* Profit Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[var(--bg)] rounded-xl shadow-md p-6">
                    <h3 className="text-lg font-bold text-[var(--text)] mb-4">Markup Summary</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-[var(--text-secondary)]">Material Markup</span>
                            <span className="font-semibold text-[var(--text)]">{projectPricing.materialMarkup}%</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--text-secondary)]">Labor Markup</span>
                            <span className="font-semibold text-[var(--text)]">{projectPricing.laborMarkup}%</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--text-secondary)]">Overhead</span>
                            <span className="font-semibold text-[var(--text)]">{projectPricing.overheadPercentage}%</span>
                        </div>
                        <div className="flex justify-between pt-3 border-t border-[var(--border)]">
                            <span className="font-bold text-[var(--text)]">Profit Margin</span>
                            <span className="font-bold text-green-600">{projectPricing.profitMarginPercentage.toFixed(1)}%</span>
                        </div>
                    </div>
                </div>

                <div className="bg-[var(--bg)] rounded-xl shadow-md p-6">
                    <h3 className="text-lg font-bold text-[var(--text)] mb-4">Project Statistics</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-[var(--text-secondary)]">Total Doors</span>
                            <span className="font-semibold text-[var(--text)]">{doors.length}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--text-secondary)]">Hardware Sets</span>
                            <span className="font-semibold text-[var(--text)]">{hardwareSets.length}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--text-secondary)]">Avg Cost per Door</span>
                            <span className="font-semibold text-[var(--text)]">
                                ${doors.length > 0 ? (projectPricing.subtotal / doors.length).toFixed(2) : '0.00'}
                            </span>
                        </div>
                        <div className="flex justify-between pt-3 border-t border-[var(--border)]">
                            <span className="font-bold text-[var(--text)]">Avg Sell Price per Door</span>
                            <span className="font-bold text-[var(--primary-text-muted)]">
                                ${doors.length > 0 ? (projectPricing.totalSellPrice / doors.length).toFixed(2) : '0.00'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Pricing Settings Modal
interface PricingSettingsModalProps {
    settings: PricingSettings;
    onSave: (settings: PricingSettings) => void;
    onClose: () => void;
}

const PricingSettingsModal: React.FC<PricingSettingsModalProps> = ({ settings, onSave, onClose }) => {
    const [formData, setFormData] = useState(settings);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--bg)] rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-[var(--bg)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-[var(--text)]">Pricing Settings</h2>
                    <button onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text-muted)]">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Labor Rate ($/hr)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.defaultLaborRate}
                                onChange={(e) => setFormData({ ...formData, defaultLaborRate: parseFloat(e.target.value) })}
                                className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Material Markup (%)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={formData.defaultMaterialMarkup}
                                onChange={(e) => setFormData({ ...formData, defaultMaterialMarkup: parseFloat(e.target.value) })}
                                className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Labor Markup (%)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={formData.defaultLaborMarkup}
                                onChange={(e) => setFormData({ ...formData, defaultLaborMarkup: parseFloat(e.target.value) })}
                                className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Overhead (%)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={formData.defaultOverheadPercentage}
                                onChange={(e) => setFormData({ ...formData, defaultOverheadPercentage: parseFloat(e.target.value) })}
                                className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Profit Margin (%)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={formData.defaultProfitMargin}
                                onChange={(e) => setFormData({ ...formData, defaultProfitMargin: parseFloat(e.target.value) })}
                                className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Tax Rate (%)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={formData.defaultTaxRate}
                                onChange={(e) => setFormData({ ...formData, defaultTaxRate: parseFloat(e.target.value) })}
                                className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-lg"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formData.includeShipping}
                                onChange={(e) => setFormData({ ...formData, includeShipping: e.target.checked })}
                                className="rounded"
                            />
                            <span className="text-sm font-medium text-[var(--text-secondary)]">Include Shipping</span>
                        </label>
                    </div>

                    {formData.includeShipping && (
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Shipping Cost ($)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.defaultShippingCost}
                                onChange={(e) => setFormData({ ...formData, defaultShippingCost: parseFloat(e.target.value) })}
                                className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-lg"
                            />
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] rounded-lg"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-[var(--primary-action)] text-white rounded-lg hover:bg-[var(--primary-action-hover)]"
                        >
                            Save Settings
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PricingView;
