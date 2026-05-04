# Source of Truth — PlanckOff Data Architecture
**Date:** 2026-05-04  
**Author:** Claude Code + Harsh Patel  
**Purpose:** Map exactly which JSON each page reads/writes, identify inconsistencies, and recommend production-level fixes.

---

## The Three JSONs

| JSON | Table | Column | Type | Origin |
|---|---|---|---|---|
| **Door Schedule JSON** | `door_schedule_imports` | `schedule_json` | `DoorScheduleRow[]` | Excel file upload (parsed client-side) |
| **Hardware Set JSON** | `hardware_pdf_extractions` | `extracted_json` | `ExtractedHardwareSet[]` | PDF upload → LLM extraction |
| **Final JSON** | `project_hardware_finals` | `final_json` | `MergedHardwareSet[]` | Merge of above two + all user edits |

The **Final JSON is the canonical source of truth** for any user-facing display of doors and hardware sets. The other two are raw inputs that feed into it.

---

## Page-by-Page Source of Truth Map

### Page 1 — Project Editor (`ProjectView.tsx`)

**Role:** The single place where all three JSONs are combined and where the user edits data.

| Action | Reads From | Writes To |
|---|---|---|
| On mount (initial load) | All 3 JSONs in parallel | — |
| User edits door/set | In-memory state | `final_json` (via PUT `/hardware-merge`) |
| User edits variants / creates manual sets | In-memory state | `extracted_json` (via PUT `/hardware-pdf`) AND `final_json` |
| User uploads new PDF | File → LLM | `extracted_json` (via POST `/hardware-pdf`) |
| User uploads new Excel | File → parser | `schedule_json` (via POST `/door-schedule`) |
| User deletes a door | In-memory state | `final_json.trash_json` |

**Merge logic on mount (client-side, in `ProjectView.tsx`):**
```
if finalJson exists:
  → use finalJson as the authoritative set ORDER
  → for each set: prefer PDF version (fresh LLM data) if exists, else keep finalJson version
  → append PDF-only sets not yet in finalJson
  → overlay finalJson door assignments onto raw Excel doors
  → append manually-created doors (only in finalJson, not Excel)
else:
  → transform PDF sets directly
  → transform Excel doors using PDF sets for assignment lookup
```

**Source of truth verdict:** ✅ Correct. Final JSON is loaded first and treated as authoritative. Raw JSONs are used only to fill gaps.

**Problems:** See Section 3.

---

### Page 2 — Door Schedule Report (`/reports/door-schedule`)

**Role:** Printable view of all doors with their assigned hardware sets.

| Action | Reads From | Writes To |
|---|---|---|
| On mount | `schedule_json` + `extracted_json` | Nothing |
| Display logic | Transforms raw inputs (no finalJson) | — |

**Source of truth verdict:** ❌ **WRONG.** This report ignores `final_json` entirely. This means:
- Any door assignment the user made in the editor is NOT shown here
- Manually created doors (not from Excel) are invisible here
- Deleted (trashed) doors still appear here
- The report contradicts the editor

---

### Page 3 — Hardware Set Report (`/reports/hardware-set`)

**Role:** Printable view of all hardware sets and the doors assigned to each.

| Action | Reads From | Writes To |
|---|---|---|
| On mount | `final_json` (preferred) → falls back to `extracted_json` + `schedule_json` | Nothing |
| Display logic | `transformFromFinalJson()` if finalJson available | — |

**Source of truth verdict:** ✅ Correct when finalJson exists. Falls back properly.

**Minor issue:** Fallback path produces different output format than the finalJson path — two different transformation pipelines for the same report.

---

### Page 4 — Pricing Report (`/reports/pricing`)

**Role:** Cost breakdown per door, per set, and totals.

| Action | Reads From | Writes To |
|---|---|---|
| On mount | `schedule_json` + `final_json` (preferred) → falls back to `extracted_json` | Nothing |
| Display logic | finalJson for sets, scheduleJson for door metadata | — |

**Source of truth verdict:** ⚠️ Partially correct. Reads `schedule_json` for door metadata AND `final_json` for sets. This means pricing reflects the merged state for sets but raw Excel data for door fields. If the user corrected a door field in the editor, the Pricing Report may show the old Excel value for that field.

---

### Page 5 — Submittal Package (`/reports/submittal-package`)

**Role:** Full specification document for the general contractor — combines all data.

| Action | Reads From | Writes To |
|---|---|---|
| On mount | `final_json` (preferred) → falls back to `extracted_json` + `schedule_json` | ⚠️ Writes `final_json` if reconstructed |
| If fallback used | Reconstructs finalJson from raw inputs | PUT `/hardware-merge` (side effect!) |

**Source of truth verdict:** ⚠️ Dangerous pattern. A report page that writes to the database on read is a serious architectural issue. The reconstruction logic (`reconstructFinalJson()`) runs on the client and silently overwrites finalJson. If the reconstruction has a bug, it corrupts the user's data.

---

### Page 6 — Elevation Tab (`ElevationTab.tsx`, embedded in ProjectView)

**Role:** Visual representation of door elevations with hardware placement.

