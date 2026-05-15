# Roadmap: PlanckOff Hardware

## Milestones

- ✅ **v1.0 Export Polish MVP** — Phases 1-6 (shipped 2013-05-13) — [archive](.planning/milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 File Modularization** — Phases 7-11 (completed 2013-05-14)

## Phases

<details>
<summary>✅ v1.0 Export Polish MVP (Phases 1-6) — SHIPPED 2013-05-13</summary>

- [x] Phase 1: Beautify Exports & Fix Ordering (5 plans) — completed 2013-05-07
- [x] Phase 2: Implement Error Message Registry (5 plans) — completed 2013-05-07
- [x] Phase 3: Fix Level-wise Filtering & Quantity Counts in Pricing Report (5 plans) — completed 2013-05-13
- [x] Phase 4: Implement Real-Time UI Updates via Supabase Realtime (8 plans) — completed 2013-05-12
- [x] Phase 5: Execute Pricing Report Fixes (3 plans) — completed 2013-05-12
- [x] Phase 6: Wire Export & Realtime Error Handling (3 plans + 2 decimal) — completed 2013-05-12

</details>

### v2.0 File Modularization (Phases 7-11)

- [x] **Phase 7: Pre-Split Cleanup** — Delete dead code, extract shared type interfaces, capture tsc baseline (completed 2013-05-13)
- [x] **Phase 8: Component Config Splits** — Split DoorScheduleConfig.tsx and HardwareSetConfig.tsx into sub-directory modules (completed 2013-05-14)
- [x] **Phase 9: Service Split** — Split excelExportService.ts into domain-scoped sub-directory modules (completed 2013-05-14)
- [x] **Phase 10: Hook Split** — Split useDoorTableState.tsx into concern-sliced sub-directory modules (completed 2013-05-14)
- [x] **Phase 11: Pricing Component Split** — Split PricingReportConfig.tsx by extracting ProposalTab sub-component (completed 2013-05-14)

## Phase Details

### Phase 7: Pre-Split Cleanup
**Goal**: The codebase is free of dead code, shared interfaces live in canonical type files, and a tsc baseline is recorded — so every subsequent split starts from a clean, measurable foundation
**Depends on**: Nothing (first v2.0 phase; blocks all subsequent phases)
**Requirements**: PRE-01, PRE-02, PRE-03, PRE-04
**Success Criteria** (what must be TRUE):
  1. `services/excelExportService.ts` no longer contains `exportDoorScheduleToPDF` (lines 711-901 deleted); `tsc --noEmit` passes with zero new errors after deletion
  2. `types/doorScheduleTypes.ts` exists and exports `DoorScheduleExportConfig`; all prior importers of that interface resolve from the new path without modification
  3. `types/hardwareSetTypes.ts` exists and exports `HardwareSetExportConfig`; all prior importers of that interface resolve from the new path without modification
  4. `.planning/tsc-baseline.txt` exists and contains the full output of `tsc --noEmit` captured before any split file is modified
**Plans**: TBD

### Phase 8: Component Config Splits
**Goal**: `DoorScheduleConfig.tsx` and `HardwareSetConfig.tsx` are replaced by sub-directory modules; all consumers import identically; the verification gates (VER-01/VER-02/VER-03) pass for both splits

> **Verification gates note:** VER-01, VER-02, and VER-03 are cross-cutting gates that apply to every split phase (8-11). They are assigned here as their canonical phase. Each split plan in Phases 9-11 must also satisfy these gates before being marked complete.

**Depends on**: Phase 7
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, VER-01, VER-02, VER-03
**Success Criteria** (what must be TRUE):
  1. `components/doorSchedule/DoorScheduleConfig/index.tsx` exists as barrel; original flat file is deleted; no file in the sub-directory exceeds 300 lines
  2. `components/hardware/HardwareSetConfig/index.tsx` exists as barrel; original flat file is deleted; no file in the sub-directory exceeds 300 lines
  3. All existing consumer imports of `DoorScheduleConfig` and `HardwareSetConfig` compile without modification; `tsc --noEmit` diff against baseline shows zero new TS2305/TS2307/TS2306 errors
  4. Every sub-file in both split directories that uses React hooks or browser APIs has `'use client'` as its literal first line (before imports, before comments)
  5. Every barrel `index.tsx` explicitly re-exports the default export using `export { default } from './File'` (not covered by `export *` alone)
**Plans**: 3 plans
Plans:
- [x] 08-01-PLAN.md — Split DoorScheduleConfig.tsx into sub-directory (index + ColumnAccordion + GroupedTable + useDoorScheduleDownload hook)
- [x] 08-02-PLAN.md — Split HardwareSetConfig.tsx into sub-directory (index + hardwareConstants + hardwareHelpers + HardwareGroupTable)
- [x] 08-03-PLAN.md — Run VER-01/02/03 verification gates and write 08-VERIFICATION.md
**UI hint**: yes

### Phase 9: Service Split
**Goal**: `excelExportService.ts` is replaced by a sub-directory of domain-scoped modules; all consumers import identically; verification gates pass
**Depends on**: Phase 7 (type extractions PRE-02/PRE-03 must be complete before service internals are moved)
**Requirements**: SVC-01, SVC-02
**Success Criteria** (what must be TRUE):
  1. `services/excelExportService/index.ts` exists as barrel; original flat file is deleted; sub-files cover all complete cohesive export domains (door schedule Excel, hardware set Excel, multi-sheet workbook assembly); no sub-file exceeds 300 lines
  2. All existing consumer imports of `excelExportService` compile without modification; `tsc --noEmit` diff against baseline shows zero new TS2305/TS2307/TS2306 errors
  3. Every sub-file that uses browser APIs carries `'use client'` as its literal first line; every barrel `index.ts` explicitly re-exports the default export via `export { default } from './File'`
**Plans**: 3 plans
Plans:
- [x] 09-01-PLAN.md — Extract door-schedule Excel domain (lines 1–189) to doorScheduleExcel.ts
- [x] 09-02-PLAN.md — Extract hardware-set Excel domain (lines 191–378) to hardwareSetExcel.ts
- [x] 09-03-PLAN.md — Extract multi-sheet domain to multiSheetWorkbook.ts, create barrel index.ts, verify tsc, delete flat file

### Phase 10: Hook Split
**Goal**: `useDoorTableState.tsx` is replaced by a sub-directory of concern-sliced modules with an orchestrator hook; all 55+ return values remain in the public interface; verification gates pass
**Depends on**: Phase 7
**Requirements**: HOOK-01, HOOK-02, HOOK-03
**Success Criteria** (what must be TRUE):
  1. `hooks/useDoorTableState/index.tsx` exists as the orchestrator barrel; sub-files each cover a complete concern domain (column definitions, filter state, column visibility, row selection, cell edit state, render helpers); no sub-file exceeds 300 lines
  2. All 55+ return values of `useDoorTableState` remain present in the public interface; every call site compiles without modification; `tsc --noEmit` diff against baseline shows zero new TS2305/TS2307/TS2306 errors
  3. `renderCell` and `renderHeader` remain co-located in the orchestrator file (`hooks/useDoorTableState/index.tsx`) — not extracted to sub-files
  4. Every sub-file that uses React hooks carries `'use client'` as its literal first line; every barrel `index.tsx` explicitly re-exports the default export via `export { default } from './File'`
**Plans**: TBD
**UI hint**: yes

### Phase 11: Pricing Component Split
**Goal**: `PricingReportConfig.tsx` is split by extracting the complete `ProposalTab` sub-component (~354 lines of cohesive JSX) into a sibling file `components/pricing/ProposalTab.tsx`; the single consumer (`app/project/[id]/reports/pricing/page.tsx`) imports identically; verification gates pass

> **Note on flat extraction:** Phase 11 is the only Phase 7-11 split that does NOT use a sub-directory + barrel structure. Only one component is extracted (ProposalTab) — a flat sibling file is the correct, simpler approach. VER-03 applies by verifying `PricingReportConfig.tsx` still ends with `export default PricingReportConfig` (the contract with the consumer's dynamic default import).

**Depends on**: Phase 7
**Requirements**: PRICING-01, PRICING-02
**Success Criteria** (what must be TRUE):
  1. `components/pricing/ProposalTab.tsx` exists as a sibling file (NOT a sub-directory) and exports `ProposalTab` and `ProposalTabProps` as named exports; the complete proposal block (header + filters, pricing summary, doors detail table, frames detail table, hardware detail table, extra expenses, tax, remarks — all 7 inner sections) moves together; per RESEARCH §File-Level Analysis, the file lands at ~313-410 lines, an explicit exception to the general 300-line ceiling that mirrors the D-16 precedent from Phase 8 (the requirement itself names ~354 lines and forbids partial extraction)
  2. `PricingReportConfig.tsx` line count reduces from 781 to ~413-450 lines; it imports `ProposalTab` from `./ProposalTab` and renders `<ProposalTab ... />` inside the existing `{activeTab === 'proposal' && (...)}` wrapper passing all 37 props
  3. All existing consumer imports of `PricingReportConfig` compile without modification — specifically `app/project/[id]/reports/pricing/page.tsx:15` (`dynamic(() => import('@/components/pricing/PricingReportConfig'))`) is unchanged; `tsc --noEmit` diff shows zero new TS2305/TS2307/TS2306 errors
  4. Both `PricingReportConfig.tsx` and `ProposalTab.tsx` have `'use client'` as their literal first line (VER-02); `PricingReportConfig.tsx` still ends with `export default PricingReportConfig` and `ProposalTab.tsx` has no default export — only named exports (VER-03 satisfied per RESEARCH §Pattern 3)
**Plans**: 2 plans
Plans:
- [x] 11-01-PLAN.md — Create components/pricing/ProposalTab.tsx with full props interface and verbatim JSX body (Wave 1)
- [x] 11-02-PLAN.md — Wire PricingReportConfig.tsx to consume <ProposalTab/>, run VER-01/02/03 gates (Wave 2)
**UI hint**: yes

### v3.0 Performance Optimization (Phase 12+)

- [x] **Phase 12: Re-render & Fetch Audit** — Audit and eliminate unnecessary React re-renders, redundant Supabase API calls, and duplicate data fetches across the application (completed 2013-05-15)
- [ ] **Phase 13: Implement Caching** — Introduce a Redis caching layer for the 3 core data sources so all downstream derived/merged data is served from cache on repeat fetches

### Phase 12: Re-render & Fetch Audit
**Goal**: Unnecessary React re-renders, redundant Supabase API calls, and duplicate data fetches are identified and eliminated across the application — resulting in a measurably snappier application with lower Supabase read usage
**Depends on**: Nothing (standalone performance audit phase)
**Requirements**: PERF-01, PERF-02, PERF-03
**Success Criteria** (what must be TRUE):
  1. No component re-renders more than once for a single user action that affects only its own state; `useMemo`/`useCallback` wrap all stable values and callbacks passed as props to child components on data-heavy pages (DoorScheduleManager, HardwareSetsManager, PricingReportConfig)
  2. No `useEffect` hook triggers a Supabase fetch with an overly-broad or missing dependency array; data shared across sibling components is fetched once at the top level and passed down — no sibling independently fetches the same data on mount
  3. Write operations (create/update/delete) update local state directly without triggering a full dataset re-fetch; UI-only state changes (tab switches, filter toggles, modal open/close) do not cause Supabase read calls
**Plans**: 3 plans
Plans:
- [x] 12-01-PLAN.md — ProjectContext optimization: useCallback on all 8 action callbacks, useMemo on Provider value, optimistic addProject/restoreProjectFn (Wave 1)
- [x] 12-02-PLAN.md — ProjectView callback stabilization: useMemo on hardwareActiveTask/doorActiveTask, useCallback on cancel handlers, elevation handlers, formatElapsed (Wave 1)
- [ ] 12-03-PLAN.md — Pricing page useEffect dep fix + 12-VERIFICATION.md gate + human smoke test (Wave 2)
**UI hint**: yes

### Phase 13: Implement Caching
**Goal**: A Redis caching layer is added at each of the 3 core data-source fetch points (door schedule, master hardware, projects list) so all downstream derived/merged data is served from cache on repeat fetches — pages that previously had a loading delay render data noticeably faster on repeat visits, and cache is always consistent (invalidated on every write)
**Depends on**: Phase 12 (stable fetch and re-render baseline before adding caching)
**Requirements**: CACHE-01, CACHE-02, CACHE-03, CACHE-04, CACHE-05
**Success Criteria** (what must be TRUE):
  1. Each of the 3 core data-source API routes serves data from Redis cache on cache hit; on miss it fetches from Supabase, populates cache with appropriate TTL, then returns
  2. Every write operation (create/update/delete) for a given source correctly invalidates the relevant cache key(s) before returning — no stale data is ever served after a write
  3. Cache keys are namespaced per data source (e.g. `door-schedule:{projectId}`, `master-hardware:all`, `projects:all`) with no collisions
  4. Redis client is initialized and used exclusively in API route handlers — never imported or called from client-side code
  5. Application behaviour is identical to pre-cache: no functional regressions in auth flows, data access, or export functionality
**Plans**: 4 plans
Plans:
- [x] 13-01-PLAN.md — Install @upstash/redis, document env vars, create lib/cache/redis.ts singleton (Wave 1)
- [x] 13-02-PLAN.md — Create the 3 cache-aside wrappers (doorSchedule, masterHardware, projects) in lib/cache/ (Wave 2)
- [x] 13-03-PLAN.md — Wire 5 API routes: GET cache reads + 9 write-path invalidations (POST/PUT/DELETE/PATCH) (Wave 3)
- [ ] 13-04-PLAN.md — Verification gate: automated structural checks + 13-VERIFICATION.md + human smoke test checkpoint (Wave 4)
**UI hint**: no
