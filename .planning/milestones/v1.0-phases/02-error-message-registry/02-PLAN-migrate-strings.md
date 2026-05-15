# Plan: Migrate All Inline Error Strings to Registry

**Phase:** 2 — Error Message Registry
**Goal:** Replace every remaining hardcoded error string in contexts, hooks, components, and utilities with a reference to the typed registry, so no inline string literals exist outside `constants/errors/`.
**Requirements:** ERR-02, ERR-03, ERR-06
**Dependencies:** 02-PLAN-error-registry.md (registry must exist), 02-PLAN-error-display.md (ErrorDisplay must exist for form field migration)

---

## Context

**Files to read before starting:**
- `F:\PlanckOff-Hardware\.planning\phases\02-error-message-registry\02-RESEARCH.md` — sections 1a–1f contain the complete before/after mapping for every file; follow section 5 for the API error flow pattern
- `F:\PlanckOff-Hardware\constants\errors\index.ts` — import `ERRORS` namespace from here for all call sites: `import { ERRORS } from '@/constants/errors'`
- `F:\PlanckOff-Hardware\contexts\ToastContext.tsx` — `addToast({ type, message, details? })` API; `message` = registry `.message`, `details` = registry `.action`
- `F:\PlanckOff-Hardware\components\shared\ErrorDisplay.tsx` — use this for inline form error `<div>` replacements (login is already done in Plan 2)

**Key constraints:**
- Import pattern: use the `ERRORS` namespace (`import { ERRORS } from '@/constants/errors'`) rather than individual domain exports, for consistent call-site style
- Toast mapping: `addToast({ type: 'error', message: ERRORS.DOMAIN.CODE.message, details: ERRORS.DOMAIN.CODE.action })`
- `throw new Error(...)` in utilities stay as `throw new Error(ERRORS.DOMAIN.CODE.message)` — no change to the throw pattern, only the string value changes
- Inline form error `<div>` blocks (Pattern B from the research) must be replaced with `<ErrorDisplay error={...} />` — import from `@/components/shared/ErrorDisplay`
- Do NOT change server-side API route strings (`app/api/`) — those are server responses and are out of scope (covered by the client-side fallback pattern)
- Do NOT change `workers/upload.worker.ts` — worker messages are not user-facing (low priority, excluded from this phase)
- Keep `console.error` calls where they already exist; only replace the user-facing output (toast message string or form error string)
- `ProjectContext.tsx` currently uses template literal strings like `'Failed to create project: ${message}'` — replace the entire `addToast` call with the registry entry; the template literal dynamic interpolation is eliminated (user sees the generic registry message)
- 2-space indentation on any new lines added; match existing surrounding indentation for in-place replacements

---

## Tasks

### Task 1: Migrate contexts — `AuthContext.tsx` and `ProjectContext.tsx`

**`F:\PlanckOff-Hardware\contexts\AuthContext.tsx`**

Read the full file first. The `login()` function returns `{ error: string | null }`. Two inline strings must be replaced:

1. `json.error ?? 'Login failed.'` → `json.error ?? ERRORS.AUTH.LOGIN_FAILED.message`
2. `'Network error. Please try again.'` → `ERRORS.AUTH.NETWORK_ERROR.message`

Add import at the top of the file (in the constants group, after existing imports):
```tsx
import { ERRORS } from '@/constants/errors';
```

**`F:\PlanckOff-Hardware\contexts\ProjectContext.tsx`**

Read the full file first. This file has 10 error strings across throw sites and `addToast` calls. The domain is `ERRORS.GENERAL` (project CRUD errors are generic enough to use `GEN_` codes) — use `ERRORS.GENERAL.SAVE_FAILED` as the catch-all for create/update/delete/restore/permanently-delete failures, OR add project-specific entries. Given the research audit, the recommended approach is to use `ERRORS.GENERAL.SAVE_FAILED` for all five operation failures (no new registry entries needed — they are already covered).

Add import:
```tsx
import { ERRORS } from '@/constants/errors';
```

