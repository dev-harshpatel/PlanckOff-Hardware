import { HardwareSet, HardwareItem, Door } from '../types';
import { assignHardwareCSISection } from '../utils/csiMasterFormat';

export interface ProcurementSummary {
    byManufacturer: ManufacturerGroup[];
    byLeadTime: LeadTimeGroup[];
    criticalPath: CriticalPathItem[];
    totalItems: number;
    totalCost: number;
    averageLeadTime: string;
}

export interface ManufacturerGroup {
    manufacturer: string;
    items: ProcurementItem[];
    totalQuantity: number;
    totalCost: number;
    longestLeadTime: string;
    contactInfo?: string;
}

export interface LeadTimeGroup {
    leadTime: string;
    leadTimeWeeks: number;
    items: ProcurementItem[];
    manufacturers: string[];
}

export interface ProcurementItem {
    name: string;
    model: string;
    quantity: number;
    unitCost?: number;
    totalCost?: number;
    leadTime: string;
    csiSection: string;
    ansiGrade?: string;
    setName: string;
}

export interface CriticalPathItem extends ProcurementItem {
    leadTimeWeeks: number;
    manufacturer: string;
}

/**
 * Generate comprehensive procurement summary
 */
export function generateProcurementSummary(
    hardwareSets: HardwareSet[],
    doors: Door[]
): ProcurementSummary {
    // Calculate door counts per hardware set
    const setDoorCounts = new Map<string, number>();
    doors.forEach(door => {
        const setName = door.hardwareSet || door.assignedHardwareSet?.name;
        if (setName) {
            setDoorCounts.set(setName, (setDoorCounts.get(setName) || 0) + 1);
        }
    });

    // Build procurement items
    const allItems: Array<{
        item: HardwareItem;
        totalQty: number;
        setName: string;
    }> = [];

    hardwareSets.forEach(set => {
        const doorCount = setDoorCounts.get(set.name) || 0;
        set.items.forEach(item => {
            const totalQty = (item.quantity || 1) * doorCount;
            allItems.push({
                item,
                totalQty,
                setName: set.name
            });
        });
    });

    // Group by manufacturer
    const byManufacturer = groupByManufacturer(allItems);

    // Group by lead time
    const byLeadTime = groupByLeadTime(allItems);

    // Identify critical path
    const criticalPath = identifyCriticalPath(allItems);

    // Calculate totals
    const totalItems = allItems.length;
    const totalCost = allItems.reduce((sum, { item, totalQty }) => {
        return sum + ((item.unitCost || 0) * totalQty);
    }, 0);

    // Calculate average lead time
    const leadTimes = allItems
        .map(({ item }) => parseLeadTimeWeeks(item.leadTime || ''))
        .filter(weeks => weeks > 0);
    const averageWeeks = leadTimes.length > 0
        ? leadTimes.reduce((sum, weeks) => sum + weeks, 0) / leadTimes.length
        : 0;
    const averageLeadTime = averageWeeks > 0 ? `${Math.round(averageWeeks)} weeks` : 'Unknown';

    return {
        byManufacturer,
        byLeadTime,
        criticalPath,
        totalItems,
        totalCost,
        averageLeadTime
    };
}

/**
 * Group items by manufacturer
 */
export function groupByManufacturer(
    items: Array<{ item: HardwareItem; totalQty: number; setName: string }>
): ManufacturerGroup[] {
    const groups = new Map<string, ManufacturerGroup>();

    items.forEach(({ item, totalQty, setName }) => {
        const manufacturer = item.manufacturer || 'Unknown';
        
        if (!groups.has(manufacturer)) {
            groups.set(manufacturer, {
                manufacturer,
                items: [],
                totalQuantity: 0,
                totalCost: 0,
                longestLeadTime: '0 weeks'
            });
        }

        const group = groups.get(manufacturer)!;
        const csiSection = item.csiSection || assignHardwareCSISection(item);
        const unitCost = item.unitCost || 0;
        const totalCost = unitCost * totalQty;

        group.items.push({
            name: item.name,
            model: item.modelNumber || '',
            quantity: totalQty,
            unitCost,
            totalCost,
            leadTime: item.leadTime || 'Unknown',
            csiSection,
            ansiGrade: item.ansiGrade,
            setName
        });

        group.totalQuantity += totalQty;
        group.totalCost += totalCost;

        // Update longest lead time
        const currentWeeks = parseLeadTimeWeeks(group.longestLeadTime);
        const itemWeeks = parseLeadTimeWeeks(item.leadTime || '');
        if (itemWeeks > currentWeeks) {
            group.longestLeadTime = item.leadTime || 'Unknown';
        }
    });

    // Sort by manufacturer name
    return Array.from(groups.values()).sort((a, b) => 
        a.manufacturer.localeCompare(b.manufacturer)
    );
}

