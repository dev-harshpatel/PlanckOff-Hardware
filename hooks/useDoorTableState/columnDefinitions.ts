export interface ColumnDef {
    key: string;
    label: string;
    width: string;
    type: 'text' | 'number' | 'select';
    options?: string[];
    align?: 'left' | 'center' | 'right';
    isCore?: boolean;
}

export interface CustomColumn {
    id: string;
    label: string;
    type: 'text' | 'number';
}

export interface PersistedColumnPrefs {
    visibleColumns: string[];
    columnOrder: string[];
    customColumns: CustomColumn[];
}

export type StatusFilter = 'all' | 'pending' | 'complete';

export const formatDimension = (inches: number): string => {
    if (!inches) return "0'-0\"";
    const feet = Math.floor(inches / 12);
    const remainingInches = inches % 12;
    return `${feet}'-${remainingInches}"`;
};

export const ALL_AVAILABLE_COLUMNS: ColumnDef[] = [
    { key: 'doorTag',               label: 'Door Tag',                width: 'min-w-[90px]',  type: 'text',   isCore: true },
    { key: 'buildingTag',           label: 'Building Tag',            width: 'min-w-[100px]', type: 'text' },
    { key: 'buildingLocation',      label: 'Building Location',       width: 'min-w-[130px]', type: 'text' },
    { key: 'location',              label: 'Door Location',           width: 'min-w-[120px]', type: 'text',   isCore: true },
    { key: 'quantity',              label: 'Quantity',                width: 'w-20',          type: 'number', align: 'center', isCore: true },
    { key: 'handing',               label: 'Hand of Openings',        width: 'min-w-[120px]', type: 'text' },
    { key: 'operation',             label: 'Door Operation',          width: 'min-w-[120px]', type: 'text' },
    { key: 'leafCount',             label: 'Leaf Count',              width: 'w-20',          type: 'text', align: 'center' },
    { key: 'interiorExterior',      label: 'Interior/Exterior',       width: 'min-w-[120px]', type: 'text' },
    { key: 'excludeReason',         label: 'Exclude Reason',          width: 'min-w-[130px]', type: 'text' },
    { key: 'width',                 label: 'Width',                   width: 'w-20',          type: 'number', align: 'center', isCore: true },
    { key: 'height',                label: 'Height',                  width: 'w-20',          type: 'number', align: 'center', isCore: true },
    { key: 'thickness',             label: 'Thickness',               width: 'w-20',          type: 'number', align: 'center', isCore: true },
    { key: 'fireRating',            label: 'Fire Rating',             width: 'min-w-[100px]', type: 'text',   isCore: true },
    { key: 'doorMaterial',          label: 'Door Material',           width: 'min-w-[120px]', type: 'text',   isCore: true },
    { key: 'elevationTypeId',       label: 'Door Elevation Type',     width: 'min-w-[140px]', type: 'text' },
    { key: 'doorCore',              label: 'Door Core',               width: 'min-w-[100px]', type: 'text' },
    { key: 'doorFace',              label: 'Door Face',               width: 'min-w-[100px]', type: 'text' },
    { key: 'doorEdge',              label: 'Door Edge',               width: 'min-w-[100px]', type: 'text' },
    { key: 'doorGauge',             label: 'Door Guage',              width: 'min-w-[100px]', type: 'text' },
    { key: 'doorFinish',            label: 'Door Finish',             width: 'min-w-[100px]', type: 'text' },
    { key: 'stcRating',             label: 'STC Rating',              width: 'min-w-[90px]',  type: 'text' },
    { key: 'undercut',              label: 'Door Undercut',           width: 'min-w-[100px]', type: 'text' },
    { key: 'doorIncludeExclude',    label: 'Door Include/Exclude',    width: 'min-w-[140px]', type: 'text' },
    { key: 'frameMaterial',         label: 'Frame Material',          width: 'min-w-[120px]', type: 'text',   isCore: true },
    { key: 'wallType',              label: 'Wall Type',               width: 'min-w-[100px]', type: 'text' },
    { key: 'throatThickness',       label: 'Throat Thickness',        width: 'min-w-[120px]', type: 'text' },
    { key: 'frameAnchor',           label: 'Frame Anchor',            width: 'min-w-[110px]', type: 'text' },
    { key: 'baseAnchor',            label: 'Base Anchor',             width: 'min-w-[100px]', type: 'text' },
    { key: 'numberOfAnchors',       label: 'No of Anchor',            width: 'min-w-[100px]', type: 'text' },
    { key: 'frameProfile',          label: 'Frame Profile',           width: 'min-w-[110px]', type: 'text' },
    { key: 'frameElevationType',    label: 'Frame Elevation Type',    width: 'min-w-[150px]', type: 'text' },
    { key: 'frameAssembly',         label: 'Frame Assembly',          width: 'min-w-[120px]', type: 'text' },
    { key: 'frameGauge',            label: 'Frame Guage',             width: 'min-w-[100px]', type: 'text' },
    { key: 'frameFinish',           label: 'Frame Finish',            width: 'min-w-[100px]', type: 'text' },
    { key: 'prehung',               label: 'Prehung',                 width: 'min-w-[90px]',  type: 'text' },
    { key: 'frameHead',             label: 'Frame Head',              width: 'min-w-[100px]', type: 'text' },
    { key: 'casing',                label: 'Casing',                  width: 'min-w-[90px]',  type: 'text' },
    { key: 'frameIncludeExclude',   label: 'Frame Include/Exclude',   width: 'min-w-[150px]', type: 'text' },
    { key: 'providedHardwareSet',   label: 'Hardware Set',            width: 'min-w-[110px]', type: 'text',   isCore: true },
    { key: 'hardwareIncludeExclude',label: 'Hardware Include/Exclude',width: 'min-w-[160px]', type: 'text' },
];

export const DOOR_SECTION_KEYS = new Set([
    'doorMaterial', 'elevationTypeId', 'doorCore', 'doorFace', 'doorEdge',
    'doorGauge', 'doorFinish', 'stcRating', 'undercut', 'doorIncludeExclude',
]);
export const FRAME_SECTION_KEYS = new Set([
    'frameMaterial', 'wallType', 'throatThickness', 'frameAnchor', 'baseAnchor',
    'numberOfAnchors', 'frameProfile', 'frameElevationType', 'frameAssembly',
    'frameGauge', 'frameFinish', 'prehung', 'frameHead', 'casing', 'frameIncludeExclude',
]);
export const HARDWARE_SECTION_KEYS = new Set([
    'providedHardwareSet', 'hardwareIncludeExclude',
]);
