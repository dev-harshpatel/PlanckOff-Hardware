# Retrospective

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
