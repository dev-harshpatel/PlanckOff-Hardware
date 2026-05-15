---
phase: 04-implement-real-time-ui-updates-via-supabase-realtime
plan: "06"
subsystem: realtime-pricing-projects
tags: [realtime, pricing, projects, dedup, callback-registration]
dependency_graph:
  requires: ["04-02", "04-03", "04-04"]
  provides: ["RT-01", "RT-02", "RT-05"]
  affects:
    - contexts/ProjectContext.tsx
    - hooks/useProjectData.ts
    - hooks/usePricingProposal.ts
    - components/pricing/PricingReportConfig.tsx
    - app/project/[id]/reports/pricing/page.tsx
tech_stack:
  added: []
  patterns:
    - ref-setter pattern for stable Realtime callbacks without re-subscription
    - trampoline callbacks in useProjectData for pricing tables
    - snake_case to camelCase inline transform mirroring server-side toProject()
key_files:
  created: []
  modified:
    - contexts/ProjectContext.tsx
    - hooks/useProjectData.ts
    - hooks/usePricingProposal.ts
    - components/pricing/PricingReportConfig.tsx
    - app/project/[id]/reports/pricing/page.tsx
decisions:
  - "projectRowToProject kept inline in ProjectContext — NOT imported from lib/db/projects.ts (server-only admin client)"
  - "Pricing callbacks use ref-setter pattern (no re-subscription on mount/unmount)"
  - "Pricing page wires useProjectData for Realtime without replacing its own data loading"
  - "markPendingWrite for projects uses updatedAt from json.data with Date/string runtime guard"
metrics:
  duration: "~30 min"
  completed_date: "2026-05-10"
  tasks: 4
  files: 5
---

# Phase 4 Plan 6: Wire Realtime Patching for project_pricing_items, project_pricing_proposal, and projects

**One-liner:** Ref-setter callback wiring for pricing items, pricing proposal, and project metadata Realtime patches with dedup self-event suppression via markPendingWrite/isOwnWrite.

---

## What Was Built

This plan wires the remaining 3 tables of the 5-table Realtime channel:

| Table | Handler Location | Callback Path |
|---|---|---|
| `project_pricing_items` | `PricingReportConfig.tsx` | `useProjectData.setPricingItemsCallback` → ref → trampoline |
| `project_pricing_proposal` | `usePricingProposal.ts` | `useProjectData.setPricingProposalCallback` → ref → trampoline |
| `projects` | `ProjectContext.tsx` | `useProjectData` calls `useProject().updateProjectFromRealtime` directly via ref |

---

## The Full useProjectRealtime Call Site (Task 4)

```typescript
useProjectRealtime({
  projectId,
  onDoorScheduleChange:    reloadDoorSchedule,
  onHardwareFinalsChange:  reloadFromHardwareFinals,
  onPricingItemsChange:    handlePricingItemsChange,
  onPricingProposalChange: handlePricingProposalChange,
  onProjectChange:         handleProjectChange,
});
```

All 5 table callbacks are passed. `onDoorScheduleChange` and `onHardwareFinalsChange` were from Plans 04-02/prior state. The three new ones (`onPricingItemsChange`, `onPricingProposalChange`, `onProjectChange`) complete the 5-table coverage.

---

## Callback-Registration Pattern (Ref-Setter)

```
PricingReportConfig (handlePricingItemsChange)
  └── useEffect → registerPricingItemsCallback(handler)
        └── setPricingItemsCallback (from useProjectData return)
              └── pricingItemsCallbackRef.current = handler
                    └── handlePricingItemsChange (trampoline in useProjectData)
                          └── pricingItemsCallbackRef.current?.(payload)
                                └── useProjectRealtime onPricingItemsChange
```

The trampoline callbacks (`handlePricingItemsChange`, `handlePricingProposalChange`, `handleProjectChange`) are defined in `useProjectData` with `useCallback([], [])` so they are stable across renders and the Realtime channel is never re-subscribed when pricing components mount or unmount.

Registration via `useEffect` in `PricingReportConfig`:
```typescript
useEffect(() => {
  if (!registerPricingItemsCallback) return;
  registerPricingItemsCallback(handlePricingItemsChange);
  return () => { registerPricingItemsCallback(null); };
}, [registerPricingItemsCallback, handlePricingItemsChange]);
```

Cleanup on unmount sets the ref to `null` so stale callbacks don't fire.

---

## Project Domain Shape Preservation Rule

