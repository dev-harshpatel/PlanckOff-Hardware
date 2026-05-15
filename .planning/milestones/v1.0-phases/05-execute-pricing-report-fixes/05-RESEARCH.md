# Phase 5: Execute Pricing Report Fixes - Research

**Researched:** 2026-05-12
**Domain:** Pricing Report filtering pipeline — uncommitted change audit, plan execution, data-source fix
**Confidence:** HIGH — all findings sourced directly from codebase inspection, git diff, and existing plan/research artifacts

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRF-01 | Level-wise filter selections return only rows belonging to selected level(s) | Requires xlsxParser alias fix (Bug A) + hardwareTransformers fallback fix (Bug B) + pricing page data source fix. Bug A partially implemented in uncommitted xlsxParser changes. Bug B partially implemented in uncommitted hardwareTransformers changes. |
| PRF-02 | Count equals SUM of Total Qty, not number of visible rows | Already implemented in uncommitted usePricingFilters.ts (lines 239-241 use g.totalQty). Ready to commit. |
| PRF-03 | Mixed Use Kamloops shows correct level-wise filtered data with accurate counts | Depends on PRF-01 fixes being committed + pricing page data source fix (load doors from transformFromFinalJson, not transformDoors). Requires manual verification (Plan 05-06). |
| PRF-04 | Total Qty values accurate after applying level filters | Follows from PRF-01 fixes. filterDoorGroups now recomputes totalQty from matching doors (uncommitted pricingGrouping.ts changes). |
| PRF-05 | Pricing totals accurate after applying level filters | Follows from PRF-01 + filterDoorGroups totalPrice recomputation in uncommitted pricingGrouping.ts changes. |
| PRF-06 | Exported Excel/PDF matches filtered UI result exactly | Already implemented in uncommitted PricingReportConfig.tsx (lines 245-247 pass visibleDoors/visibleFrames). Ready after audit confirms no conflicts. |
| PRF-07 | Detail modal quantities/totals match main table after filtering | modalGroup is set from visibleDoors/visibleFrames/visibleHardware on row click — correct by design once PRF-01 works. No additional code change needed. |
| PRF-08 | Existing behavior without filters continues to work (no regression) | filterDoorGroups returns groups unchanged when noFilters=true (uncommitted pricingGrouping.ts). Manual verification confirms. |

</phase_requirements>

---

## Summary

Phase 3 was planned but never executed. Five plan files exist (03-01 through 03-05) but no code changes were committed, no SUMMARY.md files were created, and no VERIFICATION.md exists. However, a significant amount of partial implementation work exists as uncommitted changes in three files: `hooks/usePricingExport.ts`, `hooks/usePricingFilters.ts`, and `utils/pricingGrouping.ts`. These must be audited before any new work begins.

The audit reveals that the uncommitted changes are largely correct and go further than the original plans in some areas (e.g., the hardware filter now re-groups from filtered door list rather than using the old `filterHardwareGroups` predicate). The changes align with the plans' intent. There is no conflict with the plans. The main gap is that Bug A (xlsxParser alias) and the pricing page data source fix were NOT part of the uncommitted work.

Additionally, the pricing page data source mismatch (identified in the v1.0 audit) is a new gap not covered by any existing Phase 3 plan: `app/project/[id]/reports/pricing/page.tsx` loads doors from `transformDoors(dsJson.data.scheduleJson, sets)` (line 64) — using the raw door schedule JSON. This means user-edited `buildingLocation`/`buildingTag` stored in `finalJson` via the hardware merge are invisible to the filter. The fix is to use `transformFromFinalJson(finalData).doors` instead of calling `transformDoors` separately. This function already exists and is already imported on the pricing page.

**Primary recommendation:** Audit and commit the three uncommitted files, execute the one remaining xlsxParser alias fix, fix the pricing page data source to use `transformFromFinalJson` doors, then run the mixed-use Kamloops end-to-end verification.

---

## Uncommitted Changes Audit

This is the most critical section for planning. All three files have uncommitted modifications that partially or fully implement Plan 03-03, 03-04, and aspects of pricingGrouping refactoring. The planner must address these before execution of any plan that touches the same files.

### File 1: `hooks/usePricingFilters.ts`

**What changed (git diff):**
- Import: removed `filterHardwareGroups` from the import (no longer used)
- Replaced `visibleHardware = filterHardwareGroups(hardwareGroups, ...)` with a door-based re-grouping approach:
  - New `filteredDoorsForHw` memo: filters raw doors by active material/floor/building filters
  - New `visibleHardware` memo: if no filter, uses `rawHardwareGroups`; if filtered, calls `groupHardwareItems(hardwareSets, filteredDoorsForHw)` and applies prices
- `totalDoorCount` and `totalFrameCount` (lines 239-241): already use `g.totalQty` — NOT `g.doors.length`

