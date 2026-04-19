'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { HardwareItem, Role } from '../types';
import { exportInventoryToCSV } from '../utils/csvExporter';
import UploadConfirmationModal from '../components/UploadConfirmationModal';
import { processHardwareSetFile } from '../services/fileUploadService';
import { Button } from '@/components/ui/button';
import {
    Search,
    Download,
    Upload,
    Trash2,
    Plus,
    ChevronUp,
    ChevronDown,
    ChevronsUpDown,
    Database,
} from 'lucide-react';

interface DatabaseViewProps {
  inventory: HardwareItem[];
  userRole: Role;
  onUpdateInventory: (items: HardwareItem[]) => void;
  onAddToInventory: (items: HardwareItem[]) => void;
  onOverwriteInventory: (items: HardwareItem[]) => void;
  addToast: (toast: unknown) => void;
}

const DatabaseView: React.FC<DatabaseViewProps> = ({
    inventory,
    userRole,
    onUpdateInventory,
    onAddToInventory,
    onOverwriteInventory,
    addToast,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof HardwareItem; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadFiles, setUploadFiles] = useState<File[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [editingCell, setEditingCell] = useState<{ id: string; field: keyof HardwareItem } | null>(null);
    const [tempValue, setTempValue] = useState<string | number>('');
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const canEdit = userRole === Role.Administrator || userRole === Role.SeniorEstimator;

    useEffect(() => {
        if (editingCell && inputRef.current) inputRef.current.focus();
    }, [editingCell]);

    const handleSort = (key: keyof HardwareItem) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    const filteredInventory = useMemo(() => {
        let result = [...inventory];
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(item =>
                item.name.toLowerCase().includes(q) ||
                item.manufacturer.toLowerCase().includes(q) ||
                item.description.toLowerCase().includes(q) ||
                item.finish.toLowerCase().includes(q)
            );
        }
        result.sort((a, b) => {
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];
            if (typeof valA === 'number' && typeof valB === 'number') {
                return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
            }
            const strA = String(valA).toLowerCase();
            const strB = String(valB).toLowerCase();
            if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return result;
    }, [inventory, searchQuery, sortConfig]);

    const handleDownload = () => {
        exportInventoryToCSV(inventory);
        (addToast as (t: { type: string; message: string }) => void)({ type: 'success', message: 'Database exported to CSV.' });
    };

    const handleUploadClick = () => fileInputRef.current?.click();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setUploadFiles(Array.from(e.target.files));
            setIsUploadModalOpen(true);
        }
        e.target.value = '';
    };

    const handleUploadConfirm = async (mode: 'add' | 'overwrite') => {
        if (uploadFiles.length === 0) return;
        setIsProcessing(true);
        try {
            const allItems: HardwareItem[] = [];
            for (const file of uploadFiles) {
                const report = await processHardwareSetFile(file);
                allItems.push(...report.data.flatMap(s => s.items));
            }
            if (allItems.length === 0) throw new Error('No valid items found in the uploaded files.');
            if (mode === 'overwrite') {
                onOverwriteInventory(allItems);
                (addToast as (t: { type: string; message: string }) => void)({ type: 'success', message: `Database overwritten with ${allItems.length} items.` });
            } else {
                onAddToInventory(allItems);
                (addToast as (t: { type: string; message: string }) => void)({ type: 'success', message: `Merged ${allItems.length} items into database.` });
            }
            setIsUploadModalOpen(false);
            setUploadFiles([]);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            (addToast as (t: { type: string; message: string; details?: string }) => void)({ type: 'error', message: 'Upload failed', details: message });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAddRow = () => {
        const newItem: HardwareItem = {
            id: `inv-new-${Date.now()}`,
            name: 'New Item',
            manufacturer: '',
            description: '',
            finish: '',
            quantity: 0,
        };
        onUpdateInventory([...inventory, newItem]);
        setEditingCell({ id: newItem.id, field: 'name' });
        setTempValue('New Item');
    };

    const handleDeleteRow = (id: string) => {
        if (confirm('Are you sure you want to delete this item?')) {
            onUpdateInventory(inventory.filter(item => item.id !== id));
        }
    };

    const startEditing = (item: HardwareItem, field: keyof HardwareItem) => {
        if (!canEdit) return;
        setEditingCell({ id: item.id, field });
        const val = item[field];
        setTempValue(typeof val === 'boolean' ? String(val) : val ?? '');
    };

    const saveEdit = () => {
        if (!editingCell) return;
        onUpdateInventory(inventory.map(item =>
            item.id === editingCell.id ? { ...item, [editingCell.field]: tempValue } : item
        ));
        setEditingCell(null);
        setTempValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') saveEdit();
        if (e.key === 'Escape') { setEditingCell(null); setTempValue(''); }
    };

    const SortIcon: React.FC<{ columnKey: keyof HardwareItem }> = ({ columnKey }) => {
        if (sortConfig.key !== columnKey) return <ChevronsUpDown className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-40 flex-shrink-0" />;
        return sortConfig.direction === 'asc'
            ? <ChevronUp className="w-3 h-3 ml-1 text-[var(--primary-text-muted)] flex-shrink-0" />
            : <ChevronDown className="w-3 h-3 ml-1 text-[var(--primary-text-muted)] flex-shrink-0" />;
    };

    const renderHeader = (label: string, key: keyof HardwareItem) => (
        <th
            key={key}
            scope="col"
            className="px-4 py-2.5 cursor-pointer hover:bg-blue-100 group select-none border-b border-[var(--primary-border)]"
            onClick={() => handleSort(key)}
        >
            <div className="flex items-center text-xs font-semibold text-[var(--primary-text)] uppercase tracking-wide">
                {label}
                <SortIcon columnKey={key} />
            </div>
        </th>
    );

    const renderCell = (item: HardwareItem, field: keyof HardwareItem) => {
        const isEditing = editingCell?.id === item.id && editingCell?.field === field;
        if (isEditing) {
            return (
                <input
                    ref={inputRef}
                    type={field === 'quantity' ? 'number' : 'text'}
                    value={tempValue}
                    onChange={e => setTempValue(field === 'quantity' ? Number(e.target.value) : e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={handleKeyDown}
                    className="w-full px-2 py-1 text-sm border-2 border-[var(--primary-ring)] rounded focus:outline-none bg-[var(--bg)]"
                />
            );
        }
        return (
            <div
                onClick={() => startEditing(item, field)}
                className={`truncate ${canEdit ? 'cursor-text hover:bg-[var(--bg-muted)] rounded px-1 -mx-1' : ''}`}
                title={canEdit ? 'Click to edit' : undefined}
            >
                {item[field] !== undefined && item[field] !== '' ? String(item[field]) : <span className="text-[var(--text-faint)] italic text-xs">—</span>}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-subtle)]">

            {/* Page header */}
            <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-6 py-4 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Database className="w-4 h-4 text-[var(--primary-text-muted)]" />
                    </div>
                    <div>
                        <h1 className="text-base font-semibold text-[var(--text)] leading-tight">Master Database</h1>
                        <p className="text-xs text-[var(--primary-text-muted)]">Centralized repository of unique hardware items from all projects</p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--primary-border)] bg-[var(--bg)]">
                            <span className="text-xs text-[var(--text-muted)] font-medium">Items</span>
                            <span className="text-xs font-bold text-[var(--primary-text)]">{inventory.length}</span>
                        </div>
                        {!canEdit && (
                            <span className="text-[10px] font-medium text-[var(--text-faint)] italic px-2 py-1 bg-[var(--bg)] border border-[var(--border)] rounded-md">Read-only</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="bg-[var(--bg)] border-b border-[var(--border)] px-6 py-3 flex items-center gap-3 flex-shrink-0">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-faint)] pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search by name, manufacturer, finish…"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)] focus:border-[var(--primary-ring)] bg-[var(--bg)] text-[var(--text)] placeholder:text-[var(--text-faint)]"
                    />
                </div>

                <div className="ml-auto flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownload}
                        className="border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] gap-1.5"
                        title="Export CSV"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Export CSV
                    </Button>

                    {canEdit && (
                        <>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept=".csv,.xlsx,.xls,.pdf"
                                onChange={handleFileChange}
                                multiple
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleUploadClick}
                                className="border-[var(--primary-border)] text-[var(--text-muted)] hover:bg-[var(--primary-bg)] bg-[var(--bg)] gap-1.5"
                            >
                                <Upload className="w-3.5 h-3.5" />
                                Upload Data
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleAddRow}
                                className="gap-1.5"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Add Item
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="flex-grow overflow-hidden flex flex-col mx-6 my-5 rounded-md border border-[var(--border)] bg-[var(--bg)]">
                <div className="overflow-auto flex-grow">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-[var(--primary-bg)] sticky top-0 z-10">
                            <tr>
                                {renderHeader('Item Name', 'name')}
                                {renderHeader('Manufacturer', 'manufacturer')}
                                {renderHeader('Description', 'description')}
                                {renderHeader('Finish', 'finish')}
                                {canEdit && (
                                    <th scope="col" className="px-4 py-2.5 text-center w-16 border-b border-[var(--primary-border)] bg-[var(--primary-bg)]">
                                        <span className="text-xs font-semibold text-[var(--primary-text)] uppercase tracking-wide">Actions</span>
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-subtle)]">
                            {filteredInventory.map(item => (
                                <tr key={item.id} className="hover:bg-[var(--bg-subtle)] transition-colors group">
                                    <td className="px-4 py-2.5 font-medium text-[var(--text)] align-middle">
                                        {renderCell(item, 'name')}
                                    </td>
                                    <td className="px-4 py-2.5 text-[var(--text-muted)] align-middle">
                                        {renderCell(item, 'manufacturer')}
                                    </td>
                                    <td className="px-4 py-2.5 text-[var(--text-muted)] align-middle max-w-xs">
                                        {renderCell(item, 'description')}
                                    </td>
                                    <td className="px-4 py-2.5 align-middle">
                                        {canEdit ? (
                                            renderCell(item, 'finish')
                                        ) : (
                                            item.finish
                                                ? <span className="font-mono text-xs bg-[var(--bg-muted)] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-secondary)]">{item.finish}</span>
                                                : <span className="text-[var(--text-faint)] italic text-xs">—</span>
                                        )}
                                    </td>
                                    {canEdit && (
                                        <td className="px-4 py-2.5 text-center align-middle">
                                            <button
                                                onClick={() => handleDeleteRow(item.id)}
                                                className="p-1 rounded text-[var(--text-faint)] hover:text-[var(--error-text)] hover:bg-[var(--error-bg)] transition-colors opacity-0 group-hover:opacity-100"
                                                title="Delete item"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {filteredInventory.length === 0 && (
                                <tr>
                                    <td colSpan={canEdit ? 5 : 4} className="text-center py-16 text-[var(--text-faint)]">
                                        <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">
                                            {searchQuery ? `No items match "${searchQuery}"` : 'No items in the master database yet.'}
                                        </p>
                                        {searchQuery && (
                                            <button onClick={() => setSearchQuery('')} className="mt-1 text-xs text-[var(--primary-text-muted)] hover:underline">
                                                Clear search
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Table footer */}
                <div className="bg-[var(--bg-subtle)] border-t border-[var(--border)] px-4 py-2.5 flex items-center justify-between flex-shrink-0">
                    <span className="text-xs text-[var(--text-muted)]">
                        Showing <span className="font-medium text-[var(--text-secondary)]">{filteredInventory.length}</span> of <span className="font-medium text-[var(--text-secondary)]">{inventory.length}</span> items
                    </span>
                    {searchQuery && filteredInventory.length !== inventory.length && (
                        <button onClick={() => setSearchQuery('')} className="text-xs text-[var(--primary-text-muted)] hover:underline">
                            Clear filter
                        </button>
                    )}
                </div>
            </div>

            <UploadConfirmationModal
                isOpen={isUploadModalOpen}
                onClose={() => { setIsUploadModalOpen(false); setUploadFiles([]); }}
                onConfirm={handleUploadConfirm}
                files={uploadFiles}
                isLoading={isProcessing}
            />
        </div>
    );
};

export default DatabaseView;
