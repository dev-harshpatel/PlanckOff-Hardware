import { useState, useMemo, useRef, useEffect } from 'react';
import { Door, HardwareSet } from '../types';
import { validateDoor, ValidationResult } from '../utils/doorValidation';
import { generateHardwarePrepString } from '../utils/hardwareDataMigration';
import { type RawSection } from '../components/forms/DoorFormSection';
import { BASIC_INFO_GROUPS, DEFAULT_BASIC_INFO_SEC } from '../components/forms/DoorBasicSection';
import { DEFAULT_DOOR_SEC } from '../components/forms/DoorDimensionSection';

export const FRAME_GROUPS: { header: string; cols: number; keys: string[] }[] = [
    { header: 'General',            cols: 2, keys: ['FRAME MATERIAL', 'WALL TYPE', 'THROAT THICKNESS'] },
    { header: 'Anchors',            cols: 3, keys: ['FRAME ANCHOR', 'BASE ANCHOR', 'NO OF ANCHOR'] },
    { header: 'Profile & Assembly', cols: 2, keys: ['FRAME PROFILE', 'FRAME ELEVATION TYPE', 'FRAME ASSEMBLY', 'FRAME GUAGE'] },
    { header: 'Finish & Details',   cols: 2, keys: ['FRAME FINISH', 'PREHUNG', 'FRAME HEAD', 'CASING', 'FRAME INCLUDE/EXCLUDE'] },
];

const DEFAULT_FRAME_SEC = (): RawSection =>
    Object.fromEntries(FRAME_GROUPS.flatMap(g => g.keys).map(k => [k, '']));

interface UseDoorFormStateParams {
    door: Door;
    hardwareSets: HardwareSet[];
    onSave: (updated: Door) => void;
}

interface UseDoorFormStateReturn {
    editedDoor: Door;
    elevationDirty: boolean;
    setElevationDirty: (dirty: boolean) => void;
    validationResults: ValidationResult[];
    basicInfoSec: RawSection;
    doorSec: RawSection;
    frameSec: RawSection;
    isDirty: boolean;
    doorExcluded: boolean;
    frameExcluded: boolean;
    hwExcluded: boolean;
    matchedSet: HardwareSet | null;
    updateBasicInfoSec: (key: string, value: string) => void;
    updateDoorSec: (key: string, value: string) => void;
    updateFrameSec: (key: string, value: string) => void;
    updateField: <K extends keyof Door>(field: K, value: Door[K]) => void;
    handleSave: () => void;
}