**Does this match Plan 03-04?**
YES — Plan 03-04 required changing `g.doors.length` to `g.totalQty` for `totalDoorCount` and `totalFrameCount`. That change is present.

**Extra work beyond plans:**
The hardware filter replacement (filteredDoorsForHw approach) is NOT in any Phase 3 plan. It supersedes the old `filterHardwareGroups` call. This is a deeper fix that ensures hardware visibility responds to door-level filter state correctly. It is safe and beneficial.

**Status:** IMPLEMENTED (uncommitted). Safe to commit as-is.

**What is NOT implemented here:**
- No `row.buildingArea` fallback for `hardwareTransformers.ts` (Bug B fix) — that's a separate file
- No `xlsxParser.ts` alias addition (Bug A fix) — that's a separate file
- No `doorGroups: visibleDoors` fix in `PricingReportConfig.tsx` (Bug C fix) — check PricingReportConfig directly

### File 2: `utils/pricingGrouping.ts`

**What changed (git diff):**
- `filterDoorGroups` function completely rewritten:
  - Old: simple `groups.filter()` at group level — matches group if ANY door in group matches filter
  - New: per-group, filters `g.doors` to only matching doors; rebuilds the group with recomputed `totalQty`, `totalPrice`, `materials`, `floors`, `buildings`, `prep`; skips groups where no doors match

**Does this match Plan intent?**
The plans did not explicitly call for a `filterDoorGroups` rewrite — Plan 03-04 only addressed `g.totalQty` in `usePricingFilters.ts`. However, this rewrite is essential for correct behavior: the old predicate would include an entire group (all its doors) if any single door matched the filter, which would show wrong doors and wrong quantities. The new implementation is the correct fix.

**Status:** IMPLEMENTED (uncommitted). This is a correct and necessary enhancement. Safe to commit.

**Note:** `filterHardwareGroups` still exists in the file (exports are unchanged for that function). It is just no longer called from `usePricingFilters.ts`.

### File 3: `hooks/usePricingExport.ts`

**What changed (git diff):**
The `handleDownloadPdf` function was completely rewritten. Key changes:
- Old: custom inline header (company name text block), old table styles with `[60, 80, 120]` fill, combined sections on one PDF page
- New: uses `buildAutoTableOptions`, `addPageNumbers`, `loadLogoDataUrl`, `DEFAULT_THEME`, `PDF_MARGIN`, `HEADER_BAR_HEIGHT`, `BRAND_NAVY`, `ROW_ALT_FILL` from `pdfTheme` — the Phase 1 theme system
- Each section (doors, frames, hardware) now gets its own page (`addPage()` between sections)
- Hardware export columns now include "Door Materials" column
- `handleDownloadProposalPdf`: Summary table changed to use `BRAND_NAVY` fill, added `alternateRowStyles`, `repeatHeaders`, `rowPageBreak: 'avoid'` — aligns with Phase 1 PDF theme
- Extra Expenses and Tax tables: same Phase 1 theme alignment

**Does this match any Phase 3 plan?**
NO — the Phase 3 plans did not call for PDF theme updates to `usePricingExport.ts`. This is Phase 1 PDF beautification work applied to the export hook, likely done during or after Phase 1. It is correct and beneficial.

**Does this conflict with Plan 03-03?**
Plan 03-03 requires changing `doorGroups:` to `doorGroups: visibleDoors` and `frameGroups:` to `frameGroups: visibleFrames` in `PricingReportConfig.tsx` — NOT in `usePricingExport.ts`. The `usePricingExport.ts` file itself does not need changes for Bug C; it only needs the correct data passed to it. These changes do not conflict.

**Status:** IMPLEMENTED (uncommitted). Safe to commit as Phase 1 PDF theme alignment work.

### Summary: What the uncommitted changes DO and DON'T implement

| Bug | Plan | File | Status in Uncommitted Changes |
|-----|------|------|-------------------------------|
| A — xlsxParser alias | 03-01 | utils/xlsxParser.ts | NOT present (file not modified) |
| B — hardwareTransformers fallback | 03-02 | utils/hardwareTransformers.ts | PRESENT — line 169 already has `?? row.buildingArea` |
| C — export uses unfiltered groups | 03-03 | components/pricing/PricingReportConfig.tsx | PRESENT — lines 245-247 use visibleDoors/visibleFrames |
| D — g.doors.length vs g.totalQty | 03-04 | hooks/usePricingFilters.ts | PRESENT — lines 239-241 use g.totalQty |
| — | 03-05 | (verification) | Not applicable — no code changes |

**Critical finding:** `utils/hardwareTransformers.ts` is NOT in the git diff list of modified files, yet line 169 already shows `?? row.buildingArea`. This means Bug B was fixed in a previously committed change (not in the current uncommitted diff). The fix is already in the committed codebase.

