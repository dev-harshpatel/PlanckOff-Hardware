# Plan: `final_json` as Single Source of Truth

**Date:** 2026-05-04  
**Status:** Draft — pending review  
**Scope:** Project hardware view (`/project/[id]`) data architecture

---

## 1. Why the Current 3-Source Architecture Exists

The project view currently merges data from three Supabase tables at load time:

| Table | Purpose |
|---|---|
| `hardware_pdf_extractions` | Raw items extracted from the hardware spec PDF |
| `door_schedule_imports` | Raw door rows extracted from the Excel door schedule |
| `project_hardware_finals` (`final_json`) | User edits, manual entries, matched doors, trash |

**The original intent of this design:**

1. **Idempotent re-uploads.** If an estimator re-uploads the PDF or the Excel, the new data is stored in the extraction tables. On next load, the fresh items/doors are merged with the user's edit overlay (`final_json`). The user's work is not lost.

2. **PDF items are the authoritative spec.** Hardware items (qty, manufacturer, description, finish) come directly from the architect's PDF. Keeping them in a separate table lets the app re-read them in full fidelity after any re-extraction.

3. **Door schedule columns are wide.** The Excel can have 40+ columns. `final_json`'s `MergedDoor` type only captures ~25 of them. Keeping the raw schedule in `door_schedule_imports` means no column data is silently dropped.

4. **User edits sit on top.** `final_json` stores: door-to-set matching, manual entries, deleted items (trash), and any field overrides. It is the diff, not the full state.

**The problem with this design today:**

- `transformFromFinalJson` reconstructs `HardwareSet[]` + `Door[]` only from `final_json`. The two extraction tables are loaded in parallel but their data is only used for seeding `final_json` (via `mergeHardwareData`). Once `final_json` exists, the extraction data is redundant at load time.
- Manually added doors (not in the Excel) must live in `final_json` under the `__unassigned__` sentinel, but the current merge logic did not always preserve them correctly (now fixed).
- The race condition between auto-save and initial load meant `final_json` could be overwritten with `[]` before data was loaded (now fixed).
- There is no clear moment when `final_json` "owns" the record. The app mixes "use final_json if it exists, otherwise compute from sources" logic across multiple code paths.

**Conclusion:** The 3-source design made sense for iterative re-uploads, but it creates fragile load order dependencies and makes `final_json` an inconsistent source of truth. Migrating to `final_json` as the sole runtime source eliminates the ambiguity.

---

## 2. What Data Is Currently Missing from `final_json`

### 2a. Missing flat fields on `MergedDoor` vs. the `Door` type

The `MergedDoor` interface in `lib/db/hardware.ts` does not have explicit fields for:

**Door section:**
- `doorCore`, `doorFace`, `doorEdge`, `doorGauge`, `doorFinish`
- `stcRating`, `doorUndercut`
- `doorIncludeExclude` (include/exclude flag)
- `glazingType`

**Frame section (most missing):**
- `wallType`, `throatThickness`, `frameGauge`, `frameProfile`
- `frameAnchor`, `baseAnchor`, `numberOfAnchors`
- `frameElevationType`, `frameAssembly`, `frameFinish`
- `prehung`, `frameHead`, `casing`, `frameIncludeExclude`

**Identity / grouping:**
- `buildingTag`, `buildingLocation` (only `buildingArea` is present)
- `handOfOpenings` (only reconstructed via `sections`)
- `doorOperation`, `leafCount` (leaf count only stored in sections)

**Runtime / UI fields:**
- `doorTag` is present, but `status`, `handing`, `operation`, `leafCountDisplay` are not — these are computed by `transformDoors` from raw fields.

> **Key insight:** `MergedDoor.sections` IS saved to `final_json` and contains virtually all raw Excel column data as raw strings (under `basic_information`, `door`, `frame`, `hardware`). This means most "missing" flat fields can be derived from `sections` at load time — they are not truly lost, just not denormalized into explicit flat fields.