export function useDoorFormState({ door, hardwareSets, onSave }: UseDoorFormStateParams): UseDoorFormStateReturn {
    const [editedDoor, setEditedDoor] = useState<Door>({ ...door });
    const [elevationDirty, setElevationDirty] = useState(false);
    const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);

    // Stable snapshot used to detect unsaved changes — captured once at mount
    const initialDoor = useMemo(() => JSON.stringify(door), []);  // eslint-disable-line react-hooks/exhaustive-deps

    // Raw section state — initialized from door.sections (uppercase Excel keys).
    const rawSections = door.sections as unknown as {
        basic_information?: RawSection;
        door: RawSection;
        frame: RawSection;
        hardware: RawSection;
    } | undefined;

    const biKeys = new Set(BASIC_INFO_GROUPS.flatMap(g => g.keys));

    // Convert numeric inches back to feet-inches string for display (e.g. 36 → "3'-0\"")
    const fmtInches = (v: number | undefined): string =>
        v ? `${Math.floor(v / 12)}'-${v % 12}"` : '';

    const [basicInfoSec, setBasicInfoSec] = useState<RawSection>(() => {
        // 1. New sectioned format — basic_information section has data
        const existing = rawSections?.basic_information ?? {};
        if (Object.keys(existing).length > 0) return { ...existing };
        // 2. Old sectioned format — basic-info fields lived inside the door section
        const fromDoor = Object.fromEntries([...biKeys].map(k => [k, rawSections?.door?.[k] ?? '']));
        if (Object.values(fromDoor).some(v => v)) return fromDoor;
        // 3. Flat Excel format — data lives in typed Door fields, not sections
        return {
            ...DEFAULT_BASIC_INFO_SEC(),
            'DOOR TAG':          door.doorTag              || '',
            'BUILDING TAG':      door.buildingTag          || '',
            'BUILDING LOCATION': door.buildingLocation     || '',
            'DOOR LOCATION':     door.location             || '',
            'INTERIOR/EXTERIOR': door.interiorExterior     || '',
            'QUANTITY':          door.quantity != null ? String(door.quantity) : '',
            'LEAF COUNT':        door.leafCountDisplay      || (door.leafCount != null ? String(door.leafCount) : ''),
            'HAND OF OPENINGS':  door.handing              || '',
            'DOOR OPERATION':    door.operation            || '',
            'EXCLUDE REASON':    door.excludeReason        || '',
            'WIDTH':             door.widthDisplay     ?? fmtInches(door.width),
            'HEIGHT':            door.heightDisplay    ?? fmtInches(door.height),
            'THICKNESS':         door.thicknessDisplay ?? (door.thickness != null ? String(door.thickness) : ''),
            'FIRE RATING':       door.fireRating           || '',
        };
    });

    const [doorSec, setDoorSec] = useState<RawSection>(() => {
        const existing = rawSections?.door ?? {};
        const doorOnly = Object.fromEntries(Object.entries(existing).filter(([k]) => !biKeys.has(k)));

        // Typed Door fields provide fallback values for any key that's empty in section data
        const typedFallback: RawSection = {
            'DOOR MATERIAL':        door.doorMaterial          || '',
            'DOOR ELEVATION TYPE':  door.elevationTypeId       || '',
            'DOOR CORE':            door.doorCore              || '',
            'DOOR FACE':            door.doorFace              || '',
            'DOOR EDGE':            door.doorEdge              || '',
            'DOOR GUAGE':           door.doorGauge             || '',
            'DOOR FINISH':          door.doorFinish            || '',
            'STC RATING':           door.stcRating             || '',
            'DOOR UNDERCUT':        door.undercut              || '',
            'DOOR INCLUDE/EXCLUDE': door.doorIncludeExclude    || '',
        };

        if (Object.keys(doorOnly).length > 0) {
            // Merge: section data wins when non-empty; typed Door field fills any empty gaps
            const merged: RawSection = { ...typedFallback };
            for (const [k, v] of Object.entries(doorOnly)) {
                if (v !== undefined && v !== '') merged[k] = v;
                else if (!(k in merged)) merged[k] = v ?? '';
            }
            return merged;
        }
        return { ...DEFAULT_DOOR_SEC(), ...typedFallback };
    });

    const [frameSec, setFrameSec] = useState<RawSection>(() => {
        const existing = rawSections?.frame ?? {};

        const typedFallback: RawSection = {
            'FRAME MATERIAL':        door.frameMaterial         || '',
            'WALL TYPE':             door.wallType              || '',
            'THROAT THICKNESS':      door.throatThickness       || '',
            'FRAME ANCHOR':          door.frameAnchor           || '',
            'BASE ANCHOR':           door.baseAnchor            || '',
            'NO OF ANCHOR':          door.numberOfAnchors       || '',
            'FRAME PROFILE':         door.frameProfile          || '',
            'FRAME ELEVATION TYPE':  door.frameElevationType    || '',
            'FRAME ASSEMBLY':        door.frameAssembly         || '',
            'FRAME GUAGE':           door.frameGauge            || '',
            'FRAME FINISH':          door.frameFinish           || '',
            'PREHUNG':               door.prehung               || '',
            'FRAME HEAD':            door.frameHead             || '',
            'CASING':                door.casing                || '',
            'FRAME INCLUDE/EXCLUDE': door.frameIncludeExclude   || '',
        };

        if (Object.keys(existing).length > 0) {
            // Merge: section data wins when non-empty; typed Door field fills any empty gaps
            const merged: RawSection = { ...typedFallback };
            for (const [k, v] of Object.entries(existing)) {
                if (v !== undefined && v !== '') merged[k] = v;
                else if (!(k in merged)) merged[k] = v ?? '';
            }
            return merged;
        }
        return { ...DEFAULT_FRAME_SEC(), ...typedFallback };
    });

    // Snapshots of sections as-initialized (after defaults/fallbacks are applied)
    const initialBasicInfoSec = useRef(JSON.stringify(basicInfoSec));
    const initialDoorSec      = useRef(JSON.stringify(doorSec));
    const initialFrameSec     = useRef(JSON.stringify(frameSec));

    const updateBasicInfoSec = (key: string, value: string) => setBasicInfoSec(prev => ({ ...prev, [key]: value }));
    const updateDoorSec = (key: string, value: string) => setDoorSec(prev => ({ ...prev, [key]: value }));
    const updateFrameSec = (key: string, value: string) => setFrameSec(prev => ({ ...prev, [key]: value }));

    // isDirty: true when any field differs from the initialized state
    const isDirty = useMemo(() => {
        if (elevationDirty)                                               return true;
        if (JSON.stringify(editedDoor)   !== initialDoor)                 return true;
        if (JSON.stringify(basicInfoSec) !== initialBasicInfoSec.current) return true;
        if (JSON.stringify(doorSec)      !== initialDoorSec.current)      return true;
        if (JSON.stringify(frameSec)     !== initialFrameSec.current)     return true;
        return false;
    }, [editedDoor, basicInfoSec, doorSec, frameSec, initialDoor, elevationDirty]);

    useEffect(() => {
        const results = validateDoor(editedDoor);
        setValidationResults(results);
    }, [editedDoor]);

    // Derive exclude flags — scoped per section; each section is independent.
    const doorExcluded  = doorSec['DOOR INCLUDE/EXCLUDE']?.toUpperCase()  === 'EXCLUDE';
    const frameExcluded = frameSec['FRAME INCLUDE/EXCLUDE']?.toUpperCase() === 'EXCLUDE';
    const hwExcluded    = (editedDoor.hardwareIncludeExclude ?? '').toUpperCase() === 'EXCLUDE';

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
        // Mirror hardware tab typed fields back into sections.hardware so the
        // PATCH endpoint (and any future re-transform) picks them up correctly.
        const updatedHardwareSec = {
            ...(rawSections?.hardware ?? {}),
            'HARDWARE INCLUDE/EXCLUDE': editedDoor.hardwareIncludeExclude ?? rawSections?.hardware?.['HARDWARE INCLUDE/EXCLUDE'] ?? '',
            'HARDWARE SET': editedDoor.providedHardwareSet ?? rawSections?.hardware?.['HARDWARE SET'] ?? '',
        };

        const updatedSections = {
            ...(rawSections ?? {}),
            basic_information: basicInfoSec,
            door: doorSec,
            frame: frameSec,
            hardware: updatedHardwareSec,
        };

        const doorToSave: Door = {
            ...editedDoor,
            hardwarePrep: generateHardwarePrepString(editedDoor.hardwarePrepSpec) || editedDoor.hardwarePrep,
            sections: updatedSections as unknown as Door['sections'],
            // Sync typed fields from basic_information section
            doorTag:          basicInfoSec['DOOR TAG']          ?? editedDoor.doorTag,
            location:         basicInfoSec['DOOR LOCATION']     ?? editedDoor.location,
            buildingTag:      basicInfoSec['BUILDING TAG']      ?? editedDoor.buildingTag,
            buildingLocation: basicInfoSec['BUILDING LOCATION'] ?? editedDoor.buildingLocation,
            interiorExterior: basicInfoSec['INTERIOR/EXTERIOR'] ?? editedDoor.interiorExterior,
            excludeReason:    basicInfoSec['EXCLUDE REASON']    ?? editedDoor.excludeReason,
            fireRating:       basicInfoSec['FIRE RATING']       ?? editedDoor.fireRating,
            handing:         (basicInfoSec['HAND OF OPENINGS']  ?? editedDoor.handing) as Door['handing'],
            operation:        basicInfoSec['DOOR OPERATION']    ?? editedDoor.operation,
            // Sync typed fields from door section
            doorMaterial:     doorSec['DOOR MATERIAL']          ?? editedDoor.doorMaterial,
            doorCore:         doorSec['DOOR CORE']              ?? editedDoor.doorCore,
            doorFace:         doorSec['DOOR FACE']              ?? editedDoor.doorFace,
            doorEdge:         doorSec['DOOR EDGE']              ?? editedDoor.doorEdge,
            doorGauge:        doorSec['DOOR GUAGE']             ?? editedDoor.doorGauge,
            doorFinish:       doorSec['DOOR FINISH']            ?? editedDoor.doorFinish,
            stcRating:        doorSec['STC RATING']             ?? editedDoor.stcRating,
            undercut:         doorSec['DOOR UNDERCUT']          ?? editedDoor.undercut,
            doorIncludeExclude: doorSec['DOOR INCLUDE/EXCLUDE'] ?? editedDoor.doorIncludeExclude,
            elevationTypeId:  doorSec['DOOR ELEVATION TYPE']    ?? editedDoor.elevationTypeId,
            // Sync typed fields from frame section
            frameMaterial:   (frameSec['FRAME MATERIAL']         ?? editedDoor.frameMaterial) as Door['frameMaterial'],
            wallType:         frameSec['WALL TYPE']              ?? editedDoor.wallType,
            throatThickness:  frameSec['THROAT THICKNESS']       ?? editedDoor.throatThickness,
            frameAnchor:      frameSec['FRAME ANCHOR']           ?? editedDoor.frameAnchor,
            baseAnchor:       frameSec['BASE ANCHOR']            ?? editedDoor.baseAnchor,
            numberOfAnchors:  frameSec['NO OF ANCHOR']           ?? editedDoor.numberOfAnchors,
            frameProfile:    (frameSec['FRAME PROFILE']          ?? editedDoor.frameProfile) as Door['frameProfile'],
            frameElevationType: frameSec['FRAME ELEVATION TYPE'] ?? editedDoor.frameElevationType,
            frameAssembly:    frameSec['FRAME ASSEMBLY']         ?? editedDoor.frameAssembly,
            frameGauge:       frameSec['FRAME GUAGE']            ?? editedDoor.frameGauge,
            frameFinish:      frameSec['FRAME FINISH']           ?? editedDoor.frameFinish,
            prehung:          frameSec['PREHUNG']                ?? editedDoor.prehung,
            frameHead:        frameSec['FRAME HEAD']             ?? editedDoor.frameHead,
            casing:           frameSec['CASING']                 ?? editedDoor.casing,
            frameIncludeExclude: frameSec['FRAME INCLUDE/EXCLUDE'] ?? editedDoor.frameIncludeExclude,
        };
        onSave(doorToSave);
    };

    return {
        editedDoor,
        elevationDirty,
        setElevationDirty,
        validationResults,
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
    };
}
