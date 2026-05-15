# PlanckOff Hardware

## What This Is

PlanckOff is a hardware estimating and specification platform for construction projects. It allows estimators and project managers to manage door schedules, hardware sets, and pricing, then export professional reports (PDF, Excel) for clients and submittal packages.

## Core Value

Accurate, professionally formatted hardware specifications and exports that match exactly what the user sees in the application.

## Current Milestone: v2.0 File Modularization

**Goal:** Split all source files over 750 lines into smaller, focused modules with zero behavior change — pure structural refactor.

**Target features:**
- ✓ Split `components/doorSchedule/DoorScheduleConfig.tsx` (996 lines) into focused sub-modules — Validated in Phase 08
- ✓ Split `components/hardware/HardwareSetConfig.tsx` (853 lines) into focused sub-modules — Validated in Phase 08
- ✓ Split `services/excelExportService.ts` (709 lines) into domain-scoped export sections — Validated in Phase 09
- ✓ Split `hooks/useDoorTableState.tsx` (883 lines) into logical state slices — Validated in Phase 10
- ✓ Split `components/pricing/PricingReportConfig.tsx` (781 lines) into focused sub-modules — Validated in Phase 11
- Safety-check every split before executing: no circular imports, all consumer imports preserved, logic identical post-split

---

## Current State (Phase 12 complete — re-render & fetch audit — 2026-05-15)

Shipped v1.0 with 6 phases across export polish, error handling, pricing filter fixes, and real-time updates. ~69 commits over 7 days.

**Tech stack:** Next.js 15 App Router, React 19, TypeScript, Supabase, Tailwind CSS, jsPDF, ExcelJS  
**Export services:** Client-side browser modules in `services/` (pdfTheme.ts shared theme, doorSchedulePdfService.ts, hardwarePdfService.ts, etc.)  
**Error handling:** `constants/errors/` (6 domain files, 36+ named entries), `<ErrorDisplay>` component, `<ErrorBoundary>` in layout  
**Real-time:** 5-table Supabase Realtime subscription in `hooks/useProjectRealtime.ts`; dedup set in `lib/realtime/dedupSet.ts`; optimistic writes via `hooks/useOptimisticDoorWrite.ts`

**Known outstanding items:**
- RT-01/RT-02/RT-04/RT-05/RT-06 manual tests deferred (multi-tab, reconnect) — pending Supabase environment access
- `useOptimisticDoorWrite` hook exists but has no call-site adoption yet

## Requirements

### Validated

- ✓ Door schedule management — existing
- ✓ Hardware set management — existing
- ✓ Pricing management — existing
- ✓ PDF export for door schedule, hardware sets, pricing, submittal packages — existing
- ✓ Excel/CSV export — existing
- ✓ Project management (create, view, manage) — existing
- ✓ Team management and role-based access (Administrator, Team Lead, Estimator) — existing
- ✓ Supabase-backed database with real-time updates — existing
- ✓ AI-assisted hardware generation (Google Gemini) — existing
- ✓ Consistent PDF visual template across all export types — v1.0 (services/pdfTheme.ts)
- ✓ Branded PDF header/footer (logo, project name, export date, page numbers) — v1.0
- ✓ PDF tables with alternating row shading, repeated column headers, no row cutoffs — v1.0
- ✓ Excel exports with styled headers, sensible column widths, frozen header row — v1.0
- ✓ Sequential data ordering in exports matching UI display order exactly — v1.0
- ✓ Typed error registry (constants/errors/) — all user-facing errors centralized — v1.0
- ✓ `<ErrorDisplay>` component and `<ErrorBoundary>` wired — v1.0
- ✓ Level-wise pricing report filtering — correct rows, qty-based count badges — v1.0
- ✓ Export respects active filter — visibleDoors/visibleFrames passed to export — v1.0
- ✓ buildingLocation propagation — xlsxParser aliases + hardwareTransformers fallback — v1.0
- ✓ Pricing page loads doors from finalJson (not raw transformDoors output) — v1.0
- ✓ Export error handling — try/catch on all export paths, PDF_ERRORS.EXPORT_FAILED toast — v1.0
- ✓ Realtime subscription error feedback — user-visible toast on channel failure — v1.0
- ✓ Save failure feedback — GENERAL_ERRORS.SAVE_FAILED toast in useProjectPersistence — v1.0
- ✓ 5-table Supabase Realtime subscription (doors, hardware sets, pricing items, pricing proposal, projects) — v1.0
- ✓ Self-event dedup — own writes don't trigger redundant re-renders — v1.0
- ✓ Optimistic write rollback hook (useOptimisticDoorWrite) — v1.0

