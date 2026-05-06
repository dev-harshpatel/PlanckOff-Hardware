import React from 'react';
import { DoorOpen } from 'lucide-react';
import { SectionFields, type RawSection } from './DoorFormSection';

export const DOOR_GROUPS: { header: string; cols: number; keys: string[] }[] = [
    { header: 'Material & Finish', cols: 2, keys: ['DOOR MATERIAL', 'DOOR ELEVATION TYPE', 'DOOR CORE', 'DOOR FACE', 'DOOR EDGE', 'DOOR GUAGE', 'DOOR FINISH', 'STC RATING', 'DOOR UNDERCUT', 'DOOR INCLUDE/EXCLUDE'] },
];

export const DEFAULT_DOOR_SEC = (): RawSection =>
    Object.fromEntries(DOOR_GROUPS.flatMap(g => g.keys).map(k => [k, '']));

interface DoorDimensionSectionProps {
    data: RawSection;
    onChange: (key: string, value: string) => void;
    isExcluded: boolean;
}

export function DoorDimensionSection({ data, onChange, isExcluded }: DoorDimensionSectionProps) {
    if (Object.keys(data).length === 0) {
        return (
            <div className="flex flex-col items-center gap-2 py-12 text-[var(--text-faint)] text-xs">
                <DoorOpen className="w-8 h-8 opacity-40" />
                No door section data available. Upload a sectioned Excel schedule to populate fields.
            </div>
        );
    }
    return (
        <SectionFields
            data={data}
            groups={DOOR_GROUPS}
            onChange={onChange}
            includeExcludeKey="DOOR INCLUDE/EXCLUDE"
            isExcluded={isExcluded}
            excludedLabel="door"
        />
    );
}
