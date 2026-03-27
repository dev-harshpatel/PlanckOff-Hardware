import { Door, DoorCoreType, DoorFaceType } from '../types';

/**
 * Phase 19: Door Data Migration Utilities
 * 
 * These utilities maintain backward compatibility between legacy single-field
 * specifications and new structured procurement-ready data.
 */

/**
 * Auto-populate legacy fields from new structured data
 * This ensures old reports/exports still work while new data is being added
 */
export function migrateDoorData(door: Door): Door {
    const updated = { ...door };

    // Auto-populate legacy doorMaterial from new structured fields
    if ((updated.doorCoreType || updated.doorFaceType) && !updated.doorMaterial) {
        const parts: string[] = [];
        
        if (updated.doorFaceGrade) parts.push(updated.doorFaceGrade);
        if (updated.doorFaceSpecies && updated.doorFaceSpecies !== 'Custom') {
            parts.push(updated.doorFaceSpecies);
        }
        if (updated.doorFaceType) parts.push(updated.doorFaceType);
        if (updated.doorCoreType) parts.push(`(${updated.doorCoreType})`);
        
        updated.doorMaterial = parts.join(' ') || 'Not Specified';
    }

    // Auto-populate legacy doorFinish from finishSystem
    if (updated.finishSystem && !updated.doorFinish) {
        const { finishType, colorName, manufacturer, productCode, sheen } = updated.finishSystem;
        
        const parts: string[] = [];
        if (finishType && finishType !== 'None') parts.push(finishType);
        if (sheen) parts.push(`(${sheen})`);
        if (colorName) parts.push(`- ${colorName}`);
        if (manufacturer) parts.push(`by ${manufacturer}`);
        if (productCode) parts.push(`[${productCode}]`);
        
        updated.doorFinish = parts.join(' ') || undefined;
    }

    return updated;
}

/**
 * Attempt to parse legacy doorMaterial string into structured data
 * This is best-effort for existing data migration
 */
export function parseLegacyDoorMaterial(material: string): Partial<Door> {
    const updates: Partial<Door> = {};
    const lower = material.toLowerCase();

    // Detect core type
    if (lower.includes('solid core') || lower.includes('solid-core')) {
        updates.doorCoreType = 'Solid Core';
    } else if (lower.includes('honeycomb')) {
        updates.doorCoreType = 'Honeycomb Core';
    } else if (lower.includes('particleboard') || lower.includes('particle board')) {
        updates.doorCoreType = 'Particleboard Core';
    } else if (lower.includes('stave')) {
        updates.doorCoreType = 'Stave Core';
    } else if (lower.includes('mineral')) {
        updates.doorCoreType = 'Mineral Core';
    } else if (lower.includes('polystyrene')) {
        updates.doorCoreType = 'Polystyrene Core';
    } else if (lower.includes('temperature rise')) {
        updates.doorCoreType = 'Temperature Rise Core';
    }

    // Detect face type
    if (lower.includes('wood') || lower.includes('veneer')) {
        updates.doorFaceType = 'Wood Veneer';
        
        // Try to detect species
        if (lower.includes('oak')) {
            updates.doorFaceSpecies = lower.includes('red') ? 'Red Oak' : 'White Oak';
        } else if (lower.includes('maple')) {
            updates.doorFaceSpecies = 'Maple';
        } else if (lower.includes('birch')) {
            updates.doorFaceSpecies = 'Birch';
        } else if (lower.includes('cherry')) {
            updates.doorFaceSpecies = 'Cherry';
        } else if (lower.includes('walnut')) {
            updates.doorFaceSpecies = 'Walnut';
        }
    } else if (lower.includes('metal') || lower.includes('steel')) {
        updates.doorFaceType = 'Metal';
        if (!updates.doorCoreType) {
            updates.doorCoreType = 'Honeycomb Core'; // Common for metal doors
        }
    } else if (lower.includes('laminate')) {
        updates.doorFaceType = 'Plastic Laminate';
    } else if (lower.includes('fiberglass')) {
        updates.doorFaceType = 'Fiberglass';
    } else if (lower.includes('glass')) {
        updates.doorFaceType = 'Glass';
    }

    // Detect grade
    if (lower.includes('premium')) {
        updates.doorFaceGrade = 'Premium';
    } else if (lower.includes('standard')) {
        updates.doorFaceGrade = 'Standard';
    } else if (lower.includes('economy')) {
        updates.doorFaceGrade = 'Economy';
    }

    return updates;
}

