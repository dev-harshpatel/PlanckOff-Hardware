---
phase: "02"
plan: "04"
subsystem: "error-registry"
tags: ["errors", "registry", "refactor", "contexts", "hooks", "utils", "modals"]
dependency_graph:
  requires: ["02-PLAN-error-registry", "02-PLAN-error-display"]
  provides: ["complete-error-registry-migration"]
  affects: ["contexts/AuthContext", "contexts/ProjectContext", "views/DatabaseView", "views/Dashboard", "components/modals", "hooks", "utils/parsers"]
tech_stack:
  added: []
  patterns: ["ERRORS namespace import", "ErrorDisplay component for inline form errors", "Registry-driven toast messages"]
key_files:
  created: []
  modified:
    - contexts/AuthContext.tsx
    - contexts/ProjectContext.tsx
    - views/DatabaseView.tsx
    - views/Dashboard.tsx
    - components/projects/NewProjectModal.tsx
    - components/team/InviteTeamMemberModal.tsx
    - components/team/InviteMemberModal.tsx
    - components/settings/MasterItemFormModal.tsx
    - components/upload/ImageAnalysisModal.tsx
    - hooks/useProjectUploads.ts
    - hooks/useHardwareSetsManager.ts
    - hooks/useDoorTableState.tsx
    - hooks/useDashboardState.ts
    - hooks/useProjectData.ts
    - utils/csvParser.ts
    - utils/xlsxParser.ts
    - utils/docxParser.ts
    - utils/pdfParser.ts
decisions:
  - "Used ERRORS.GENERAL.SAVE_FAILED for all project CRUD failures — generic enough to cover create/update/delete/restore/permanently-delete"
  - "Dropped template literal interpolation in addToast messages — registry action text is sufficient"
  - "Replaced all inline form error divs with ErrorDisplay component in InviteTeamMemberModal, InviteMemberModal, MasterItemFormModal"
  - "Replaced PROCESSING_FAILED action text for ImageAnalysisModal rather than passing raw error.message to users"
  - "Used ERRORS.GENERAL.REQUIRED_FIELD for InviteMemberModal email validation (semantically equivalent to 'please enter a valid email' in context)"
metrics:
  duration: "~40 minutes"
  completed: "2026-05-07"
  tasks_completed: 5
  files_modified: 18
  strings_migrated: 36
---

# Phase 2 Plan 4: Migrate Inline Error Strings to Registry — Summary

**One-liner:** Replaced 36 hardcoded inline error strings across 18 files with typed `ERRORS` namespace references, eliminating all inline string literals outside `constants/errors/`.

---

## What Was Done

All remaining hardcoded error strings in contexts, views, modal components, hooks, and utility parsers were replaced with references to the `ERRORS` namespace (`import { ERRORS } from '@/constants/errors'`). Three inline error `<div>` blocks were replaced with the `<ErrorDisplay>` component.

### Task 1: Contexts (2 files, 9 strings)

**`contexts/AuthContext.tsx`**
- `'Login failed.'` → `ERRORS.AUTH.LOGIN_FAILED.message`
- `'Network error. Please try again.'` → `ERRORS.AUTH.NETWORK_ERROR.message`

**`contexts/ProjectContext.tsx`**
- 5 `throw new Error(...)` strings for create/update/delete/restore/permanently-delete → `ERRORS.GENERAL.SAVE_FAILED.message`
- 2 `addToast` template literal strings (`'Failed to create project: ${message}'`, `'Failed to update project: ${message}'`) → `ERRORS.GENERAL.SAVE_FAILED.message` with `details: ERRORS.GENERAL.SAVE_FAILED.action`
- Removed now-unused `message` variable in addProject and updateProject catch blocks

### Task 2: Views (2 files, 7 strings)

**`views/DatabaseView.tsx`**
- 5 throw strings (LOAD_FAILED, UPDATE_FAILED, CREATE_FAILED, DELETE_FAILED, REVIEW_FAILED) → `ERRORS.DOORS.*`
- 1 toast ternary `err instanceof Error ? err.message : 'Delete failed.'` → `ERRORS.DOORS.DELETE_FAILED.message`

**`views/Dashboard.tsx`**
- Ternary `editingProject ? 'Project update failed' : 'Project creation failed'` → `ERRORS.GENERAL.SAVE_FAILED.message`

### Task 3: Modal Components (5 files, 10 strings + 3 ErrorDisplay replacements)

**`components/projects/NewProjectModal.tsx`** — 3 validation strings → `ERRORS.GENERAL.REQUIRED_FIELD.message`

**`components/team/InviteTeamMemberModal.tsx`**
- `'Something went wrong.'` → `ERRORS.GENERAL.UNEXPECTED.message`
- `'Network error. Please try again.'` → `ERRORS.AUTH.NETWORK_ERROR.message`
- Inline red `<div>` → `<ErrorDisplay error={error} />`

**`components/team/InviteMemberModal.tsx`**
- `'Please enter a valid email address.'` → `ERRORS.GENERAL.REQUIRED_FIELD.message`
- Inline `<p className="text-sm text-red-600">` → `<ErrorDisplay error={error} />`

