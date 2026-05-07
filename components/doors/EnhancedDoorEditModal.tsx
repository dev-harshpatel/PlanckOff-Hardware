
import React, { useState } from 'react';
import { Door, HardwareSet, ElevationType } from '../../types';
import HardwarePrepEditor from '../hardware/HardwarePrepEditor';
import ElectrificationEditor from '../hardware/ElectrificationEditor';
import HingeSpecEditor from '../hardware/HingeSpecEditor';
import { ElevationTab } from '../elevation/ElevationTab';
import { X, DoorOpen, Frame, Wrench, Image, ClipboardList, AlertCircle } from 'lucide-react';
import { getAssignedDoorMismatchMap, ValidationResult } from '../../utils/doorValidation';
import { SectionFields } from '../forms/DoorFormSection';
import { DoorBasicSection } from '../forms/DoorBasicSection';
import { DoorDimensionSection } from '../forms/DoorDimensionSection';
import { DoorHardwareSection } from '../forms/DoorHardwareSection';
import { useDoorFormState, FRAME_GROUPS } from '../../hooks/useDoorFormState';

interface EnhancedDoorEditModalProps {
    door: Door;
    onSave: (updatedDoor: Door) => void;
    onCancel: () => void;
    hardwareSets: HardwareSet[];
    elevationTypes: ElevationType[];
    projectId: string;
    onElevationTypeUpdate: (updated: ElevationType) => void;
    siblingDoors?: Door[];
}

type TabId = 'basic' | 'door' | 'frame' | 'hardware' | 'elevation';

const EnhancedDoorEditModal: React.FC<EnhancedDoorEditModalProps> = ({
    door,
    onSave,
    onCancel,
    hardwareSets,
    elevationTypes,
    projectId,
    onElevationTypeUpdate,
    siblingDoors = [],
}) => {
    const [activeTab, setActiveTab] = useState<TabId>('basic');
    const [elevationMode, setElevationMode] = useState<'door' | 'frame'>('door');
    const [isIssuesOpen, setIsIssuesOpen] = useState(false);

    const {
        editedDoor,
        setElevationDirty,
        basicInfoSec,
        doorSec,
        frameSec,
        isDirty,
        doorExcluded,
        frameExcluded,
        hwExcluded,
        matchedSet,
        updateBasicInfoSec,
        updateDoorSec,
        updateFrameSec,
        updateField,
        handleSave,
    } = useDoorFormState({ door, hardwareSets, onSave });

    // Group-mismatch warnings only: compare this door against siblings in the same hardware set
    const mismatchWarnings: ValidationResult[] = React.useMemo(() => {
        if (siblingDoors.length === 0) return [];
        const allInSet = [editedDoor, ...siblingDoors];
        const mismatchMap = getAssignedDoorMismatchMap(allInSet);
        const conflicts = mismatchMap.get(editedDoor.id) ?? {};
        return Object.entries(conflicts).map(([field, message]) => ({
            doorId: editedDoor.id,
            doorTag: editedDoor.doorTag,
            ruleId: `group-mismatch-${field}`,
            severity: 'warning' as const,
            message: message ?? '',
            field: field as keyof Door,
        }));
    }, [editedDoor, siblingDoors]);

    const conflictCount = mismatchWarnings.length;

    const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
        { id: 'basic',     label: 'Basic Info', icon: <ClipboardList className="w-3.5 h-3.5" /> },
        { id: 'door',      label: 'Door',       icon: <DoorOpen      className="w-3.5 h-3.5" /> },
        { id: 'frame',     label: 'Frame',      icon: <Frame         className="w-3.5 h-3.5" /> },
        { id: 'hardware',  label: 'Hardware',   icon: <Wrench        className="w-3.5 h-3.5" /> },
        { id: 'elevation', label: 'Elevation',  icon: <Image         className="w-3.5 h-3.5" /> },
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

                    {/* Conflict pill — only shown when group mismatches exist */}
                    {conflictCount > 0 && (
                        <button onClick={() => setIsIssuesOpen(true)} className="ml-auto self-center flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[10px] font-semibold hover:bg-amber-500/20 transition-colors">
                            <AlertCircle className="w-3 h-3" />
                            {conflictCount} conflict{conflictCount > 1 ? 's' : ''}
                        </button>
                    )}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-6">

                    {/* ── BASIC INFO TAB ── */}
                    {activeTab === 'basic' && (
                        <DoorBasicSection data={basicInfoSec} onChange={updateBasicInfoSec} />
                    )}

                    {/* ── DOOR TAB ── */}
                    {activeTab === 'door' && (
                        <DoorDimensionSection data={doorSec} onChange={updateDoorSec} isExcluded={doorExcluded} />
                    )}

                    {/* ── FRAME TAB ── */}
                    {activeTab === 'frame' && (
                        Object.keys(frameSec).length > 0
                            ? <SectionFields
                                data={frameSec}
                                groups={FRAME_GROUPS}
                                onChange={updateFrameSec}
                                includeExcludeKey="FRAME INCLUDE/EXCLUDE"
                                isExcluded={frameExcluded}
                                excludedLabel="frame"
                              />
                            : <div className="flex flex-col items-center gap-2 py-12 text-[var(--text-faint)] text-xs">
                                <Frame className="w-8 h-8 opacity-40" />
                                No frame section data available. Upload a sectioned Excel schedule to populate fields.
                              </div>
                    )}

                    {/* ── HARDWARE TAB ── */}
                    {activeTab === 'hardware' && (
                        <DoorHardwareSection
                            editedDoor={editedDoor}
                            hardwareSets={hardwareSets}
                            hwExcluded={hwExcluded}
                            matchedSet={matchedSet}
                            updateField={updateField}
                        />
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
                                onElevationTypeUpdate={(updated) => {
                                    setElevationDirty(true);
                                    onElevationTypeUpdate(updated);
                                }}
                                mode={elevationMode}
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg)] rounded-b-xl flex-shrink-0">
                    <div className="text-[10px] text-[var(--text-faint)]">
                        {conflictCount > 0 && <span className="text-amber-500">⚠ {conflictCount} group conflict{conflictCount > 1 ? 's' : ''} detected</span>}
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
                            disabled={!isDirty}
                            className="px-5 py-2 text-sm bg-[var(--primary-action)] text-white rounded-lg font-semibold transition-colors shadow-sm enabled:hover:bg-[var(--primary-action-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* Group conflicts modal */}
        {isIssuesOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setIsIssuesOpen(false)}>
                <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[70vh]" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] flex-shrink-0">
                        <h3 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                            Group Conflicts — Door {editedDoor.doorTag}
                        </h3>
                        <button onClick={() => setIsIssuesOpen(false)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="overflow-y-auto flex-1 p-4 space-y-2">
                        {mismatchWarnings.map((r, i) => (
                            <div key={i} className="rounded-lg border p-3 bg-amber-500/10 border-amber-500/20">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
                                    <div className="min-w-0">
                                        <p className="text-xs font-medium text-[var(--text)]">{r.message}</p>
                                        {r.field && (
                                            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                                                Field: <span className="font-mono">{String(r.field)}</span>
                                            </p>
                                        )}
                                    </div>
                                    <span className="ml-auto flex-shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
                                        Conflict
                                    </span>
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