### 2b. Missing fields on `MergedHardwareSet` vs. `HardwareSet`

| Field | Present in `MergedHardwareSet`? | Notes |
|---|---|---|
| `id` | No | Generated fresh by `transformFromFinalJson` |
| `doorTags` | No | Derived from matched `doors` array |
| `division` | No | Not in PDF extraction output |
| `isAvailable` | No | UI-only flag |
| `parentSetId` | No | Variant relationship not stored |
| `pricing` / `totalSetCost` | No | Pricing config stored separately |

> `HardwareItem` in `final_json` uses different field names than the `HardwareItem` in `types.ts`. The DB version uses `item` / `manufacturer` / `description` / `finish` / `qty`; the UI version uses `name` / `manufacturer` / `description` / `finish` / `quantity`. The transformer handles this mapping.

---

## 3. Migration Strategy

### Phase A — Stabilize the current design (done)

These are already fixed and should not be revisited:

- [x] `updateProjectHardwareFinal` uses `.upsert()` so it never silently fails on a missing row
- [x] `hasFinalJson` guard: only seed `final_json` when `sets.length > 0`
- [x] Race condition: `useEffect([project.id])` no longer sets state; functional updater bailout used in `loadProjectData`
- [x] `__unassigned__` sentinel correctly round-trips manual doors through `final_json`

### Phase B — Enrich `MergedDoor` with missing flat fields

**Goal:** `final_json` contains all data needed to reconstruct the full `Door` and `HardwareSet` types without reading from the extraction tables.

**Changes required:**

1. **Extend `MergedDoor`** in `lib/db/hardware.ts` to add the missing flat fields:
   ```
   doorCore, doorFace, doorEdge, doorGauge, doorFinish, stcRating, doorUndercut,
   doorIncludeExclude, glazingType, wallType, throatThickness, frameGauge,
   frameProfile, frameAnchor, baseAnchor, numberOfAnchors, frameElevationType,
   frameAssembly, frameFinish, prehung, frameHead, casing, frameIncludeExclude,
   buildingTag, buildingLocation, handOfOpenings, doorOperation, leafCount
   ```

2. **Update `mergeHardwareData`** in `utils/hardwareTransformers.ts` (or wherever the merge happens) to populate these new fields when seeding `final_json` from the extraction tables.

3. **Update `transformFromFinalJson`** to read these new flat fields (with `sections` as fallback) so `transformDoors` gets accurate input.

> **Alternative (lower risk):** Do not add flat fields. Instead, update `transformFromFinalJson` to always read from `sections` for these fields, since `sections` is already persisted. This avoids a schema change to `MergedDoor` and is backward-compatible. The downside: `sections` contains raw Excel strings (e.g., `"3'-0\""`) not normalized values — transformers must handle both formats.

**Recommended approach:** Use `sections` as the primary source in `transformFromFinalJson`. Add flat fields only for fields that are NOT in `sections` (like `doorOperation`, `leafCount`, `buildingTag`).

### Phase C — Eliminate the extraction tables from the load path

**Goal:** Once `final_json` exists and is complete, skip loading `hardware_pdf_extractions` and `door_schedule_imports` at runtime.

**Changes required:**

1. In `loadProjectData` (inside `ProjectView.tsx` or `useProjectData` hook), check if `final_json` is non-empty.
2. If `final_json` is non-empty, call `transformFromFinalJson` only — skip `mergeHardwareData`.
3. If `final_json` is empty (new project, no pipeline run yet), fall through to the current extraction merge path.

**Guard condition:**
```typescript
if (finalRaw && finalRaw.finalJson.length > 0) {
  // Source of truth: final_json only
  const { sets, doors } = transformFromFinalJson(finalRaw.finalJson, finalRaw.trashJson);
  setHardwareSets(sets);
  setDoors(doors);
} else {
  // No final_json yet — run the merge from extraction tables
  // (same as today)
}
```

### Phase D — Re-upload flow (preserve user edits)

