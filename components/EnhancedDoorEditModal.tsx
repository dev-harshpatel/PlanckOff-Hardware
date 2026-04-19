
import React, { useState, useMemo } from 'react';
import { Door, HardwareSet, HardwareItem, ElevationType } from '../types';
import HardwarePrepEditor from './HardwarePrepEditor';
import ElectrificationEditor from './ElectrificationEditor';
import HingeSpecEditor from './HingeSpecEditor';
import { validateDoor, ValidationResult } from '../utils/doorValidation';
import { generateHardwarePrepString } from '../utils/hardwareDataMigration';
import { X, DoorOpen, Frame, Wrench, AlertTriangle, CheckCircle2, PackageOpen } from 'lucide-react';

interface EnhancedDoorEditModalProps {
    door: Door;
    onSave: (updatedDoor: Door) => void;
    onCancel: () => void;
    hardwareSets: HardwareSet[];
    elevationTypes: ElevationType[];
}

type TabId = 'door' | 'frame' | 'hardware';

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <label className="block text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1">{children}</label>
);

const inputCls = "w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--text)] bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)] focus:border-[var(--primary-ring)] placeholder:text-[var(--text-faint)] transition-colors";
const selectCls = "w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--text)] bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)] focus:border-[var(--primary-ring)] transition-colors";

const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="flex items-center gap-2 mb-3 mt-5 first:mt-0">
        <span className="text-xs font-bold text-[var(--primary-text-muted)] uppercase tracking-wider">{children}</span>
        <div className="flex-1 h-px bg-[var(--primary-border)]" />
    </div>
);

