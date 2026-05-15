# Requirements: PlanckOff Hardware v2.0

**Defined:** 2026-05-13
**Core Value:** Accurate, professionally formatted hardware specifications and exports that match exactly what the user sees in the application.

## v2.0 Requirements

Milestone goal: Split all source files over 750 lines into smaller, focused modules — pure structural refactor, zero behavior change, all consumer imports preserved.

**Split quality constraint (applies to ALL splits):** Each extracted sub-file must represent a complete, cohesive domain. If any logic from a domain is extracted, ALL related logic in that domain moves with it. No partial extractions that leave half a domain split across files. Sub-file names must precisely reflect their full content domain.

---

### Pre-split Cleanup (PRE)

- [x] **PRE-01**: Dead code `exportDoorScheduleToPDF` (lines 711–901 of `services/excelExportService.ts`) deleted — confirmed unused, no callers
- [x] **PRE-02**: `DoorScheduleExportConfig` interface extracted from `components/doorSchedule/DoorScheduleConfig.tsx` into `types/doorScheduleTypes.ts`; all 4+ service importers updated to the new path
- [x] **PRE-03**: `HardwareSetExportConfig` interface extracted from `components/hardware/HardwareSetConfig.tsx` into new `types/hardwareSetTypes.ts`; all 4–5 service importers updated to the new path
- [x] **PRE-04**: Baseline `tsc --noEmit` error snapshot saved to `.planning/tsc-baseline.txt` before any file is modified — used to diff post-split regressions

### Component Splits (COMP)

- [x] **COMP-01**: `components/doorSchedule/DoorScheduleConfig.tsx` (915 ln) replaced by `DoorScheduleConfig/` sub-directory with barrel `index.tsx` — sub-files cover all complete cohesive domains within the file (column accordion UI, grouped table UI, download handler logic)
- [x] **COMP-02**: All existing consumer imports of `DoorScheduleConfig` resolve to the same named exports without modification after split; `tsc --noEmit` diff shows zero new errors
- [x] **COMP-03**: `components/hardware/HardwareSetConfig.tsx` (780 ln) replaced by `HardwareSetConfig/` sub-directory with barrel `index.tsx` — sub-files cover all complete cohesive domains (hardware preview table UI, download handler logic, constants)
- [x] **COMP-04**: All existing consumer imports of `HardwareSetConfig` resolve to the same named exports without modification after split; `tsc --noEmit` diff shows zero new errors

### Service Split (SVC)

- [x] **SVC-01**: `services/excelExportService.ts` replaced by `excelExportService/` sub-directory with barrel `index.ts` — domain modules cover all complete cohesive export domains (door schedule Excel, hardware set Excel, multi-sheet workbook assembly)
- [x] **SVC-02**: All existing consumer imports of `excelExportService` resolve to the same named exports without modification after split; `tsc --noEmit` diff shows zero new errors

### Hook Split (HOOK)

- [x] **HOOK-01**: `hooks/useDoorTableState.tsx` (783 ln) replaced by `useDoorTableState/` sub-directory with barrel `index.tsx` — concern-sliced sub-files each cover a complete domain (column definitions, filter state, column visibility state, row selection state, cell edit state, render helpers); orchestrator hook assembles them
- [x] **HOOK-02**: All 55+ return values of `useDoorTableState` remain in the public interface unchanged — consumer call sites need zero modification
- [x] **HOOK-03**: `renderCell` and `renderHeader` remain co-located in the orchestrator file (closure constraint — these functions close over hook state and cannot be extracted without behavior change)

### Pricing Component Split (PRICING)

- [x] **PRICING-01**: `components/pricing/PricingReportConfig.tsx` (745 ln) split by extracting the complete `ProposalTab` sub-component (~354 lines of cohesive JSX) into its own file — no partial extraction of individual tables
- [x] **PRICING-02**: All existing consumer imports of `PricingReportConfig` resolve to the same named exports without modification after split; `tsc --noEmit` diff shows zero new errors

### Verification Gates (VER)

