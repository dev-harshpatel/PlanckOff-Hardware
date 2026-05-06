import { Door } from '@/types';

export function parseLeafCount(value?: string): number | undefined {
    if (!value) return undefined;
    const raw = value.trim();
    if (!raw) return undefined;

    const numeric = parseInt(raw, 10);
    if (!isNaN(numeric)) return numeric;

    const normalized = raw.toLowerCase();
    if (['single', 'singles', 'single leaf', '1 leaf'].includes(normalized)) return 1;
    if (['double', 'pair', 'double leaf', '2 leaf', '2 leaves'].includes(normalized)) return 2;

    return undefined;
}

export function parseDoorQuantity(value?: string | number): number {
    if (typeof value === 'number') return Number.isNaN(value) ? 1 : value;
    if (!value) return 1;

    const parsed = parseFloat(String(value).trim());
    return Number.isNaN(parsed) ? 1 : parsed;
}

export function getDoorQuantity(door: Door): number {
    const raw = (door.sections as unknown as Record<string, Record<string, string | undefined>> | undefined)
        ?.basic_information?.['QUANTITY'];
    const q = parseInt(raw ?? '', 10);
    return isNaN(q) || q < 1 ? 1 : q;
}

export function sumDoorQuantities(doors: Door[]): number {
    return doors.reduce((sum, d) => sum + getDoorQuantity(d), 0);
}

export function getSectionValue(door: Door, colId: string): string {
    const idx = colId.indexOf('::');
    if (idx === -1) return '';
    const sectionKey = colId.slice(0, idx);
    const colKey = colId.slice(idx + 2);

    if (sectionKey === 'basic_information' && colKey === 'DOOR TAG') return door.doorTag;

    const sec = (door.sections as unknown as Record<string, Record<string, string | undefined>> | undefined)?.[sectionKey];
    const secVal = sec?.[colKey];
    if (secVal !== undefined && secVal !== '') return secVal;

    if (sectionKey === 'hardware' && colKey === 'HARDWARE PREP') return door.hardwarePrep ?? '';
    if (sectionKey === 'hardware' && colKey === 'HW SET') return door.providedHardwareSet ?? sec?.['HARDWARE SET'] ?? '';

    return secVal ?? '';
}
