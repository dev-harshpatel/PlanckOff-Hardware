import { Door, HardwarePrepSpec, ElectrificationSpec, HingeSpec } from '../types';

/**
 * Phase 21: Hardware Data Migration Utilities
 * Auto-populate legacy fields from structured hardware specifications
 */

/**
 * Generate legacy hardwarePrep string from structured HardwarePrepSpec
 */
export function generateHardwarePrepString(spec?: HardwarePrepSpec): string {
    if (!spec || spec.prepType === 'None') {
        return 'Not Specified';
    }

    const parts: string[] = [spec.prepType];
    
    if (spec.backset) {
        parts.push(`${spec.backset} BS`);
    }
    
    if (spec.strikeType) {
        parts.push(spec.strikeType);
    }
    
    if (spec.closerPrep && spec.closerType) {
        let closerDesc = `${spec.closerType} Closer`;
        if (spec.closerArmType) {
            closerDesc += ` (${spec.closerArmType})`;
        }
        parts.push(closerDesc);
    }
    
    return parts.join(', ');
}

/**
 * Parse legacy hardwarePrep string into structured HardwarePrepSpec
 * This is a best-effort parser for existing data
 */
export function parseLegacyHardwarePrep(hardwarePrep: string): HardwarePrepSpec | undefined {
    if (!hardwarePrep || hardwarePrep.trim() === '' || hardwarePrep === 'Not Specified') {
        return undefined;
    }

    const lower = hardwarePrep.toLowerCase();
    
    // Determine prep type
    let prepType: HardwarePrepSpec['prepType'] = 'None';
    if (lower.includes('mortise')) prepType = 'Mortise';
    else if (lower.includes('cylindrical')) prepType = 'Cylindrical';
    else if (lower.includes('exit') || lower.includes('panic')) prepType = 'Exit Device';
    else if (lower.includes('multipoint')) prepType = 'Multipoint';
    else if (lower.includes('electrified') || lower.includes('electric')) prepType = 'Electrified';
    
    if (prepType === 'None') {
        return undefined;
    }

    const spec: HardwarePrepSpec = { prepType };

    // Parse backset
    if (lower.includes('2-3/4') || lower.includes('2 3/4')) {
        spec.backset = '2-3/4"';
    } else if (lower.includes('2-3/8') || lower.includes('2 3/8')) {
        spec.backset = '2-3/8"';
    } else if (lower.includes('5"') || lower.includes('5 ')) {
        spec.backset = '5"';
    }

    // Parse strike type
    if (lower.includes('box strike')) {
        spec.strikeType = 'Box Strike';
    } else if (lower.includes('electric strike')) {
        spec.strikeType = 'Electric Strike';
    } else if (lower.includes('magnetic')) {
        spec.strikeType = 'Magnetic';
    } else if (lower.includes('roller')) {
        spec.strikeType = 'Roller Latch';
    } else if (lower.includes('strike')) {
        spec.strikeType = 'Standard';
    }

    // Parse closer info
    if (lower.includes('closer')) {
        spec.closerPrep = true;
        
        if (lower.includes('surface')) {
            spec.closerType = 'Surface';
        } else if (lower.includes('concealed')) {
            spec.closerType = 'Concealed';
        } else if (lower.includes('overhead')) {
            spec.closerType = 'Overhead';
        } else if (lower.includes('floor')) {
            spec.closerType = 'Floor';
        }

        if (lower.includes('parallel')) {
            spec.closerArmType = 'Parallel Arm';
        } else if (lower.includes('top jamb')) {
            spec.closerArmType = 'Top Jamb';
        } else if (lower.includes('slide track')) {
            spec.closerArmType = 'Slide Track';
        } else if (lower.includes('regular')) {
            spec.closerArmType = 'Regular Arm';
        }
    }

    return spec;
}

/**
 * Suggest hinge count based on door height
 */
export function suggestHingeCount(doorHeight?: number): number {
    if (!doorHeight) return 3;
    if (doorHeight >= 120) return 5; // 10 feet or taller
    if (doorHeight >= 90) return 4;  // 7.5 feet or taller
    return 3; // Standard
}

/**
 * Suggest hinge specification based on door properties
 */
export function suggestHingeSpec(door: Door): HingeSpec | undefined {
    const height = door.height;
    if (!height) return undefined;

    const spec: HingeSpec = {
        count: suggestHingeCount(height),
        size: '4.5" x 4.5"',
        type: 'Full Mortise',
        material: 'Steel'
    };

    // Suggest stainless steel for exterior doors
    if (door.location?.toLowerCase().includes('exterior')) {
        spec.material = 'Stainless Steel';
    }

    // Suggest ball bearing for heavy doors
    if (door.thickness === '1-3/4"' && door.doorCoreType === 'Solid Core') {
        spec.ballBearing = true;
    }

    // Suggest electric wire for electrified doors
    if (door.electrification?.isElectrified) {
        spec.electricWire = true;
    }

    // Suggest NRP for outswing exterior doors
    if (door.location?.toLowerCase().includes('exterior') && 
        door.operation?.toLowerCase().includes('out')) {
        spec.nrp = true;
    }

    return spec;
}

/**
 * Migrate door hardware data from legacy to Phase 21 structured format
 * This function auto-populates structured fields from legacy data
 */
export function migrateHardwareData(door: Door): Door {
    const migrated = { ...door };

    // If no structured hardware prep but legacy field exists, parse it
    if (!migrated.hardwarePrepSpec && migrated.hardwarePrep && migrated.hardwarePrep !== 'Not Specified') {
        migrated.hardwarePrepSpec = parseLegacyHardwarePrep(migrated.hardwarePrep);
    }

    // If structured hardware prep exists, update legacy field
    if (migrated.hardwarePrepSpec) {
        migrated.hardwarePrep = generateHardwarePrepString(migrated.hardwarePrepSpec);
    }

    // Suggest hinge spec if not present
    if (!migrated.hingeSpec && migrated.height) {
        migrated.hingeSpec = suggestHingeSpec(migrated);
    }

    // Initialize electrification if not present
    if (!migrated.electrification) {
        migrated.electrification = {
            isElectrified: false
        };
    }

    return migrated;
}

/**
 * Batch migrate multiple doors
 */
export function migrateBulkHardwareData(doors: Door[]): Door[] {
    return doors.map(migrateHardwareData);
}