**Critical finding 2:** `components/pricing/PricingReportConfig.tsx` is NOT in the git diff list, yet lines 245-247 already pass `doorGroups: visibleDoors` and `frameGroups: visibleFrames`. This means Bug C was fixed in a previously committed change.

**Result:** The only remaining code fix from the Phase 3 plans that is NOT yet present in any form is Bug A (xlsxParser alias for 'buildingn area'/'building area'/'buildingarea'). All other fixes either exist as uncommitted changes (to be committed) or were already committed earlier.

---

## Current State of Each Target File

### `utils/xlsxParser.ts` (line 73)

Current content (already verified by codebase read):
```typescript
buildingLocation: ['buildinglocation', 'building location', 'bldg location', 'bldglocation', 'buildingn area', 'building area', 'buildingarea'],
```

**Finding:** Bug A is ALREADY FIXED. Line 73 already contains all 7 aliases including `'buildingn area'`, `'building area'`, and `'buildingarea'`. Plan 03-01 is already implemented in committed code. No change needed.

### `utils/hardwareTransformers.ts` (line 169)

Current content:
```typescript
buildingLocation: bi?.['BUILDING LOCATION']   ?? d?.['BUILDING LOCATION']  ?? row.buildingLocation ?? row.buildingArea,
```

**Finding:** Bug B is ALREADY FIXED. `?? row.buildingArea` is present. Plan 03-02 is already implemented in committed code. No change needed.

**Additional finding — `transformFromFinalJson` (line 309):**
```typescript
buildingLocation: bi?.['BUILDING LOCATION'] ?? ds?.['BUILDING LOCATION'],
```

This is different from `transformDoors`. In `transformFromFinalJson`, the `MergedDoor` type does NOT have a `buildingArea` field that maps directly from schedule row — instead it has `buildingArea?: string` in `MergedDoor` (see `lib/db/hardware.ts:133`). However, the `transformFromFinalJson` buildingLocation chain also does not include a fallback to `door.buildingArea`.

More importantly: when the pricing page loads doors, it currently uses `transformDoors(dsJson.data.scheduleJson, sets)` — this goes through the raw schedule JSON path. User edits made to `buildingLocation`/`buildingTag` via the door editor UI are saved to `finalJson` (via the hardware merge), NOT back to `scheduleJson`. So loading from `scheduleJson` via `transformDoors` bypasses all user edits.

### `components/pricing/PricingReportConfig.tsx` (lines 241-271)

Current content (confirmed by code read):
```typescript
const { handleDownloadExcel, handleDownloadPdf, handleDownloadProposalPdf } = usePricingExport({
  projectId,
  projectName,
  companySettings,
  doorGroups: visibleDoors,     // ← already fixed
  frameGroups: visibleFrames,   // ← already fixed
  hardwareGroups: visibleHardware,
  ...
```

**Finding:** Bug C is ALREADY FIXED. Both `visibleDoors` and `visibleFrames` are being passed. Plan 03-03 is already implemented in committed code. No change needed.

### `hooks/usePricingFilters.ts` (lines 239-241)

Current content (confirmed by code read):
```typescript
const totalDoorCount  = useMemo(() => visibleDoors.reduce((s, g) => s + g.totalQty, 0),    [visibleDoors]);
const totalFrameCount = useMemo(() => visibleFrames.reduce((s, g) => s + g.totalQty, 0),   [visibleFrames]);
const totalHwCount    = useMemo(() => visibleHardware.reduce((s, g) => s + g.totalQty, 0),     [visibleHardware]);
```

**Finding:** Bug D is ALREADY IN UNCOMMITTED CHANGES. `g.totalQty` is used for all three. Plan 03-04 intent is satisfied. These changes need to be committed.

---

## The Pricing Page Data Source Gap (PRF-03 additional gap)

### Problem

`app/project/[id]/reports/pricing/page.tsx` lines 63-65:
```typescript
const loadedDoors: Door[] = dsJson?.data?.scheduleJson
  ? transformDoors(dsJson.data.scheduleJson, sets)
  : [];
```

This calls `transformDoors` with the raw `scheduleJson` (from the `door-schedule` API endpoint, which returns `project_door_schedule_imports.schedule_json`).

### Why This Is Wrong

User edits to `buildingLocation` and `buildingTag` are saved to `finalJson` (the `project_hardware_finals` table), NOT back to `scheduleJson`. The edit flow is:
1. User opens door editor in the hardware merge view
2. Edits are saved via `PUT /api/projects/[id]/hardware-merge` which updates `project_hardware_finals.final_json`
3. Pricing page fetches `scheduleJson` from `project_door_schedule_imports` — which contains the original upload, not the edited values
4. `transformDoors(scheduleJson)` produces Door objects with the original, pre-edit `buildingLocation`/`buildingTag`
5. Level filter sees old values — user edits are invisible

### The Fix