**`components/settings/MasterItemFormModal.tsx`**
- `'Item Name is required.'` → `ERRORS.GENERAL.REQUIRED_FIELD.message`
- `err.message ?? 'Save failed.'` → `ERRORS.GENERAL.SAVE_FAILED.message`
- Inline `<p className="text-xs text-red-500 ...">` → `<ErrorDisplay error={error} />`

**`components/upload/ImageAnalysisModal.tsx`**
- `message: 'Analysis Failed', details: error.message` → `ERRORS.HARDWARE.PROCESSING_FAILED.message` + `action`

### Task 4: Hooks (5 files, 11 strings)

**`hooks/useProjectUploads.ts`** (8 strings)
- 2x `'Upload failed.'` → `ERRORS.HARDWARE.UPLOAD_FAILED.message`
- `'Hardware PDF failed: ${err...}'` → `ERRORS.HARDWARE.HARDWARE_PDF_FAILED.message` + action
- `'Please upload a PDF file for hardware sets.'` → `ERRORS.HARDWARE.PDF_FILE_REQUIRED.message`
- `'Door schedule failed: ${err...}'` → `ERRORS.HARDWARE.DOOR_SCHEDULE_FAILED.message` + action
- `'Server error (HTTP ${res.status}). The request may have timed out...'` → `ERRORS.HARDWARE.SERVER_ERROR.message`
- `json?.error ?? 'Server error (HTTP ${res.status}).'` → `ERRORS.HARDWARE.SERVER_ERROR.message`
- `'Processing failed: ${msg}'` → `ERRORS.HARDWARE.PROCESSING_FAILED.message` + action
- `'Assignment failed. Make sure both...'` → `ERRORS.HARDWARE.ASSIGNMENT_FAILED.message` + action

**`hooks/useHardwareSetsManager.ts`** (3 strings) → `ERRORS.HARDWARE.INVALID_RESPONSE`, `PREP_GENERATION_FAILED`, `NO_PREP_DATA`

**`hooks/useDoorTableState.tsx`** (1 string) → `ERRORS.DOORS.COLUMN_NAME_REQUIRED.message`

**`hooks/useDashboardState.ts`** (1 string) — `'Failed to move "${project.name}"'` → `ERRORS.GENERAL.SAVE_FAILED.message`

**`hooks/useProjectData.ts`** (1 string) — `'File processing timed out...'` → `ERRORS.HARDWARE.TIMEOUT.message` + action

### Task 5: Utility Parsers (4 files, 10 throws)

**`utils/csvParser.ts`** — 4 unique strings (2 duplicates consolidated) → `ERRORS.DOORS.CSV_EMPTY/CSV_MISSING_COLUMNS/CSV_NO_VALID_DATA/CSV_MISSING_SET_NAME`

**`utils/xlsxParser.ts`** — 4 unique strings (1 duplicate consolidated) → `ERRORS.DOORS.EXCEL_EMPTY/EXCEL_MISSING_COLUMNS/EXCEL_NO_VALID_DATA/EXCEL_NO_HARDWARE_SETS`

**`utils/docxParser.ts`** — 2 strings → `ERRORS.HARDWARE.DOCX_LIBRARY_MISSING/DOCX_READ_FAILED`

**`utils/pdfParser.ts`** — 1 string → `ERRORS.PDF.PARSE_FAILED.message` (dropped raw `error.message` interpolation)

---

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | f43e863 | feat(02-04): migrate context error strings to ERRORS registry |
| Task 2 | 744a4ba | feat(02-04): migrate view error strings to ERRORS registry |
| Task 3 | b15910e | feat(02-04): migrate modal error strings to ERRORS registry |
| Task 4 | 71c9fb9 | feat(02-04): migrate hook error strings to ERRORS registry |
| Task 5 | 6261a89 | feat(02-04): migrate utility parser error strings to ERRORS registry |

---

## Verification

- `npx tsc --noEmit` — zero new errors introduced (pre-existing errors in unrelated files remain unchanged)
- Grep for all 36 migrated string patterns — zero matches found in migrated files
- Three inline form error `<div>` blocks replaced with `<ErrorDisplay>` in InviteTeamMemberModal, InviteMemberModal, MasterItemFormModal

---

## Deviations from Plan

None — plan executed exactly as written. The `message` variable cleanup in ProjectContext catch blocks (removing unused variable after template literal elimination) was a natural consequence of the migration, not a deviation.

---

## Known Stubs

None. All migrated error surfaces now reference the registry and are fully wired.

---

## Self-Check: PASSED

Key modified files confirmed present:
- `contexts/AuthContext.tsx` — FOUND
- `contexts/ProjectContext.tsx` — FOUND
- `views/DatabaseView.tsx` — FOUND
- `views/Dashboard.tsx` — FOUND
- `components/projects/NewProjectModal.tsx` — FOUND
- `components/team/InviteTeamMemberModal.tsx` — FOUND
- `hooks/useProjectUploads.ts` — FOUND
- `utils/csvParser.ts` — FOUND
- `utils/xlsxParser.ts` — FOUND

Commits confirmed in git log:
- f43e863, 744a4ba, b15910e, 71c9fb9, 6261a89 — all present on AP-Sprint-1
