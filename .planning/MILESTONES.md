# Milestones

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
