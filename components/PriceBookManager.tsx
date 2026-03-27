import React, { useState, useMemo } from 'react';
import { PriceBookEntry } from '../types';

interface PriceBookManagerProps {
    priceBook: PriceBookEntry[];
    onAddEntry: (entry: Omit<PriceBookEntry, 'id'>) => void;
    onUpdateEntry: (id: string, entry: Partial<PriceBookEntry>) => void;
    onDeleteEntry: (id: string) => void;
    onImportCSV?: (file: File) => void;
    onExportCSV?: () => void;
}

const PriceBookManager: React.FC<PriceBookManagerProps> = ({
    priceBook,
    onAddEntry,
    onUpdateEntry,
    onDeleteEntry,
    onImportCSV,
    onExportCSV
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<'all' | 'door' | 'frame' | 'hardware'>('all');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingEntry, setEditingEntry] = useState<PriceBookEntry | null>(null);

    // Filter and search price book
    const filteredPriceBook = useMemo(() => {
        return priceBook.filter(entry => {
            // Category filter
            if (categoryFilter !== 'all' && entry.category !== categoryFilter) {
                return false;
            }

            // Search filter
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                return (
                    entry.itemType.toLowerCase().includes(search) ||
                    entry.description.toLowerCase().includes(search) ||
                    entry.manufacturer?.toLowerCase().includes(search) ||
                    entry.modelNumber?.toLowerCase().includes(search)
                );
            }

            return true;
        });
    }, [priceBook, categoryFilter, searchTerm]);

    // Statistics
    const stats = useMemo(() => {
        return {
            total: priceBook.length,
            doors: priceBook.filter(e => e.category === 'door').length,
            frames: priceBook.filter(e => e.category === 'frame').length,
            hardware: priceBook.filter(e => e.category === 'hardware').length
        };
    }, [priceBook]);

    const handleEdit = (entry: PriceBookEntry) => {
        setEditingEntry(entry);
        setShowAddModal(true);
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Are you sure you want to delete this price entry?')) {
            onDeleteEntry(id);
        }
    };

    const handleCloseModal = () => {
        setShowAddModal(false);
        setEditingEntry(null);
    };

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Price Book Manager</h1>
                        <p className="text-sm text-gray-600 mt-1">Manage pricing for doors, frames, and hardware</p>
                    </div>
                    <div className="flex gap-3">
                        {onImportCSV && (
                            <label className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                Import CSV
                                <input
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) onImportCSV(file);
                                    }}
                                />
                            </label>
                        )}
                        {onExportCSV && (
                            <button
                                onClick={onExportCSV}
                                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                                </svg>
                                Export CSV
                            </button>
                        )}
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Price
                        </button>
                    </div>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                        <div className="text-sm text-blue-600 font-medium">Total Entries</div>
                        <div className="text-2xl font-bold text-blue-900 mt-1">{stats.total}</div>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                        <div className="text-sm text-green-600 font-medium">Doors</div>
                        <div className="text-2xl font-bold text-green-900 mt-1">{stats.doors}</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
                        <div className="text-sm text-purple-600 font-medium">Frames</div>
                        <div className="text-2xl font-bold text-purple-900 mt-1">{stats.frames}</div>
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4">
                        <div className="text-sm text-orange-600 font-medium">Hardware</div>
                        <div className="text-2xl font-bold text-orange-900 mt-1">{stats.hardware}</div>
                    </div>
                </div>

                {/* Search and Filter */}
                <div className="flex gap-4">
                    <div className="flex-1 relative">
                        <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search by item type, description, manufacturer, or model..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value as any)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="all">All Categories</option>
                        <option value="door">Doors</option>
                        <option value="frame">Frames</option>
                        <option value="hardware">Hardware</option>
                    </select>
                </div>
            </div>

            {/* Price Book Table */}
            <div className="flex-1 overflow-auto px-6 py-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Item Type</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Manufacturer</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Model</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Unit Price</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">UOM</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredPriceBook.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                                        <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <p className="text-lg font-medium">No price entries found</p>
                                        <p className="text-sm mt-1">Add your first price entry to get started</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredPriceBook.map((entry) => (
                                    <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${entry.category === 'door' ? 'bg-green-100 text-green-800' :
                                                    entry.category === 'frame' ? 'bg-purple-100 text-purple-800' :
                                                        'bg-orange-100 text-orange-800'
                                                }`}>
                                                {entry.category}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-medium text-gray-900">{entry.itemType}</td>
                                        <td className="px-4 py-3 text-gray-600">{entry.manufacturer || '-'}</td>
                                        <td className="px-4 py-3 text-gray-600">{entry.modelNumber || '-'}</td>
                                        <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={entry.description}>
                                            {entry.description}
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                                            ${entry.unitPrice.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-center text-gray-600">{entry.unitOfMeasure}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleEdit(entry)}
                                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                    title="Edit"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(entry.id)}
                                                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    title="Delete"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Results count */}
                {filteredPriceBook.length > 0 && (
                    <div className="mt-4 text-sm text-gray-600 text-center">
                        Showing {filteredPriceBook.length} of {priceBook.length} entries
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {showAddModal && (
                <PriceEntryModal
                    entry={editingEntry}
                    onSave={(entry) => {
                        if (editingEntry) {
                            onUpdateEntry(editingEntry.id, entry);
                        } else {
                            onAddEntry(entry);
                        }
                        handleCloseModal();
                    }}
                    onClose={handleCloseModal}
                />
            )}
        </div>
    );
};

// Price Entry Modal Component
interface PriceEntryModalProps {
    entry: PriceBookEntry | null;
    onSave: (entry: Omit<PriceBookEntry, 'id'>) => void;
    onClose: () => void;
}

const PriceEntryModal: React.FC<PriceEntryModalProps> = ({ entry, onSave, onClose }) => {
    const [formData, setFormData] = useState<Omit<PriceBookEntry, 'id'>>({
        category: entry?.category || 'door',
        itemType: entry?.itemType || '',
        manufacturer: entry?.manufacturer || '',
        modelNumber: entry?.modelNumber || '',
        description: entry?.description || '',
        unitPrice: entry?.unitPrice || 0,
        unitOfMeasure: entry?.unitOfMeasure || 'each',
        laborHours: entry?.laborHours,
        laborRate: entry?.laborRate,
        effectiveDate: entry?.effectiveDate || new Date(),
        expirationDate: entry?.expirationDate,
        supplier: entry?.supplier || '',
        leadTime: entry?.leadTime || '',
        notes: entry?.notes || ''
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">
                        {entry ? 'Edit Price Entry' : 'Add Price Entry'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Category */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                        <select
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                        >
                            <option value="door">Door</option>
                            <option value="frame">Frame</option>
                            <option value="hardware">Hardware</option>
                        </select>
                    </div>

                    {/* Item Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Item Type *</label>
                        <input
                            type="text"
                            value={formData.itemType}
                            onChange={(e) => setFormData({ ...formData, itemType: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="e.g., Hollow Metal Door, Mortise Lock"
                            required
                        />
                    </div>

                    {/* Manufacturer and Model */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
                            <input
                                type="text"
                                value={formData.manufacturer}
                                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Model Number</label>
                            <input
                                type="text"
                                value={formData.modelNumber}
                                onChange={(e) => setFormData({ ...formData, modelNumber: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={3}
                            required
                        />
                    </div>

                    {/* Price and UOM */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price ($) *</label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.unitPrice}
                                onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Unit of Measure *</label>
                            <select
                                value={formData.unitOfMeasure}
                                onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value as any })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                            >
                                <option value="each">Each</option>
                                <option value="set">Set</option>
                                <option value="pair">Pair</option>
                            </select>
                        </div>
                    </div>

                    {/* Labor */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Labor Hours</label>
                            <input
                                type="number"
                                step="0.1"
                                value={formData.laborHours || ''}
                                onChange={(e) => setFormData({ ...formData, laborHours: e.target.value ? parseFloat(e.target.value) : undefined })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Labor Rate ($/hr)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.laborRate || ''}
                                onChange={(e) => setFormData({ ...formData, laborRate: e.target.value ? parseFloat(e.target.value) : undefined })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Supplier and Lead Time */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                            <input
                                type="text"
                                value={formData.supplier}
                                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Lead Time</label>
                            <input
                                type="text"
                                value={formData.leadTime}
                                onChange={(e) => setFormData({ ...formData, leadTime: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="e.g., 2-3 weeks"
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={2}
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                            {entry ? 'Update' : 'Add'} Price
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PriceBookManager;
