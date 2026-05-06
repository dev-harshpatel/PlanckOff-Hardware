import type { Door } from '@/types';
import { getDoorQuantity, getSectionValue } from './doorUtils';
import {
    SECTION_DEFS, CANONICAL_COLUMN_ORDER,
    type SectionKey, type DynamicColumnGroup, type GroupLevel, type DoorGroup, type AggregatedDoorRow,
} from '@/components/doorSchedule/doorScheduleTypes';

export function buildColId(sectionKey: SectionKey, colKey: string): string {
    return `${sectionKey}::${colKey}`;
}

export function parseColId(colId: string): { sectionKey: SectionKey; colKey: string } {
    const idx = colId.indexOf('::');
    return { sectionKey: colId.slice(0, idx) as SectionKey, colKey: colId.slice(idx + 2) };
}

export function isDoorIdentityColumn(colId: string): boolean {
    const { sectionKey, colKey } = parseColId(colId);
    return sectionKey === 'basic_information' && (colKey === 'DOOR TAG' || colKey === 'QUANTITY');
}

export function aggregateDoorsBySelectedColumns(doors: Door[], selectedColumns: string[]): AggregatedDoorRow[] {
    const comparisonColumns = selectedColumns.filter(col => !isDoorIdentityColumn(col));
    const groups = new Map<string, AggregatedDoorRow>();

    for (const door of doors) {
        const key = comparisonColumns.length > 0
            ? comparisonColumns.map(col => getSectionValue(door, col) || '').join('␟')
            : '__all__';

        const existing = groups.get(key);
        if (existing) {
            existing.doors.push(door);
            existing.quantity += getDoorQuantity(door);
            existing.doorTags = `${existing.doorTags}, ${door.doorTag}`;
        } else {
            groups.set(key, {
                id: `agg-${door.id}`,
                doors: [door],
                quantity: getDoorQuantity(door),
                doorTags: door.doorTag,
            });
        }
    }

    return Array.from(groups.values());
}

export function getRowValue(row: AggregatedDoorRow, colId: string): string {
    const { sectionKey, colKey } = parseColId(colId);
    if (sectionKey === 'basic_information' && colKey === 'DOOR TAG') return row.doorTags;
    if (sectionKey === 'basic_information' && colKey === 'QUANTITY') return String(row.quantity);
    return getSectionValue(row.doors[0], colId);
}

export function getGroupValue(door: Door, sectionKey: SectionKey, field: string): string {
    const sec = (door.sections as unknown as Record<string, Record<string, string | undefined>> | undefined)?.[sectionKey];
    if (!sec) return '(No Value)';
    // Exact match first, then case-insensitive fallback
    const exactVal = sec[field];
    if (exactVal !== undefined && exactVal.trim() !== '') return exactVal.trim();
    const lower = field.toLowerCase();
    const matchedKey = Object.keys(sec).find(k => k.toLowerCase() === lower);
    const val = matchedKey ? sec[matchedKey] : undefined;
    return val?.trim() || '(No Value)';
}

export function deriveColumnGroups(doors: Door[]): DynamicColumnGroup[] {
    return SECTION_DEFS.map(({ key, label }) => {
        // Collect every key that appears across all doors for this section.
        const allKeys = new Set<string>();
        for (const d of doors) {
            const sec = (d.sections as unknown as Record<string, Record<string, string | undefined>> | undefined)?.[key];
            if (sec) Object.keys(sec).forEach(k => allKeys.add(k));
        }

        const canonical = CANONICAL_COLUMN_ORDER[key] ?? [];

        // Always include all canonical columns so the picker is complete even when
        // the current dataset has no values for a given template column.
        canonical.forEach(k => allKeys.add(k));

        const canonicalIndex = new Map(canonical.map((k, i) => [k, i]));

        // Keys in the canonical list come first (in template order).
        // Keys not in the canonical list are appended in the order first seen in data.
        const sorted = Array.from(allKeys).sort((a, b) => {
            const ai = canonicalIndex.get(a) ?? Infinity;
            const bi = canonicalIndex.get(b) ?? Infinity;
            return ai - bi;
        });

        return { sectionKey: key, label, cols: sorted.map(k => ({ id: buildColId(key, k), label: k })) };
    });
}

export function groupDoorsByLevels(doors: Door[], levels: GroupLevel[]): DoorGroup[] {
    if (levels.length === 0) return [{ breadcrumb: [], doors }];
    function recurse(subset: Door[], remaining: GroupLevel[], crumb: string[]): DoorGroup[] {
        if (remaining.length === 0) return [{ breadcrumb: crumb, doors: subset }];
        const [cur, ...rest] = remaining;
        const { sectionKey, colKey } = parseColId(cur.colId);
        const buckets = new Map<string, Door[]>();
        for (const door of subset) {
            const val = getGroupValue(door, sectionKey, colKey);
            if (!buckets.has(val)) buckets.set(val, []);
            buckets.get(val)!.push(door);
        }
        return Array.from(buckets.entries()).flatMap(([val, sub]) => recurse(sub, rest, [...crumb, val]));
    }
    return recurse(doors, levels, []);
}

export function makeGroupId(): string {
    return `gl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