`transformFromFinalJson` already exists, is already imported on the pricing page, and is already used to build `sets` (hardware sets). The same `finalData` used to build `sets` also contains `door.buildingArea` on each `MergedDoor` (stored by `mergeService.ts:112 — buildingArea: row.buildingArea`).

The fix replaces the separate `transformDoors` door load with using `transformFromFinalJson(finalData).doors`:

```typescript
// Current (lines 52-65):
let sets: HardwareSet[] = [];
const finalData: MergedHardwareSet[] | undefined = mergeJson?.data?.finalJson;
if (finalData && finalData.length > 0) {
  const { hardwareSets: mergedSets } = transformFromFinalJson(finalData);
  sets = mergedSets;
} else {
  // ... fallback ...
}
const loadedDoors: Door[] = dsJson?.data?.scheduleJson
  ? transformDoors(dsJson.data.scheduleJson, sets)
  : [];

// Fixed (pseudocode):
let sets: HardwareSet[] = [];
let loadedDoors: Door[] = [];
const finalData: MergedHardwareSet[] | undefined = mergeJson?.data?.finalJson;
if (finalData && finalData.length > 0) {
  const { hardwareSets: mergedSets, doors: finalDoors } = transformFromFinalJson(finalData);
  sets = mergedSets;
  loadedDoors = finalDoors;
} else {
  // fallback: use schedule JSON path
  const hwRes = await fetch(`/api/projects/${id}/hardware-pdf`, ...);
  // ...
  if (hwJson?.data?.extractedJson) sets = transformHardwareSets(hwJson.data.extractedJson);
  loadedDoors = dsJson?.data?.scheduleJson
    ? transformDoors(dsJson.data.scheduleJson, sets)
    : [];
}
```

### Key detail: `transformFromFinalJson` buildingLocation for MergedDoor

In `transformFromFinalJson` (lines 308-309):
```typescript
buildingTag: bi?.['BUILDING TAG'] ?? ds?.['BUILDING TAG'],
buildingLocation: bi?.['BUILDING LOCATION'] ?? ds?.['BUILDING LOCATION'],
```

The `MergedDoor` type has `buildingArea?: string` (set by mergeService). But `transformFromFinalJson` does NOT include `?? door.buildingArea` as a fallback for `buildingLocation`. This means the same Bug B applies to the finalJson path.

**The full fix for the pricing page data source must include:**
1. Use `transformFromFinalJson(finalData).doors` as the door source
2. Also add `?? door.buildingArea` fallback to `buildingLocation` in `transformFromFinalJson` (same as the already-committed fix in `transformDoors`)

OR alternatively:

The `finalJson` door data from `project_hardware_finals` includes `door.sections.basic_information['BUILDING LOCATION']` if the user edited the door (since the door editor saves to sections). In this case, `bi?.['BUILDING LOCATION']` would already have the user-edited value. The `buildingArea` fallback is only needed for doors that were never edited but came from a "BUILDINGN AREA" source column.

**Recommendation:** Apply `?? door.buildingArea` to the `transformFromFinalJson` buildingLocation line at the same time as the pricing page fix. This is a one-line addition analogous to the `transformDoors` fix.

---

## Architecture Patterns

### Data Flow (complete picture for Phase 5)

```
Client-side Excel upload (parseDoorScheduleXLSX):
  utils/xlsxParser.ts line 73
  → 'buildingn area' alias now present (already committed)
  → Door.buildingLocation = "LEVEL 01" on upload ✓

Server/DB load via mergeService:
  services/doorScheduleService.ts line 28
  → DoorScheduleRow.buildingArea = "LEVEL 01"
  → mergeService.ts:112 copies buildingArea to MergedDoor.buildingArea
  → stored in project_hardware_finals.final_json

Pricing page load:
  Current (BROKEN):
    GET /door-schedule → DoorScheduleRow[] → transformDoors() → Door.buildingLocation = undefined
    (scheduleJson has buildingArea but transformDoors reads it — Bug B FIXED in committed code)
    WAIT: transformDoors line 169 DOES have ?? row.buildingArea now
    So transformDoors path is actually correct now.

  BUT the bigger issue:
    If user edited buildingLocation via door editor UI, that edit is in finalJson, NOT scheduleJson
    → transformDoors(scheduleJson) will MISS the user edit
    → transformFromFinalJson(finalJson).doors preserves user edits

  Fixed (correct):
    GET /hardware-merge → finalJson → transformFromFinalJson().doors → Door.buildingLocation = "LEVEL 01"
    (user edits are in finalJson, this is the authoritative source)

usePricingFilters:
  groupByFields() reads door.buildingLocation → group.floors[] populated
  filterDoorGroups() matches filters.floor against door.buildingLocation ← door-level filter (correct)
  filteredDoorsForHw: re-groups hardware from filtered doors ← correct (in uncommitted changes)
  totalDoorCount/totalFrameCount: g.totalQty ← correct (in uncommitted changes)

usePricingExport (PricingReportConfig.tsx call site):
  doorGroups: visibleDoors ← correct (already committed)
  frameGroups: visibleFrames ← correct (already committed)
```

