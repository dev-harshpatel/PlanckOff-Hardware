# Retrospective

---

## Milestone: v3.0 — Performance Optimization

**Shipped:** 2026-05-17
**Phases:** 2 (12-13) | **Plans:** 6 active | **Timeline:** 1 day (2026-05-15)

### What Was Built

1. `ProjectContext.tsx` — all 8 action callbacks in `useCallback`; Provider value in `useMemo`; `addProject`/`restoreProjectFn` made optimistic
2. `ProjectView.tsx` — `useMemo` on derived task values; `useCallback` on 6 prop callbacks passed to child managers
3. Pricing page `useEffect` dep array fixed (`[id, addToast]`)
4. Three `unstable_cache` wrappers (`lib/cache/`) with `revalidateTag` invalidation on all 9 write paths
5. `@upstash/redis` removed — zero external cache deps; `next/cache` is server-only and requires no env vars

### What Worked

- **unstable_cache pivot** was the right call — scrapping 4 Upstash Redis plans mid-phase and starting fresh with `unstable_cache` (Plans 13-01 through 13-04 superseded by 13-05) saved significant infra complexity. Zero env vars, zero external deps, enforced server-only by Next.js.
- **Human smoke test gate** at the end of both phases gave real confidence — functional cache hit/miss verification can't be automated with greps alone.
- **1-day execution** — both phases ran cleanly; performance changes are surgical and don't introduce debugging cycles.

### What Was Inefficient

- **MILESTONES.md CLI extraction noise (again)** — same problem as v2.0: SUMMARY.md files don't have `one_liner` frontmatter filled, so the CLI outputs "One-liner:" headers verbatim. Required manual cleanup for the second time. The `one_liner` field in SUMMARY.md frontmatter must be filled at plan completion time.
- **Plans 13-01 through 13-04 superseded mid-phase** — the initial Redis approach required 4 plans before being replaced. Upfront research into `unstable_cache` availability in Next.js 15 would have avoided this. Research phase should explicitly check whether a native solution exists before recommending an external dependency.
- **REQUIREMENTS.md deleted too early** — the v2.0 archival deleted REQUIREMENTS.md which also contained v3.0 requirements. The v3.0 archive (this milestone) required reconstructing requirements from memory. Requirements for the active next milestone should not be stored in the same REQUIREMENTS.md as the milestone being archived.

### Patterns Established

- **`unstable_cache` + `revalidateTag` pattern:** module-level `const getCached* = unstable_cache(fetchFn, keyParts, { revalidate, tags })` for reads; synchronous `revalidateTag(tag)` before returning from write routes.
- **Pitfall 1 guard:** `projectId` must be a function argument to `getCachedDoorSchedule`, NOT in `keyParts` — otherwise all projects share the same cache entry.
- **Optimistic local state pattern:** `setProjects(prev => [...prev, json.data!])` for appends; Realtime INSERT echo handler short-circuits when item already present.

### Key Lessons

1. The `one_liner` frontmatter in SUMMARY.md is used by the CLI to populate MILESTONES.md — fill it at plan completion or the milestone archival requires manual cleanup.
2. Research phases should check for native framework solutions before proposing external packages. `unstable_cache` was available in Next.js 15 all along; Upstash was unnecessary.
3. Active next-milestone requirements should not share a REQUIREMENTS.md file with the milestone being archived — they'll get deleted too.

### Cost Observations

- Model: balanced profile (Sonnet 4.6)
- Timeline: 1 day (2026-05-15)
- Notable: Phase 13 required a mid-phase pivot (Upstash → unstable_cache) — sunk cost on 4 superseded plans

---

## Milestone: v2.0 — File Modularization

**Shipped:** 2026-05-17
**Phases:** 5 (7-11) | **Plans:** 14 | **Commits:** ~30 | **Timeline:** 2 days

### What Was Built

