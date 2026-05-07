import React, { useState, useCallback } from 'react';
import { ManufacturerCutSheet } from '../../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/contexts/ToastContext';
import { GENERAL_ERRORS } from '@/constants/errors';

interface CutSheetLibraryProps {
    cutSheets: ManufacturerCutSheet[];
    onAddCutSheet: (cutSheet: Omit<ManufacturerCutSheet, 'id' | 'uploadDate'>) => void;
    onDeleteCutSheet: (id: string) => void;
    onUpdateCutSheet: (id: string, updates: Partial<ManufacturerCutSheet>) => void;
}

const CutSheetLibrary: React.FC<CutSheetLibraryProps> = ({
    cutSheets,
    onAddCutSheet,
    onDeleteCutSheet,
    onUpdateCutSheet
}) => {
    const { addToast } = useToast();
    const [filterManufacturer, setFilterManufacturer] = useState<string>('');
    const [filterCategory, setFilterCategory] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [previewCutSheet, setPreviewCutSheet] = useState<ManufacturerCutSheet | null>(null);
    const [dragActive, setDragActive] = useState(false);

    // New cut sheet form state
    const [newCutSheet, setNewCutSheet] = useState({
        manufacturer: '',
        productName: '',
        modelNumber: '',
        category: 'Hardware' as ManufacturerCutSheet['category'],
        csiSection: '08 71 00',
        file: null as File | null
    });

    // Get unique manufacturers
    const manufacturers = Array.from(new Set(cutSheets.map(cs => cs.manufacturer))).sort();

    // Filter cut sheets
    const filteredCutSheets = cutSheets.filter(cs => {
        if (filterManufacturer && cs.manufacturer !== filterManufacturer) return false;
        if (filterCategory && cs.category !== filterCategory) return false;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                cs.productName.toLowerCase().includes(query) ||
                cs.modelNumber.toLowerCase().includes(query) ||
                cs.manufacturer.toLowerCase().includes(query)
            );
        }
        return true;
    });

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const files = Array.from(e.dataTransfer.files);
        const pdfFiles = files.filter(file => file.type === 'application/pdf');

        if (pdfFiles.length > 0) {
            setNewCutSheet(prev => ({ ...prev, file: pdfFiles[0] }));
            setShowUploadModal(true);
        }
    }, []);

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type === 'application/pdf') {
            setNewCutSheet(prev => ({ ...prev, file }));
            setShowUploadModal(true);
        }
    };

    const handleUploadSubmit = () => {
        if (!newCutSheet.file || !newCutSheet.manufacturer || !newCutSheet.productName) {
            addToast({ type: 'error', message: GENERAL_ERRORS.REQUIRED_FIELD.message });
            return;
        }

        // Create file URL (in real app, this would upload to server)
        const fileUrl = URL.createObjectURL(newCutSheet.file);

        onAddCutSheet({
            manufacturer: newCutSheet.manufacturer,
            productName: newCutSheet.productName,
            modelNumber: newCutSheet.modelNumber,
            category: newCutSheet.category,
            fileUrl,
            fileName: newCutSheet.file.name,
            csiSection: newCutSheet.csiSection
        });

        // Reset form
        setNewCutSheet({
            manufacturer: '',
            productName: '',
            modelNumber: '',
            category: 'Hardware',
            csiSection: '08 71 00',
            file: null
        });
        setShowUploadModal(false);
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'Door': return '🚪';
            case 'Frame': return '🖼️';
            case 'Hardware': return '🔧';
            case 'Finish': return '🎨';
            default: return '📄';
        }
    };

    return (
        <div className="bg-[var(--bg)] rounded-lg shadow-sm border border-[var(--border)]">
            {/* Header */}
            <div className="border-b border-[var(--border)] p-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-[var(--text)]">Manufacturer Cut Sheet Library</h2>
                        <p className="text-sm text-[var(--text-muted)] mt-1">
                            Upload and manage product documentation
                        </p>
                    </div>
                    <button
                        onClick={() => setShowUploadModal(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                    >
                        + Add Cut Sheet
                    </button>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                            Manufacturer
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

                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                            Category
                        </label>
                        <Select value={filterCategory || '__none__'} onValueChange={v => setFilterCategory(v === '__none__' ? '' : v)}>
                            <SelectTrigger className="w-full"><SelectValue placeholder="All Categories" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">All Categories</SelectItem>
                                <SelectItem value="Door">Door</SelectItem>
                                <SelectItem value="Frame">Frame</SelectItem>
                                <SelectItem value="Hardware">Hardware</SelectItem>
                                <SelectItem value="Finish">Finish</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                            Search
                        </label>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Product name, model..."
                            className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-lg bg-[var(--bg)] text-[var(--text)] focus:ring-2 focus:ring-[var(--primary-ring)]"
                        />
                    </div>
                </div>
            </div>

            {/* Drag & Drop Zone */}
            {cutSheets.length === 0 && (
                <div
                    className={`m-6 border-2 border-dashed rounded-lg p-12 text-center transition-colors ${dragActive ? 'border-blue-500 bg-[var(--primary-bg)]' : 'border-[var(--border-strong)] bg-[var(--bg-subtle)]'
                        }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <div className="text-6xl mb-4">📄</div>
                    <div className="text-lg font-semibold text-[var(--text)] mb-2">
                        Drag & Drop PDF Cut Sheets Here
                    </div>
                    <div className="text-sm text-[var(--text-muted)] mb-4">
                        or click the button above to upload
                    </div>
                    <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileInput}
                        className="hidden"
                        id="file-upload"
                    />
                    <label
                        htmlFor="file-upload"
                        className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
                    >
                        Browse Files
                    </label>
                </div>
            )}

            {/* Cut Sheet Grid */}
            {filteredCutSheets.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                    {filteredCutSheets.map(cutSheet => (
                        <div
                            key={cutSheet.id}
                            className="border border-[var(--border)] rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="text-3xl">{getCategoryIcon(cutSheet.category)}</div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPreviewCutSheet(cutSheet)}
                                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                    >
                                        View
                                    </button>
                                    <button
                                        onClick={() => onDeleteCutSheet(cutSheet.id)}
                                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>

                            <h3 className="font-semibold text-[var(--text)] mb-1">{cutSheet.productName}</h3>
                            <div className="text-sm text-[var(--text-muted)] mb-2">{cutSheet.manufacturer}</div>

                            {cutSheet.modelNumber && (
                                <div className="text-xs font-mono text-[var(--text-muted)] mb-2">
                                    Model: {cutSheet.modelNumber}
                                </div>
                            )}

                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border)]">
                                <span className="text-xs px-2 py-1 bg-[var(--bg-muted)] text-[var(--text-secondary)] rounded">
                                    {cutSheet.category}
                                </span>
                                {cutSheet.csiSection && (
                                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded font-mono">
                                        {cutSheet.csiSection}
                                    </span>
                                )}
                            </div>

                            {(cutSheet.linkedDoorIds?.length || cutSheet.linkedHardwareItemIds?.length) ? (
                                <div className="mt-2 text-xs text-[var(--text-muted)]">
                                    Linked: {cutSheet.linkedDoorIds?.length || 0} doors, {cutSheet.linkedHardwareItemIds?.length || 0} items
                                </div>
                            ) : null}
                        </div>
                    ))}
                </div>
            )}

            {filteredCutSheets.length === 0 && cutSheets.length > 0 && (
                <div className="p-12 text-center text-[var(--text-muted)]">
                    <div className="text-4xl mb-2">🔍</div>
                    <div className="font-medium">No cut sheets found</div>
                    <div className="text-sm">Try adjusting your filters</div>
                </div>
            )}

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-[var(--bg)] rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-[var(--border)]">
                            <h3 className="text-xl font-bold text-[var(--text)]">Add Cut Sheet</h3>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                    Manufacturer <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newCutSheet.manufacturer}
                                    onChange={(e) => setNewCutSheet(prev => ({ ...prev, manufacturer: e.target.value }))}
                                    className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-lg bg-[var(--bg)] text-[var(--text)]"
                                    placeholder="e.g., Schlage, LCN, McKinney"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                    Product Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newCutSheet.productName}
                                    onChange={(e) => setNewCutSheet(prev => ({ ...prev, productName: e.target.value }))}
                                    className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-lg bg-[var(--bg)] text-[var(--text)]"
                                    placeholder="e.g., ND80 Mortise Lock"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                    Model Number
                                </label>
                                <input
                                    type="text"
                                    value={newCutSheet.modelNumber}
                                    onChange={(e) => setNewCutSheet(prev => ({ ...prev, modelNumber: e.target.value }))}
                                    className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-lg bg-[var(--bg)] text-[var(--text)]"
                                    placeholder="e.g., ND80PD RHO 626"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                        Category
                                    </label>
                                    <Select value={newCutSheet.category} onValueChange={v => setNewCutSheet(prev => ({ ...prev, category: v as any }))}>
                                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Door">Door</SelectItem>
                                            <SelectItem value="Frame">Frame</SelectItem>
                                            <SelectItem value="Hardware">Hardware</SelectItem>
                                            <SelectItem value="Finish">Finish</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                        CSI Section
                                    </label>
                                    <input
                                        type="text"
                                        value={newCutSheet.csiSection}
                                        onChange={(e) => setNewCutSheet(prev => ({ ...prev, csiSection: e.target.value }))}
                                        className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-lg bg-[var(--bg)] text-[var(--text)] font-mono"
                                        placeholder="08 71 00"
                                    />
                                </div>
                            </div>

                            {newCutSheet.file && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-green-600">✓</span>
                                        <span className="text-sm text-green-800 font-medium">{newCutSheet.file.name}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-[var(--border)] flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowUploadModal(false);
                                    setNewCutSheet({
                                        manufacturer: '',
                                        productName: '',
                                        modelNumber: '',
                                        category: 'Hardware',
                                        csiSection: '08 71 00',
                                        file: null
                                    });
                                }}
                                className="px-4 py-2 border border-[var(--border-strong)] rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text)]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUploadSubmit}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Add Cut Sheet
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {previewCutSheet && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-[var(--bg)] rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-[var(--border)] flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-[var(--text)]">{previewCutSheet.productName}</h3>
                                <p className="text-sm text-[var(--text-muted)]">{previewCutSheet.manufacturer}</p>
                            </div>
                            <button
                                onClick={() => setPreviewCutSheet(null)}
                                className="text-[var(--text-faint)] hover:text-[var(--text-muted)]"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6">
                            <iframe
                                src={previewCutSheet.fileUrl}
                                className="w-full h-[600px] border border-[var(--border-strong)] rounded"
                                title="Cut Sheet Preview"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CutSheetLibrary;