/**
 * Group items by lead time
 */
export function groupByLeadTime(
    items: Array<{ item: HardwareItem; totalQty: number; setName: string }>
): LeadTimeGroup[] {
    const groups = new Map<string, LeadTimeGroup>();

    items.forEach(({ item, totalQty, setName }) => {
        const leadTime = item.leadTime || 'Unknown';
        const leadTimeWeeks = parseLeadTimeWeeks(leadTime);
        
        if (!groups.has(leadTime)) {
            groups.set(leadTime, {
                leadTime,
                leadTimeWeeks,
                items: [],
                manufacturers: []
            });
        }

        const group = groups.get(leadTime)!;
        const csiSection = item.csiSection || assignHardwareCSISection(item);
        const manufacturer = item.manufacturer || 'Unknown';

        group.items.push({
            name: item.name,
            model: item.modelNumber || '',
            quantity: totalQty,
            unitCost: item.unitCost,
            totalCost: (item.unitCost || 0) * totalQty,
            leadTime,
            csiSection,
            ansiGrade: item.ansiGrade,
            setName
        });

        // Add manufacturer if not already in list
        if (!group.manufacturers.includes(manufacturer)) {
            group.manufacturers.push(manufacturer);
        }
    });

    // Sort by lead time (longest first)
    return Array.from(groups.values()).sort((a, b) => 
        b.leadTimeWeeks - a.leadTimeWeeks
    );
}

/**
 * Identify critical path items (longest lead times)
 */
export function identifyCriticalPath(
    items: Array<{ item: HardwareItem; totalQty: number; setName: string }>
): CriticalPathItem[] {
    const criticalItems: CriticalPathItem[] = [];

    items.forEach(({ item, totalQty, setName }) => {
        const leadTimeWeeks = parseLeadTimeWeeks(item.leadTime || '');
        const csiSection = item.csiSection || assignHardwareCSISection(item);

        criticalItems.push({
            name: item.name,
            model: item.modelNumber || '',
            quantity: totalQty,
            unitCost: item.unitCost,
            totalCost: (item.unitCost || 0) * totalQty,
            leadTime: item.leadTime || 'Unknown',
            leadTimeWeeks,
            csiSection,
            ansiGrade: item.ansiGrade,
            setName,
            manufacturer: item.manufacturer || 'Unknown'
        });
    });

    // Sort by lead time (longest first) and return top items
    return criticalItems
        .sort((a, b) => b.leadTimeWeeks - a.leadTimeWeeks)
        .filter(item => item.leadTimeWeeks > 0)
        .slice(0, 10); // Top 10 critical items
}

/**
 * Parse lead time string to weeks
 */
function parseLeadTimeWeeks(leadTime: string): number {
    if (!leadTime || leadTime === 'Unknown') return 0;

    // Try to extract number from various formats
    // "4-6 weeks" -> 5 (average)
    // "2 weeks" -> 2
    // "3 months" -> 12
    const match = leadTime.match(/(\d+)(?:-(\d+))?\s*(week|month)/i);
    if (!match) return 0;

    const min = parseInt(match[1]);
    const max = match[2] ? parseInt(match[2]) : min;
    const average = (min + max) / 2;
    const unit = match[3].toLowerCase();

    if (unit.startsWith('month')) {
        return average * 4; // Convert months to weeks
    }

    return average;
}

/**
 * Format lead time for display
 */
export function formatLeadTime(weeks: number): string {
    if (weeks === 0) return 'Unknown';
    if (weeks < 4) return `${weeks} week${weeks !== 1 ? 's' : ''}`;
    
    const months = Math.round(weeks / 4);
    return `${months} month${months !== 1 ? 's' : ''}`;
}
