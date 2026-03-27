import React, { useState } from 'react';
import { Door, HardwareSet, ElevationType, DoorHanding, DoorCoreType, DoorFaceType, DoorFaceGrade, WoodSpecies, DoorFinishSystem, FireRatingLabel, FrameGauge, FrameProfile } from '../types';
import DoorHandingSelector from './DoorHandingSelector';
import DoorMaterialSelector from './DoorMaterialSelector';
import FinishSystemEditor from './FinishSystemEditor';
import HardwarePrepEditor from './HardwarePrepEditor';
import ElectrificationEditor from './ElectrificationEditor';
import HingeSpecEditor from './HingeSpecEditor';
import { XCircleIcon } from './icons';
import { validateDoor, ValidationResult, getSeverityIcon, getSeverityColor } from '../utils/doorValidation';
import { generateHardwarePrepString } from '../utils/hardwareDataMigration';

interface EnhancedDoorEditModalProps {
    door: Door;
    onSave: (updatedDoor: Door) => void;
    onCancel: () => void;
    hardwareSets: HardwareSet[];
    elevationTypes: ElevationType[];
}

type TabId = 'basic' | 'materials' | 'finish' | 'frame' | 'hardware';

const EnhancedDoorEditModal: React.FC<EnhancedDoorEditModalProps> = ({
    door,
    onSave,
    onCancel,
    hardwareSets,
    elevationTypes
}) => {
    const [activeTab, setActiveTab] = useState<TabId>('basic');
    const [editedDoor, setEditedDoor] = useState<Door>({ ...door });
    const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);

    // Phase 20: Run validation whenever door changes
    React.useEffect(() => {
        const results = validateDoor(editedDoor);
        setValidationResults(results);
    }, [editedDoor]);

    const updateField = <K extends keyof Door>(field: K, value: Door[K]) => {
        setEditedDoor(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = () => {
        // Phase 21: Auto-populate legacy hardwarePrep from structured spec
        const doorToSave = {
            ...editedDoor,
            hardwarePrep: generateHardwarePrepString(editedDoor.hardwarePrepSpec) || editedDoor.hardwarePrep
        };

        // Validation is informational only - always allow save
        onSave(doorToSave);
    };

    const criticalCount = validationResults.filter(r => r.severity === 'critical').length;
    const warningCount = validationResults.filter(r => r.severity === 'warning').length;
    const infoCount = validationResults.filter(r => r.severity === 'info').length;

    const tabs: { id: TabId; label: string; icon: string }[] = [
        { id: 'basic', label: 'Basic Info', icon: '📋' },
        { id: 'materials', label: 'Materials', icon: '🏗️' },
        { id: 'finish', label: 'Finish', icon: '🎨' },
        { id: 'frame', label: 'Frame', icon: '🚪' },
        { id: 'hardware', label: 'Hardware', icon: '🔧' }
    ];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Edit Door</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            {editedDoor.doorTag} - {editedDoor.location}
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <XCircleIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-gray-200 px-6 bg-gray-50">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                px-4 py-3 text-sm font-medium transition-all relative
                                ${activeTab === tab.id
                                    ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                }
                            `}
                        >
                            <span className="mr-2">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Phase 20: Validation Summary Banner */}
                {validationResults.length > 0 && (
                    <div className="px-6 py-3 border-b border-gray-200">
                        {criticalCount > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-red-600 font-semibold text-sm">
                                        🔴 {criticalCount} Critical Error{criticalCount > 1 ? 's' : ''} - Please review
                                    </span>
                                </div>
                                <ul className="text-xs text-red-700 list-disc list-inside space-y-1">
                                    {validationResults
                                        .filter(r => r.severity === 'critical')
                                        .slice(0, 3)
                                        .map((r, i) => (
                                            <li key={i}>{r.message}</li>
                                        ))}
                                </ul>
                            </div>
                        )}
                        {criticalCount === 0 && (warningCount > 0 || infoCount > 0) && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-yellow-700">
                                        ⚠️ {warningCount} Warning{warningCount !== 1 ? 's' : ''}
                                        {infoCount > 0 && `, ${infoCount} Suggestion${infoCount !== 1 ? 's' : ''}`}
                                    </span>
                                </div>
                            </div>
                        )}
                        {validationResults.length === 0 && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                <div className="flex items-center gap-2 text-sm text-green-700">
                                    ✅ All validation checks passed
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'basic' && (
                        <div className="space-y-4 max-w-2xl">
                            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Basic Information</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Door Tag</label>
                                    <input
                                        type="text"
                                        value={editedDoor.doorTag}
                                        onChange={(e) => updateField('doorTag', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                                    <input
                                        type="text"
                                        value={editedDoor.location}
                                        onChange={(e) => updateField('location', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Dimensions */}
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Width (in)</label>
                                    <input
                                        type="number"
                                        value={editedDoor.width}
                                        onChange={(e) => updateField('width', Number(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Height (in)</label>
                                    <input
                                        type="number"
                                        value={editedDoor.height}
                                        onChange={(e) => updateField('height', Number(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Thickness (in)</label>
                                    <input
                                        type="number"
                                        value={editedDoor.thickness}
                                        onChange={(e) => updateField('thickness', Number(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Handing - Phase 19 */}
                            <DoorHandingSelector
                                value={editedDoor.handing}
                                onChange={(handing) => updateField('handing', handing)}
                                required={!!editedDoor.assignedHardwareSet}
                            />

                            {/* Other Basic Fields */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                                    <input
                                        type="number"
                                        value={editedDoor.quantity}
                                        onChange={(e) => updateField('quantity', Number(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Leaf Count</label>
                                    <input
                                        type="number"
                                        value={editedDoor.leafCount}
                                        onChange={(e) => updateField('leafCount', Number(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Operation</label>
                                <input
                                    type="text"
                                    value={editedDoor.operation}
                                    onChange={(e) => updateField('operation', e.target.value)}
                                    placeholder="e.g., Single Swing, Pair, Sliding..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            {/* Fire Rating */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Fire Rating</label>
                                    <select
                                        value={editedDoor.fireRating}
                                        onChange={(e) => updateField('fireRating', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="N/A">N/A</option>
                                        <option value="20 Min">20 Min</option>
                                        <option value="45 Min">45 Min</option>
                                        <option value="60 Min">60 Min</option>
                                        <option value="90 Min">90 Min</option>
                                        <option value="3 Hour">3 Hour</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Fire Label</label>
                                    <select
                                        value={editedDoor.fireRatingLabel || ''}
                                        onChange={(e) => updateField('fireRatingLabel', e.target.value as FireRatingLabel)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">Select...</option>
                                        <option value="UL">UL</option>
                                        <option value="WHI">WHI</option>
                                        <option value="Intertek">Intertek</option>
                                        <option value="N/A">N/A</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Undercut (inches)</label>
                                <input
                                    type="number"
                                    step="0.125"
                                    value={editedDoor.undercut || ''}
                                    onChange={(e) => updateField('undercut', e.target.value ? Number(e.target.value) : undefined)}
                                    placeholder="e.g., 0.75 or 1.0"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'materials' && (
                        <div className="max-w-2xl">
                            <DoorMaterialSelector
                                coreType={editedDoor.doorCoreType}
                                faceType={editedDoor.doorFaceType}
                                faceSpecies={editedDoor.doorFaceSpecies}
                                faceGrade={editedDoor.doorFaceGrade}
                                onCoreTypeChange={(value) => updateField('doorCoreType', value)}
                                onFaceTypeChange={(value) => updateField('doorFaceType', value)}
                                onFaceSpeciesChange={(value) => updateField('doorFaceSpecies', value)}
                                onFaceGradeChange={(value) => updateField('doorFaceGrade', value)}
                            />

                            <div className="mt-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Door Manufacturer</label>
                                    <input
                                        type="text"
                                        value={editedDoor.doorManufacturer || ''}
                                        onChange={(e) => updateField('doorManufacturer', e.target.value || undefined)}
                                        placeholder="e.g., Steelcraft, Curries, Mesker..."
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Door Model Number</label>
                                    <input
                                        type="text"
                                        value={editedDoor.doorModelNumber || ''}
                                        onChange={(e) => updateField('doorModelNumber', e.target.value || undefined)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'finish' && (
                        <div className="max-w-2xl">
                            <FinishSystemEditor
                                finishSystem={editedDoor.finishSystem}
                                onChange={(value) => updateField('finishSystem', value)}
                            />
                        </div>
                    )}

                    {activeTab === 'frame' && (
                        <div className="space-y-4 max-w-2xl">
                            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Frame Specifications</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Frame Material</label>
                                    <input
                                        type="text"
                                        value={editedDoor.frameMaterial}
                                        onChange={(e) => updateField('frameMaterial', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Frame Gauge</label>
                                    <select
                                        value={editedDoor.frameGauge || ''}
                                        onChange={(e) => updateField('frameGauge', e.target.value as FrameGauge)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">Select...</option>
                                        <option value="16 GA">16 GA</option>
                                        <option value="18 GA">18 GA</option>
                                        <option value="20 GA">20 GA</option>
                                        <option value="14 GA">14 GA</option>
                                        <option value="12 GA">12 GA</option>
                                        <option value="N/A">N/A</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Frame Profile</label>
                                    <select
                                        value={editedDoor.frameProfile || ''}
                                        onChange={(e) => updateField('frameProfile', e.target.value as FrameProfile)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">Select...</option>
                                        <option value="Single Rabbet">Single Rabbet</option>
                                        <option value="Double Rabbet">Double Rabbet</option>
                                        <option value="Cased Opening">Cased Opening</option>
                                        <option value="Borrowed Light">Borrowed Light</option>
                                        <option value="Transom">Transom</option>
                                        <option value="Custom">Custom</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Frame Type</label>
                                    <input
                                        type="text"
                                        value={editedDoor.frameType || ''}
                                        onChange={(e) => updateField('frameType', e.target.value || undefined)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Wall Type</label>
                                    <input
                                        type="text"
                                        value={editedDoor.wallType || ''}
                                        onChange={(e) => updateField('wallType', e.target.value || undefined)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Jamb Depth</label>
                                    <input
                                        type="text"
                                        value={editedDoor.jambDepth || ''}
                                        onChange={(e) => updateField('jambDepth', e.target.value || undefined)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Frame Manufacturer</label>
                                <input
                                    type="text"
                                    value={editedDoor.frameManufacturer || ''}
                                    onChange={(e) => updateField('frameManufacturer', e.target.value || undefined)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'hardware' && (
                        <div className="space-y-6 max-w-2xl">
                            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Hardware Information</h3>

                            {/* Phase 21: Hardware Prep Editor */}
                            <HardwarePrepEditor
                                value={editedDoor.hardwarePrepSpec}
                                onChange={(value) => updateField('hardwarePrepSpec', value)}
                            />

                            {/* Phase 21: Electrification Editor */}
                            <ElectrificationEditor
                                value={editedDoor.electrification}
                                onChange={(value) => updateField('electrification', value)}
                            />

                            {/* Phase 21: Hinge Spec Editor */}
                            <HingeSpecEditor
                                value={editedDoor.hingeSpec}
                                onChange={(value) => updateField('hingeSpec', value)}
                                doorHeight={editedDoor.height}
                            />

                            {/* Divider */}
                            <div className="border-t pt-6">
                                <h4 className="text-md font-semibold text-gray-700 mb-4">Hardware Set Assignment</h4>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Provided Hardware Set</label>
                                <input
                                    type="text"
                                    value={editedDoor.providedHardwareSet || ''}
                                    onChange={(e) => updateField('providedHardwareSet', e.target.value || undefined)}
                                    placeholder="e.g., Set 3.0, Set A..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Assigned Hardware Set</label>
                                <select
                                    value={editedDoor.assignedHardwareSet?.id || ''}
                                    onChange={(e) => {
                                        const set = hardwareSets.find(s => s.id === e.target.value);
                                        updateField('assignedHardwareSet', set);
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">None</option>
                                    {hardwareSets.map(set => (
                                        <option key={set.id} value={set.id}>{set.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Elevation Type</label>
                                <select
                                    value={editedDoor.elevationTypeId || ''}
                                    onChange={(e) => updateField('elevationTypeId', e.target.value || undefined)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">None</option>
                                    {elevationTypes.map(type => (
                                        <option key={type.id} value={type.id}>{type.code} - {type.description}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Legacy Hardware Prep Field - Auto-populated, read-only */}
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                    Legacy Hardware Prep (Auto-populated)
                                </label>
                                <input
                                    type="text"
                                    value={editedDoor.hardwarePrep}
                                    readOnly
                                    className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 text-sm"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    This field is automatically generated from the structured hardware prep above
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EnhancedDoorEditModal;