Replace each occurrence:
- `json.error ?? 'Failed to create project.'` → `json.error ?? ERRORS.GENERAL.SAVE_FAILED.message`
- `json.error ?? 'Failed to update project.'` → `json.error ?? ERRORS.GENERAL.SAVE_FAILED.message`
- `'Failed to delete project.'` → `ERRORS.GENERAL.SAVE_FAILED.message`
- `'Failed to restore project.'` → `ERRORS.GENERAL.SAVE_FAILED.message`
- `'Failed to permanently delete project.'` → `ERRORS.GENERAL.SAVE_FAILED.message`
- Template literal `'Failed to create project: ${message}'` in the `addToast` call → `ERRORS.GENERAL.SAVE_FAILED.message` (drop the interpolated detail — the registry `action` text is sufficient)
- Template literal `'Failed to update project: ${message}'` in the `addToast` call → `ERRORS.GENERAL.SAVE_FAILED.message`

For the `addToast` calls that currently pass the error string as `message`, also add the `action` hint as `details`:
```tsx
addToast({ type: 'error', message: ERRORS.GENERAL.SAVE_FAILED.message, details: ERRORS.GENERAL.SAVE_FAILED.action });
```

### Task 2: Migrate views — `DatabaseView.tsx` and `Dashboard.tsx`

**`F:\PlanckOff-Hardware\views\DatabaseView.tsx`**

Read the full file first. Five throw strings and one `addToast` string:

Add import:
```tsx
import { ERRORS } from '@/constants/errors';
```

Replace:
- `json.error ?? 'Failed to load database.'` → `json.error ?? ERRORS.DOORS.LOAD_FAILED.message`
- `json.error ?? 'Update failed.'` → `json.error ?? ERRORS.DOORS.UPDATE_FAILED.message`
- `json.error ?? 'Create failed.'` → `json.error ?? ERRORS.DOORS.CREATE_FAILED.message`
- `json.error ?? 'Delete failed.'` → `json.error ?? ERRORS.DOORS.DELETE_FAILED.message`
- `json.error ?? 'Review failed.'` → `json.error ?? ERRORS.DOORS.REVIEW_FAILED.message`
- `err instanceof Error ? err.message : 'Delete failed.'` → `ERRORS.DOORS.DELETE_FAILED.message` (the toast should always show the registry message; the `err.message` was a leak of raw API error text)

**`F:\PlanckOff-Hardware\views\Dashboard.tsx`**

Read the relevant section (around line 143 per the research audit). One `addToast` call with an inline ternary string:

Add import:
```tsx
import { ERRORS } from '@/constants/errors';
```

Replace:
- `editingProject ? 'Project update failed' : 'Project creation failed'` in the toast `message` field → `ERRORS.GENERAL.SAVE_FAILED.message`

### Task 3: Migrate components — modals and inline form error blocks

**`F:\PlanckOff-Hardware\components\projects\NewProjectModal.tsx`**

Read the file. Three validation toast errors around lines 141–151:

Add import:
```tsx
import { ERRORS } from '@/constants/errors';
```

Replace:
- `'Project Name is required.'` → `ERRORS.GENERAL.REQUIRED_FIELD.message`
- `'Project country is required.'` → `ERRORS.GENERAL.REQUIRED_FIELD.message`
- `'Project province is required.'` → `ERRORS.GENERAL.REQUIRED_FIELD.message`

**`F:\PlanckOff-Hardware\components\team\InviteTeamMemberModal.tsx`**

Read the file. Two inline form error strings (Pattern B — inline `<div>` not a toast). The component manages an `error` state displayed in a form:

Add imports:
```tsx
import { ERRORS } from '@/constants/errors';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
```

Replace:
- `json.error ?? 'Something went wrong.'` → `json.error ?? ERRORS.GENERAL.UNEXPECTED.message`
- `'Network error. Please try again.'` → `ERRORS.AUTH.NETWORK_ERROR.message`

Also replace the inline error `<div>` that renders the error state with `<ErrorDisplay error={error} />` (same pattern as was done for the login page in Plan 2).

**`F:\PlanckOff-Hardware\components\team\InviteMemberModal.tsx`**

