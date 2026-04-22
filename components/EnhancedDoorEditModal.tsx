
import React, { useState, useMemo } from 'react';
import { Door, HardwareSet, HardwareItem, ElevationType } from '../types';
import HardwarePrepEditor from './HardwarePrepEditor';
import ElectrificationEditor from './ElectrificationEditor';
import HingeSpecEditor from './HingeSpecEditor';
import { ElevationTab } from './ElevationTab';
import { validateDoor, ValidationResult } from '../utils/doorValidation';
import { generateHardwarePrepString } from '../utils/hardwareDataMigration';
import { X, DoorOpen, Frame, Wrench, Image, AlertTriangle, CheckCircle2, PackageOpen } from 'lucide-react';

interface EnhancedDoorEditModalProps {
    door: Door;
    onSave: (updatedDoor: Door) => void;
    onCancel: () => void;
    hardwareSets: HardwareSet[];
    elevationTypes: ElevationType[];
    projectId: string;
    onElevationTypeUpdate: (updated: ElevationType) => void;
}

type TabId = 'door' | 'frame' | 'hardware' | 'elevation';

type RawSection = Record<string, string | undefined>;

const DOOR_GROUPS: { header: string; cols: number; keys: string[] }[] = [
    { header: 'Identity', cols: 2, keys: ['DOOR TAG', 'BUILDING TAG', 'BUILDING LOCATION', 'BUILDING AREA', 'DOOR LOCATION', 'QUANTITY', 'HAND OF OPENINGS', 'DOOR OPERATION', 'LEAF COUNT', 'INTERIOR/EXTERIOR', 'EXCLUDE REASON'] },
    { header: 'Dimensions', cols: 3, keys: ['WIDTH', 'HEIGHT', 'THICKNESS'] },
    { header: 'Material & Finish', cols: 2, keys: ['FIRE RATING', 'DOOR MATERIAL', 'DOOR ELEVATION TYPE', 'DOOR CORE', 'DOOR FACE', 'DOOR EDGE', 'DOOR GUAGE', 'DOOR FINISH', 'STC RATING', 'DOOR UNDERCUT', 'DOOR INCLUDE/EXCLUDE'] },
];

const FRAME_GROUPS: { header: string; cols: number; keys: string[] }[] = [
    { header: 'General', cols: 2, keys: ['FRAME MATERIAL', 'WALL TYPE', 'THROAT THICKNESS'] },
    { header: 'Anchors', cols: 3, keys: ['FRAME ANCHOR', 'BASE ANCHOR', 'NO OF ANCHOR'] },
    { header: 'Profile & Assembly', cols: 2, keys: ['FRAME PROFILE', 'FRAME ELEVATION TYPE', 'FRAME ASSEMBLY', 'FRAME GUAGE'] },
    { header: 'Finish & Details', cols: 2, keys: ['FRAME FINISH', 'PREHUNG', 'FRAME HEAD', 'CASING', 'FRAME INCLUDE/EXCLUDE'] },
];

const DEFAULT_DOOR_SEC = (): RawSection =>
    Object.fromEntries(DOOR_GROUPS.flatMap(g => g.keys).map(k => [k, '']));

const DEFAULT_FRAME_SEC = (): RawSection =>
    Object.fromEntries(FRAME_GROUPS.flatMap(g => g.keys).map(k => [k, '']));

const prettifyKey = (key: string) =>
    key.split(/[\s_]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <label className="block text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1">{children}</label>
);

const selectCls = "w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--text)] bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)] focus:border-[var(--primary-ring)] transition-colors";

const inputCls = "w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--text)] bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)] focus:border-[var(--primary-ring)] placeholder:text-[var(--text-faint)] transition-colors";

const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="flex items-center gap-2 mb-3 mt-5 first:mt-0">
        <span className="text-xs font-bold text-[var(--primary-text-muted)] uppercase tracking-wider">{children}</span>
        <div className="flex-1 h-px bg-[var(--primary-border)]" />
    </div>
);