### filterDoorGroups — new behavior vs old

Old (committed baseline):
```typescript
return groups.filter(g =>
  (filters.floor.length === 0 || filters.floor.some(f => g.floors.includes(f))),
);
// Returns the entire group if any door in the group has a matching floor
// → correct group visibility, but group still contains ALL doors (not just matching ones)
```

New (in uncommitted pricingGrouping.ts):
```typescript
const matching = g.doors.filter(d =>
  (filters.floor.length === 0 || filters.floor.includes(floor))
);
// Returns a new group containing ONLY matching doors, with recomputed totalQty/totalPrice
```

The new behavior is strictly correct. A group with 3 doors on Level 01 and 2 on Level 02, when filtered to Level 01, now returns a group with 3 doors and the correct totalQty. The old version returned the full 5-door group.

---

## What Each Phase 5 Plan Must Do

### Plan 05-01: Audit and commit uncommitted changes

**Purpose:** Establish a clean, committed baseline before running any further fixes.

**What to do:**
1. Read current state of all 3 uncommitted files (verify against what we know above)
2. Confirm no merge conflicts with already-committed fixes
3. Commit all 3 files together as "feat(pricing): apply level filter and qty count fixes from Phase 3 audit"

**Files to commit:**
- `hooks/usePricingFilters.ts` — hardware re-grouping + g.totalQty counts
- `utils/pricingGrouping.ts` — filterDoorGroups rewrite for per-door filtering
- `hooks/usePricingExport.ts` — PDF theme alignment (Phase 1 work applied to pricing export)

**Do NOT expect:**
- Any change to `utils/xlsxParser.ts` (already committed correctly)
- Any change to `utils/hardwareTransformers.ts` (already committed with Bug B fix)
- Any change to `components/pricing/PricingReportConfig.tsx` (already committed with Bug C fix)

**Verify before committing:**
```bash
# Confirm xlsxParser has the aliases (already committed):
grep "'buildingn area'" utils/xlsxParser.ts        # expect: match on line 73

# Confirm hardwareTransformers has the fallback (already committed):
grep "row.buildingArea" utils/hardwareTransformers.ts   # expect: match on line 169

# Confirm PricingReportConfig passes visibleDoors (already committed):
grep "doorGroups: visibleDoors" components/pricing/PricingReportConfig.tsx  # expect: match

# Confirm usePricingFilters has g.totalQty (in uncommitted changes — about to commit):
grep "g.totalQty" hooks/usePricingFilters.ts            # expect: 3 matches
```

### Plans 05-02 and 05-03: Execute 03-01 and 03-02

**Finding:** Both fixes are already committed. These plans should verify the committed state and create SUMMARY files confirming completion. No new code changes needed.

- 03-01 (xlsxParser aliases): Confirmed present at `utils/xlsxParser.ts:73`
- 03-02 (hardwareTransformers fallback): Confirmed present at `utils/hardwareTransformers.ts:169`

### Plan 05-04: Execute 03-03 + 03-04

**Finding:** Both fixes are confirmed present (03-03 in committed PricingReportConfig.tsx, 03-04 in uncommitted usePricingFilters.ts about to be committed by Plan 05-01). These plans verify committed state, create SUMMARY files.

### Plan 05-05: Fix pricing page data source

**This is the new work not covered by any Phase 3 plan.**

**File:** `app/project/[id]/reports/pricing/page.tsx`

**Change summary:**
The `load()` async function (lines 37-76) currently:
1. Fetches door-schedule, hardware-merge, project in parallel
2. If `finalData` exists, calls `transformFromFinalJson(finalData)` to get `sets` only (discards `doors`)
3. Always calls `transformDoors(dsJson.data.scheduleJson, sets)` for doors

**Required change:**
1. When `finalData` exists, use `transformFromFinalJson(finalData).doors` as the door source (not `transformDoors`)
2. Fall back to `transformDoors(scheduleJson, sets)` only when `finalData` is absent

**Also required:** Add `?? door.buildingArea` fallback to `transformFromFinalJson` at `utils/hardwareTransformers.ts:309`:
```typescript
// Current line 309:
buildingLocation: bi?.['BUILDING LOCATION'] ?? ds?.['BUILDING LOCATION'],

// Fixed:
buildingLocation: bi?.['BUILDING LOCATION'] ?? ds?.['BUILDING LOCATION'] ?? door.buildingArea,
```

This is a one-line change analogous to the already-committed `transformDoors` fix.