| Action | Reads From | Writes To |
|---|---|---|
| Display | `door`, `elevationTypes` props from ProjectView | Nothing directly |
| Edit elevation type | Calls `onElevationTypeUpdate` → ProjectView state | `projects.elevation_types` (via PUT `/api/projects/{id}`) |

**Source of truth verdict:** ✅ Correct. Reads from parent state. Writes to project metadata, not any of the 3 JSONs.

---

## Summary Table

| Page | Door Schedule JSON | Hardware Set JSON | Final JSON | Writes? | Verdict |
|---|---|---|---|---|---|
| Project Editor | ✅ Read on mount | ✅ Read on mount | ✅ Read on mount, primary | ✅ Saves all 3 | Correct |
| Door Schedule Report | ✅ Read | ✅ Read | ❌ Ignored | ❌ Never writes | **BUG — ignores user edits** |
| Hardware Set Report | Fallback only | Fallback only | ✅ Primary | ❌ Never writes | Correct |
| Pricing Report | ✅ Read (door fields) | Fallback only | ✅ Primary (sets) | ❌ Never writes | Partial — mixed sources |
| Submittal Package | Fallback only | Fallback only | ✅ Primary | ⚠️ Writes on read | **Dangerous — side effect on read** |
| Elevation Tab | ❌ N/A | ❌ N/A | ❌ N/A | ✅ Elevation types only | Correct |

---

## Senior Developer Analysis — What's Wrong & Why

### Problem 1 — Door Schedule Report reads raw data, not finalJson

**Severity:** High — this is a user-visible bug.

The Door Schedule Report calls `GET /door-schedule` and `GET /hardware-pdf` and ignores `GET /hardware-merge`. This means the report is showing the unedited Excel import, not the user's actual work. Any door assignment, deletion, or manual entry the user made in the editor is invisible in this report.

**Why it happened:** The report was probably built before the merge workflow was finalized, and no one went back to update it.

**Fix:** The Door Schedule Report must call `GET /hardware-merge` first. If finalJson exists, use it exclusively. The raw JSONs should only be read if finalJson is absent (first-time load).

---

### Problem 2 — Submittal Package writes to the database on read

**Severity:** High — this violates command/query separation (CQS) and can corrupt data.

The Submittal Package page fetches data, and if finalJson is missing, it reconstructs it and then PUTs it back to Supabase. A report page should never write. This pattern means:

- Navigating to the submittal package can silently overwrite user data
- If the reconstruction algorithm has a bug (which it might — it's client-side), the "correct" finalJson is replaced with a corrupted one
- The side effect is invisible to the user

**Fix:** Remove the write from the report page entirely. If finalJson is missing, show a "Project setup is incomplete" message with a button to return to the editor. The merge/reconstruction should only ever happen server-side via the POST `/hardware-merge` endpoint.

---

### Problem 3 — The merge algorithm lives on the client

**Severity:** Medium.

The logic that combines Door Schedule JSON + Hardware Set JSON → Final JSON runs inside `ProjectView.tsx` on the client. This means:

1. The same merge logic is partially duplicated across the Submittal Package (`reconstructFinalJson()`)
2. If the merge algorithm changes, client-side and server-side results can diverge
3. The POST `/hardware-merge` endpoint also runs a version of this merge server-side — there are now two merge implementations

**Fix:** The merge algorithm should live in exactly one place: the `POST /hardware-merge` API route. The client should never merge — it should send raw inputs to the server and receive the result.

---

### Problem 4 — `hardware_pdf_extractions` holds both raw LLM output AND user-created data

**Severity:** Medium.

When the user creates a manual hardware set or a variant, it is written into `extracted_json` (the PDF extraction table) via PUT `/hardware-pdf`. This means the PDF extraction table is no longer a clean, immutable record of what the LLM returned — it's been mixed with user mutations.

If the user re-uploads a PDF, the new LLM extraction overwrites both the original LLM data AND the user's manual sets (unless there's logic to preserve them — but that logic adds complexity to the wrong place).

**Fix:** Treat `hardware_pdf_extractions` as immutable raw input. User-created sets and variants belong in `final_json` only. The merge layer should know how to distinguish "came from LLM" vs "user-created."

---

### Problem 5 — Two transformation pipelines produce different outputs for the same data

**Severity:** Medium.

When finalJson is present, the app uses `transformFromFinalJson(finalJson)`. When it's absent (fallback), the app uses `transformHardwareSets(extractedJson)` + `transformDoors(scheduleJson, sets)`. These two pipelines produce `HardwareSet[]` and `Door[]` from different inputs. There's no guarantee they produce identical structures for identical data.

This means the Hardware Set Report looks different depending on whether the user has saved from the editor at least once.

**Fix:** Standardize on one transformation pipeline. If finalJson is absent, run the merge server-side (via GET or POST `/hardware-merge`) and return a response in the same shape as finalJson. The client should only ever work with one data shape.

---

### Problem 6 — Pricing Report reads door fields from `schedule_json`, not `final_json`

**Severity:** Low-Medium.

