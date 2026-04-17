'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { HardwareItem, Role, HardwareSet } from '../types';
import { 
    MagnifyingGlassIcon, 
    ChevronDownIcon, 
    ChevronUpIcon,
    TableCellsIcon,
    ArrowDownTrayIcon,
    ArrowUpTrayIcon,
    TrashIcon,
    PencilSquareIcon,
    CheckCircleIcon
} from '../components/icons';
import { exportInventoryToCSV } from '../utils/csvExporter';
import UploadConfirmationModal from '../components/UploadConfirmationModal';
import { processHardwareSetFile } from '../services/fileUploadService';

interface DatabaseViewProps {
  inventory: HardwareItem[];
  userRole: Role;
  onUpdateInventory: (items: HardwareItem[]) => void;
  onAddToInventory: (items: HardwareItem[]) => void;
  onOverwriteInventory: (items: HardwareItem[]) => void;
  addToast: (toast: any) => void;
}

const DatabaseView: React.FC<DatabaseViewProps> = ({ 
    inventory, 
    userRole, 
    onUpdateInventory, 
    onAddToInventory, 
    onOverwriteInventory,
    addToast
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof HardwareItem; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Inline Editing State
  const [editingCell, setEditingCell] = useState<{ id: string, field: keyof HardwareItem } | null>(null);
  const [tempValue, setTempValue] = useState<string | number>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = userRole === Role.Administrator || userRole === Role.SeniorEstimator;

  // Focus input when editing starts
  useEffect(() => {
      if (editingCell && inputRef.current) {
          inputRef.current.focus();
      }
  }, [editingCell]);

  const handleSort = (key: keyof HardwareItem) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredInventory = useMemo(() => {
      let result = [...inventory];

      if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          result = result.filter(item => 
             item.name.toLowerCase().includes(query) || 
             item.manufacturer.toLowerCase().includes(query) || 
             item.description.toLowerCase().includes(query) ||
             item.finish.toLowerCase().includes(query)
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

  // --- Actions ---

  const handleDownload = () => {
      exportInventoryToCSV(inventory);
      addToast({ type: 'success', message: 'Database downloaded successfully.' });
  };

  const handleUploadClick = () => {
      if (fileInputRef.current) {
          fileInputRef.current.click();
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          setUploadFiles(Array.from(e.target.files));
          setIsUploadModalOpen(true);
      }
      e.target.value = ''; // Reset input
  };

  const handleUploadConfirm = async (mode: 'add' | 'overwrite') => {
      if (uploadFiles.length === 0) return;
      setIsProcessing(true);

      try {
          const allItems: HardwareItem[] = [];
          for (const file of uploadFiles) {
               // Reuse the hardware set parser logic as it extracts items correctly
               const sets = await processHardwareSetFile(file); 
               const items = sets.flatMap(s => s.items);
               allItems.push(...items);
          }

          if (allItems.length === 0) {
              throw new Error("No valid items found in the uploaded files.");
          }

          if (mode === 'overwrite') {
              onOverwriteInventory(allItems);
              addToast({ type: 'success', message: `Database overwritten with ${allItems.length} items.` });
          } else {
              onAddToInventory(allItems);
              addToast({ type: 'success', message: `Merged ${allItems.length} items into database.` });
          }
          
          setIsUploadModalOpen(false);
          setUploadFiles([]);

      } catch (error: any) {
          console.error("Upload failed:", error);
          addToast({ type: 'error', message: 'Upload failed', details: error.message });
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
          quantity: 0
      };
      onUpdateInventory([...inventory, newItem]);
      // Automatically start editing the name of the new item
      setEditingCell({ id: newItem.id, field: 'name' });
      setTempValue('New Item');
  };

  const handleDeleteRow = (id: string) => {
      if (confirm('Are you sure you want to delete this item?')) {
          onUpdateInventory(inventory.filter(item => item.id !== id));
      }
  };

  // --- Inline Editing ---

  const startEditing = (item: HardwareItem, field: keyof HardwareItem) => {
      if (!canEdit) return;
      setEditingCell({ id: item.id, field });
      setTempValue(item[field]);
  };

  const saveEdit = () => {
      if (!editingCell) return;

      const updatedInventory = inventory.map(item => {
          if (item.id === editingCell.id) {
              return { ...item, [editingCell.field]: tempValue };
          }
          return item;
      });

      onUpdateInventory(updatedInventory);
      setEditingCell(null);
      setTempValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') saveEdit();
      if (e.key === 'Escape') {
          setEditingCell(null);
          setTempValue('');
      }
  };

  // --- Render Helpers ---

  const SortIcon: React.FC<{ columnKey: keyof HardwareItem }> = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
        return <div className="w-4 h-4 ml-1 inline-block opacity-0 group-hover:opacity-30"><ChevronDownIcon className="w-4 h-4" /></div>;
    }
    return sortConfig.direction === 'asc' ? (
        <ChevronUpIcon className="w-4 h-4 ml-1 inline-block text-primary-600" />
    ) : (
        <ChevronDownIcon className="w-4 h-4 ml-1 inline-block text-primary-600" />
    );
  };

  const renderHeader = (label: string, key: keyof HardwareItem) => (
    <th 
        scope="col" 
        className="px-6 py-3 cursor-pointer hover:bg-gray-200 group select-none sticky top-0 bg-gray-100 z-10"
        onClick={() => handleSort(key)}
    >
        <div className="flex items-center">
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
                  onChange={(e) => setTempValue(field === 'quantity' ? Number(e.target.value) : e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={handleKeyDown}
                  className="w-full p-1 text-sm border-2 border-blue-500 rounded focus:outline-none shadow-sm"
              />
          );
      }

      return (
          <div 
            onClick={() => startEditing(item, field)}
            className={`p-1 rounded truncate ${canEdit ? 'cursor-text hover:bg-gray-100' : ''}`}
            title={canEdit ? 'Click to edit' : undefined}
          >
              {item[field] || <span className="text-gray-300 italic">Empty</span>}
          </div>
      );
  };

  return (
    <div className="p-5 h-full flex flex-col">
      <div className="flex flex-wrap items-center justify-between mb-6 gap-4 flex-shrink-0">
        <div>
            <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                <TableCellsIcon className="w-8 h-8 text-primary-600" />
                Master Database
            </h2>
            <p className="text-gray-500 text-sm mt-1">Centralized repository of unique hardware items from all projects.</p>
        </div>
        
        <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    placeholder="Search inventory..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                />
            </div>
            
            <button 
                onClick={handleDownload}
                className="p-2 text-gray-600 hover:text-primary-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                title="Download Database (CSV)"
            >
                <ArrowDownTrayIcon className="w-5 h-5" />
            </button>

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
                    <button 
                        onClick={handleUploadClick}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-semibold text-sm transition-colors"
                    >
                        <ArrowUpTrayIcon className="w-4 h-4" />
                        Upload Data
                    </button>
                    <button 
                        onClick={handleAddRow}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-semibold text-sm transition-colors shadow-sm"
                    >
                        + Add Item
                    </button>
                </>
            )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg border border-gray-200 flex-grow flex flex-col overflow-hidden">
        <div className="overflow-auto flex-grow">
            <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b border-gray-200 sticky top-0 z-10">
                    <tr>
                        {renderHeader('Item Name', 'name')}
                        {renderHeader('Manufacturer', 'manufacturer')}
                        {renderHeader('Description', 'description')}
                        {renderHeader('Finish', 'finish')}
                        {canEdit && <th scope="col" className="px-6 py-3 text-center w-24 bg-gray-100 sticky top-0 z-10">Actions</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredInventory.map(item => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                            <td className="px-6 py-3 font-medium text-gray-900 align-middle">{renderCell(item, 'name')}</td>
                            <td className="px-6 py-3 align-middle">{renderCell(item, 'manufacturer')}</td>
                            <td className="px-6 py-3 align-middle">{renderCell(item, 'description')}</td>
                            <td className="px-6 py-3 align-middle">
                                <div className={canEdit ? "" : "inline-block bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded border border-gray-300"}>
                                    {renderCell(item, 'finish')}
                                </div>
                            </td>
                            {canEdit && (
                                <td className="px-6 py-3 text-center align-middle">
                                    <button 
                                        onClick={() => handleDeleteRow(item.id)}
                                        className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50 opacity-0 group-hover:opacity-100"
                                        title="Delete Row"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </td>
                            )}
                        </tr>
                    ))}
                    {filteredInventory.length === 0 && (
                        <tr>
                            <td colSpan={canEdit ? 5 : 4} className="text-center py-12 text-gray-400">
                                No items found in the master database.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-center flex-shrink-0">
            <span>Showing {filteredInventory.length} unique items</span>
            {!canEdit && <span className="italic text-gray-400">Read-Only View</span>}
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