The `updateProjectFromRealtime` callback in `ProjectContext.tsx` preserves `hardwareSets`, `doors`, and `elevationTypes` from the existing entry on UPDATE events:

```typescript
return prev.map(p =>
  p.id === id
    ? {
        ...incoming,              // fresh metadata from Realtime payload
        hardwareSets:   existing.hardwareSets,   // preserved — not in payload
        doors:          existing.doors,          // preserved — not in payload
        elevationTypes: incoming.elevationTypes ?? existing.elevationTypes,
      }
    : p,
);
```

This prevents the Realtime UPDATE from stripping locally-loaded domain arrays that are not part of the `projects` table column set (they come from joined queries or separate API calls).

---

## Pricing Page Wiring (5th Modified File)

The plan's output spec noted that the executor must locate the component that renders `<PricingReportConfig>` alongside `useProjectData` and wire the callback props.

**Finding:** `PricingReportConfig` is rendered ONLY from `app/project/[id]/reports/pricing/page.tsx`. This page did NOT previously use `useProjectData`.

**Solution:** Modified `app/project/[id]/reports/pricing/page.tsx` to:
1. Import and call `useProjectData` (for Realtime channel subscription + setter functions)
2. Provide a noop `saveToFinalJsonRef` (the pricing page does not persist hardware data)
3. Pass `registerPricingItemsCallback={setPricingItemsCallback}` and `registerPricingProposalCallback={setPricingProposalCallback}` to `<PricingReportConfig>`

The page's existing data-loading `useEffect` (fetch + `setDoors`/`setHardwareSets`) is preserved unchanged. The `useProjectData` hook now runs alongside it — its hardware state is unused by this page; only the Realtime callbacks are consumed.

**File modified:** `app/project/[id]/reports/pricing/page.tsx`

---

## Own-Write Dedup Paths

| Table | markPendingWrite caller | isOwnWrite checker |
|---|---|---|
| `projects` | `updateProject()` in ProjectContext.tsx after PUT | `updateProjectFromRealtime()` |
| `project_pricing_items` | `handlePriceChange()` debounce after PUT | `handlePricingItemsChange()` |
| `project_pricing_proposal` | `saveProposalSettings()` debounce after PUT | `handlePricingProposalChange()` |

---

## Deviations from Plan

### markPendingWrite cast in ProjectContext

**Found during:** Task 1 TypeScript check
**Issue:** `json.data` is typed as `Project`, and `Project.updatedAt` is `Date`, not `string`. The plan snippet used `(json.data as { updatedAt?: string })` which would result in calling `markPendingWrite` with a `Date` object string representation.
**Fix:** Used runtime check: `rawUpdatedAt instanceof Date ? rawUpdatedAt.toISOString() : typeof rawUpdatedAt === 'string' ? rawUpdatedAt : undefined`.
**Rule:** Rule 1 (type correctness — using Date directly without conversion would produce wrong key format).

---

## Known Stubs

None. All callbacks are fully wired end-to-end. The pricing page's own data-loading is preserved and the Realtime callbacks supplement it with in-memory patches.

---

## Self-Check: PASSED

**Files created/modified:**
- `contexts/ProjectContext.tsx` — FOUND (contains `updateProjectFromRealtime`, `projectRowToProject`, `markPendingWrite`)
- `components/pricing/PricingReportConfig.tsx` — FOUND (contains `handlePricingItemsChange`, `registerPricingItemsCallback`, `markPendingWrite`)
- `hooks/usePricingProposal.ts` — FOUND (contains `handlePricingProposalChange`, `markPendingWrite`)
- `hooks/useProjectData.ts` — FOUND (contains `setPricingItemsCallback`, `setPricingProposalCallback`, `handleProjectChange`)
- `app/project/[id]/reports/pricing/page.tsx` — FOUND (registers callbacks via props)

**Commits:**
- `d716a33` — feat(04-06): add updateProjectFromRealtime and projectRowToProject to ProjectContext
- `8b8ea7c` — feat(04-06): add handlePricingItemsChange, markPendingWrite, and callback registration to PricingReportConfig
- `11dfa8e` — feat(04-06): add handlePricingProposalChange and markPendingWrite to usePricingProposal
- `9cf786b` — feat(04-06): thread pricing and project callbacks through useProjectData
- `08fd56f` — feat(04-06): wire Realtime callback props to PricingReportConfig in pricing page

**TypeScript:** `npx tsc --noEmit` — no errors in any of the 5 target files. Pre-existing errors in unrelated files (ElectrificationEditor, RevisionHistory, etc.) unchanged.