1. Pre-split cleanup — dead code deleted, export config interfaces extracted to `types/`, tsc baseline snapshot established
2. `DoorScheduleConfig.tsx` (996 lines) → 4-file sub-directory (barrel + 2 sub-components + download hook)
3. `HardwareSetConfig.tsx` (780 lines) → 4-file sub-directory (barrel + table + constants + helpers)
4. `excelExportService.ts` (709 lines) → 3-domain sub-directory with named-export barrel
5. `useDoorTableState.tsx` (883 lines) → 6-file orchestrator sub-directory; all 68 return values preserved
6. `PricingReportConfig.tsx` (781 lines) → 469 lines; `ProposalTab.tsx` extracted as purely presentational sibling

### What Worked

- **tsc diff baseline pattern** worked cleanly as the regression gate — running `tsc --noEmit` before any split, capturing 142-line output, then diffing post-split output to confirm zero new errors. Simple and reliable.
- **VER-01/02/03 as named gates** applied consistently across all 5 phases gave a uniform verification checklist. No phase shipped without explicitly checking all three gates.
- **Component-as-barrel (D-14) pattern** worked well for component splits — index.tsx holds the main component and serves as the barrel, avoiding a trivial empty wrapper.
- **D-16 cohesion exception** was the right call for multiSheetWorkbook (334 ln), useDoorScheduleDownload (437 ln), and ProposalTab (474 ln) — forced clarity over the alternative of splitting cohesive logic into multiple files.
- **2-day execution** — the structural nature of the work (no behavior changes) made it fast; phases ran without debugging cycles.

### What Was Inefficient

- **MILESTONES.md CLI extraction noise** — the `gsd-tools milestone complete` CLI extracted "One-liner:", "Found during:" fragments where SUMMARY.md files had those as section headers rather than filled values. Required manual cleanup. SUMMARY.md files should use `one_liner` frontmatter field, not a `One-liner:` section header.
- **Roadmap date typos (2013 vs 2026)** — ROADMAP.md had wrong years on several completed dates. Small but needed fixing during archival.
- **Phase 12-03 and 13-07 checkboxes not ticked in ROADMAP** despite having SUMMARY.md files — execution completed but the ROADMAP checkboxes were never updated. The ROADMAP is the source of truth for plan status; plans should tick their checkbox in the ROADMAP at completion.

### Patterns Established

- **Sub-directory + barrel split pattern**: directory-index resolution; barrel owns `export { default }` explicitly (not covered by `export *`); `'use client'` only in sub-files that use browser APIs.
- **`export type { X } from` + separate `import type { X }`** in component files that previously owned shared interfaces — re-export covers callers, import type needed separately for in-file scope.
- **VER-01/02/03 gate names** are now established vocabulary — any future split phase should declare which gates apply and verify each one.
- **D-16 cohesion exception** naming and justification pattern — state the reason a file legitimately exceeds 300 lines, name the exception.

### Key Lessons

1. SUMMARY.md `one_liner` frontmatter must be filled — the CLI uses it directly; an unfilled field creates noise in MILESTONES.md.
2. Tick ROADMAP checkboxes at plan execution time, not at milestone close — the unchecked 12-03 and 13-07 plans created confusion about v3.0 completion state.
3. Structural refactors (zero behavior change) are fast to execute but require a reliable regression gate (tsc diff) — invest in the baseline before touching any file.

### Cost Observations

- Model: balanced profile (Sonnet 4.6 execution)
- Timeline: 2 days (2026-05-13 → 2026-05-14)
- Notable: No debugging cycles — structural refactors with tsc as the gate meant each plan either compiled or didn't; no runtime failures

---

## Milestone: v1.0 — Export Polish MVP

**Shipped:** 2026-05-13
**Phases:** 6 | **Plans:** 29 | **Commits:** 69 | **Timeline:** 7 days

### What Was Built

