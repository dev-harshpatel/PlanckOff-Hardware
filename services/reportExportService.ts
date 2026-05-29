import { Door, HardwareSet, ElevationType } from '../types';
import type { DoorScheduleExportConfig } from '../types/doorScheduleTypes';
import type { HardwareSetExportConfig } from '../types/hardwareSetTypes';
import { SubmittalExportConfig } from '../components/submittals/SubmittalPackageConfig';
import { exportDoorScheduleToCSV, exportHardwareSetToCSV } from './csvExportService';
import { exportDoorScheduleToExcel, exportHardwareSetToExcel } from './excelExportService';
import { exportDoorScheduleToPDF, exportHardwareSetToPDF, exportSubmittalPackageToPDF } from './pdfExportService';

// Calculate usage statistics for Hardware Set reports
export interface HardwareItemUsage {
  item: any;
  doorTags: string[];
  totalQuantity: number;
  sets: string[];
}

export const calculateHardwareUsage = (
  doors: Door[],
  hardwareSets: HardwareSet[]
): HardwareItemUsage[] => {
  const itemUsageMap = new Map<string, HardwareItemUsage>();

  hardwareSets.forEach(set => {
    set.items.forEach(item => {
      // Key on Item Name + Description + Manufacturer + Finish only.
      // Quantity is intentionally excluded so the same item appearing in multiple
      // sets (possibly with different per-set quantities) merges into one row
      // and has its total quantity summed correctly.
      const key = [
        (item.name || '').trim().toLowerCase(),
        ((item.processedDescription ?? item.description) || '').trim().toLowerCase(),
        (item.manufacturer || '').trim().toLowerCase(),
        (item.finish || '').trim().toLowerCase(),
      ].join('|');

      if (!itemUsageMap.has(key)) {
        itemUsageMap.set(key, {
          item,
          doorTags: [],
          totalQuantity: 0,
          sets: []
        });
      }

      const usage = itemUsageMap.get(key)!;

      // Find all doors using this set
      const doorsWithSet = doors.filter(d =>
        d.assignedHardwareSet?.name === set.name
      );

      doorsWithSet.forEach(door => {
        const doorTag = door.doorTag || door.location || 'Unknown';
        if (!usage.doorTags.includes(doorTag)) {
          usage.doorTags.push(doorTag);
        }
        const doorQty = (door.quantity || 1) * (door.liftCount || 1);
        usage.totalQuantity += item.quantity * doorQty;
      });

      if (!usage.sets.includes(set.name)) {
        usage.sets.push(set.name);
      }
    });
  });

  return Array.from(itemUsageMap.values());
};

// Export Door Schedule Report
export const exportDoorSchedule = async (
  doors: Door[],
  config: DoorScheduleExportConfig,
  projectName: string,
  elevationTypes: ElevationType[] = [],
  projectLocation?: string,
  projectProvince?: string,
): Promise<void> => {
  try {
    // ORD-04: explicit spread preserves call-site array order (UI display order)
    const orderedDoors = [...doors];
    switch (config.format) {
      case 'xlsx':
        await exportDoorScheduleToExcel(orderedDoors, config, projectName, elevationTypes);
        break;
      case 'pdf':
        await exportDoorScheduleToPDF(orderedDoors, config, projectName, elevationTypes, projectLocation, projectProvince);
        break;
      case 'csv':
        exportDoorScheduleToCSV(orderedDoors, config, projectName, elevationTypes);
        break;
      default:
        throw new Error(`Unsupported format: ${config.format}`);
    }
  } catch (error) {
    console.error('Error exporting Door Schedule:', error);
    throw error;
  }
};

// Export Hardware Set Report
export const exportHardwareSet = async (
  doors: Door[],
  hardwareSets: HardwareSet[],
  config: HardwareSetExportConfig,
  projectName: string,
  projectLocation?: string,
  projectProvince?: string,
): Promise<void> => {
  try {
    // ORD-04: explicit spreads preserve call-site array order
    const orderedDoors        = [...doors];
    const orderedHardwareSets = [...hardwareSets];
    // Calculate usage statistics
    const usageStats = calculateHardwareUsage(orderedDoors, orderedHardwareSets);

    switch (config.format) {
      case 'xlsx':
        await exportHardwareSetToExcel(usageStats, config, projectName);
        break;
      case 'pdf':
        await exportHardwareSetToPDF(usageStats, config, projectName, projectLocation, projectProvince);
        break;
      case 'csv':
        exportHardwareSetToCSV(usageStats, config, projectName);
        break;
      default:
        throw new Error(`Unsupported format: ${config.format}`);
    }
  } catch (error) {
    console.error('Error exporting Hardware Set:', error);
    throw error;
  }
};

// Export Submittal Package
export const exportSubmittalPackage = async (
  doors: Door[],
  hardwareSets: HardwareSet[],
  elevationTypes: ElevationType[],
  config: SubmittalExportConfig
): Promise<void> => {
  try {
    if (config.format === 'pdf') {
      await exportSubmittalPackageToPDF(doors, hardwareSets, elevationTypes, config);
    } else {
      throw new Error(`Unsupported format: ${config.format}`);
    }
  } catch (error) {
    console.error('Error exporting Submittal Package:', error);
    throw error;
  }
};
