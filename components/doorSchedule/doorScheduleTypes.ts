import type { Door } from '@/types';

export type SectionKey = 'basic_information' | 'door' | 'frame' | 'hardware';
export type ExportFormat = 'excel' | 'pdf';

export interface DynamicColumnGroup {
    sectionKey: SectionKey;
    label: string;
    cols: { id: string; label: string }[];
}

export interface GroupLevel {
    id: string;
    colId: string;  // sectionKey::colKey — derived from actual data, not hardcoded
    label: string;
}

export interface DoorGroup {
    breadcrumb: string[];
    doors: Door[];
}

export interface AggregatedDoorRow {
    id: string;
    doors: Door[];
    quantity: number;
    doorTags: string;
}

// ─── Static config ────────────────────────────────────────────────────────────

export const SECTION_DEFS: { key: SectionKey; label: string }[] = [
    { key: 'basic_information', label: 'Basic Information' },
    { key: 'door',              label: 'Doors'             },
    { key: 'frame',             label: 'Frame'             },
    { key: 'hardware',          label: 'Hardware'          },
];

// Grouping fields — colId matches exact keys verified from parsed JSON
export const GROUPING_FIELDS: { colId: string; label: string; section: string }[] = [
    { colId: 'basic_information::BUILDING TAG',       label: 'Building Tag',         section: 'Basic Information' },
    { colId: 'basic_information::BUILDING LOCATION',  label: 'Building Location',    section: 'Basic Information' },
    { colId: 'basic_information::DOOR OPERATION',     label: 'Door Operation',       section: 'Basic Information' },
    { colId: 'basic_information::FIRE RATING',        label: 'Fire Rating',          section: 'Basic Information' },
    { colId: 'door::DOOR MATERIAL',                   label: 'Door Material',        section: 'Doors'             },
    { colId: 'door::DOOR ELEVATION TYPE',             label: 'Door Elevation Type',  section: 'Doors'             },
    { colId: 'door::DOOR CORE',                       label: 'Door Core',            section: 'Doors'             },
    { colId: 'frame::FRAME MATERIAL',                 label: 'Frame Material',       section: 'Frame'             },
    { colId: 'frame::FRAME ELEVATION TYPE',           label: 'Frame Elevation Type', section: 'Frame'             },
    { colId: 'frame::FRAME ASSEMBLY',                 label: 'Frame Assembly',       section: 'Frame'             },
    { colId: 'frame::PREHUNG',                        label: 'Prehung',              section: 'Frame'             },
];

// Grouped by section for the picker modal
export const GROUPING_SECTIONS = Array.from(
    GROUPING_FIELDS.reduce((map, gf) => {
        if (!map.has(gf.section)) map.set(gf.section, []);
        map.get(gf.section)!.push(gf);
        return map;
    }, new Map<string, typeof GROUPING_FIELDS>()),
);

// ─── Canonical column order per section ──────────────────────────────────────
// Matches the left-to-right header sequence of the Excel template.
// Keys not in this list are appended at the end in the order they appear in the data.

export const CANONICAL_COLUMN_ORDER: Partial<Record<SectionKey, string[]>> = {
    basic_information: [
        'DOOR TAG', 'BUILDING TAG', 'BUILDING LOCATION', 'DOOR LOCATION',
        'QUANTITY', 'HAND OF OPENINGS', 'DOOR OPERATION', 'LEAF COUNT',
        'INTERIOR/EXTERIOR', 'EXCLUDE REASON', 'WIDTH', 'HEIGHT', 'THICKNESS', 'FIRE RATING',
        'BUILDING AREA',
    ],
    door: [
        'DOOR MATERIAL', 'DOOR ELEVATION TYPE', 'DOOR CORE', 'DOOR FACE',
        'DOOR EDGE', 'DOOR GUAGE', 'DOOR FINISH', 'STC RATING',
        'DOOR UNDERCUT', 'GLAZING TYPE', 'DOOR INCLUDE/EXCLUDE',
    ],
    frame: [
        'FRAME MATERIAL', 'WALL TYPE', 'THROAT THICKNESS',
        'FRAME ANCHOR', 'BASE ANCHOR', 'NO OF ANCHOR',
        'FRAME PROFILE', 'FRAME ELEVATION TYPE', 'FRAME ASSEMBLY', 'FRAME GUAGE',
        'FRAME FINISH', 'PREHUNG', 'FRAME HEAD', 'CASING', 'FRAME INCLUDE/EXCLUDE',
    ],
    hardware: [
        'HARDWARE SET', 'HARDWARE PREP',
        'HARDWARE INCLUDE/EXCLUDE',
    ],
};

// Columns that should never appear in the picker, even if present in door data.
// 'HW SET' is an alias for 'HARDWARE SET' (same data, shown once).
// 'HARDWARE ON DOOR' has been removed from the report.
export const EXCLUDED_SECTION_COLUMNS: Partial<Record<SectionKey, ReadonlySet<string>>> = {
    hardware: new Set(['HW SET', 'HARDWARE ON DOOR']),
};