Read the file. One inline error string. Apply the same pattern as `InviteTeamMemberModal.tsx`:

Add imports:
```tsx
import { ERRORS } from '@/constants/errors';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
```

Replace the inline string with the appropriate registry entry and replace the error `<div>` with `<ErrorDisplay error={error} />`.

**`F:\PlanckOff-Hardware\components\settings\MasterItemFormModal.tsx`**

Read the file. Two inline form error strings around lines 57 and 63:

Add imports:
```tsx
import { ERRORS } from '@/constants/errors';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
```

Replace:
- `'Item Name is required.'` → `ERRORS.GENERAL.REQUIRED_FIELD.message`
- `err.message ?? 'Save failed.'` — this leaks `err.message` raw to users; replace with: `ERRORS.GENERAL.SAVE_FAILED.message`

Replace the inline error `<div>` with `<ErrorDisplay error={error} />`.

**`F:\PlanckOff-Hardware\components\upload\ImageAnalysisModal.tsx`**

Read the file. One toast error with an inline message around line 66:

Add import:
```tsx
import { ERRORS } from '@/constants/errors';
```

Replace the inline toast error string with `ERRORS.HARDWARE.PROCESSING_FAILED.message`.

### Task 4: Migrate hooks — `useProjectUploads.ts`, `useHardwareSetsManager.ts`, `useDoorTableState.tsx`, `useDashboardState.ts`, `useProjectData.ts`

For each hook, read the file first, add `import { ERRORS } from '@/constants/errors'`, then replace each inline string:

**`F:\PlanckOff-Hardware\hooks\useProjectUploads.ts`** (8 strings):
- `json.error ?? 'Upload failed.'` → `json.error ?? ERRORS.HARDWARE.UPLOAD_FAILED.message`
- `'Hardware PDF failed: ${err...}'` (template literal) → `ERRORS.HARDWARE.HARDWARE_PDF_FAILED.message` (drop interpolation; add `details: ERRORS.HARDWARE.HARDWARE_PDF_FAILED.action`)
- `'Please upload a PDF file for hardware sets.'` → `ERRORS.HARDWARE.PDF_FILE_REQUIRED.message`
- `'Door schedule failed: ${err...}'` (template literal) → `ERRORS.HARDWARE.DOOR_SCHEDULE_FAILED.message`
- `'Server error (HTTP ${res.status}). The request may have timed out...'` → `ERRORS.HARDWARE.SERVER_ERROR.message`
- `json?.error ?? 'Server error (HTTP ${res.status}).'` → `json?.error ?? ERRORS.HARDWARE.SERVER_ERROR.message`
- `'Processing failed: ${msg}'` → `ERRORS.HARDWARE.PROCESSING_FAILED.message`
- `'Assignment failed. Make sure both the hardware PDF and door schedule are uploaded.'` → `ERRORS.HARDWARE.ASSIGNMENT_FAILED.message` with `details: ERRORS.HARDWARE.ASSIGNMENT_FAILED.action`

**`F:\PlanckOff-Hardware\hooks\useHardwareSetsManager.ts`** (3 strings):
- `'Server returned an invalid response. Please try again.'` → `ERRORS.HARDWARE.INVALID_RESPONSE.message`
- `json.error ?? 'Prep generation failed.'` → `json.error ?? ERRORS.HARDWARE.PREP_GENERATION_FAILED.message`
- `'Server did not return prep data.'` → `ERRORS.HARDWARE.NO_PREP_DATA.message`

**`F:\PlanckOff-Hardware\hooks\useDoorTableState.tsx`** (1 string):
- `'Please enter a column name'` in the toast → `ERRORS.DOORS.COLUMN_NAME_REQUIRED.message`

**`F:\PlanckOff-Hardware\hooks\useDashboardState.ts`** (1 string):
- `'Failed to move "${project.name}"'` → `ERRORS.GENERAL.SAVE_FAILED.message` (drop the dynamic project name — registry messages are static)