const EnhancedDoorEditModal: React.FC<EnhancedDoorEditModalProps> = ({
    door,
    onSave,
    onCancel,
    hardwareSets,
    elevationTypes
}) => {
    const [activeTab, setActiveTab] = useState<TabId>('door');
    const [editedDoor, setEditedDoor] = useState<Door>({ ...door });
    const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);

    React.useEffect(() => {
        const results = validateDoor(editedDoor);
        setValidationResults(results);
    }, [editedDoor]);

    const matchedSet = useMemo<HardwareSet | null>(() => {
        if (editedDoor.assignedHardwareSet) return editedDoor.assignedHardwareSet;
        if (editedDoor.providedHardwareSet) {
            return hardwareSets.find(s =>
                s.name.trim().toLowerCase() === editedDoor.providedHardwareSet!.trim().toLowerCase()
            ) ?? null;
        }
        return null;
    }, [editedDoor.assignedHardwareSet, editedDoor.providedHardwareSet, hardwareSets]);

    const updateField = <K extends keyof Door>(field: K, value: Door[K]) => {
        setEditedDoor(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = () => {
        const doorToSave = {
            ...editedDoor,
            hardwarePrep: generateHardwarePrepString(editedDoor.hardwarePrepSpec) || editedDoor.hardwarePrep
        };
        onSave(doorToSave);
    };

    const criticalCount = validationResults.filter(r => r.severity === 'critical').length;
    const warningCount = validationResults.filter(r => r.severity === 'warning').length;

    const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
        { id: 'door',     label: 'Door',     icon: <DoorOpen className="w-3.5 h-3.5" /> },
        { id: 'frame',    label: 'Frame',    icon: <Frame className="w-3.5 h-3.5" /> },
        { id: 'hardware', label: 'Hardware', icon: <Wrench className="w-3.5 h-3.5" /> },
    ];

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--bg)] rounded-xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col border border-[var(--border-subtle)]">

                {/* Header */}
                <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-6 py-4 flex items-center justify-between flex-shrink-0 rounded-t-xl">
                    <div className="flex items-center gap-3">
                        <div className="bg-[var(--primary-bg-hover)] p-2 rounded-lg">
                            <DoorOpen className="w-4 h-4 text-[var(--primary-text-muted)]" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-[var(--text)]">Edit Door</h2>
                            <p className="text-xs text-[var(--primary-text-muted)] mt-0.5">
                                {editedDoor.doorTag}{editedDoor.location ? ` · ${editedDoor.location}` : ''}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-1.5 text-[var(--text-faint)] hover:text-[var(--text-muted)] hover:bg-[var(--primary-bg-hover)] rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-[var(--primary-border)] bg-[var(--bg)] px-4 flex-shrink-0">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold transition-all border-b-2 -mb-px ${
                                activeTab === tab.id
                                    ? 'text-[var(--primary-text)] border-[var(--primary-action)] bg-[var(--primary-bg)]/50'
                                    : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text)] hover:bg-[var(--bg-subtle)]'
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}

                    {/* Validation pill */}
                    {criticalCount > 0 && (
                        <div className="ml-auto self-center flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 text-[10px] font-semibold">
                            <AlertTriangle className="w-3 h-3" />
                            {criticalCount} issue{criticalCount > 1 ? 's' : ''}
                        </div>
                    )}
                    {criticalCount === 0 && warningCount > 0 && (
                        <div className="ml-auto self-center flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-600 text-[10px] font-semibold">
                            <AlertTriangle className="w-3 h-3" />
                            {warningCount} warning{warningCount > 1 ? 's' : ''}
                        </div>
                    )}
                    {criticalCount === 0 && warningCount === 0 && validationResults.length > 0 && (
                        <div className="ml-auto self-center flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-green-600 text-[10px] font-semibold">
                            <CheckCircle2 className="w-3 h-3" />
                            Valid
                        </div>
                    )}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-6">

                    {/* ── DOOR TAB ── */}
                    {activeTab === 'door' && (
                        <div className="space-y-1 max-w-2xl">

                            {/* Identity — matches Excel cols 1-10 */}
                            <SectionHeader>Identity</SectionHeader>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label>Door Tag</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.doorTag}
                                        onChange={e => updateField('doorTag', e.target.value)} />
                                </div>
                                <div>
                                    <Label>Building Tag</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.buildingTag || ''}
                                        onChange={e => updateField('buildingTag', e.target.value || undefined)} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <div>
                                    <Label>Building Location</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.buildingLocation || ''}
                                        onChange={e => updateField('buildingLocation', e.target.value || undefined)} />
                                </div>
                                <div>
                                    <Label>Door Location</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.location}
                                        onChange={e => updateField('location', e.target.value)} />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 pt-2">
                                <div>
                                    <Label>Quantity</Label>
                                    <input type="number" className={inputCls}
                                        value={editedDoor.quantity}
                                        onChange={e => updateField('quantity', Number(e.target.value))} />
                                </div>
                                <div>
                                    <Label>Leaf Count</Label>
                                    <input type="number" className={inputCls}
                                        value={editedDoor.leafCount ?? 1}
                                        onChange={e => updateField('leafCount', Number(e.target.value))} />
                                </div>
                                <div>
                                    <Label>Interior / Exterior</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.interiorExterior || ''}
                                        placeholder="Interior / Exterior"
                                        onChange={e => updateField('interiorExterior', e.target.value || undefined)} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <div>
                                    <Label>Hand of Openings</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.handing || ''}
                                        placeholder="e.g. LHR, RHR, LHRB…"
                                        onChange={e => updateField('handing', e.target.value as Door['handing'] || undefined)} />
                                </div>
                                <div>
                                    <Label>Door Operation</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.operation || ''}
                                        placeholder="e.g. Single Swing, Pair…"
                                        onChange={e => updateField('operation', e.target.value || undefined)} />
                                </div>
                            </div>
                            <div className="pt-2">
                                <Label>Exclude Reason</Label>
                                <input type="text" className={inputCls}
                                    value={editedDoor.excludeReason || ''}
                                    onChange={e => updateField('excludeReason', e.target.value || undefined)} />
                            </div>

                            {/* Dimensions — Excel cols 11-13 */}
                            <SectionHeader>Dimensions</SectionHeader>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <Label>Width (in)</Label>
                                    <input type="number" className={inputCls}
                                        value={editedDoor.width}
                                        onChange={e => updateField('width', Number(e.target.value))} />
                                </div>
                                <div>
                                    <Label>Height (in)</Label>
                                    <input type="number" className={inputCls}
                                        value={editedDoor.height}
                                        onChange={e => updateField('height', Number(e.target.value))} />
                                </div>
                                <div>
                                    <Label>Thickness (in)</Label>
                                    <input type="number" className={inputCls}
                                        value={editedDoor.thickness}
                                        onChange={e => updateField('thickness', Number(e.target.value))} />
                                </div>
                            </div>

                            {/* Fire Rating — Excel col 14 */}
                            <SectionHeader>Fire Rating</SectionHeader>
                            <div className="w-1/2 pr-1.5">
                                <Label>Fire Rating</Label>
                                <select className={selectCls}
                                    value={editedDoor.fireRating || ''}
                                    onChange={e => updateField('fireRating', e.target.value || undefined)}>
                                    <option value="">N/A</option>
                                    <option>20 Min</option>
                                    <option>45 Min</option>
                                    <option>60 Min</option>
                                    <option>90 Min</option>
                                    <option>3 Hour</option>
                                </select>
                            </div>

                            {/* Door Material & Finish — Excel cols 15-24 in exact order */}
                            <SectionHeader>Door Material & Finish</SectionHeader>
                            {/* 15: Door Material | 16: Door Elevation Type */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label>Door Material</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.doorMaterial || ''}
                                        onChange={e => updateField('doorMaterial', e.target.value)} />
                                </div>
                                <div>
                                    <Label>Door Elevation Type</Label>
                                    <select className={selectCls}
                                        value={editedDoor.elevationTypeId || ''}
                                        onChange={e => updateField('elevationTypeId', e.target.value || undefined)}>
                                        <option value="">None</option>
                                        {elevationTypes.map(t => (
                                            <option key={t.id} value={t.id}>{t.code}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            {/* 17: Door Core | 18: Door Face */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <div>
                                    <Label>Door Core</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.doorCore || ''}
                                        onChange={e => updateField('doorCore', e.target.value || undefined)} />
                                </div>
                                <div>
                                    <Label>Door Face</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.doorFace || ''}
                                        onChange={e => updateField('doorFace', e.target.value || undefined)} />
                                </div>
                            </div>
                            {/* 19: Door Edge | 20: Door Gauge */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <div>
                                    <Label>Door Edge</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.doorEdge || ''}
                                        onChange={e => updateField('doorEdge', e.target.value || undefined)} />
                                </div>
                                <div>
                                    <Label>Door Guage</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.doorGauge || ''}
                                        onChange={e => updateField('doorGauge', e.target.value || undefined)} />
                                </div>
                            </div>
                            {/* 21: Door Finish | 22: STC Rating */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <div>
                                    <Label>Door Finish</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.doorFinish || ''}
                                        onChange={e => updateField('doorFinish', e.target.value || undefined)} />
                                </div>
                                <div>
                                    <Label>STC Rating</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.stcRating || ''}
                                        onChange={e => updateField('stcRating', e.target.value || undefined)} />
                                </div>
                            </div>
                            {/* 23: Door Undercut | 24: Door Include/Exclude */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <div>
                                    <Label>Door Undercut</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.undercut || ''}
                                        placeholder='e.g. 3/4"'
                                        onChange={e => updateField('undercut', e.target.value || undefined)} />
                                </div>
                                <div>
                                    <Label>Door Include / Exclude</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.doorIncludeExclude || ''}
                                        onChange={e => updateField('doorIncludeExclude', e.target.value || undefined)} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── FRAME TAB ── */}
                    {activeTab === 'frame' && (
                        <div className="space-y-1 max-w-2xl">

                            {/* Row 1-2: Material + Wall + Throat */}
                            <SectionHeader>General</SectionHeader>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label>Frame Material</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.frameMaterial || ''}
                                        onChange={e => updateField('frameMaterial', e.target.value as Door['frameMaterial'])} />
                                </div>
                                <div>
                                    <Label>Wall Type</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.wallType || ''}
                                        onChange={e => updateField('wallType', e.target.value || undefined)} />
                                </div>
                            </div>
                            <div className="pt-2">
                                <Label>Throat Thickness</Label>
                                <input type="text" className={inputCls}
                                    value={editedDoor.throatThickness || ''}
                                    onChange={e => updateField('throatThickness', e.target.value || undefined)} />
                            </div>

                            {/* Row 4-6: Anchors */}
                            <SectionHeader>Anchors</SectionHeader>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <Label>Frame Anchor</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.frameAnchor || ''}
                                        onChange={e => updateField('frameAnchor', e.target.value || undefined)} />
                                </div>
                                <div>
                                    <Label>Base Anchor</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.baseAnchor || ''}
                                        onChange={e => updateField('baseAnchor', e.target.value || undefined)} />
                                </div>
                                <div>
                                    <Label>No of Anchor</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.numberOfAnchors || ''}
                                        onChange={e => updateField('numberOfAnchors', e.target.value || undefined)} />
                                </div>
                            </div>

                            {/* Row 7-10: Profile + Elevation + Assembly + Gauge */}
                            <SectionHeader>Profile & Assembly</SectionHeader>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label>Frame Profile</Label>
                                    <select className={selectCls}
                                        value={editedDoor.frameProfile || ''}
                                        onChange={e => updateField('frameProfile', (e.target.value || undefined) as Door['frameProfile'])}>
                                        <option value="">Select…</option>
                                        <option>Single Rabbet</option>
                                        <option>Double Rabbet</option>
                                        <option>Cased Opening</option>
                                        <option>Borrowed Light</option>
                                        <option>Transom</option>
                                        <option>Custom</option>
                                    </select>
                                </div>
                                <div>
                                    <Label>Frame Elevation Type</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.frameElevationType || ''}
                                        onChange={e => updateField('frameElevationType', e.target.value || undefined)} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <div>
                                    <Label>Frame Assembly</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.frameAssembly || ''}
                                        onChange={e => updateField('frameAssembly', e.target.value || undefined)} />
                                </div>
                                <div>
                                    <Label>Frame Guage</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.frameGauge || ''}
                                        placeholder="e.g. 16 GA, 18 GA"
                                        onChange={e => updateField('frameGauge', e.target.value || undefined)} />
                                </div>
                            </div>

                            {/* Row 11-15: Finish + Prehung + Head + Casing + Include/Exclude */}
                            <SectionHeader>Finish & Details</SectionHeader>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label>Frame Finish</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.frameFinish || ''}
                                        onChange={e => updateField('frameFinish', e.target.value || undefined)} />
                                </div>
                                <div>
                                    <Label>Prehung</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.prehung || ''}
                                        placeholder="Yes / No"
                                        onChange={e => updateField('prehung', e.target.value || undefined)} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <div>
                                    <Label>Frame Head</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.frameHead || ''}
                                        onChange={e => updateField('frameHead', e.target.value || undefined)} />
                                </div>
                                <div>
                                    <Label>Casing</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.casing || ''}
                                        onChange={e => updateField('casing', e.target.value || undefined)} />
                                </div>
                            </div>
                            <div className="pt-2">
                                <Label>Frame Include / Exclude</Label>
                                <input type="text" className={inputCls}
                                    value={editedDoor.frameIncludeExclude || ''}
                                    onChange={e => updateField('frameIncludeExclude', e.target.value || undefined)} />
                            </div>
                        </div>
                    )}

                    {/* ── HARDWARE TAB ── */}
                    {activeTab === 'hardware' && (
                        <div className="space-y-1 max-w-2xl">

                            {/* Matched Hardware Set Items Table */}
                            <SectionHeader>Matched Hardware Set</SectionHeader>
                            {matchedSet ? (
                                <div className="border border-[var(--primary-border)] rounded-lg overflow-hidden">
                                    {/* Set name banner */}
                                    <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--primary-bg)] border-b border-[var(--primary-border)]">
                                        <div className="flex items-center gap-2">
                                            <PackageOpen className="w-3.5 h-3.5 text-[var(--primary-text-muted)] flex-shrink-0" />
                                            <span className="text-xs font-semibold text-[var(--primary-text)]">{matchedSet.name}</span>
                                            {matchedSet.description && (
                                                <span className="text-[10px] text-[var(--primary-text-muted)] truncate max-w-[200px]">{matchedSet.description}</span>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-medium text-[var(--primary-text-muted)] bg-[var(--primary-bg-hover)] px-2 py-0.5 rounded-full flex-shrink-0">
                                            {matchedSet.items.length} item{matchedSet.items.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>

                                    {matchedSet.items.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-wider">
                                                        <th className="px-3 py-2 text-center w-10">Qty</th>
                                                        <th className="px-3 py-2 text-left">Item / Manufacturer</th>
                                                        <th className="px-3 py-2 text-left">Description</th>
                                                        <th className="px-3 py-2 text-left w-24">Finish</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[var(--border-subtle)]">
                                                    {matchedSet.items.map((item: HardwareItem, idx: number) => (
                                                        <tr key={item.id || idx} className={idx % 2 === 0 ? 'bg-[var(--bg)]' : 'bg-[var(--bg-subtle)]/50'}>
                                                            <td className="px-3 py-2.5 text-center font-semibold text-[var(--text-secondary)] tabular-nums">
                                                                {item.quantity}
                                                            </td>
                                                            <td className="px-3 py-2.5">
                                                                <div className="font-medium text-[var(--text)] leading-snug">
                                                                    {item.name || <span className="text-[var(--text-faint)] italic">—</span>}
                                                                </div>
                                                                {item.manufacturer && (
                                                                    <div className="text-[10px] text-[var(--text-faint)] mt-0.5">{item.manufacturer}</div>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-[var(--text-muted)] max-w-[220px]">
                                                                <span className="line-clamp-2 leading-snug">
                                                                    {item.description || <span className="text-[var(--text-faint)] italic">—</span>}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2.5">
                                                                {item.finish
                                                                    ? <span className="inline-block px-2 py-0.5 bg-[var(--bg-muted)] text-[var(--text-muted)] rounded text-[10px] font-medium">{item.finish}</span>
                                                                    : <span className="text-[var(--text-faint)]">—</span>
                                                                }
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="px-4 py-6 text-center text-xs text-[var(--text-faint)]">
                                            No items in this hardware set.
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2 py-8 border border-dashed border-[var(--border)] rounded-lg bg-[var(--bg-subtle)]">
                                    <PackageOpen className="w-8 h-8 text-[var(--text-faint)]" />
                                    <p className="text-xs text-[var(--text-faint)] font-medium">No hardware set matched</p>
                                    <p className="text-[10px] text-[var(--text-faint)] text-center max-w-[200px]">
                                        Assign a set below or run <span className="font-semibold">Assign All</span> to auto-match.
                                    </p>
                                </div>
                            )}

                            {/* Assignment controls */}
                            <SectionHeader>Assignment</SectionHeader>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label>Provided Hardware Set</Label>
                                    <input type="text" className={inputCls}
                                        value={editedDoor.providedHardwareSet || ''}
                                        placeholder="e.g. Set 3.0, Set A…"
                                        onChange={e => updateField('providedHardwareSet', e.target.value || undefined)} />
                                </div>
                                <div>
                                    <Label>Assigned Hardware Set</Label>
                                    <select className={selectCls}
                                        value={editedDoor.assignedHardwareSet?.id || ''}
                                        onChange={e => {
                                            const set = hardwareSets.find(s => s.id === e.target.value);
                                            updateField('assignedHardwareSet', set);
                                        }}>
                                        <option value="">None</option>
                                        {hardwareSets.map(set => (
                                            <option key={set.id} value={set.id}>{set.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="pt-2">
                                <Label>Hardware Include / Exclude</Label>
                                <input type="text" className={inputCls}
                                    value={editedDoor.hardwareIncludeExclude || ''}
                                    onChange={e => updateField('hardwareIncludeExclude', e.target.value || undefined)} />
                            </div>

                            <SectionHeader>Hardware Prep</SectionHeader>
                            <HardwarePrepEditor
                                value={editedDoor.hardwarePrepSpec}
                                onChange={value => updateField('hardwarePrepSpec', value)}
                            />

                            <SectionHeader>Electrification</SectionHeader>
                            <ElectrificationEditor
                                value={editedDoor.electrification}
                                onChange={value => updateField('electrification', value)}
                            />

                            <SectionHeader>Hinge Specification</SectionHeader>
                            <HingeSpecEditor
                                value={editedDoor.hingeSpec}
                                onChange={value => updateField('hingeSpec', value)}
                                doorHeight={editedDoor.height}
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg)] rounded-b-xl flex-shrink-0">
                    <div className="text-[10px] text-[var(--text-faint)]">
                        {criticalCount > 0 && <span className="text-red-500">⚠ {criticalCount} critical issue{criticalCount > 1 ? 's' : ''} — save anyway?</span>}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-sm text-[var(--text-muted)] bg-[var(--bg)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-subtle)] font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-5 py-2 text-sm bg-[var(--primary-action)] text-white rounded-lg hover:bg-[var(--primary-action-hover)] font-semibold transition-colors shadow-sm"
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EnhancedDoorEditModal;
