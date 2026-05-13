// Canonical export config types for door schedule exports.
// Extracted from components/doorSchedule/DoorScheduleConfig.tsx (PRE-02).
// All service importers should import from this path; component file re-exports for backward compat.

export interface DoorScheduleExportConfig {
    format?: string;
    columns: {
        basic: string[];
        dimensions: string[];
        materials: string[];
        fireSafety: string[];
        hardware: string[];
        additional: string[];
    };
    includeHeader: boolean;
    includeSummary: boolean;
}
