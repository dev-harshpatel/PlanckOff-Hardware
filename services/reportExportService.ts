import { Door, HardwareSet, ElevationType } from '../types';
import { DoorScheduleExportConfig } from '../components/DoorScheduleConfig';
import { HardwareSetExportConfig } from '../components/HardwareSetConfig';
import { SubmittalExportConfig } from '../components/SubmittalPackageConfig';
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
      const key = `${item.name}|${item.manufacturer || ''}|${item.finish || ''}`;

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
export const exportDoorSchedule = (
  doors: Door[],
  config: DoorScheduleExportConfig,
  projectName: string
): void => {
  try {
    switch (config.format) {
      case 'xlsx':
        exportDoorScheduleToExcel(doors, config, projectName);
        break;
      case 'pdf':
        exportDoorScheduleToPDF(doors, config, projectName);
        break;
      case 'csv':
        exportDoorScheduleToCSV(doors, config, projectName);
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
export const exportHardwareSet = (
  doors: Door[],
  hardwareSets: HardwareSet[],
  config: HardwareSetExportConfig,
  projectName: string
): void => {
  try {
    // Calculate usage statistics
    const usageStats = calculateHardwareUsage(doors, hardwareSets);

    switch (config.format) {
      case 'xlsx':
        exportHardwareSetToExcel(usageStats, config, projectName);
        break;
      case 'pdf':
        exportHardwareSetToPDF(usageStats, config, projectName);
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
export const exportSubmittalPackage = (
  doors: Door[],
  hardwareSets: HardwareSet[],
  elevationTypes: ElevationType[],
  config: SubmittalExportConfig
): void => {
  try {
    if (config.format === 'pdf') {
      exportSubmittalPackageToPDF(doors, hardwareSets, elevationTypes, config);
    } else {
      throw new Error(`Unsupported format: ${config.format}`);
    }
  } catch (error) {
    console.error('Error exporting Submittal Package:', error);
    throw error;
  }
};