### Active

- [ ] Multi-tab real-time sync verified end-to-end (manual tests RT-01/RT-02/RT-04/RT-05/RT-06 deferred pending Supabase access)
- [ ] useOptimisticDoorWrite adopted at call sites (hook exists, no components use it yet)
- ✓ Dead code cleanup: `exportDoorScheduleToPDF` deleted from `services/excelExportService.ts` (709 lines, down from 901) — Validated in Phase 07: pre-split-cleanup
- [ ] Hardcoded Tailwind red classes in HardwareSetModal.tsx / SaveStatusIndicator.tsx — inconsistent with CSS variable token pattern
- ✓ Stable callbacks + optimistic writes in ProjectContext (useCallback/useMemo on all 8 actions, Provider value memoized) — Validated in Phase 12
- ✓ ProjectView stable prop callbacks for HardwareSetsManager/DoorScheduleManager — Validated in Phase 12
- ✓ Pricing page useEffect dep array fixed ([id, addToast]) — Validated in Phase 12
- Deferred: pricing page double-fetch (subscribeOnly hook option), ProjectContext structural split, React.memo on DoorTableRow — documented in 12-VERIFICATION.md

### Out of Scope

- Authentication overhaul — separate concern
- New export types beyond existing (door schedule, hardware sets, pricing, submittal) — v2
- Real-time collaboration on exports — v2
- Server-side PDF rendering — v2
- User-configurable branding (custom logo, colors) — v2
- Export history / audit log — v2

## Context

- Next.js 15 App Router, React 19, TypeScript, Supabase, Tailwind CSS
- PDF generation: custom services in `services/` using jsPDF + jspdf-autotable; shared theme in `services/pdfTheme.ts`
- Excel generation: `exceljs` + `xlsx-js-style` packages
- Export services are client-side browser modules imported by view components
- `views/ProjectView.tsx` — 531 lines (refactored from earlier 2100-line version)

## Constraints

- **Tech Stack**: Next.js 15 + TypeScript — no new framework additions
- **Client-side**: Export services run in the browser, not server-side
- **Existing services**: Refactor in place, do not introduce new export pipelines

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep client-side PDF/Excel generation | Existing architecture; avoids server-side complexity | ✓ Good — works well, SSR-safe theme module |
| Single shared PDF theme module (pdfTheme.ts) | Ensures visual consistency across all export types | ✓ Good — single file controls all PDF appearance |
| Two-pass page numbering (didDrawPage + addPageNumbers) | Avoids Page 1 of 1 bug on multi-page PDFs | ✓ Good |
| Logo embedded as base64 PNG placeholder | Avoids async fetch and cross-browser SVG issues | ✓ Good |
| `as const satisfies Record<string, AppError>` for error registry | Full literal inference + type-checking in one expression | ✓ Good — TypeScript 5.8.2 supports satisfies |
| ErrorDisplay accepts AppError or string | Migration-period compatibility with existing string-based error state | ✓ Good — smooth migration |
| Single Realtime channel per project (not per-table) | Matches existing pattern; fewer connections | ✓ Good |
| dedupSet.ts in lib/realtime/ (not inlined) | Safe import from both server (API routes) and client (hooks) | ✓ Good |
| Set<string> + setTimeout for dedup pruning | Simpler than Map<key,timestamp> — no timestamp storage needed | ✓ Good |
| wasClosedRef flag for reconnect detection | Simpler than debounce/timestamp tracking | ✓ Good |
| Pricing page door source: transformFromFinalJson when finalData exists | User edits stored in finalJson not scheduleJson — authoritative source | ✓ Good |
| addToast required (not optional) on UsePricingExportParams | Single caller always provides it; prevents hiding bugs | ✓ Good |
| onError optional on UseProjectRealtimeOptions | Keeps hook general-purpose; toast wiring lives in callers | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-15 — v2.0 File Modularization milestone complete (Phase 11)*