When an estimator re-uploads the PDF or Excel, the current app overwrites `final_json` by calling `upsertProjectHardwareFinal` with a fresh merge. This would destroy user edits.

**New re-upload flow:**

1. Run the extraction (PDF → items, Excel → door rows) and store in extraction tables as today.
2. Load current `final_json`.
3. Run a **reconciliation merge**:
   - For each door in the new schedule: if a door with the same `doorTag` exists in `final_json`, update its `sections` / dimension fields but preserve user-edited fields (e.g., `excludeReason`, manual set assignment).
   - For each hardware item in the new PDF: update the item in the matching set's `hardwareItems` array.
   - Preserve all manually added entries (doors, sets) that don't appear in the new upload.
4. Write the reconciled result back to `final_json`.

This is a more complex merge than the current "replace" behavior. It is **Phase D** work and should be tackled after Phase B and C are stable.

### Phase E — Extend `MergedHardwareSet` for pricing and variants

Add to `MergedHardwareSet`:
- `id` (stable UUID, generated on seed and preserved through updates)
- `division` (copy from PDF extraction or default `'08'`)
- `parentSetId` (for variant sets)
- Pricing fields can remain separate (stored in `pricing_configs` or similar) — linking by `setName` is sufficient for now.

---

## 4. Data Flow After Migration

```
Upload PDF → hardware_pdf_extractions (raw store only, not runtime read)
Upload Excel → door_schedule_imports   (raw store only, not runtime read)
                          │
                          ▼
                  mergeHardwareData()   ← runs once on first pipeline completion
                          │
                          ▼
              project_hardware_finals.final_json
                     (single source)
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
   transformFromFinalJson()     auto-save writes
   → HardwareSet[] + Door[]     → back to final_json
              │
              ▼
       ProjectView renders
```

All user actions (add door, delete set, edit field, move door, restore from trash) write directly to `final_json` via the existing `saveToFinalJson` → `performSave` → `PUT /api/projects/[id]/hardware-merge` path. No change needed to the write path.

---

## 5. Files to Change (by phase)

| Phase | File | Change |
|---|---|---|
| B | `lib/db/hardware.ts` | Add missing flat fields to `MergedDoor` |
| B | `utils/hardwareTransformers.ts` | Populate new fields in `transformToFinalJson`; read them in `transformFromFinalJson` |
| B | `utils/hardwareMerge.ts` (or equivalent) | Copy all door fields when seeding `final_json` |
| C | `views/ProjectView.tsx` (or `useProjectData`) | Branch load path on `final_json` presence |
| C | `app/api/projects/[id]/hardware-merge/route.ts` | Ensure PUT always writes all fields |
| D | `views/ProjectView.tsx` | Add reconciliation merge on re-upload |
| D | `app/api/projects/[id]/hardware-pdf/route.ts` | Trigger reconcile, not replace |
| E | `lib/db/hardware.ts` | Add `id`, `division`, `parentSetId` to `MergedHardwareSet` |

---

## 6. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Existing `final_json` rows missing new flat fields → `undefined` everywhere | `transformFromFinalJson` falls back to `sections` for all new fields |
| Re-upload overwrites user edits during Phase C (before Phase D) | Gate re-upload behind a confirmation dialog: "This will reset your edits." Acceptable short-term trade-off. |
| `sections` raw strings differ between Excel formats | Keep existing format-normalization logic in `transformDoors`; `sections` is the raw backup, flat fields are the normalized form |
| Stale `final_json` from before Phase B (missing fields) | Always treat missing flat fields as `undefined` and fall through to `sections` — backward compatible |

---

## 7. Acceptance Criteria

- [ ] A manually added door persists across page refresh (already done).
- [ ] A door's frame material, gauge, anchor type render correctly in pricing report groupings using `final_json` data only.
- [ ] After re-upload, existing user edits (manual set assignments, excluded doors) are preserved.
- [ ] The extraction tables are not read during page load when `final_json` is non-empty.
- [ ] All door fields visible in `EnhancedDoorEditModal` are round-tripped through `final_json` without data loss.
