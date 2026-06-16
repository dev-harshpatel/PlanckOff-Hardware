import type { Door, HardwareSet } from '@/types';
import type { MergedHardwareSet, MergedDoor } from '@/lib/db/hardware';

function isMergedDoorHardwareExcluded(door: MergedDoor): boolean {
  const hw = door.sections?.hardware?.['HARDWARE INCLUDE/EXCLUDE']?.trim().toUpperCase();
  return hw?.startsWith('EXCLUD') ?? false;
}

/** Remove doors from MergedHardwareSet[] where hardware is excluded, drop sets with 0 remaining doors. */
export function filterExcludedFromFinalJson(finalJson: MergedHardwareSet[]): MergedHardwareSet[] {
  return finalJson
    .map(set => ({ ...set, doors: set.doors.filter(d => !isMergedDoorHardwareExcluded(d)) }))
    .filter(set => set.doors.length > 0);
}

/**
 * Remove doors where the DOOR component is excluded.
 * Use for: door-schedule report — only the door leaf itself is out of scope.
 */
export function filterExcludedDoors(doors: Door[]): Door[] {
  return doors.filter(d => d.doorIncludeExclude?.toUpperCase() !== 'EXCLUDE');
}

/**
 * Remove doors where the HARDWARE component is excluded.
 * Use for: hardware-set report, submittal package, pricing set membership.
 */
export function filterHardwareExcludedDoors(doors: Door[]): Door[] {
  return doors.filter(d => d.hardwareIncludeExclude?.toUpperCase() !== 'EXCLUDE');
}

/** Keep only hardware sets that have at least one hardware-included door assigned. */
export function filterSetsWithNoDoors(sets: HardwareSet[], doors: Door[]): HardwareSet[] {
  const activeSets = new Set(
    doors.map(d => d.assignedHardwareSet?.id).filter((id): id is string => Boolean(id)),
  );
  return sets.filter(s => activeSets.has(s.id));
}