**`F:\PlanckOff-Hardware\hooks\useProjectData.ts`** (1 string):
- `'File processing timed out. Please try uploading again.'` → `ERRORS.HARDWARE.TIMEOUT.message` with `details: ERRORS.HARDWARE.TIMEOUT.action`

### Task 5: Migrate utilities — `csvParser.ts`, `xlsxParser.ts`, `docxParser.ts`, `pdfParser.ts`

Utilities throw errors rather than calling toasts. The thrown `Error.message` is what eventually surfaces in the calling component's catch block. Replace only the string argument to `new Error(...)`.

**`F:\PlanckOff-Hardware\utils\csvParser.ts`** (5 throws, 2 duplicates → 4 unique entries):
Add `import { ERRORS } from '@/constants/errors';`
- `'CSV file must contain a header row and at least one data row.'` (appears twice) → `ERRORS.DOORS.CSV_EMPTY.message`
- `'CSV is missing required columns...'` → `ERRORS.DOORS.CSV_MISSING_COLUMNS.message`
- `'Could not parse any valid door data from the CSV...'` → `ERRORS.DOORS.CSV_NO_VALID_DATA.message`
- `'CSV is missing the required "Set Name" column.'` → `ERRORS.DOORS.CSV_MISSING_SET_NAME.message`

**`F:\PlanckOff-Hardware\utils\xlsxParser.ts`** (5 throws, 1 duplicate):
Add `import { ERRORS } from '@/constants/errors';`
- `'Excel file appears to be empty or in an unsupported format.'` (appears twice) → `ERRORS.DOORS.EXCEL_EMPTY.message`
- `'Excel file is missing required columns...'` → `ERRORS.DOORS.EXCEL_MISSING_COLUMNS.message`
- `'Could not parse any valid door data from the Excel file...'` → `ERRORS.DOORS.EXCEL_NO_VALID_DATA.message`
- `'Could not find any valid hardware sets in the Excel file...'` → `ERRORS.DOORS.EXCEL_NO_HARDWARE_SETS.message`

**`F:\PlanckOff-Hardware\utils\docxParser.ts`** (2 throws):
Add `import { ERRORS } from '@/constants/errors';`
- `'The Word document processing library (Mammoth) is not loaded...'` → `ERRORS.HARDWARE.DOCX_LIBRARY_MISSING.message`
- `'Could not read the provided Word document...'` → `ERRORS.HARDWARE.DOCX_READ_FAILED.message`

**`F:\PlanckOff-Hardware\utils\pdfParser.ts`** (1 throw):
Add `import { ERRORS } from '@/constants/errors';`
- `'PDF Parsing Error: ${error.message}...'` → `ERRORS.PDF.PARSE_FAILED.message` (drop the raw `error.message` interpolation)

---

## Verification

- [ ] `npx tsc --noEmit` passes with no new errors after all changes
- [ ] Grep for hardcoded error string patterns in the migrated files returns zero matches:
  - Search `contexts/AuthContext.tsx` for `'Login failed'` or `'Network error'` — should find none
  - Search `contexts/ProjectContext.tsx` for `'Failed to create'` or `'Failed to update'` or `'Failed to delete'` — should find none
  - Search `views/DatabaseView.tsx` for `'Update failed'` or `'Create failed'` or `'Delete failed'` or `'Load database'` — should find none
  - Search `hooks/useProjectUploads.ts` for `'Upload failed'` or `'Hardware PDF failed'` — should find none
  - Search `utils/csvParser.ts` for `'CSV file must contain'` — should find none
  - Search `utils/xlsxParser.ts` for `'Excel file appears'` — should find none
- [ ] Form errors in `InviteTeamMemberModal.tsx`, `InviteMemberModal.tsx`, `MasterItemFormModal.tsx` now render via `<ErrorDisplay>` (no hardcoded red classes)
- [ ] Triggering a login failure shows a toast or inline error sourced from `ERRORS.AUTH.*`
- [ ] Triggering a door import with an invalid CSV file shows a toast sourced from `ERRORS.DOORS.*`
- [ ] Triggering a hardware upload failure shows a toast sourced from `ERRORS.HARDWARE.*`
