import { Door, ElevationType } from '@/types';

export function resolveElevationTypes(door: Door, types: ElevationType[]): ElevationType[] {
    const result: ElevationType[] = [];
    const seen = new Set<string>();
    const tryAdd = (code: string | undefined) => {
        if (!code?.trim()) return;
        const c = code.trim();
        const et = types.find(t => t.id === c || t.code === c || t.name === c);
        if (et && !seen.has(et.id)) { seen.add(et.id); result.push(et); }
    };
    tryAdd(door.elevationTypeId);
    const sec = door.sections as unknown as Record<string, Record<string, string | undefined>> | undefined;
    tryAdd(sec?.door?.['DOOR ELEVATION TYPE']);
    tryAdd(sec?.frame?.['FRAME ELEVATION TYPE']);
    return result;
}

export function collectGroupElevationTypes(doors: Door[], types: ElevationType[]): ElevationType[] {
    const seen = new Set<string>();
    const result: ElevationType[] = [];
    for (const door of doors) {
        for (const et of resolveElevationTypes(door, types)) {
            if (!seen.has(et.id)) { seen.add(et.id); result.push(et); }
        }
    }
    return result;
}

export function getElevationById(id: string, types: ElevationType[]): ElevationType | undefined {
    return types.find(t => t.id === id);
}
