
import { Door, Report } from '../types';

export const generateReport = (doors: Door[]): Report | null => {
  if (!doors || !Array.isArray(doors)) return null;
  const doorsWithHardware = doors.filter(d => d.status === 'complete' && d.assignedHardwareSet);

  if (doorsWithHardware.length === 0) {
    return null;
  }

  // Use a temporary summary object that can hold a Set for unique source set names
  const tempSummary: { [key: string]: { item: any; totalQuantity: number; sourceSets: Set<string>; } } = {};

  doorsWithHardware.forEach(door => {
    const totalLeaves = (door.quantity || 1) * (door.liftCount || 1);
    const hardwareSet = door.assignedHardwareSet;
    
    if (hardwareSet) {
        hardwareSet.items.forEach(item => {
            // Include door material in the grouping key so items on different door types appear as separate rows
            const key = `${item.name}|${item.manufacturer}|${item.finish}|${item.description}|${door.doorMaterial}`;
            const totalItemQtyForDoor = item.quantity * totalLeaves;

            if (tempSummary[key]) {
                tempSummary[key].totalQuantity += totalItemQtyForDoor;
                tempSummary[key].sourceSets.add(hardwareSet.name); // Add the set name
            } else {
                const { id, quantity, ...itemDetails } = item;
                tempSummary[key] = {
                    item: {
                        ...itemDetails,
                        doorMaterial: door.doorMaterial // Add this new field
                    },
                    totalQuantity: totalItemQtyForDoor,
                    sourceSets: new Set([hardwareSet.name]), // Initialize the set
                };
            }
        });
    }
  });
  
  // Convert the temporary summary with Sets to the final summary with sorted string arrays
  const finalSummary: Report['hardwareSummary'] = {};
  for (const key in tempSummary) {
      finalSummary[key] = {
          ...tempSummary[key],
          sourceSets: Array.from(tempSummary[key].sourceSets).sort(),
      };
  }

  return {
    totalDoors: doors.length,
    doorsWithHardware: doorsWithHardware.length,
    hardwareSummary: finalSummary,
  };
};
