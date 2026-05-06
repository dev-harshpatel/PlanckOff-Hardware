import React from 'react';
import { ClipboardList } from 'lucide-react';
import { SectionFields, type RawSection } from './DoorFormSection';

export const BASIC_INFO_GROUPS: { header: string; cols: number; keys: string[] }[] = [
    { header: 'Identity',       cols: 2, keys: ['DOOR TAG', 'BUILDING TAG', 'BUILDING LOCATION', 'DOOR LOCATION', 'INTERIOR/EXTERIOR'] },
    { header: 'Operation',      cols: 3, keys: ['QUANTITY', 'LEAF COUNT', 'HAND OF OPENINGS', 'DOOR OPERATION', 'EXCLUDE REASON'] },
    { header: 'Dimensions',     cols: 3, keys: ['WIDTH', 'HEIGHT', 'THICKNESS'] },
    { header: 'Classification', cols: 2, keys: ['FIRE RATING'] },
];

export const DEFAULT_BASIC_INFO_SEC = (): RawSection =>
    Object.fromEntries(BASIC_INFO_GROUPS.flatMap(g => g.keys).map(k => [k, '']));

interface DoorBasicSectionProps {
    data: RawSection;
    onChange: (key: string, value: string) => void;
}

export function DoorBasicSection({ data, onChange }: DoorBasicSectionProps) {
    if (Object.keys(data).length === 0) {
        return (
            <div className="flex flex-col items-center gap-2 py-12 text-[var(--text-faint)] text-xs">
                <ClipboardList className="w-8 h-8 opacity-40" />
                No basic information data available. Upload a sectioned Excel schedule to populate fields.
            </div>
        );
    }
    return <SectionFields data={data} groups={BASIC_INFO_GROUPS} onChange={onChange} />;
}
