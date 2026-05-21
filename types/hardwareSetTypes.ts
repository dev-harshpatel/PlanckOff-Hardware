// Canonical export config types for hardware set exports.
// Extracted from components/hardware/HardwareSetConfig.tsx (PRE-03).
// All service importers should import from this path; component file re-exports for backward compat.

export interface HardwareSetExportConfig {
    requiredColumns: string[];
    optionalColumns: string[];
    groupBy: 'set' | 'type' | 'manufacturer' | 'flat' | 'buildingTag' | 'buildingLocation' | 'doorMaterial';
    usageDisplay: string[];
    format: 'xlsx' | 'pdf' | 'csv';
}
