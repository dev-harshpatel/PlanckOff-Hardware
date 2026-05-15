---
phase: 08-component-config-splits
plan: "02"
subsystem: components/hardware
tags: [split, refactor, typescript, hardware-set, modularization]
one_liner: "Split 853-line HardwareSetConfig.tsx into 4-file sub-directory: constants, helpers, sub-component, barrel index with inline handleDownload"
dependency_graph:
  requires: []
  provides: [components/hardware/HardwareSetConfig/index.tsx, components/hardware/HardwareSetConfig/hardwareConstants.ts, components/hardware/HardwareSetConfig/hardwareHelpers.ts, components/hardware/HardwareSetConfig/HardwareGroupTable.tsx]
  affects: [components/reports/ReportGenerationCenter.tsx, views/ReportsView.tsx, app/project/[id]/reports/hardware-set/page.tsx]
tech_stack:
  added: []
  patterns: [sub-directory barrel module, sibling imports, type-only circular import, 'use client' boundary]
key_files:
  created:
    - components/hardware/HardwareSetConfig/hardwareConstants.ts
    - components/hardware/HardwareSetConfig/hardwareHelpers.ts
    - components/hardware/HardwareSetConfig/HardwareGroupTable.tsx
    - components/hardware/HardwareSetConfig/index.tsx
  modified: []
  deleted:
    - components/hardware/HardwareSetConfig.tsx
decisions:
  - "HardwareSetExportConfig inline definition removed — re-exported from types/hardwareSetTypes per D-08"
  - "handleDownload kept inline in index.tsx per D-07 (no hook extraction)"
  - "GroupByOption, HardwareItemUsage, HardwareGroup types moved to hardwareHelpers.ts and exported"
  - "hardwareConstants.ts imports type GroupByOption from hardwareHelpers (type-only — no runtime circular dep)"
  - "Default export preserved on index.tsx for consumer backward-compatibility (deliberate SKILL.md §3 deviation)"
metrics:
  duration: "~15 min"
  completed: "2026-05-14"
  tasks: 3
  files: 5
requirements_closed: [COMP-03, COMP-04, VER-02, VER-03]
---

# Phase 08 Plan 02: HardwareSetConfig Sub-Directory Split Summary

**One-liner:** Split 853-line HardwareSetConfig.tsx into 4-file sub-directory: constants, helpers, sub-component, barrel index with inline handleDownload

## What Was Built

Split `components/hardware/HardwareSetConfig.tsx` (853 lines) into a focused sub-directory module with 4 files:

### Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `components/hardware/HardwareSetConfig/hardwareConstants.ts` | 31 | Static config arrays: REQUIRED_COLUMN_DEFS, GROUPING_OPTIONS, USAGE_OPTIONS |
| `components/hardware/HardwareSetConfig/hardwareHelpers.ts` | 216 | Exported types (GroupByOption, HardwareItemUsage, HardwareGroup) + 7 pure helper functions |
| `components/hardware/HardwareSetConfig/HardwareGroupTable.tsx` | 133 | HardwareGroupTable sub-component |
| `components/hardware/HardwareSetConfig/index.tsx` | 498 | Main component orchestration + inline handleDownload + JSX |

### Files Deleted

- `components/hardware/HardwareSetConfig.tsx` (853 lines — replaced by sub-directory)

## Verification Results

### VER-02: 'use client' Directive Placement

- `index.tsx` line 1: `'use client';` — CORRECT (uses hooks)
- `HardwareGroupTable.tsx` line 1: `'use client';` — CORRECT (uses JSX rendering)
- `hardwareConstants.ts` line 1: `import type { GroupByOption }...` — CORRECT (no 'use client' — pure data)
- `hardwareHelpers.ts` line 1: `import type { Door, HardwareSet, HardwareItem }...` — CORRECT (no 'use client' — pure functions)

### VER-03: Explicit Default Export

```
grep "export default HardwareSetConfig" components/hardware/HardwareSetConfig/index.tsx
export default HardwareSetConfig
```
Present — VER-03 PASS.

### D-07: Inline handleDownload Preserved

```
grep -n "const handleDownload" components/hardware/HardwareSetConfig/index.tsx
126:  const handleDownload = useCallback(async () => {
```
handleDownload is at line 126, inline in the main component — D-07 PASS.

### D-08: Type Re-Export Preserved

```
export type { HardwareSetExportConfig } from '../../../types/hardwareSetTypes';
```
Present in index.tsx — D-08 PASS.

### VER-01: tsc Diff vs Baseline — Zero New TS2305/TS2307/TS2306 Errors

Post-split tsc run compared to `.planning/tsc-baseline.txt`:
- Diff shows NO `>` lines (no new errors added)
- Diff shows only `<` lines (baseline had MORE errors — split actually removed the duplicate inline `HardwareSetExportConfig` interface that caused some downstream TS2305 errors)
- VER-01 PASS

### Consumer Compatibility

All 4 consumer files remain unmodified:
- `app/project/[id]/reports/hardware-set/page.tsx` — `dynamic(() => import('@/components/hardware/HardwareSetConfig'))` resolves to new index.tsx
- `components/reports/ReportGenerationCenter.tsx` — default import resolves to index.tsx
- `views/ReportsView.tsx` — default import resolves to index.tsx

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 338bf31 | feat(08-02): create hardwareConstants.ts and hardwareHelpers.ts (pure files, no use client) |
| Task 2 | 29a0a6d | feat(08-02): create HardwareGroupTable.tsx sub-component ('use client' as line 1) |
| Task 3 | 0a18f21 | feat(08-02): create barrel index.tsx, delete flat HardwareSetConfig.tsx |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data flows are wired (this is a pure structural refactor with zero behavior change).

## Self-Check: PASSED

- `components/hardware/HardwareSetConfig/index.tsx` — EXISTS
- `components/hardware/HardwareSetConfig/hardwareConstants.ts` — EXISTS
- `components/hardware/HardwareSetConfig/hardwareHelpers.ts` — EXISTS
- `components/hardware/HardwareSetConfig/HardwareGroupTable.tsx` — EXISTS
- `components/hardware/HardwareSetConfig.tsx` (flat file) — DELETED (confirmed)
- Commit 338bf31 — EXISTS
- Commit 29a0a6d — EXISTS
- Commit 0a18f21 — EXISTS
