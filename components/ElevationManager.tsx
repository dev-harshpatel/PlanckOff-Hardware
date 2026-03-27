import React, { useState, useRef } from 'react';
import { ElevationType } from '../types';
import { CameraIcon } from './icons';

interface ElevationManagerProps {
    elevationTypes: ElevationType[];
    onUpdate: (types: ElevationType[]) => void;
    onClose: () => void;
}

const ElevationManager: React.FC<ElevationManagerProps> = ({ elevationTypes, onUpdate, onClose }) => {
    const [types, setTypes] = useState<ElevationType[]>(elevationTypes);
    const [editingId, setEditingId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [newType, setNewType] = useState<Partial<ElevationType>>({
        code: '',
        description: ''
    });

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            // Generate a temporary ID or use it for the new type being created
            if (editingId) {
                setTypes(prev => prev.map(t => t.id === editingId ? { ...t, imageData: base64 } : t));
            } else {
                setNewType(prev => ({ ...prev, imageData: base64 }));
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSaveNew = () => {
        if (!newType.code || !newType.imageData) return;

        const newElevation: ElevationType = {
            id: crypto.randomUUID(),
            code: newType.code,
            description: newType.description || '',
            imageData: newType.imageData
        };

        const updated = [...types, newElevation];
        setTypes(updated);
        onUpdate(updated);

        // Reset form
        setNewType({ code: '', description: '' });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Are you sure you want to delete this elevation type? It will be removed from all assigned doors.')) {
            const updated = types.filter(t => t.id !== id);
            setTypes(updated);
            onUpdate(updated);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <h2 className="text-xl font-bold text-gray-800">Manage Elevation Types</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex">
                    {/* List Panel */}
                    <div className="w-1/3 border-r border-gray-200 overflow-y-auto p-4 bg-gray-50">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Existing Types</h3>
                        <div className="space-y-3">
                            {types.map(type => (
                                <div
                                    key={type.id}
                                    className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:ring-2 ring-blue-500 cursor-pointer transition-all relative group"
                                >
                                    <div className="aspect-w-16 aspect-h-9 mb-2 bg-gray-100 rounded overflow-hidden h-32 flex items-center justify-center">
                                        <img src={type.imageData} alt={type.code} className="object-contain max-h-full" />
                                    </div>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-bold text-gray-900">{type.code}</div>
                                            <div className="text-xs text-gray-500 line-clamp-2">{type.description}</div>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(type.id); }}
                                            className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {types.length === 0 && (
                                <div className="text-center py-8 text-gray-400 italic">
                                    No elevation types created yet.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Editor Panel */}
                    <div className="w-2/3 p-6 overflow-y-auto">
                        <h3 className="text-lg font-bold text-gray-800 mb-6">Add New Elevation Type</h3>

                        <div className="space-y-6 max-w-lg">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Elevation Code <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Type A, E-1, GW-01"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    value={newType.code}
                                    onChange={e => setNewType({ ...newType, code: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description
                                </label>
                                <textarea
                                    placeholder="e.g. Full glass aluminum entry door..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none h-24 resize-none"
                                    value={newType.description}
                                    onChange={e => setNewType({ ...newType, description: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Upload Drawing/Image <span className="text-red-500">*</span>
                                </label>
                                <div
                                    className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {newType.imageData ? (
                                        <div className="relative">
                                            <img src={newType.imageData} alt="Preview" className="max-h-64 mx-auto rounded shadow-sm" />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-30 transition-all group">
                                                <span className="text-white opacity-0 group-hover:opacity-100 font-medium bg-black bg-opacity-50 px-3 py-1 rounded">
                                                    Click to Change
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
                                                <CameraIcon className="w-6 h-6" />
                                            </div>
                                            <div className="font-medium text-gray-900">Click to upload image</div>
                                            <div className="text-xs text-gray-500">Supports PNG, JPG, GIF</div>
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleFileUpload}
                                    />
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    onClick={handleSaveNew}
                                    disabled={!newType.code || !newType.imageData}
                                    className={`w-full py-3 rounded-lg font-bold text-white shadow-md transition-all ${!newType.code || !newType.imageData
                                            ? 'bg-gray-300 cursor-not-allowed'
                                            : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
                                        }`}
                                >
                                    Create Elevation Type
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ElevationManager;