/**
 * Attempt to parse legacy doorFinish string into structured finish system
 */
export function parseLegacyDoorFinish(finish: string): Partial<Door> {
    const updates: Partial<Door> = {};
    const lower = finish.toLowerCase();

    const finishSystem: Partial<Door['finishSystem']> = {};

    // Detect finish type
    if (lower.includes('paint')) {
        finishSystem.finishType = 'Paint';
    } else if (lower.includes('stain')) {
        finishSystem.finishType = 'Stain';
    } else if (lower.includes('clear coat') || lower.includes('clearcoat')) {
        finishSystem.finishType = 'Clear Coat';
    } else if (lower.includes('powder coat')) {
        finishSystem.finishType = 'Powder Coat';
    } else if (lower.includes('anodized')) {
        finishSystem.finishType = 'Anodized';
    } else if (lower.includes('mill finish')) {
        finishSystem.finishType = 'Mill Finish';
    }

    // Detect base prep
    if (lower.includes('primed') || lower.includes('primer')) {
        finishSystem.basePrep = 'Factory Primed';
    } else if (lower.includes('unfinished')) {
        finishSystem.basePrep = 'Unfinished';
    } else if (lower.includes('pre-finished') || lower.includes('prefinished')) {
        finishSystem.basePrep = 'Pre-finished';
    }

    // Detect sheen
    if (lower.includes('flat')) {
        finishSystem.sheen = 'Flat';
    } else if (lower.includes('eggshell')) {
        finishSystem.sheen = 'Eggshell';
    } else if (lower.includes('satin')) {
        finishSystem.sheen = 'Satin';
    } else if (lower.includes('semi-gloss') || lower.includes('semigloss')) {
        finishSystem.sheen = 'Semi-Gloss';
    } else if (lower.includes('gloss')) {
        finishSystem.sheen = 'Gloss';
    }

    // Try to extract manufacturer (common brands)
    const manufacturers = [
        'Sherwin Williams', 'Benjamin Moore', 'PPG', 'Behr', 
        'Valspar', 'Dunn-Edwards', 'Pratt & Lambert'
    ];
    
    for (const mfr of manufacturers) {
        if (lower.includes(mfr.toLowerCase())) {
            finishSystem.manufacturer = mfr;
            break;
        }
    }

    // Try to extract product code (pattern: letters + numbers)
    const codeMatch = finish.match(/\b([A-Z]{2,3}\s?\d{3,5})\b/i);
    if (codeMatch) {
        finishSystem.productCode = codeMatch[1];
    }

    if (Object.keys(finishSystem).length > 0) {
        updates.finishSystem = finishSystem as Door['finishSystem'];
    }

    return updates;
}

/**
 * Suggest structured data upgrades for a door with legacy fields
 * Returns suggested values and confidence level
 */
export function suggestDataUpgrade(door: Door): {
    suggestions: Partial<Door>;
    confidence: 'high' | 'medium' | 'low';
    message: string;
} {
    const suggestions: Partial<Door> = {};
    let confidence: 'high' | 'medium' | 'low' = 'low';
    let message = '';

    // Check if door has legacy data but no structured data
    const hasLegacyMaterial = door.doorMaterial && !door.doorCoreType && !door.doorFaceType;
    const hasLegacyFinish = door.doorFinish && !door.finishSystem;

    if (hasLegacyMaterial) {
        const materialSuggestions = parseLegacyDoorMaterial(door.doorMaterial);
        Object.assign(suggestions, materialSuggestions);
        
        if (materialSuggestions.doorCoreType && materialSuggestions.doorFaceType) {
            confidence = 'high';
            message = 'We detected detailed material information. Click to upgrade to structured format.';
        } else if (materialSuggestions.doorCoreType || materialSuggestions.doorFaceType) {
            confidence = 'medium';
            message = 'We detected partial material information. Review and complete the upgrade.';
        } else {
            confidence = 'low';
            message = 'Could not parse material data. Please manually specify core and face types.';
        }
    }

    if (hasLegacyFinish) {
        const finishSuggestions = parseLegacyDoorFinish(door.doorFinish);
        Object.assign(suggestions, finishSuggestions);
    }

    return { suggestions, confidence, message };
}

/**
 * Bulk migrate all doors in a project
 */
export function bulkMigrateDoors(doors: Door[]): Door[] {
    return doors.map(door => migrateDoorData(door));
}
