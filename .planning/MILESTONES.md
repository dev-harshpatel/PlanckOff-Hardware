# Milestones

## v3.0 Performance Optimization (Shipped: 2026-05-17)

**Phases completed:** 2 phases (12-13), 6 active plans
**Timeline:** 2026-05-15 (1 day)

**Key accomplishments:**

1. `ProjectContext.tsx`: all 8 action callbacks stabilized with `useCallback`; Provider value memoized with `useMemo` — stops 6 consumer re-renders on unrelated internal state changes (PERF-01)
2. `addProject`/`restoreProjectFn` made optimistic — eliminates GET /api/projects re-fetch after every project create/restore (PERF-03)
3. `ProjectView.tsx`: `useMemo` on `hardwareActiveTask`/`doorActiveTask`; `useCallback` on 6 prop callbacks — stops `HardwareSetsManager`/`DoorScheduleManager` from re-rendering on unrelated parent state
4. Pricing page `useEffect` dep array fixed (`[id, addToast]`) — closes PERF-02 concrete gap; double-fetch via `subscribeOnly` accepted as tech debt
5. Three `unstable_cache` wrappers (projects/300s, masterHardware/3600s, doorSchedule/1800s) with 9 `revalidateTag` write-path invalidations — CACHE-01/02/03 all PASS
6. `@upstash/redis` removed — zero external cache deps; app loads fail-open with no `UPSTASH_*` env vars (CACHE-04/05 PASS; human smoke test approved)

### Known Gaps (accepted as tech debt)

- **PERF-02 partial:** pricing page double-fetch (subscribeOnly hook option), cross-page data sharing via shared hook, `React.memo` on `DoorTableRow` — documented in `12-VERIFICATION.md`

---

## v2.0 File Modularization (Shipped: 2026-05-17)

**Phases completed:** 5 phases (7-11), 14 plans
**Timeline:** 2026-05-13 → 2026-05-14 (2 days)

**Key accomplishments:**

1. Pre-split cleanup — dead `exportDoorScheduleToPDF` (190 lines) deleted; `DoorScheduleExportConfig` and `HardwareSetExportConfig` extracted to `types/`; tsc baseline snapshot saved for zero-regression diffing
2. `DoorScheduleConfig.tsx` (996 lines) split into 4-file sub-directory: barrel index.tsx, ColumnAccordion.tsx, GroupedTable.tsx, useDoorScheduleDownload.tsx hook (D-16 exception at 437 lines)
3. `HardwareSetConfig.tsx` (780 lines) split into 4-file sub-directory: barrel index.tsx, HardwareGroupTable.tsx, hardwareConstants.ts, hardwareHelpers.ts
4. `excelExportService.ts` (709 lines) split into 3-domain sub-directory with named-export barrel: doorScheduleExcel.ts (186 lines), hardwareSetExcel.ts (193 lines), multiSheetWorkbook.ts (334 lines, D-16)
5. `useDoorTableState.tsx` (883 lines) split into 6-file sub-directory: orchestrator index.tsx, columnDefinitions, filterState, columnVisibility, rowSelection, cellEditState — all 68 return values preserved
6. `PricingReportConfig.tsx` (781 lines) reduced to 469 lines by extracting `ProposalTab.tsx` (474 lines, D-16) as purely presentational sibling component with 37 props
7. VER-01/02/03 PASS across all 5 split phases — zero new tsc errors, correct `'use client'` directives, explicit default exports in all barrels

---

## v1.0 Export Polish MVP (Shipped: 2026-05-13)

**Phases completed:** 6 phases, 29 plans
**Timeline:** 2026-05-07 → 2026-05-13 (7 days)
**Git:** 69 commits, 187 files changed (+21,524 / -16,474 lines)

**Key accomplishments:**

1. Created unified `services/pdfTheme.ts` — consistent visual template (fonts, header/footer, alternating rows, pagination) across all PDF export types
2. Built typed error registry (`constants/errors/`) — 36 named entries across 5 domain files; `<ErrorDisplay>` component and `ErrorBoundary` wired across all error surfaces
3. Fixed level-wise pricing filter — buildingLocation aliases in xlsxParser, per-door re-grouping in filterDoorGroups, qty-based count badges (g.totalQty), export receives visibleDoors/visibleFrames; PRF-01..08 all verified PASS against Mixed Use Kamloops
4. Implemented 5-table Supabase Realtime subscription — instant UI updates via postgres_changes, dedup set with 5s prune, reconnect reload, optimistic door write with rollback (20/20 automated checks PASS)
5. Fixed pricing page data source — loads doors from `transformFromFinalJson(finalData).doors` (not raw `transformDoors`) so user-edited buildingLocation/buildingTag is visible to level filter
6. Wired export & realtime error handling — try/catch on all three export handlers, `PDF_ERRORS.EXPORT_FAILED` toast; `REALTIME_ERRORS.RT_SUBSCRIPTION_FAILED` toast; `GENERAL_ERRORS.SAVE_FAILED` toast on persistence failures; pricing page load-error uses registry

### Known Gaps (accepted as tech debt)

- **RT-01, RT-02, RT-04, RT-05, RT-06** — multi-tab and reconnect manual verification deferred pending Supabase environment access. Structural wiring is complete (20/20 automated PASS). See `.planning/milestones/v1.0-phases/04-implement-real-time-ui-updates-via-supabase-realtime/04-08-VERIFICATION.md` for full checkpoint.
- **ERR-01, ERR-05, ERR-07** — satisfied per audit but REQUIREMENTS.md traceability table shows "Planned" (documentation gap, not a functionality gap).

---
