import { Door, HardwareItem } from '../types';

/**
 * Phase 22: CSI MasterFormat Section Assignment Utility
 * Auto-assigns industry-standard CSI section codes to doors and hardware
 */

// CSI MasterFormat Division 08 - Openings
export const CSI_SECTIONS = {
    // Doors
    METAL_DOORS: '08 11 00',
    WOOD_DOORS: '08 14 00',
    COMPOSITE_DOORS: '08 16 00',
    ACCESS_DOORS: '08 31 00',
    
    // Frames
    METAL_FRAMES: '08 11 13',
    WOOD_FRAMES: '08 14 13',
    
    // Hardware
    DOOR_HARDWARE: '08 71 00',
    HARDWARE_ACCESSORIES: '08 79 00',
    
    // Finishes
    PAINTING: '09 91 00',
    STAINING: '09 93 00'
} as const;

/**
 * Assign CSI section to a door based on material
 */
export function assignDoorCSISection(door: Door): string {
    const material = door.doorMaterial?.toLowerCase() || '';
    const coreType = door.doorCoreType?.toLowerCase() || '';
    const faceType = door.doorFaceType?.toLowerCase() || '';
    
    // Check for metal/steel doors
    if (material.includes('metal') || material.includes('steel') || 
        material.includes('aluminum') || material.includes('hollow metal')) {
        return CSI_SECTIONS.METAL_DOORS;
    }
    
    // Check for wood doors
    if (material.includes('wood') || faceType.includes('wood') || 
        coreType.includes('wood') || material.includes('timber')) {
        return CSI_SECTIONS.WOOD_DOORS;
    }
    
    // Check for composite/fiberglass doors
    if (material.includes('composite') || material.includes('fiberglass') || 
        material.includes('plastic') || material.includes('laminate')) {
        return CSI_SECTIONS.COMPOSITE_DOORS;
    }
    
    // Check for access doors/panels
    if (door.location?.toLowerCase().includes('access') || 
        door.doorTag?.toLowerCase().includes('access')) {
        return CSI_SECTIONS.ACCESS_DOORS;
    }
    
    // Default to metal doors (most common)
    return CSI_SECTIONS.METAL_DOORS;
}

/**
 * Assign CSI section to hardware item based on type
 */
export function assignHardwareCSISection(item: HardwareItem): string {
    const name = item.name.toLowerCase();
    const description = item.description?.toLowerCase() || '';
    
    // Main hardware items (locks, closers, hinges, etc.)
    if (name.includes('lock') || name.includes('latch') || 
        name.includes('closer') || name.includes('hinge') || 
        name.includes('exit') || name.includes('panic') ||
        name.includes('lever') || name.includes('knob')) {
        return CSI_SECTIONS.DOOR_HARDWARE;
    }
    
    // Hardware accessories (stops, holders, kick plates, etc.)
    if (name.includes('stop') || name.includes('holder') || 
        name.includes('kick plate') || name.includes('push plate') || 
        name.includes('pull') || name.includes('threshold') ||
        name.includes('sweep') || name.includes('seal')) {
        return CSI_SECTIONS.HARDWARE_ACCESSORIES;
    }
    
    // Default to main hardware
    return CSI_SECTIONS.DOOR_HARDWARE;
}

/**
 * Get CSI section description
 */
export function getCSISectionDescription(csiSection: string): string {
    const descriptions: Record<string, string> = {
        '08 11 00': 'Metal Doors and Frames',
        '08 11 13': 'Metal Door Frames',
        '08 14 00': 'Wood Doors',
        '08 14 13': 'Wood Door Frames',
        '08 16 00': 'Composite Doors',
        '08 31 00': 'Access Doors and Panels',
        '08 71 00': 'Door Hardware',
        '08 79 00': 'Hardware Accessories',
        '09 91 00': 'Painting',
        '09 93 00': 'Staining and Transparent Finishing'
    };
    
    return descriptions[csiSection] || 'Unknown Section';
}

/**
 * Batch assign CSI sections to all doors
 */
export function assignCSISectionsToAllDoors(doors: Door[]): Door[] {
    return doors.map(door => ({
        ...door,
        csiSection: assignDoorCSISection(door)
    }));
}

/**
 * Batch assign CSI sections to all hardware items
 */
export function assignCSISectionsToAllHardware(items: HardwareItem[]): HardwareItem[] {
    return items.map(item => ({
        ...item,
        csiSection: assignHardwareCSISection(item)
    }));
}

/**
 * Group doors by CSI section
 */
export function groupDoorsByCSISection(doors: Door[]): Map<string, Door[]> {
    const grouped = new Map<string, Door[]>();
    
    doors.forEach(door => {
        const section = door.csiSection || assignDoorCSISection(door);
        if (!grouped.has(section)) {
            grouped.set(section, []);
        }
        grouped.get(section)!.push(door);
    });
    
    return grouped;
}

/**
 * Group hardware items by CSI section
 */
export function groupHardwareByCSISection(items: HardwareItem[]): Map<string, HardwareItem[]> {
    const grouped = new Map<string, HardwareItem[]>();
    
    items.forEach(item => {
        const section = item.csiSection || assignHardwareCSISection(item);
        if (!grouped.has(section)) {
            grouped.set(section, []);
        }
        grouped.get(section)!.push(item);
    });
    
    return grouped;
}

/**
 * Get all unique CSI sections used in a project
 */
export function getUniqueCSISections(doors: Door[], hardwareItems: HardwareItem[]): string[] {
    const sections = new Set<string>();
    
    doors.forEach(door => {
        const section = door.csiSection || assignDoorCSISection(door);
        sections.add(section);
    });
    
    hardwareItems.forEach(item => {
        const section = item.csiSection || assignHardwareCSISection(item);
        sections.add(section);
    });
    
    return Array.from(sections).sort();
}
