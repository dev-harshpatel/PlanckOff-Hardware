---
phase: 1
plan: 2
subsystem: excel-exports
tags: [excel, xlsx, sheetjs, styling, theme]
dependency_graph:
  requires: []
  provides: [services/excelTheme.ts]
  affects: [services/excelExportService.ts, services/pricingReportService.ts, components/doorSchedule/DoorScheduleConfig.tsx]
tech_stack:
  added: []
  patterns: [shared-theme-module, worksheet-mutation-in-place]
key_files:
  created: [services/excelTheme.ts]
  modified: []
decisions:
  - "Used (ws as any)['!freeze'] cast because SheetJS 0.18.5 type definitions do not declare !freeze, but it is fully supported at runtime"
  - "XLSX_WRITE_OPTIONS exported as a constant so callers can spread it — enforces cellStyles: true at every write site"
  - "contentAwareColWidths caps data width at 50 chars to prevent notes/description fields from blowing out column widths"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-07"
  tasks_completed: 3
  files_created: 1
  files_modified: 0
---

# Phase 1 Plan 2: Create Shared Excel Theme Module Summary

**One-liner:** SheetJS (xlsx 0.18.5) Excel theme helpers — navy header fill (#1E293B) + freeze pane + content-aware column widths — with XLSX_WRITE_OPTIONS constant enforcing cellStyles: true at all write sites.

## What Was Built

`services/excelTheme.ts` — a zero-React, zero-browser-global module of SheetJS worksheet styling helpers used across all three Excel export paths in the codebase.

### Exports

| Export | Type | Purpose |
|--------|------|---------|
| `XLS_HEADER_FILL` | `string` | Brand navy hex `'1E293B'` (no leading #) |
| `XLS_HEADER_TEXT` | `string` | White hex `'FFFFFF'` |
| `XLSX_WRITE_OPTIONS` | `object` | `{ bookType: 'xlsx', type: 'array', cellStyles: true }` |
| `applyHeaderRow(ws)` | function | Bold white text + #1E293B fill on every cell in row 0 |
| `freezeHeaderRow(ws)` | function | Sets `!freeze` to lock row 1 when scrolling |
| `contentAwareColWidths(headers, dataRows)` | function | Returns `XLSX.ColInfo[]` with max-of-header/data widths, capped at 50 |
| `applySheetTheme(ws, headers, dataRows)` | function | Convenience wrapper: applyHeaderRow → freezeHeaderRow → set !cols |

## Tasks Completed

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 | Create services/excelTheme.ts with all exports | 56ce12a | Done |
| 2 | TypeScript compile check — zero new errors from excelTheme.ts | 56ce12a | Done |
| 3 | Verify !freeze property name — confirmed cast required | 56ce12a | Done |

## Verification

- [x] `services/excelTheme.ts` exists at project root
- [x] `npx tsc --noEmit` — no errors attributable to excelTheme.ts (pre-existing errors in other files are not regressions)
- [x] All five required exports present: `applyHeaderRow`, `freezeHeaderRow`, `contentAwareColWidths`, `applySheetTheme`, `XLSX_WRITE_OPTIONS`
- [x] `XLSX_WRITE_OPTIONS` includes `{ bookType: 'xlsx', type: 'array', cellStyles: true }`
- [x] `XLS_HEADER_FILL` is `'1E293B'` — matching the PDF theme navy
- [x] `XLS_HEADER_TEXT` is `'FFFFFF'`
- [x] No React import or browser global at module scope
- [x] JSDoc comment at top prominently warns callers to include `cellStyles: true` in `XLSX.write()`
- [x] No exceljs import — only xlsx (SheetJS)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical export] Added XLSX_WRITE_OPTIONS constant**

- **Found during:** Task 1 — key_context in the execution prompt specified this export was required but the plan's code listing did not include it
- **Issue:** The plan's TypeScript code block shows only the four functions and two color constants. The execution context specified: "excelTheme.ts should export a XLSX_WRITE_OPTIONS constant with { bookType: 'xlsx', type: 'array', cellStyles: true } that callers can spread"
- **Fix:** Added `XLSX_WRITE_OPTIONS` export with correct options
- **Files modified:** services/excelTheme.ts
- **Commit:** 56ce12a

**2. [Rule 1 - Defensive type cast] Used (ws as any)['!freeze'] instead of ws['!freeze']**

- **Found during:** Task 3 — verified SheetJS 0.18.5 type definitions at node_modules/xlsx/types/index.d.ts
- **Issue:** WorkSheet interface declares `[cell: string]: CellObject | WSKeys | any` — the any indexer means `ws['!freeze']` compiles without error, but the property is not explicitly typed. The plan explicitly recommended using the cast for documentation clarity.
- **Fix:** Used `(ws as any)['!freeze']` with a JSDoc comment explaining the cast is intentional
- **Files modified:** services/excelTheme.ts
- **Commit:** 56ce12a

## Known Stubs

None — this module is pure logic with no data stubs or placeholder values.

## Self-Check: PASSED

- [x] `F:\PlanckOff-Hardware\services\excelTheme.ts` — file created and verified
- [x] Commit `56ce12a` exists — confirmed via `git rev-parse --short HEAD`
- [x] All exports present — confirmed via grep of export statements
- [x] Zero TypeScript errors from this file — confirmed via `npx tsc --noEmit | grep excelTheme` (empty output)
