import { Door, HardwareSet, ElevationType } from '../types';
import { DoorScheduleExportConfig } from '../components/doorSchedule/DoorScheduleConfig';
import { HardwareSetExportConfig } from '../components/hardware/HardwareSetConfig';
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
      const key = `${item.name}|${item.description || ''}|${item.manufacturer || ''}|${item.finish || ''}|${item.quantity || 0}`;

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
): Promise<void> => {
  try {
    switch (config.format) {
      case 'xlsx':
        await exportDoorScheduleToExcel(doors, config, projectName, elevationTypes);
        break;
      case 'pdf':
        await exportDoorScheduleToPDF(doors, config, projectName, elevationTypes);
        break;
      case 'csv':
        exportDoorScheduleToCSV(doors, config, projectName, elevationTypes);
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
  projectName: string
): Promise<void> => {
  try {
    // Calculate usage statistics
    const usageStats = calculateHardwareUsage(doors, hardwareSets);

    switch (config.format) {
      case 'xlsx':
        await exportHardwareSetToExcel(usageStats, config, projectName);
        break;
      case 'pdf':
        await exportHardwareSetToPDF(usageStats, config, projectName);
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
