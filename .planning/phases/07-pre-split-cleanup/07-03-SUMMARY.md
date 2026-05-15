---
phase: 07-pre-split-cleanup
plan: 03
subsystem: types
tags: [typescript, types, interfaces, import-refactor, modularization]

# Dependency graph
requires:
  - phase: 07-01
    provides: dead-code analysis and baseline tsc error list

provides:
  - types/doorScheduleTypes.ts — canonical location for DoorScheduleExportConfig
  - types/hardwareSetTypes.ts — canonical location for HardwareSetExportConfig
  - Component files retain backward-compat re-exports for existing consumers

affects:
  - 08-component-config-splits
  - 09-service-split
  - Any future file that imports DoorScheduleExportConfig or HardwareSetExportConfig

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Canonical types/ file: interfaces that are shared across services live in types/, not in component files"
    - "Backward-compat re-export: component files use export type { X } from '../../types/X' to preserve existing import paths"
    - "import type: all type-only imports use import type { } syntax for isolatedModules compliance"

key-files:
  created:
    - types/doorScheduleTypes.ts
    - types/hardwareSetTypes.ts
  modified:
    - components/doorSchedule/DoorScheduleConfig.tsx
    - components/hardware/HardwareSetConfig.tsx
    - services/excelExportService.ts
    - services/pdfExportService.ts
    - services/csvExportService.ts
    - services/reportExportService.ts
    - views/ReportsView.tsx
    - app/project/[id]/reports/hardware-set/page.tsx
    - components/reports/ReportGenerationCenter.tsx

key-decisions:
  - "import type { } added to component files to bring re-exported names into local scope (export type { } re-export does not make the name available within the same file)"
  - "Backward-compat re-exports retained in component files so any consumer not yet updated still compiles"
  - "All 7 consumer files updated to import type from types/ paths, eliminating component->service dependency inversion"

patterns-established:
  - "Pattern: export config interfaces belong in types/, not in component files that implement the UI for those configs"
  - "Pattern: component files that previously owned shared interfaces add both import type (local use) + export type (backward compat)"

requirements-completed: [PRE-02, PRE-03]

# Metrics
duration: 15min
completed: 2026-05-13
---

# Phase 07 Plan 03: Pre-Split Cleanup — Export Config Interface Extraction Summary

**Eliminated component->service import inversion by extracting DoorScheduleExportConfig and HardwareSetExportConfig into neutral types/ files, updating all 7 consumer files, and retaining backward-compat re-exports in the component files.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-13T00:00:00Z
- **Completed:** 2026-05-13
- **Tasks:** 4/4
- **Files modified:** 9

## Accomplishments

- Created `types/doorScheduleTypes.ts` — canonical, no-dependency home for `DoorScheduleExportConfig`
- Created `types/hardwareSetTypes.ts` — canonical, no-dependency home for `HardwareSetExportConfig`
- Updated 4 service files + 3 non-service consumer files to import from `types/` paths using `import type`
- Replaced inline interface definitions in both component files with `export type { } from` re-exports plus a local `import type` for in-file usage
- Zero new TSC errors vs baseline (diff shows only line number shift and non-deterministic union ordering in error messages)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create types/doorScheduleTypes.ts** - `b19a0a3` (feat)
2. **Task 2: Create types/hardwareSetTypes.ts** - `85bccfc` (feat)
3. **Task 3: Add re-export declarations to component files** - `36c4ea0` (feat)
4. **Task 4: Update all service and non-service importers** - `12f90b8` (feat)

## Files Created/Modified

- `types/doorScheduleTypes.ts` - New canonical file; exports DoorScheduleExportConfig with exact original shape
- `types/hardwareSetTypes.ts` - New canonical file; exports HardwareSetExportConfig with exact original shape
- `components/doorSchedule/DoorScheduleConfig.tsx` - Replaced inline interface with re-export + added local import type
- `components/hardware/HardwareSetConfig.tsx` - Replaced inline interface with re-export + added local import type
- `services/excelExportService.ts` - Updated to import type from types/doorScheduleTypes + types/hardwareSetTypes
- `services/pdfExportService.ts` - Updated to import type from types/doorScheduleTypes + types/hardwareSetTypes
- `services/csvExportService.ts` - Updated to import type from types/doorScheduleTypes + types/hardwareSetTypes
- `services/reportExportService.ts` - Updated to import type from types/doorScheduleTypes + types/hardwareSetTypes
- `views/ReportsView.tsx` - Split combined import; added import type HardwareSetExportConfig from types/
- `app/project/[id]/reports/hardware-set/page.tsx` - Updated @/ alias path to @/types/hardwareSetTypes
- `components/reports/ReportGenerationCenter.tsx` - Split both combined imports; added import type from types/

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added import type to component files for local scope**

- **Found during:** Task 3
- **Issue:** `export type { X } from '...'` re-exports the name to _importers_ but does not make `X` available within the same file. The `DoorScheduleConfigProps` and `HardwareSetConfigProps` interfaces referenced the names, causing `error TS2304: Cannot find name '...'`
- **Fix:** Added `import type { DoorScheduleExportConfig } from '../../types/doorScheduleTypes'` to DoorScheduleConfig.tsx and `import type { HardwareSetExportConfig } from '../../types/hardwareSetTypes'` to HardwareSetConfig.tsx
- **Files modified:** `components/doorSchedule/DoorScheduleConfig.tsx`, `components/hardware/HardwareSetConfig.tsx`
- **Commit:** 36c4ea0

## Known Stubs

None — all interfaces wired to real canonical files, no placeholder values.

## Self-Check: PASSED

- `types/doorScheduleTypes.ts` exists and exports `DoorScheduleExportConfig`
- `types/hardwareSetTypes.ts` exists and exports `HardwareSetExportConfig`
- All 4 service files import from types/ paths (8 matches confirmed)
- All 3 non-service consumer files updated (ReportsView, hardware-set page, ReportGenerationCenter)
- tsc diff vs baseline: only line number shifts and non-deterministic union ordering — zero new errors