**Files modified:**
- `app/project/[id]/reports/pricing/page.tsx` — restructure load() to use finalJson doors
- `utils/hardwareTransformers.ts` — add `?? door.buildingArea` to `transformFromFinalJson` line 309

**Type safety check:**
`MergedDoor.buildingArea` is typed as `string | undefined` in `lib/db/hardware.ts:133`. The `??` chain handles undefined naturally. No cast needed.

### Plan 05-06: End-to-end verification (execute 03-05)

**This is manual verification only.** No code changes. Uses the existing 03-05-PLAN.md step list (Steps 1-9 plus hardware regression).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Door loading with user edits | Custom merge of scheduleJson + finalJson | `transformFromFinalJson(finalData).doors` | Already builds Door[] correctly from finalJson with all user edits |
| Level value resolution | Custom buildingArea → buildingLocation map | `?? door.buildingArea` in existing fallback chain | Three-way `??` chain in transformFromFinalJson already exists, just needs one more fallback term |
| Per-door filter within group | Custom group re-builder | The already-written `filterDoorGroups` rewrite in uncommitted pricingGrouping.ts | Already correct, just needs committing |

---

## Common Pitfalls

### Pitfall 1: Assuming uncommitted files need the changes from Phase 3 plans
**What goes wrong:** Planner reads Plan 03-04 (change `g.doors.length` to `g.totalQty`) and applies it again to `usePricingFilters.ts` — creating a duplicate or conflicting edit on top of the already-correct uncommitted change.
**How to avoid:** Read the actual file first. Lines 239-241 already use `g.totalQty`. Plan 05-01 just commits the existing state.

### Pitfall 2: Believing hardwareTransformers.ts needs Bug B fix
**What goes wrong:** Plan 05-03 (executing 03-02) tries to edit `hardwareTransformers.ts` line 169 to add `?? row.buildingArea` — but that's already there in committed code.
**How to avoid:** `grep "row.buildingArea" utils/hardwareTransformers.ts` returns line 169. No edit needed. Plan 05-03 just verifies and creates a SUMMARY.

### Pitfall 3: Forgetting that `transformFromFinalJson` has a separate buildingLocation chain
**What goes wrong:** Fixing the pricing page to use `transformFromFinalJson` doors but NOT adding `?? door.buildingArea` to line 309. Doors from "BUILDINGN AREA" source files that were never edited by the user will still have `buildingLocation: undefined`.
**How to avoid:** Plan 05-05 must touch BOTH `page.tsx` AND `hardwareTransformers.ts:309`.

### Pitfall 4: Removing `transformDoors` from the pricing page fallback
**What goes wrong:** Pricing page has a fallback path for projects that don't have `finalData` yet (no hardware merge run). Removing the `scheduleJson + transformDoors` fallback would break those projects.
**How to avoid:** Keep the `else` branch that uses `transformDoors(scheduleJson, sets)`. Only the `if (finalData)` branch changes.

### Pitfall 5: `visibleDoors` vs `doorGroups` in Proposal tab
**What goes wrong:** The Proposal tab in PricingReportConfig.tsx still iterates `doorGroups`/`frameGroups` for its tables (lines ~340-383). These must remain unfiltered. This is already correct in the committed code.
**How to avoid:** The `usePricingExport` call at lines 241-271 uses `visibleDoors`/`visibleFrames`. The Proposal tab JSX iterates `doorGroups`/`frameGroups` directly — these are different variables. No change needed.

### Pitfall 6: Plan 05-01 commit scope creep
**What goes wrong:** Developer sees the `usePricingExport.ts` diff and tries to split it into separate commits or refactor further.
**How to avoid:** Commit all 3 files atomically in one commit. The `usePricingExport.ts` change is a PDF theme alignment that was done alongside the filter work and is ready to commit.

---

## Code Examples

### Pricing page data source fix (Plan 05-05)

Source: direct codebase analysis.