const SectionFields: React.FC<{
    data: RawSection;
    groups: typeof DOOR_GROUPS;
    onChange: (key: string, value: string) => void;
}> = ({ data, groups, onChange }) => {
    const allGroupedKeys = new Set(groups.flatMap(g => g.keys));
    const extraKeys = Object.keys(data).filter(k => !allGroupedKeys.has(k));

    return (
        <div className="space-y-1 max-w-2xl">
            {groups.map(group => {
                const presentKeys = group.keys.filter(k => k in data);
                if (presentKeys.length === 0) return null;
                return (
                    <React.Fragment key={group.header}>
                        <SectionHeader>{group.header}</SectionHeader>
                        <div className={`grid gap-3 ${group.cols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                            {presentKeys.map(key => (
                                <div key={key}>
                                    <label className="block text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1">
                                        {prettifyKey(key)}
                                    </label>
                                    <input
                                        type="text"
                                        className={inputCls}
                                        value={data[key] ?? ''}
                                        onChange={e => onChange(key, e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>
                    </React.Fragment>
                );
            })}
            {extraKeys.length > 0 && (
                <>
                    <SectionHeader>Other</SectionHeader>
                    <div className="grid grid-cols-2 gap-3">
                        {extraKeys.map(key => (
                            <div key={key}>
                                <label className="block text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1">
                                    {prettifyKey(key)}
                                </label>
                                <input
                                    type="text"
                                    className={inputCls}
                                    value={data[key] ?? ''}
                                    onChange={e => onChange(key, e.target.value)}
                                />
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

const EnhancedDoorEditModal: React.FC<EnhancedDoorEditModalProps> = ({
    door,
    onSave,
    onCancel,
    hardwareSets,
    elevationTypes,
    projectId,
    onElevationTypeUpdate,
}) => {
    const [activeTab, setActiveTab] = useState<TabId>('door');
    const [elevationMode, setElevationMode] = useState<'door' | 'frame'>('door');
    const [editedDoor, setEditedDoor] = useState<Door>({ ...door });
    const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);

    // Raw section state — initialized from door.sections (uppercase Excel keys)
    // For new doors without sections, seed with empty-string defaults so all fields render.
    const rawSections = door.sections as unknown as { door: RawSection; frame: RawSection; hardware: RawSection } | undefined;
    const [doorSec, setDoorSec] = useState<RawSection>(() => {
        const existing = rawSections?.door ?? {};
        if (Object.keys(existing).length > 0) return { ...existing };
        return { ...DEFAULT_DOOR_SEC(), 'DOOR TAG': door.doorTag || '' };
    });
    const [frameSec, setFrameSec] = useState<RawSection>(() => {
        const existing = rawSections?.frame ?? {};
        if (Object.keys(existing).length > 0) return { ...existing };
        return DEFAULT_FRAME_SEC();
    });

    const updateDoorSec = (key: string, value: string) => setDoorSec(prev => ({ ...prev, [key]: value }));
    const updateFrameSec = (key: string, value: string) => setFrameSec(prev => ({ ...prev, [key]: value }));

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
        // Sync section edits back to typed Door fields
        const updatedSections = {
            ...(rawSections ?? { door: {}, frame: {}, hardware: {} }),
            door: doorSec,
            frame: frameSec,
        };

        const doorToSave: Door = {
            ...editedDoor,
            hardwarePrep: generateHardwarePrepString(editedDoor.hardwarePrepSpec) || editedDoor.hardwarePrep,
            sections: updatedSections as unknown as Door['sections'],
            // Sync typed fields from section edits so the rest of the app stays in sync
            doorTag: doorSec['DOOR TAG'] ?? editedDoor.doorTag,
            location: doorSec['DOOR LOCATION'] ?? editedDoor.location,
            buildingTag: doorSec['BUILDING TAG'] ?? editedDoor.buildingTag,
            buildingLocation: doorSec['BUILDING LOCATION'] ?? editedDoor.buildingLocation,
            interiorExterior: doorSec['INTERIOR/EXTERIOR'] ?? editedDoor.interiorExterior,
            excludeReason: doorSec['EXCLUDE REASON'] ?? editedDoor.excludeReason,
            fireRating: doorSec['FIRE RATING'] ?? editedDoor.fireRating,
            doorMaterial: doorSec['DOOR MATERIAL'] ?? editedDoor.doorMaterial,
            doorCore: doorSec['DOOR CORE'] ?? editedDoor.doorCore,
            doorFace: doorSec['DOOR FACE'] ?? editedDoor.doorFace,
            doorEdge: doorSec['DOOR EDGE'] ?? editedDoor.doorEdge,
            doorGauge: doorSec['DOOR GUAGE'] ?? editedDoor.doorGauge,
            doorFinish: doorSec['DOOR FINISH'] ?? editedDoor.doorFinish,
            stcRating: doorSec['STC RATING'] ?? editedDoor.stcRating,
            undercut: doorSec['DOOR UNDERCUT'] ?? editedDoor.undercut,
            doorIncludeExclude: doorSec['DOOR INCLUDE/EXCLUDE'] ?? editedDoor.doorIncludeExclude,
            elevationTypeId: doorSec['DOOR ELEVATION TYPE'] ?? editedDoor.elevationTypeId,
            handing: (doorSec['HAND OF OPENINGS'] ?? editedDoor.handing) as Door['handing'],
            operation: doorSec['DOOR OPERATION'] ?? editedDoor.operation,
            frameMaterial: (frameSec['FRAME MATERIAL'] ?? editedDoor.frameMaterial) as Door['frameMaterial'],
            wallType: frameSec['WALL TYPE'] ?? editedDoor.wallType,
            throatThickness: frameSec['THROAT THICKNESS'] ?? editedDoor.throatThickness,
            frameAnchor: frameSec['FRAME ANCHOR'] ?? editedDoor.frameAnchor,
            baseAnchor: frameSec['BASE ANCHOR'] ?? editedDoor.baseAnchor,
            numberOfAnchors: frameSec['NO OF ANCHOR'] ?? editedDoor.numberOfAnchors,
            frameProfile: (frameSec['FRAME PROFILE'] ?? editedDoor.frameProfile) as Door['frameProfile'],
            frameElevationType: frameSec['FRAME ELEVATION TYPE'] ?? editedDoor.frameElevationType,
            frameAssembly: frameSec['FRAME ASSEMBLY'] ?? editedDoor.frameAssembly,
            frameGauge: frameSec['FRAME GUAGE'] ?? editedDoor.frameGauge,
            frameFinish: frameSec['FRAME FINISH'] ?? editedDoor.frameFinish,
            prehung: frameSec['PREHUNG'] ?? editedDoor.prehung,
            frameHead: frameSec['FRAME HEAD'] ?? editedDoor.frameHead,
            casing: frameSec['CASING'] ?? editedDoor.casing,
            frameIncludeExclude: frameSec['FRAME INCLUDE/EXCLUDE'] ?? editedDoor.frameIncludeExclude,
        };
        onSave(doorToSave);
    };

    const criticalCount = validationResults.filter(r => r.severity === 'critical').length;
    const warningCount = validationResults.filter(r => r.severity === 'warning').length;
    const [isIssuesOpen, setIsIssuesOpen] = useState(false);

    const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
        { id: 'door',      label: 'Door',      icon: <DoorOpen className="w-3.5 h-3.5" /> },
        { id: 'frame',     label: 'Frame',     icon: <Frame    className="w-3.5 h-3.5" /> },
        { id: 'hardware',  label: 'Hardware',  icon: <Wrench   className="w-3.5 h-3.5" /> },
        { id: 'elevation', label: 'Elevation', icon: <Image    className="w-3.5 h-3.5" /> },
    ];

    return (
        <>
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

                    {/* Validation pill — clickable */}
                    {criticalCount > 0 && (
                        <button onClick={() => setIsIssuesOpen(true)} className="ml-auto self-center flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-[10px] font-semibold hover:bg-red-500/20 transition-colors">
                            <AlertTriangle className="w-3 h-3" />
                            {criticalCount} issue{criticalCount > 1 ? 's' : ''}
                        </button>
                    )}
                    {criticalCount === 0 && warningCount > 0 && (
                        <button onClick={() => setIsIssuesOpen(true)} className="ml-auto self-center flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[10px] font-semibold hover:bg-amber-500/20 transition-colors">
                            <AlertTriangle className="w-3 h-3" />
                            {warningCount} warning{warningCount > 1 ? 's' : ''}
                        </button>
                    )}
                    {criticalCount === 0 && warningCount === 0 && validationResults.length > 0 && (
                        <div className="ml-auto self-center flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 text-[10px] font-semibold">
                            <CheckCircle2 className="w-3 h-3" />
                            Valid
                        </div>
                    )}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-6">

                    {/* ── DOOR TAB ── */}
                    {activeTab === 'door' && (
                        Object.keys(doorSec).length > 0
                            ? <SectionFields data={doorSec} groups={DOOR_GROUPS} onChange={updateDoorSec} />
                            : <div className="flex flex-col items-center gap-2 py-12 text-[var(--text-faint)] text-xs">
                                <DoorOpen className="w-8 h-8 opacity-40" />
                                No door section data available. Upload a sectioned Excel schedule to populate fields.
                              </div>
                    )}

                    {/* ── FRAME TAB ── */}
                    {activeTab === 'frame' && (
                        Object.keys(frameSec).length > 0
                            ? <SectionFields data={frameSec} groups={FRAME_GROUPS} onChange={updateFrameSec} />
                            : <div className="flex flex-col items-center gap-2 py-12 text-[var(--text-faint)] text-xs">
                                <Frame className="w-8 h-8 opacity-40" />
                                No frame section data available. Upload a sectioned Excel schedule to populate fields.
                              </div>
                    )}

                    {/* ── HARDWARE TAB ── */}
                    {activeTab === 'hardware' && (
                        <div className="space-y-1 max-w-2xl">

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


                        </div>
                    )}

                    {/* ── ELEVATION TAB ── */}
                    {activeTab === 'elevation' && (
                        <div className="space-y-4">
                            {/* Sub-picker: Door Elevation vs Frame Elevation */}
                            <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border)] w-fit">
                                <button
                                    onClick={() => setElevationMode('door')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                                        elevationMode === 'door'
                                            ? 'bg-[var(--bg)] text-[var(--text)] shadow-sm border border-[var(--border)]'
                                            : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                                    }`}
                                >
                                    <DoorOpen className="w-3.5 h-3.5" />
                                    Door Elevation
                                </button>
                                <button
                                    onClick={() => setElevationMode('frame')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                                        elevationMode === 'frame'
                                            ? 'bg-[var(--bg)] text-[var(--text)] shadow-sm border border-[var(--border)]'
                                            : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                                    }`}
                                >
                                    <Frame className="w-3.5 h-3.5" />
                                    Frame Elevation
                                </button>
                            </div>

                            <ElevationTab
                                door={editedDoor}
                                elevationTypes={elevationTypes}
                                projectId={projectId}
                                onElevationTypeUpdate={onElevationTypeUpdate}
                                mode={elevationMode}
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

        {/* Issues detail modal */}
        {isIssuesOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setIsIssuesOpen(false)}>
                <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[70vh]" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] flex-shrink-0">
                        <h3 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            Validation Issues — Door {editedDoor.doorTag}
                        </h3>
                        <button onClick={() => setIsIssuesOpen(false)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="overflow-y-auto flex-1 p-4 space-y-2">
                        {validationResults.map((r, i) => (
                            <div key={i} className={`rounded-lg border p-3 ${
                                r.severity === 'critical'
                                    ? 'bg-red-500/10 border-red-500/20'
                                    : r.severity === 'warning'
                                    ? 'bg-amber-500/10 border-amber-500/20'
                                    : 'bg-blue-500/10 border-blue-500/20'
                            }`}>
                                <div className="flex items-start gap-2">
                                    <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                                        r.severity === 'critical' ? 'text-red-500' :
                                        r.severity === 'warning' ? 'text-amber-500' : 'text-blue-500'
                                    }`} />
                                    <div className="min-w-0">
                                        <p className="text-xs font-medium text-[var(--text)]">{r.message}</p>
                                        {r.field && (
                                            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                                                Field: <span className="font-mono">{String(r.field)}</span>
                                            </p>
                                        )}
                                        {r.suggestion && (
                                            <p className="text-[10px] text-[var(--text-muted)] mt-1 italic">{r.suggestion}</p>
                                        )}
                                    </div>
                                    <span className={`ml-auto flex-shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                        r.severity === 'critical' ? 'bg-red-500/20 text-red-600 dark:text-red-400' :
                                        r.severity === 'warning' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                                        'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                                    }`}>{r.severity}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end flex-shrink-0">
                        <button
                            onClick={() => setIsIssuesOpen(false)}
                            className="px-4 py-1.5 text-sm bg-[var(--bg-muted)] border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default EnhancedDoorEditModal;
