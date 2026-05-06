import type { HardwareSet, Door } from '@/types';

export const formatDimension = (inches: number): string => {
    if (!inches) return "0'-0\"";
    const feet = Math.floor(inches / 12);
    const remainingInches = inches % 12;
    return `${feet}'-${remainingInches}"`;
};

export const getDoorConflicts = (
    set: HardwareSet,
    door: Door,
): Partial<Record<'fireRating' | 'dimensions' | 'doorMaterial', string>> => {
    const conflicts: Partial<Record<'fireRating' | 'dimensions' | 'doorMaterial', string>> = {};
    const setDesc = set.description.toLowerCase();
    const setItemsText = set.items.map(i => (i.name + i.description).toLowerCase()).join(' ');
    const isSetFireRated = setDesc.includes('fire') || setDesc.includes('rated') || setItemsText.includes('fire') || setItemsText.includes('rated') || setItemsText.includes('label');
    const doorRating = door.fireRating ? door.fireRating.toLowerCase().trim() : 'n/a';
    const isDoorRated = doorRating !== 'n/a' && doorRating !== '' && doorRating !== 'non-rated';
    if (isDoorRated && !isSetFireRated) conflicts.fireRating = `CRITICAL: Door is rated (${door.fireRating}), but hardware set is NOT fire-rated.`;
    if (!isDoorRated && isSetFireRated) conflicts.fireRating = `WARNING: Non-rated door assigned to fire-rated set (Over-spec).`;
    const hingeItems = set.items.filter(item => {
        const name = item.name.toLowerCase(); const desc = item.description.toLowerCase();
        return (name.includes('hinge') || desc.includes('hinge') || name.includes('butt') || desc.includes('butt')) && !name.includes('continuous') && !desc.includes('continuous');
    });
    if (hingeItems.length > 0) {
        const totalHinges = hingeItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
        if (door.height > 90 && totalHinges < 4) conflicts.dimensions = `CRITICAL: Door height ${formatDimension(door.height)} (> 90") usually requires 4 hinges, set has ${totalHinges}.`;
    }
    const doorMat = (door.doorMaterial || '').toLowerCase();
    if (setDesc.includes('wood door') && (doorMat.includes('hollow') || doorMat.includes('metal') || doorMat.includes('alum') || doorMat.includes('steel'))) conflicts.doorMaterial = `CONFLICT: Set specified for 'Wood Door', applied to '${door.doorMaterial}'.`;
    if ((setDesc.includes('aluminum door') || setDesc.includes('metal door') || setDesc.includes('steel door')) && doorMat.includes('wood')) conflicts.doorMaterial = `CONFLICT: Set specified for Metal/Aluminum, applied to '${door.doorMaterial}'.`;
    return conflicts;
};