```typescript
// app/project/[id]/reports/pricing/page.tsx — load() function, lines 37-76
// BEFORE (current):
const [dsRes, mergeRes, projRes] = await Promise.all([
  fetch(`/api/projects/${id}/door-schedule`, { credentials: 'include' }),
  fetch(`/api/projects/${id}/hardware-merge`, { credentials: 'include' }),
  fetch(`/api/projects/${id}`, { credentials: 'include' }),
]);
const [dsJson, mergeJson, projJson] = await Promise.all([
  dsRes.ok ? dsRes.json() : null,
  mergeRes.ok ? mergeRes.json() : null,
  projRes.ok ? projRes.json() : null,
]);

setProjectName(projJson?.data?.name ?? '');

let sets: HardwareSet[] = [];
const finalData: MergedHardwareSet[] | undefined = mergeJson?.data?.finalJson;
if (finalData && finalData.length > 0) {
  const { hardwareSets: mergedSets } = transformFromFinalJson(finalData);
  sets = mergedSets;
} else {
  const hwRes = await fetch(`/api/projects/${id}/hardware-pdf`, { credentials: 'include' });
  const hwJson = hwRes.ok ? await hwRes.json() : null;
  if (hwJson?.data?.extractedJson) sets = transformHardwareSets(hwJson.data.extractedJson);
}

const loadedDoors: Door[] = dsJson?.data?.scheduleJson
  ? transformDoors(dsJson.data.scheduleJson, sets)
  : [];

// AFTER (fixed):
setProjectName(projJson?.data?.name ?? '');

let sets: HardwareSet[] = [];
let loadedDoors: Door[] = [];
const finalData: MergedHardwareSet[] | undefined = mergeJson?.data?.finalJson;
if (finalData && finalData.length > 0) {
  const { hardwareSets: mergedSets, doors: finalDoors } = transformFromFinalJson(finalData);
  sets = mergedSets;
  loadedDoors = finalDoors;
} else {
  const hwRes = await fetch(`/api/projects/${id}/hardware-pdf`, { credentials: 'include' });
  const hwJson = hwRes.ok ? await hwRes.json() : null;
  if (hwJson?.data?.extractedJson) sets = transformHardwareSets(hwJson.data.extractedJson);
  loadedDoors = dsJson?.data?.scheduleJson
    ? transformDoors(dsJson.data.scheduleJson, sets)
    : [];
}
```

### `transformFromFinalJson` buildingLocation fix (Plan 05-05, in hardwareTransformers.ts)

```typescript
// utils/hardwareTransformers.ts line 309 — inside transformFromFinalJson
// BEFORE:
buildingLocation: bi?.['BUILDING LOCATION'] ?? ds?.['BUILDING LOCATION'],

// AFTER:
buildingLocation: bi?.['BUILDING LOCATION'] ?? ds?.['BUILDING LOCATION'] ?? door.buildingArea,
```

`MergedDoor.buildingArea` is `string | undefined` (lib/db/hardware.ts:133). No type cast required.

### Plan 05-01 commit verification commands

```bash
# Before committing, verify all expected states:
node -e "const c=require('fs').readFileSync('utils/xlsxParser.ts','utf8');['buildingn area','building area','buildingarea'].forEach(a=>{if(!c.includes(\"'\"+a+\"'\")){console.error('Missing: '+a);process.exit(1);}});console.log('xlsxParser OK')"

node -e "const c=require('fs').readFileSync('utils/hardwareTransformers.ts','utf8');const l=c.split('\n').find(l=>l.includes('buildingLocation:')&&l.includes('BUILDING LOCATION')&&!l.includes('transformFromFinalJson'));if(!l||!l.includes('row.buildingArea')){console.error('transformDoors buildingArea fallback missing');process.exit(1);}console.log('hardwareTransformers transformDoors OK')"

node -e "const c=require('fs').readFileSync('hooks/usePricingFilters.ts','utf8');['totalDoorCount','totalFrameCount'].forEach(k=>{const l=c.split('\n').find(l=>l.includes(k)&&l.includes('useMemo'));if(!l||!l.includes('g.totalQty')||l.includes('g.doors.length')){console.error(k+' not using g.totalQty');process.exit(1);}});console.log('usePricingFilters OK')"

node -e "const c=require('fs').readFileSync('components/pricing/PricingReportConfig.tsx','utf8');if(!c.includes('doorGroups: visibleDoors')||!c.includes('frameGroups: visibleFrames')){console.error('PricingReportConfig export fix missing');process.exit(1);}console.log('PricingReportConfig OK')"
```

---

## State of the Art (What Was Already Done vs. What Remains)

| Fix | Original Plan | Status | Notes |
|-----|---------------|--------|-------|
| xlsxParser 'buildingn area' alias | 03-01 | DONE (committed) | Line 73 has 7 aliases including all 3 new ones |
| hardwareTransformers `?? row.buildingArea` | 03-02 | DONE (committed) | Line 169 confirmed |
| PricingReportConfig `visibleDoors`/`visibleFrames` | 03-03 | DONE (committed) | Lines 245-246 confirmed |
| usePricingFilters `g.totalQty` | 03-04 | IN UNCOMMITTED (commit via 05-01) | Lines 239-241 confirmed in working tree |
| filterDoorGroups per-door rewrite | not in plans | IN UNCOMMITTED (commit via 05-01) | pricingGrouping.ts, deeper fix than planned |
| Hardware filter via re-grouping | not in plans | IN UNCOMMITTED (commit via 05-01) | usePricingFilters.ts, better approach than filterHardwareGroups |
| usePricingExport PDF theme alignment | not in plans (Phase 1 work) | IN UNCOMMITTED (commit via 05-01) | usePricingExport.ts |
| Pricing page door data source | not in any Phase 3 plan | NOT DONE | Plan 05-05: page.tsx + hardwareTransformers:309 |
| transformFromFinalJson `?? door.buildingArea` | not in any plan | NOT DONE | Plan 05-05: hardwareTransformers:309 |
| Mixed Use Kamloops verification | 03-05 | NOT DONE | Plan 05-06: manual verification |

