import type { Door, HardwareSet } from '@/types';
import type { MergedHardwareSet, MergedDoor } from '@/lib/db/hardware';

function isMergedDoorExcluded(door: MergedDoor): boolean {
  const hw = door.sections?.hardware?.['HARDWARE INCLUDE/EXCLUDE']?.toUpperCase();
  const d = door.sections?.door?.['DOOR INCLUDE/EXCLUDE']?.toUpperCase();
  const fr = door.sections?.frame?.['FRAME INCLUDE/EXCLUDE']?.toUpperCase();
  return hw === 'EXCLUDE' || d === 'EXCLUDE' || fr === 'EXCLUDE';
}

function isDoorExcluded(door: Door): boolean {
  return (
    door.hardwareIncludeExclude?.toUpperCase() === 'EXCLUDE' ||
    door.doorIncludeExclude?.toUpperCase() === 'EXCLUDE' ||
    door.frameIncludeExclude?.toUpperCase() === 'EXCLUDE'
  );
}

/** Remove excluded doors from MergedHardwareSet[] and drop sets that end up with 0 doors. */
export function filterExcludedFromFinalJson(finalJson: MergedHardwareSet[]): MergedHardwareSet[] {
  return finalJson
    .map(set => ({ ...set, doors: set.doors.filter(d => !isMergedDoorExcluded(d)) }))
    .filter(set => set.doors.length > 0);
}

/** Remove excluded doors from a Door[]. */
export function filterExcludedDoors(doors: Door[]): Door[] {
  return doors.filter(d => !isDoorExcluded(d));
}

/** Keep only hardware sets that have at least one non-excluded door assigned. */
export function filterSetsWithNoDoors(sets: HardwareSet[], doors: Door[]): HardwareSet[] {
  const activeSets = new Set(
    doors.map(d => d.assignedHardwareSet?.id).filter((id): id is string => Boolean(id)),
  );
  return sets.filter(s => activeSets.has(s.id));
}
