<!-- summary-frontmatter-guard -->
phase: 05-execute-pricing-report-fixes
plan: 02
status: complete
requirements-completed: [PRF-03]
requirements-partial-progress: [PRF-01]
commit: ecfd9e074961f585d580ae7aca9c1586622e8e9c
<!-- summary-frontmatter-guard -->

# 05-02 SUMMARY: Pricing page data source + transformFromFinalJson fallback

## One-liner

Pricing page now loads doors from `transformFromFinalJson(finalData).doors` (authoritative finalJson source); `transformFromFinalJson` buildingLocation chain gains `?? door.buildingArea` fallback matching the already-committed `transformDoors` pattern.

## What was done

### Edit 1 — utils/hardwareTransformers.ts line ~309

BEFORE:
```typescript
buildingLocation: bi?.['BUILDING LOCATION'] ?? ds?.['BUILDING LOCATION'],
```

AFTER:
```typescript
buildingLocation: bi?.['BUILDING LOCATION'] ?? ds?.['BUILDING LOCATION'] ?? door.buildingArea,
```

### Edit 2 — app/project/[id]/reports/pricing/page.tsx load() function

BEFORE: `transformFromFinalJson(finalData)` was called for sets only; `transformDoors(scheduleJson, sets)` was always called for doors regardless of finalData.

AFTER: when `finalData && finalData.length > 0`, doors come from `transformFromFinalJson(finalData).doors` (destructured as `finalDoors`). The `transformDoors` path is preserved as the else-branch fallback for projects without a hardware merge run.

Key structural change in `load()`:
```typescript
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

## Why

User edits to door fields (buildingLocation, buildingTag, etc.) are written to `project_hardware_finals.final_json`, never back to `project_door_schedule_imports.schedule_json`. Loading doors from scheduleJson via `transformDoors` bypassed all user edits, leaving the level filter blind to user-edited values. `transformFromFinalJson` reads from the authoritative finalJson source. The `?? door.buildingArea` fallback ensures doors that have `buildingArea` from the upload source column but no user-edited BUILDING LOCATION override are still resolved correctly by the level filter.

## Grep evidence (post-commit)

- `grep -c "?? door.buildingArea" utils/hardwareTransformers.ts` → 1
- `grep -c "?? row.buildingArea" utils/hardwareTransformers.ts` → 1 (transformDoors unchanged)
- `grep -c "doors: finalDoors" app/project/[id]/reports/pricing/page.tsx` → 1
- `grep -c "loadedDoors = finalDoors;" app/project/[id]/reports/pricing/page.tsx` → 1
- `grep -c "loadedDoors = dsJson?.data?.scheduleJson" app/project/[id]/reports/pricing/page.tsx` → 1
- `grep -c "const loadedDoors: Door\[\] = dsJson" app/project/[id]/reports/pricing/page.tsx` → 0 (old form removed)

## Build result

`npm run build`: PASS — no new TypeScript errors in `app/project/[id]/reports/pricing/page.tsx` or `utils/hardwareTransformers.ts`. Build completed with 0 errors. `/project/[id]/reports/pricing` route compiled to 60.7 kB.

## Requirement status after this commit

- **PRF-01**: COMPLETE (implementation). xlsxParser aliases (committed earlier), `transformDoors` `row.buildingArea` fallback (committed earlier), `transformFromFinalJson` `door.buildingArea` fallback (this plan). All three legs of the level-resolution chain are present. Final user verification: Plan 05-03.
- **PRF-03**: COMPLETE (implementation). Pricing page now loads doors from the authoritative finalJson source. Mixed Use Kamloops verification: Plan 05-03.

## Commit hash

ecfd9e074961f585d580ae7aca9c1586622e8e9c

## What this plan does NOT close

- PRF-07 (detail modal matches main table after filtering) — Plan 05-03 (manual)
- PRF-08 (no regression without filters) — Plan 05-03 (manual)
- Final user verification of PRF-01 and PRF-03 — Plan 05-03 (manual)

## Deviations from Plan

None — plan executed exactly as written. Both tasks applied in sequence, committed atomically, build clean.

## Known Stubs

None — both edits wire real data paths (finalJson → Door[]) with no placeholder or stub values.

## Self-Check: PASSED

- FOUND: utils/hardwareTransformers.ts
- FOUND: app/project/[id]/reports/pricing/page.tsx
- FOUND: .planning/phases/05-execute-pricing-report-fixes/05-02-SUMMARY.md
- FOUND: commit ecfd9e0
- Working tree clean for committed files (git diff returns empty)