---

## Open Questions

1. **Does `transformFromFinalJson` lose sections data that `transformDoors` preserves?**
   - What we know: `transformFromFinalJson` copies `door.sections` to `builtDoor.sections` at line 344. The Door UI type has `sections` as a passthrough. Both transformers preserve sections.
   - What's unclear: Whether the pricing page's existing behavior (render count badge, "X doors · Y sets") depends on the exact format of doors from `transformDoors` vs `transformFromFinalJson`.
   - Recommendation: The count badge renders `doors.length` and `hardwareSets.length` — these should be equivalent since both transformers return one Door per doorTag. Safe to switch.

2. **What if a project has finalData with 0 doors but non-empty hardware sets?**
   - What we know: `transformFromFinalJson` returns `{ hardwareSets, doors }`. If sets have no doors, `doors` will be an empty array.
   - Recommendation: The `if (finalData && finalData.length > 0)` guard checks set count, not door count. Keep this guard. If sets exist but have no doors, `loadedDoors = []` is correct behavior.

3. **Is the `door-schedule` API call still needed after the data source fix?**
   - What we know: After the fix, when `finalData` exists, doors come from `transformFromFinalJson` and the `dsJson` (door-schedule) result is unused.
   - Recommendation: Keep the `door-schedule` fetch in the `Promise.all` for now — the fallback path still needs it. Could be optimized later to skip the fetch when finalData is present, but that's out of scope for Phase 5.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is pure code changes with no external dependencies beyond the existing Next.js/TypeScript stack.

---

## Validation Architecture

nyquist_validation is false (per `.planning/STATE.md` — `nyquist: overall: "SKIPPED (workflow.nyquist_validation = false)"`). This section is skipped.

Manual verification is the gate: Plan 05-06 (executing 03-05) runs the Mixed Use Kamloops end-to-end test.

---

## Sources

### Primary (HIGH confidence)
- Direct code read: `hooks/usePricingFilters.ts` (full file, 324 lines) — confirmed g.totalQty present
- Direct code read: `utils/pricingGrouping.ts` (full file, 416 lines) — confirmed filterDoorGroups rewrite present
- Direct code read: `hooks/usePricingExport.ts` (full file, 512 lines) — confirmed PDF theme changes present
- Direct code read: `app/project/[id]/reports/pricing/page.tsx` (full file, 105 lines) — confirmed transformDoors data source bug
- Direct code read: `utils/xlsxParser.ts` (lines 65-100) — confirmed Bug A already fixed at line 73
- Direct code read: `utils/hardwareTransformers.ts` (lines 155-180, 225-373) — confirmed Bug B fixed at line 169; transformFromFinalJson buildingLocation chain at line 309 missing `?? door.buildingArea`
- Direct code read: `components/pricing/PricingReportConfig.tsx` (lines 241-271) — confirmed Bug C fixed
- Direct code read: `lib/db/hardware.ts` (lines 24-199) — confirmed MergedDoor.buildingArea: string | undefined
- `git diff hooks/usePricingFilters.ts hooks/usePricingExport.ts utils/pricingGrouping.ts` — full diff inspected
- `.planning/phases/03-fix-level-wise-filtering-and-quantity-counts-in-pricing-report/03-RESEARCH.md` — Phase 3 research, HIGH confidence findings
- `.planning/phases/03-fix-level-wise-filtering-and-quantity-counts-in-pricing-report/03-01-PLAN.md` through `03-05-PLAN.md` — all 5 plans read
- `.planning/v1.0-MILESTONE-AUDIT.md` — gap analysis, confirmed PRF-01 through PRF-08 all unsatisfied

### Secondary (MEDIUM confidence)
- `app/api/projects/[id]/hardware-merge/route.ts` — confirms finalJson includes MergedDoor with buildingArea
- `services/mergeService.ts:112` — confirms buildingArea copied from DoorScheduleRow to MergedDoor
- `services/doorScheduleService.ts:28-29` — confirms 'buildingn area' maps to buildingArea in server parse

---

## Metadata

**Confidence breakdown:**
- Uncommitted changes audit: HIGH — confirmed via direct file read + git diff
- Already-committed fixes (Bugs A/B/C): HIGH — confirmed by line-by-line code read
- Pricing page data source gap: HIGH — confirmed by tracing code path end-to-end
- transformFromFinalJson buildingArea gap: HIGH — confirmed by code read of line 309
- Plan 05-05 fix strategy: HIGH — uses existing function, one-line additions

**Research date:** 2026-05-12
**Valid until:** 2026-06-12 (stable codebase, no active refactors on these files)