If the user corrects a door's fire rating, door size, or location in the editor (which writes to `final_json`), the Pricing Report still reads those fields from the original `schedule_json`. The report will show the old, uncorrected value.

**Fix:** Door field corrections that happen in the editor must be stored in `final_json`. The Pricing Report must read all door data from `final_json` only, not from `schedule_json`.

---

## What the Architecture Should Look Like

### Correct Source of Truth Hierarchy

```
                    ┌─────────────────────────────────┐
                    │         FINAL JSON               │
                    │    (project_hardware_finals)      │
                    │  Authoritative for ALL pages      │
                    │  Contains everything that         │
                    │  the user has seen and confirmed  │
                    └────────────┬────────────────────--┘
                                 │ feeds from
              ┌──────────────────┴──────────────────┐
              │                                     │
   ┌──────────▼──────────┐             ┌────────────▼──────────┐
   │  Door Schedule JSON  │             │  Hardware Set JSON     │
   │  (door_schedule_     │             │  (hardware_pdf_        │
   │   imports)           │             │   extractions)         │
   │                      │             │                        │
   │  Immutable after     │             │  Immutable after       │
   │  upload. Never       │             │  upload. Never written │
   │  written to by       │             │  to by the editor.     │
   │  the editor.         │             │  Manual sets → finalJson│
   └──────────────────────┘             └────────────────────────┘
```

### Rule: One Read Path for Every Page

Every page (report or editor) must follow this single read path:

1. Call `GET /api/projects/{id}/hardware-merge`
2. If `finalJson` is present → use it, full stop
3. If `finalJson` is absent → show "Upload your PDF and Excel to get started" state

No page should call `/door-schedule` or `/hardware-pdf` directly for display purposes. Those endpoints exist only for the upload/extraction flow.

---

## Production-Level Fix Plan

### Fix 1 — Door Schedule Report (High Priority)

**File:** The Door Schedule Report page  
**Change:** Replace the raw-data fetch with a `hardware-merge` GET. Use `transformFromFinalJson()` exclusively.  
**Before:** Reads `schedule_json` + `extracted_json`  
**After:** Reads `final_json` only

---

### Fix 2 — Remove write from Submittal Package (High Priority)

**File:** Submittal Package report page  
**Change:** Delete the `reconstructFinalJson()` call and the PUT that follows it. If finalJson is absent, render an empty state with a CTA to return to the editor.  
**Result:** Report pages are read-only. Data mutations only happen in the editor.

---

### Fix 3 — Move merge algorithm to the server (Medium Priority)

**File:** `app/api/projects/[id]/hardware-merge/route.ts` (POST handler)  
**Change:** The POST handler already runs a server-side merge. Make the client call it instead of merging locally. Remove the client-side merge logic from `ProjectView.tsx`.  
**Result:** One canonical merge algorithm. No divergence between client and server.

---

### Fix 4 — Treat `hardware_pdf_extractions` as immutable (Medium Priority)

**Files:** `app/api/projects/[id]/hardware-pdf/route.ts` (PUT handler), `HardwareSetsManager.tsx`  
**Change:** When user creates a manual set or variant, write it to `final_json` only, not `extracted_json`. The PUT `/hardware-pdf` endpoint should be deprecated/removed.  
**Result:** `extracted_json` = pristine LLM output. `final_json` = everything the user has touched.

---

### Fix 5 — Standardize the transformation pipeline (Medium Priority)

**Files:** `utils/hardwareTransformers.ts`, all report pages  
**Change:** Ensure all pages use the same `transformFromFinalJson()` function. The fallback transformation path (`transformHardwareSets` + `transformDoors`) should only exist inside the POST `/hardware-merge` server handler — not on the client.

---

### Fix 6 — Store corrected door fields in finalJson (Low Priority)

**Files:** `components/EnhancedDoorEditModal.tsx`, `app/api/projects/[id]/hardware-merge/route.ts`  
**Change:** When the user edits a door field, ensure the corrected value is stored in `final_json` and not just in `schedule_json` (which the editor currently PATCHes separately). `final_json` must be the final word on all door field values.

---

## Quick Reference — Single Source of Truth Table

| Data | Canonical Table | Canonical Column | Who Writes | Who Reads |
|---|---|---|---|---|
| Door list (final) | `project_hardware_finals` | `final_json` | Editor only | All pages |
| Hardware set list (final) | `project_hardware_finals` | `final_json` | Editor only | All pages |
| Door-to-set assignment | `project_hardware_finals` | `final_json` | Editor only | All pages |
| Deleted items (trash) | `project_hardware_finals` | `trash_json` | Editor only | Editor only |
| Raw Excel import | `door_schedule_imports` | `schedule_json` | Upload flow only | Merge service only |
| Raw LLM extraction | `hardware_pdf_extractions` | `extracted_json` | Upload/LLM only | Merge service only |
| Project metadata | `projects` | (columns) | Editor + Settings | All pages |
| Elevation types | `projects` | `elevation_types` | Elevation Tab | Elevation Tab |
| Pricing | `project_pricing_items` | (rows) | Pricing editor | Pricing Report |