- [x] **VER-01**: `tsc --noEmit` diff against baseline shows zero new TS2305/TS2307/TS2306 errors after each split phase completes
- [x] **VER-02**: Every sub-file that uses React hooks or browser APIs carries `'use client'` as its literal first line (before imports, before comments)
- [x] **VER-03**: Every barrel `index.ts(x)` explicitly re-exports the default export (not covered by `export *` — must be `export { default } from './File'`)

---

## Future Requirements

### 500–749 Line Files

- **FUTURE-01**: `services/geminiService.ts` (714 ln) — AI service, split by operation domain if it grows further
- **FUTURE-02**: `utils/doorValidation.ts` (662 ln) — validation utilities, split by rule domain
- **FUTURE-03**: `hooks/useProjectUploads.ts` (602 ln) — upload hook, split by upload type
- **FUTURE-04**: `components/doorSchedule/DoorScheduleManager.tsx` (594 ln) — split if it crosses 750 lines
- **FUTURE-05**: `services/pdfExportService.ts` (559 ln), `services/cobieExportService.ts` (549 ln), `hooks/usePricingExport.ts` (538 ln), `views/ProjectView.tsx` (531 ln), `components/hardware/HardwareSetsManager.tsx` (524 ln) — monitor; split at 750-line threshold

---

---

## v3.0 Requirements

Milestone goal: Audit and eliminate unnecessary React re-renders, redundant Supabase API calls, and duplicate data fetches — resulting in a measurably snappier application with lower Supabase read usage. Zero behavior change.

### Re-render Optimization (PERF)

- [x] **PERF-01**: Stable values and callbacks on data-heavy pages (DoorScheduleManager, HardwareSetsManager, PricingReportConfig, ProjectView) are wrapped in `useMemo`/`useCallback`; no component re-renders more than once for a single user action that affects only its own state; large Context providers that cause wide re-renders are split so consumers only re-render when the specific slice they use changes
- [ ] **PERF-02**: No `useEffect` hook triggers a Supabase fetch with an overly-broad or missing dependency array; data shared across sibling components is fetched once at the top level and passed down — siblings do not independently fetch the same data on mount; if the same endpoint is called twice within a short window, the second call waits for the first (fetch deduplication)
- [x] **PERF-03**: Write operations (create/update/delete) update local React state directly without triggering a full dataset re-fetch; UI-only state changes (tab switches, filter toggles, modal open/close, sort/column-visibility) do not cause any Supabase read calls

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Behavior changes during split | Zero-behavior-change constraint — splits are structural only |
| New abstractions / shared utilities | Introduces new patterns; out of scope for structural refactor |
| Refactoring implementation logic | Would risk regressions beyond what a structural split carries |
| Applying ESLint import rules enforcement | Config changes; separate concern from the split work |
| Re-enabling TypeScript strict mode | Would surface 100s of pre-existing errors; separate concern |
| Splitting files under 750 lines | Deferred to future milestone based on growth |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PRE-01 | Phase 7 | Complete |
| PRE-02 | Phase 7 | Complete |
| PRE-03 | Phase 7 | Complete |
| PRE-04 | Phase 7 | Complete |
| COMP-01 | Phase 8 | Complete |
| COMP-02 | Phase 8 | Complete |
| COMP-03 | Phase 8 | Complete |
| COMP-04 | Phase 8 | Complete |
| VER-01 | Phase 8 | Complete |
| VER-02 | Phase 8 | Complete |
| VER-03 | Phase 8 | Complete |
| SVC-01 | Phase 9 | Complete |
| SVC-02 | Phase 9 | Complete |
| HOOK-01 | Phase 10 | Complete |
| HOOK-02 | Phase 10 | Complete |
| HOOK-03 | Phase 10 | Complete |
| PRICING-01 | Phase 11 | Complete |
| PRICING-02 | Phase 11 | Complete |

**Coverage:**
- v2.0 requirements: 18 total
- Mapped to phases: 18 ✓
- Unmapped: 0 ✓

> **VER gate note:** VER-01/VER-02/VER-03 are assigned to Phase 8 as their canonical phase for traceability. These gates apply as exit criteria within every split phase (8, 9, 10, 11) — each split plan must satisfy all three before being marked complete.

---
*Requirements defined: 2026-05-13*
*Last updated: 2026-05-13 — traceability populated by roadmapper (v2.0 roadmap)*
