import type { Door, HardwareSet } from '../types';

function getDoorProfileKey(door: Door): string {
    const w = door.widthDisplay ?? (door.width ? `${door.width}"` : '');
    const h = door.heightDisplay ?? (door.height ? `${door.height}"` : '');
    const leafCount = door.leafCountDisplay ?? (door.leafCount != null ? String(door.leafCount) : '');
    const rating = (door.fireRating ?? '').trim();
    const material = (door.doorMaterial ?? '').trim();
    const operation = (door.operation ?? '').trim();
    const frameMaterial = ((door.frameMaterial as string) ?? '').trim();
    const intExt = (door.interiorExterior ?? '').trim();
    return [w, h, leafCount, rating, material, operation, frameMaterial, intExt].join('|||');
}

/**
 * After a pipeline run, detect doors assigned to the same hardware set that
 * have differing profiles across: W×H, Leaf Count, Fire Rating, Door Material,
 * Door Operation, Frame Material, Int/Ext.
 *
 * For each set with multiple distinct door profiles, the largest group keeps
 * the original set and each remaining group gets a new auto-variant
 * (named "{setName}.v1", ".v2", etc.) inserted immediately after the source.
 *
 * Only base sets (no parentSetId) are processed; existing variants are left alone.
 */
export function autoCreateVariants(
    sets: HardwareSet[],
    doors: Door[],
): { sets: HardwareSet[]; doors: Door[] } {
    const baseSets = sets.filter(s => !s.parentSetId);

    let updatedSets = [...sets];
    let updatedDoors = [...doors];
    let seq = 0;

    for (const set of baseSets) {
        const assignedDoors = updatedDoors.filter(d => d.assignedHardwareSet?.id === set.id);
        if (assignedDoors.length <= 1) continue;

        const groups = new Map<string, Door[]>();
        for (const door of assignedDoors) {
            const key = getDoorProfileKey(door);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(door);
        }

        if (groups.size <= 1) continue;

        // Largest group stays on the original set; remaining groups get variants
        const sortedGroups = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
        const [, ...variantGroups] = sortedGroups;

        let variantIdx = 1;
        for (const [, variantDoors] of variantGroups) {
            seq++;
            const variantId = `hs-autovariant-${Date.now()}-${seq}`;
            const variantName = variantIdx === 1 ? `${set.name}.W` : `${set.name}.W${variantIdx}`;

            const newVariant: HardwareSet = {
                ...set,
                id: variantId,
                name: variantName,
                parentSetId: set.id,
                isManualEntry: false,
                items: set.items.map((item, i) => ({
                    ...item,
                    id: `${variantId}-item-${i}`,
                })),
            };

            // Insert after the last child of this set, or directly after the set itself
            const insertAfter = updatedSets.reduce(
                (last, s, i) => (s.id === set.id || s.parentSetId === set.id ? i : last),
                -1,
            );
            if (insertAfter >= 0) {
                updatedSets.splice(insertAfter + 1, 0, newVariant);
            } else {
                updatedSets.push(newVariant);
            }

            const variantDoorIds = new Set(variantDoors.map(d => d.id));
            updatedDoors = updatedDoors.map(door =>
                variantDoorIds.has(door.id)
                    ? {
                          ...door,
                          assignedHardwareSet: newVariant,
                          providedHardwareSet: newVariant.name,
                          status: 'complete' as const,
                      }
                    : door,
            );

            variantIdx++;
        }
    }

    return { sets: updatedSets, doors: updatedDoors };
}
