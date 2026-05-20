import type { Door, HardwareSet } from '@/types';
import type { MergedHardwareSet, MergedDoor } from '@/lib/db/hardware';
import { resolveDescriptionPlaceholders, resolveDimension } from './dimensionRules';

function hasPlaceholderTokens(description: string): boolean {
  return /x\s*(req\.?\s*)?(width|height|length|2-height)/i.test(description);
}

function shouldResolve(
  description: string,
  itemName: string,
  door: Door,
  isPair: boolean,
): boolean {
  if (hasPlaceholderTokens(description)) return true;
  // Also resolve items that have a dimension rule even without tokens
  return resolveDimension(itemName, door, isPair) !== null;
}

/**
 * Resolve processedDescription for all items in a set using the first assigned door.
 * Returns a new HardwareSet — no mutation.
 * If assignedDoors is empty, returns the set unchanged.
 */
export function resolveSetDescriptions(
  set: HardwareSet,
  assignedDoors: Door[],
): HardwareSet {
  if (assignedDoors.length === 0) return set;

  const door = assignedDoors[0];
  const isPair =
    (door.leafCount != null && door.leafCount > 1) ||
    (door.leafCountDisplay?.toLowerCase().includes('double') ?? false) ||
    (door.leafCountDisplay?.toLowerCase().includes('pair') ?? false);

  const resolvedItems = set.items.map((item) => {
    if (!shouldResolve(item.description, item.name, door, isPair)) {
      return item;
    }

    const resolved = resolveDescriptionPlaceholders(
      item.description,
      item.name,
      door,
      isPair,
    );

    // Only store if the resolved string actually differs from the raw description
    if (resolved === item.description) return item;

    return { ...item, processedDescription: resolved };
  });

  return { ...set, items: resolvedItems };
}

/**
 * Run resolveSetDescriptions over every set in the array.
 * Uses the Door array to find each set's assigned doors.
 */
export function resolveAllSets(
  sets: HardwareSet[],
  doors: Door[],
): HardwareSet[] {
  return sets.map((set) => {
    const assignedDoors = doors.filter(
      (d) => d.assignedHardwareSet?.id === set.id,
    );
    return resolveSetDescriptions(set, assignedDoors);
  });
}

// ---------------------------------------------------------------------------
// Server-side resolver — works with MergedHardwareSet / MergedDoor
// ---------------------------------------------------------------------------

/**
 * Parse a dimension string like "3'-6\"", "42\"", "1016mm", or "2*3'-6\""
 * into raw inches. Returns 0 if unparseable.
 */
function parseDimensionStr(val: string | undefined): number {
  if (!val) return 0;
  // Strip leading multiplier like "2*" or "(2) "
  const clean = val.replace(/^\(\d+\)\s*/, '').replace(/^\d+\s*\*\s*/, '').trim();

  // Feet-inches: 3'-6" or 3'6"
  const ftIn = clean.match(/^(\d+)[''′]\s*-?\s*(\d+(?:\.\d+)?)[""″]?/);
  if (ftIn) return parseInt(ftIn[1], 10) * 12 + parseFloat(ftIn[2]);

  // Plain inches: 42" or 42
  const inOnly = clean.match(/^(\d+(?:\.\d+)?)[""″]?\s*$/);
  if (inOnly) {
    const n = parseFloat(inOnly[1]);
    // Heuristic: values over ~10 that look like mm (>500) convert from mm
    if (n > 500) return Math.round(n / 25.4);
    return Math.round(n);
  }

  // mm explicit: 1016mm
  const mm = clean.match(/^(\d+(?:\.\d+)?)\s*mm/i);
  if (mm) return Math.round(parseFloat(mm[1]) / 25.4);

  return 0;
}

function getDimensionsFromMergedDoor(door: MergedDoor): {
  width: number;
  height: number;
  isPair: boolean;
} {
  const bi = door.sections?.basic_information ?? {};
  const ds = door.sections?.door ?? {};

  const rawWidth =
    bi['WIDTH'] ?? bi['DOOR WIDTH'] ?? ds['WIDTH'] ?? ds['DOOR WIDTH'] ?? door.doorWidth;
  const rawHeight =
    bi['HEIGHT'] ?? bi['DOOR HEIGHT'] ?? ds['HEIGHT'] ?? ds['DOOR HEIGHT'] ?? door.doorHeight;
  const rawLeaf =
    bi['LEAF COUNT'] ?? ds['LEAF COUNT'] ?? door.leafCount;

  const leafStr = String(rawLeaf ?? '').toLowerCase().trim();
  const isPair =
    leafStr === 'double' ||
    leafStr === 'pair' ||
    leafStr.includes('double') ||
    leafStr.includes('pair') ||
    parseInt(leafStr, 10) > 1;

  return {
    width: parseDimensionStr(rawWidth),
    height: parseDimensionStr(rawHeight),
    isPair,
  };
}

/**
 * Resolve processedDescription for all items in every MergedHardwareSet.
 * Uses the first assigned door's dimensions. Sets with no doors are unchanged.
 * Pure function — no mutation.
 */
export function resolveAllMergedSets(
  sets: MergedHardwareSet[],
): MergedHardwareSet[] {
  return sets.map((set) => {
    if (set.doors.length === 0) return set;

    const { width, height, isPair } = getDimensionsFromMergedDoor(set.doors[0]);
    if (!width || !height) return set;

    // Cast to the shape resolveDescriptionPlaceholders / resolveDimension need
    const fakeDoor = { width, height } as unknown as Door;

    const resolvedItems = set.hardwareItems.map((item) => {
      const description = item.description ?? '';
      const hasTokens = /x\s*(req\.?\s*)?(width|height|length|2-height)/i.test(description);
      if (!hasTokens && resolveDimension(item.item, fakeDoor, isPair) === null) return item;

      const resolved = resolveDescriptionPlaceholders(description, item.item, fakeDoor, isPair);
      if (resolved === description) return item;

      return { ...item, processedDescription: resolved };
    });

    return { ...set, hardwareItems: resolvedItems };
  });
}