1. `services/pdfTheme.ts` — unified visual template (header, footer, alternating rows, pagination) for all PDF exports
2. `constants/errors/` — 36 named error entries across 5 domain files; `<ErrorDisplay>` and `<ErrorBoundary>` wired
3. Level-wise pricing filter — buildingLocation aliases, per-door re-grouping, qty-based count badges; PRF-01..08 PASS
4. 5-table Supabase Realtime subscription — dedup set, reconnect, optimistic write hook; 20/20 automated checks PASS
5. Pricing page data source fix — finalJson → transformFromFinalJson path closes PRF-03 integration gap
6. Error wiring — export try/catch + EXPORT_FAILED toast; subscription SUBSCRIPTION_FAILED toast; SAVE_FAILED toast

### What Worked

- **Gap-closure milestone pattern:** The audit identified that Phase 3 was unexecuted and Phases 5/6 were created specifically to close those gaps. This worked cleanly — named gap phases are easier to reason about than patching original phases.
- **Yolo mode** kept execution fast — no interactive gates for scope that was clearly understood.
- **Pre-flight grep before planning** surfaced that Bugs A/B/C were already committed, dramatically reducing Phase 5 scope vs. what Phase 3 had planned.
- **Required `addToast` parameter pattern** (vs. optional) prevented silent failures at future call sites — a good default for hooks with error surfaces.

### What Was Inefficient

- **Phase 3 was planned but never executed before the audit.** The original 6-plan Phase 3 roadmap was never run; Phase 5 was a narrower re-do. The dual tracking (Phase 3 plans + Phase 5 plans) added confusion. Better to remove Phase 3 from the roadmap or mark it void before running Phase 5.
- **Manual RT tests deferred.** Phase 4 completed automated checks but 10 manual tests (M1-M10) remain deferred pending Supabase access. These RT requirements show as partial at close. This should have been a clear pre-close condition to communicate.
- **MILESTONES.md accomplishments extracted with noise** — several SUMMARY.md files lacked `one_liner` frontmatter so the CLI output "One-liner:" placeholders. Summary files should always have `one_liner` filled.

### Patterns Established

- `pdfTheme.ts` single-source-of-truth pattern: all PDF services call `buildAutoTableOptions()` and `drawPageHeader()` — never override rowPageBreak or repeatHeaders.
- Error registry pattern: `as const satisfies Record<string, AppError>` in domain files; import via ERRORS namespace from index.ts.
- Realtime dedup: module-level `Set<string>` in `lib/realtime/dedupSet.ts`; `markPendingWrite` called before write, `isOwnWrite` checked in event handler.
- Gap-closure phases: when an audit identifies unexecuted phases, create new numbered gap phases (5, 6) rather than re-running original plans — keeps history clean.

### Key Lessons

- Before planning gap-closure phases, always grep the codebase first — uncommitted or partially committed changes from abandoned plans may already cover some planned work.
- RT manual verification should be a gate before milestone close, not a deferred item. If environment access is unavailable, note it in the milestone as a known open item with a clear resume condition.
- `one_liner` in SUMMARY.md frontmatter is worth filling — it surfaces directly in MILESTONES.md and is the artifact used for automated extraction.

### Cost Observations

- Model: balanced profile (mix of Sonnet 4.6 for execution, agents for research/planning)
- Sessions: ~8-10 sessions across 7 days
- Notable: Gap-closure phases (5 and 6) were very efficient — narrow scope, pre-grounded by audit findings

---

## Cross-Milestone Trends

| Milestone | Phases | Plans | Days | Commits | Key Gap |
|-----------|--------|-------|------|---------|---------|
| v1.0 Export Polish MVP | 6 | 29 | 7 | 69 | Phase 3 never executed pre-audit; RT manual tests deferred |
| v2.0 File Modularization | 5 | 14 | 2 | ~30 | ROADMAP checkboxes not ticked for 12-03/13-07 at execution time |
| v3.0 Performance Optimization | 2 | 6 | 1 | ~15 | Plans 13-01..13-04 superseded mid-phase (Upstash → unstable_cache pivot) |
