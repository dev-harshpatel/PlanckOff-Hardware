# Phase 2: Error Message Registry - Research

**Researched:** 2026-05-07
**Domain:** TypeScript error registry, React error display, Sonner toasts, shadcn/ui patterns
**Confidence:** HIGH — all findings sourced directly from the actual codebase; no external library assumptions required for the core implementation

---

## Summary

The codebase currently has 50+ inline error strings scattered across contexts, hooks, views, components, and utility parsers. There is no centralised registry. Error surfaces are inconsistent: some failures reach users via Sonner toasts (via `addToast`), some via `useState`-driven inline `<div>` blocks, some via the browser's native `alert()`, and some via raw `console.error` with no user-facing feedback. The `ErrorBoundary` component actively renders `error.toString()` and `componentStack` — raw JS internals — directly in the UI.

The toast system is already modern and consistent: Sonner wraps a `ToastContext` with `addToast({ type, message, details? })`. The CSS variables for error states (`--error-bg`, `--error-text`, `--error-border`) are fully defined in both light and dark themes in `globals.css`. The `Badge` component has a `destructive` variant using these exact tokens. There is no existing `Alert` shadcn component — that would need to be created for the `<ErrorDisplay>` component, or the inline pattern from the login page can be used as the standard.

**Primary recommendation:** Create `constants/errors/` with five domain files, a shared `AppError` type, one `<ErrorDisplay>` component that reads from the registry, and migrate every error surface in a single systematic pass. The `ErrorBoundary` must be upgraded to use the registry and never show raw error messages.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ERR-01 | `constants/errors/` directory with `auth.ts`, `doors.ts`, `hardware.ts`, `pdf.ts`, `general.ts` — typed `{ code, message, action? }` objects | Confirmed: `constants/` pattern exists with `auth.ts`, `roles.ts`, `inventory.ts`; new domain files follow same `as const` pattern |
| ERR-02 | No hardcoded inline error strings outside the registry | Audit below identifies every inline string by file |
| ERR-03 | Every known failure point maps to a named registry entry | Audit below categorises all ~50+ failure points by domain |
| ERR-04 | Reusable `<ErrorDisplay>` component using Tailwind/shadcn theme | CSS tokens confirmed; inline error UI pattern seen on login page is the template; `destructive` Badge variant already uses `--error-*` tokens |
| ERR-05 | Fallback for unhandled errors; no raw JS errors shown | `ErrorBoundary` currently shows `error.toString()` + stack trace — must be fixed |
| ERR-06 | All error surfaces use the registry exclusively | Three surfaces identified: Sonner toasts, inline form divs, native `alert()` calls |
| ERR-07 | Updating an error message requires changing only `constants/errors/` | Follows from ERR-01 through ERR-06 being complete |
</phase_requirements>

---

## 1. Current Error Landscape (Categorised by Domain)

### 1a. Auth Domain

**Files:** `app/(auth)/login/page.tsx`, `contexts/AuthContext.tsx`, `app/api/auth/login/route.ts`

| Location | Error String | Surface |
|----------|-------------|---------|
| `AuthContext.tsx:66` | `json.error ?? 'Login failed.'` | returned from `login()`, shown on login form |
| `AuthContext.tsx:72` | `'Network error. Please try again.'` | returned from `login()`, shown on login form |
| `app/api/auth/login/route.ts:28` | `'Invalid JSON body.'` | API response (server) |
| `app/api/auth/login/route.ts:33` | `'Email and password are required.'` | API response (server) |
| `app/api/auth/login/route.ts:60,100,106` | `'Invalid email or password.'` | API response (server) |
| `app/api/auth/login/route.ts:72,118` | `'Failed to create session.'` | API response (server) |
| `middleware.ts:61,66` | `'Forbidden.'` / `error=access_denied` | API response + URL param |
| `contexts/ProjectContext.tsx:67` | `console.error('Failed to fetch projects:', err)` | silent — no user feedback |

**Domain:** `auth` — 8 entries needed

### 1b. Projects Domain

**Files:** `contexts/ProjectContext.tsx`, `hooks/useDashboardState.ts`, `components/projects/NewProjectModal.tsx`

| Location | Error String | Surface |
|----------|-------------|---------|
| `ProjectContext.tsx:105` | `json.error ?? 'Failed to create project.'` | thrown, caught, shown as toast |
| `ProjectContext.tsx:129` | `json.error ?? 'Failed to update project.'` | thrown, caught, shown as toast |
| `ProjectContext.tsx:154` | `'Failed to delete project.'` | thrown, caught, shown as toast |
| `ProjectContext.tsx:174` | `'Failed to restore project.'` | thrown, caught, shown as toast |
| `ProjectContext.tsx:190` | `'Failed to permanently delete project.'` | thrown, caught, shown as toast |
| `ProjectContext.tsx:111` | `'Failed to create project: ${message}'` | toast (inline interpolation) |
| `ProjectContext.tsx:144` | `'Failed to update project: ${message}'` | toast (inline interpolation) |
| `useDashboardState.ts:98` | `'Failed to move "${project.name}"'` | toast with details |
| `NewProjectModal.tsx:141` | `'Project Name is required.'` | toast error |
| `NewProjectModal.tsx:146` | `'Project country is required.'` | toast error |
| `NewProjectModal.tsx:151` | `'Project province is required.'` | toast error |
| `Dashboard.tsx:143` | `editingProject ? 'Project update failed' : 'Project creation failed'` | toast with details |

**Domain:** belongs partly in `general.ts` (CRUD operations), partly a dedicated project section

### 1c. Doors Domain

**Files:** `views/DatabaseView.tsx`, `hooks/useDoorTableState.tsx`, `utils/csvParser.ts`, `utils/xlsxParser.ts`

| Location | Error String | Surface |
|----------|-------------|---------|
| `DatabaseView.tsx:55` | `json.error ?? 'Failed to load database.'` | thrown |
| `DatabaseView.tsx:167` | `json.error ?? 'Update failed.'` | thrown |
| `DatabaseView.tsx:178` | `json.error ?? 'Create failed.'` | thrown |
| `DatabaseView.tsx:197` | `json.error ?? 'Delete failed.'` | thrown |
| `DatabaseView.tsx:217` | `json.error ?? 'Review failed.'` | thrown |
| `DatabaseView.tsx:202` | `err instanceof Error ? err.message : 'Delete failed.'` | toast |
| `useDoorTableState.tsx:592` | `'Please enter a column name'` | toast warning |
| `csvParser.ts:17` | `'CSV file must contain a header row and at least one data row.'` | thrown |
| `csvParser.ts:77` | `'CSV is missing required columns...'` (dynamic) | thrown |
| `csvParser.ts:119` | `'Could not parse any valid door data from the CSV...'` | thrown |
| `csvParser.ts:167` | `'CSV file must contain a header row and at least one data row.'` | thrown (duplicate) |
| `csvParser.ts:210` | `'CSV is missing the required "Set Name" column.'` | thrown |
| `xlsxParser.ts:64` | `'Excel file appears to be empty or in an unsupported format.'` | thrown |
| `xlsxParser.ts:164` | `'Excel file is missing required columns...'` (dynamic) | thrown |
| `xlsxParser.ts:314` | `'Could not parse any valid door data from the Excel file...'` | thrown |
| `xlsxParser.ts:335` | `'Excel file appears to be empty or in an unsupported format.'` | thrown (duplicate) |
| `xlsxParser.ts:415` | `'Could not find any valid hardware sets in the Excel file...'` | thrown |

**Domain:** `doors.ts` — ~12 unique entries (several strings are duplicated across csv/xlsx)

### 1d. Hardware Domain

**Files:** `hooks/useProjectUploads.ts`, `hooks/useHardwareSetsManager.ts`, `utils/docxParser.ts`, `workers/upload.worker.ts`

| Location | Error String | Surface |
|----------|-------------|---------|
| `useProjectUploads.ts:212,315` | `json.error ?? 'Upload failed.'` | thrown |
| `useProjectUploads.ts:266` | `'Hardware PDF failed: ${err...}'` | toast (inline interpolation) |
| `useProjectUploads.ts:273` | `'Please upload a PDF file for hardware sets.'` | toast |
| `useProjectUploads.ts:364` | `'Door schedule failed: ${err...}'` | toast (inline interpolation) |
| `useProjectUploads.ts:494` | `'Server error (HTTP ${res.status}). The request may have timed out...'` | thrown |
| `useProjectUploads.ts:497` | `json?.error ?? 'Server error (HTTP ${res.status}).'` | thrown |
| `useProjectUploads.ts:552` | `'Processing failed: ${msg}'` | toast |
| `useProjectUploads.ts:573` | `'Assignment failed. Make sure both the hardware PDF and door schedule are uploaded.'` | toast |
| `useHardwareSetsManager.ts:232` | `'Server returned an invalid response. Please try again.'` | thrown |
| `useHardwareSetsManager.ts:236` | `json.error ?? 'Prep generation failed.'` | thrown |
| `useHardwareSetsManager.ts:240` | `'Server did not return prep data.'` | thrown |
| `docxParser.ts:12` | `'The Word document processing library (Mammoth) is not loaded...'` | thrown |
| `docxParser.ts:23` | `'Could not read the provided Word document...'` | thrown |
| `workers/upload.worker.ts:23` | `'No file received in worker'` | worker message |
| `hooks/useProjectData.ts:50` | `'File processing timed out. Please try uploading again.'` | toast |

**Domain:** `hardware.ts` — ~12 unique entries

### 1e. PDF Domain

**Files:** `utils/pdfParser.ts`, `services/reportExportService.ts`, `views/ReportsView.tsx`, `components/reports/ReportGenerationCenter.tsx`, `app/project/[id]/reports/hardware-set/page.tsx`

| Location | Error String | Surface |
|----------|-------------|---------|
| `pdfParser.ts:79` | `'PDF Parsing Error: ${error.message}...'` | thrown |
| `reportExportService.ts:85` | `console.error('Error exporting Door Schedule:', error)` | silent |
| `reportExportService.ts:118` | `console.error('Error exporting Hardware Set:', error)` | silent |
| `reportExportService.ts:137` | `console.error('Error exporting Submittal Package:', error)` | silent |
| `ReportsView.tsx:88` | `alert('Export failed. Please try again.')` | browser alert |
| `ReportGenerationCenter.tsx:42,51` | `alert('Export failed. Please try again.')` | browser alert |
| `app/project/.../hardware-set/page.tsx:84` | `alert('Export failed. Please try again.')` | browser alert |

**Domain:** `pdf.ts` — ~5 unique entries

### 1f. General / AI Domain

**Files:** `lib/ai/generate.ts`, `services/geminiService.ts`, `components/upload/ImageAnalysisModal.tsx`, `components/settings/MasterItemFormModal.tsx`, `components/settings/CutSheetLibrary.tsx`, `components/projects/RevisionHistory.tsx`, `components/team/InviteTeamMemberModal.tsx`, `views/TeamManagement.tsx`, `components/hardware/HardwareScheduleView.tsx`

| Location | Error String | Surface |
|----------|-------------|---------|
| `lib/ai/generate.ts:51` | `'OPENROUTER_API_KEY is not configured.'` | thrown (server) |
| `lib/ai/generate.ts:79` | `'GEMINI_API_KEY is not configured.'` | thrown (server) |
| `ImageAnalysisModal.tsx:66` | toast error with inline message | toast |
| `MasterItemFormModal.tsx:57` | `'Item Name is required.'` | inline form state |
| `MasterItemFormModal.tsx:63` | `err.message ?? 'Save failed.'` | inline form state |
| `InviteTeamMemberModal.tsx:68` | `json.error ?? 'Something went wrong.'` | inline form state |
| `InviteTeamMemberModal.tsx:82` | `'Network error. Please try again.'` | inline form state |
| `CutSheetLibrary.tsx:87` | `alert('Please fill in all required fields')` | browser alert |
| `RevisionHistory.tsx:49` | `alert('Please fill in all required fields')` | browser alert |
| `TeamManagement.tsx:170` | `alert('Resending invite to ${member.email}')` | browser alert (not error) |
| `HardwareScheduleView.tsx:109` | `alert('Excel export functionality coming soon!')` | browser alert (placeholder) |

**Domain:** `general.ts` — ~8 entries. AI key errors go server-side (will never show users directly) but should be wrapped.

### 1g. ErrorBoundary — Critical Issue

**File:** `components/shared/ErrorBoundary.tsx`

Currently renders raw JavaScript `error.toString()` (class name + message) and `componentStack` (full React component hierarchy) directly in the UI. This is the most urgent violation of ERR-05. It uses hardcoded Tailwind classes that don't use the app's CSS variable tokens and uses `export default` (against new component conventions).

---

## 2. Toast System Analysis

**System:** Sonner v2.0.7 wrapped by `contexts/ToastContext.tsx`

**API:**
```typescript
// From contexts/ToastContext.tsx
addToast({ type: 'success' | 'error' | 'warning' | 'info', message: string, details?: string })

// Maps to:
toast.success(message, { description: details, duration: 4000 })
toast.error(message, { description: details, duration: Infinity })  // errors persist until dismissed
toast.warning(message, { description: details, duration: 4000 })
toast.info(message, { description: details, duration: 4000 })
```

**Key insight:** The `details` field maps to Sonner's `description` — this is where `action` text from the registry should go.

**How `addToast` is passed:** Via props through views down to hooks. Components that can't reach `useToast()` directly receive `addToast` as a prop. The `useToast()` hook is the correct way for any 'use client' component.

**Toast styling:** Defined in `components/ui/sonner.tsx` using CSS variables (`--border`, `--bg`, `--text`, etc.). Error toasts have `border-l-4 border-l-red-500`. These are consistent and theme-aware.

**The `Toast` type** (from `types.ts`):
```typescript
type Toast = { id: number; type: 'success' | 'error' | 'warning' | 'info'; message: string; details?: string }
```

---

## 3. Error Display Patterns (Current)

Three distinct error surface patterns exist today:

### Pattern A: Sonner Toast (PRIMARY — most common)
Used by contexts and hooks. Correct pattern. After registry: pass `ERRORS.DOMAIN.CODE.message` as `message` and `ERRORS.DOMAIN.CODE.action` as `details`.

### Pattern B: Inline Form Error `<div>` (4 locations)
Used by: `login/page.tsx`, `InviteTeamMemberModal.tsx`, `InviteMemberModal.tsx`, `MasterItemFormModal.tsx`

Current implementation on login page:
```tsx
{error && (
  <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3">
    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
  </div>
)}
```

This uses hardcoded red Tailwind colors instead of the CSS variable tokens (`--error-bg`, `--error-text`, `--error-border`). The `<ErrorDisplay>` component must use the token-based approach.

**Correct token-based version:**
```tsx
<div className="rounded-md border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3">
  <p className="text-sm text-[var(--error-text)]">{error.message}</p>
</div>
```

### Pattern C: Browser `alert()` (WORST — must be eliminated)
Used by: `ReportsView.tsx`, `ReportGenerationCenter.tsx`, `hardware-set/page.tsx`, `CutSheetLibrary.tsx`, `RevisionHistory.tsx` (5 distinct locations).
Must be replaced with `addToast({ type: 'error', ... })` using registry entries.

### Pattern D: `console.error` with No User Feedback (silent failures)
Used by: `reportExportService.ts` (3 catch blocks), `ProjectContext.tsx`, multiple hooks.
Must be paired with a toast or rethrow, per the code conventions.

### CSS Tokens Available for ErrorDisplay
From `globals.css` — confirmed in both `:root` and `.dark`:
```css
--error-bg: #fef2f2  (light) / #1f0d0d (dark)
--error-text: #991b1b (light) / #ff7b72 (dark)
--error-dot: #ef4444 (light) / #ff7b72 (dark)
--error-border: #fecaca (light) / #5c1a1a (dark)
```

No `Alert` shadcn component exists in the codebase. The project has `alert-dialog.tsx` (a confirmation modal), but no inline `Alert` / `AlertDescription`. The `<ErrorDisplay>` will be a new primitive built with the CSS variable tokens above.

---

## 4. Constants Folder State

**Current files:**
```
constants/
├── auth.ts       # AUTH_CONFIG (cookie name, session duration) + COOKIE_CONFIG
├── inventory.ts  # inventory-related constants (not inspected, out of scope)
└── roles.ts      # ROLE_LEVELS, canInviteRole(), getInvitableRoles()
```

**Pattern used:** `as const` objects with JSDoc comments, exported by name. No default exports.

**Example structure to follow:**
```typescript
// constants/auth.ts
export const AUTH_CONFIG = {
  SESSION_DURATION_DAYS: 7,
  // ...
} as const;
```

**No error infrastructure exists today.** The registry is a greenfield addition. The correct new structure:

```
constants/
├── auth.ts        (existing)
├── inventory.ts   (existing)
├── roles.ts       (existing)
└── errors/
    ├── index.ts   # barrel: re-exports AppError type + all domain registries
    ├── auth.ts    # AUTH_ERRORS
    ├── doors.ts   # DOOR_ERRORS
    ├── hardware.ts # HARDWARE_ERRORS
    ├── pdf.ts     # PDF_ERRORS
    └── general.ts # GENERAL_ERRORS
```

---

## 5. API Error Handling (How API Errors Flow Client-Side)

**Server shape:** All API routes return `{ error: string }` with an HTTP error status. This is consistent throughout `app/api/`.

**Client consumption pattern:**
```typescript
const res = await fetch('/api/...');
const json = await res.json();
if (!res.ok) throw new Error(json.error ?? 'Fallback string.');
```

The thrown `Error` is then caught by a `try/catch` in the calling context or hook, which calls `addToast({ type: 'error', message: err.message })`. This means server-side error strings (from DB layer or route handlers) can flow through to users directly.

**After registry:** The pattern becomes:
```typescript
if (!res.ok) throw new Error(json.error ?? ERRORS.GENERAL.UNKNOWN.message);
// ...catch:
addToast({ type: 'error', message: ERRORS.DOMAIN.CODE.message, details: ERRORS.DOMAIN.CODE.action });
```

Or better — the catch block identifies the domain and maps to a registry entry rather than forwarding the raw server string.

**API routes themselves** use `error.message` from the DB layer (`DbResult<T>`) — these are Supabase error messages and should never reach users. They are server-only and do not need registry entries (they already correctly return HTTP error codes). The client-side fallback strings are what need to be in the registry.

---

## 6. Recommended Implementation

### AppError Type Shape

```typescript
// constants/errors/index.ts
export interface AppError {
  code: string;           // e.g. 'AUTH_INVALID_CREDENTIALS'
  message: string;        // user-facing message
  action?: string;        // optional suggestion: 'Check your connection and try again.'
}
```

**Convention:** `code` uses SCREAMING_SNAKE_CASE, namespaced by domain prefix (`AUTH_`, `DOOR_`, `HW_`, `PDF_`, `GEN_`). This matches the `as const` pattern already in use.

### Registry Shape (Example: auth.ts)

```typescript
// constants/errors/auth.ts
import type { AppError } from './index';

export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: {
    code: 'AUTH_INVALID_CREDENTIALS',
    message: 'Invalid email or password.',
    action: 'Check your credentials and try again.',
  },
  NETWORK_ERROR: {
    code: 'AUTH_NETWORK_ERROR',
    message: 'Network error. Please check your connection.',
    action: 'Try again in a moment.',
  },
  SESSION_FAILED: {
    code: 'AUTH_SESSION_FAILED',
    message: 'Sign-in failed. Please try again.',
  },
  LOGIN_FAILED: {
    code: 'AUTH_LOGIN_FAILED',
    message: 'Login failed.',
  },
} as const satisfies Record<string, AppError>;
```

Note: `satisfies Record<string, AppError>` (TypeScript 4.9+) gives type-checking without widening — verify this is available under the ES2022/bundler module config. Given TypeScript ~5.8.2 is used, this is fully supported.

### Barrel Export

```typescript
// constants/errors/index.ts
export type { AppError };
export { AUTH_ERRORS } from './auth';
export { DOOR_ERRORS } from './doors';
export { HARDWARE_ERRORS } from './hardware';
export { PDF_ERRORS } from './pdf';
export { GENERAL_ERRORS } from './general';

// Convenience namespace (optional, makes call sites cleaner)
export const ERRORS = {
  AUTH: AUTH_ERRORS,
  DOORS: DOOR_ERRORS,
  HARDWARE: HARDWARE_ERRORS,
  PDF: PDF_ERRORS,
  GENERAL: GENERAL_ERRORS,
} as const;
```

### ErrorDisplay Component

**Location:** `components/shared/ErrorDisplay.tsx`

Follows the conventions: named export, no `export default`, 2-space indentation, `cn()` for class merging, uses CSS variable tokens.

```tsx
// components/shared/ErrorDisplay.tsx
'use client';

import { cn } from '@/lib/utils';
import type { AppError } from '@/constants/errors';

interface ErrorDisplayProps {
  error: AppError | string | null;
  className?: string;
}

export function ErrorDisplay({ error, className }: ErrorDisplayProps) {
  if (!error) return null;

  const message = typeof error === 'string' ? error : error.message;
  const action = typeof error === 'string' ? undefined : error.action;

  return (
    <div
      role="alert"
      className={cn(
        'rounded-md border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3',
        className,
      )}
    >
      <p className="text-sm font-medium text-[var(--error-text)]">{message}</p>
      {action && (
        <p className="mt-1 text-xs text-[var(--error-text)] opacity-75">{action}</p>
      )}
    </div>
  );
}
```

This accepts either an `AppError` object (from registry) or a plain string (for migration-period compatibility). The `role="alert"` makes it accessible.

### ErrorBoundary Fix

The existing `ErrorBoundary` must be updated to:
1. Not show `error.toString()` or `componentStack`
2. Show a friendly fallback message from the registry (`GENERAL_ERRORS.UNEXPECTED`)
3. Use CSS variable tokens and the named export convention
4. Optionally accept a custom `fallback` prop

### General Fallback Entry

```typescript
// constants/errors/general.ts
export const GENERAL_ERRORS = {
  UNEXPECTED: {
    code: 'GEN_UNEXPECTED',
    message: 'Something went wrong.',
    action: 'Please reload the page or try again.',
  },
  NETWORK: {
    code: 'GEN_NETWORK',
    message: 'Network error. Please check your connection.',
    action: 'Try again in a moment.',
  },
  // ...
} as const satisfies Record<string, AppError>;
```

### Migration Strategy

1. **Wave 0** — Create `constants/errors/` with all five domain files. No application code changes.
2. **Wave 1** — Fix the two critical issues first: `ErrorBoundary` (shows raw internals) and the `alert()` calls (worst UX).
3. **Wave 2** — Create `<ErrorDisplay>` component. Migrate the four inline form error `<div>` blocks (login, InviteTeamMemberModal, InviteMemberModal, MasterItemFormModal).
4. **Wave 3** — Migrate all toast error strings in contexts (`ProjectContext.tsx`, `AuthContext.tsx`) to use registry.
5. **Wave 4** — Migrate hooks (`useProjectUploads.ts`, `useHardwareSetsManager.ts`, `useDoorTableState.tsx`, `useDashboardState.ts`).
6. **Wave 5** — Migrate utilities (`csvParser.ts`, `xlsxParser.ts`, `docxParser.ts`, `pdfParser.ts`) — these throw errors, not toasts; update message strings to reference registry constants.
7. **Wave 6** — Add fallback handling for `console.error`-only catch blocks in `reportExportService.ts`.

---

## 7. Files That Will Change (Complete List)

All paths relative to project root. Only files in the canonical codebase (not `.claude/worktrees/`):

### New Files (create)
- `constants/errors/index.ts`
- `constants/errors/auth.ts`
- `constants/errors/doors.ts`
- `constants/errors/hardware.ts`
- `constants/errors/pdf.ts`
- `constants/errors/general.ts`
- `components/shared/ErrorDisplay.tsx`

### Modified Files (migrate error strings)

**Contexts:**
- `contexts/AuthContext.tsx` — 2 error strings in `login()`
- `contexts/ProjectContext.tsx` — 5 throw strings + 5 toast strings

**Views:**
- `views/DatabaseView.tsx` — 5 throw strings + 1 toast
- `views/ReportsView.tsx` — 1 `alert()` call + 1 silent `console.error`
- `views/Dashboard.tsx` — 1 toast string (already uses `addToast`)

**Components:**
- `components/shared/ErrorBoundary.tsx` — rewrite to use registry fallback, fix raw error display
- `components/projects/NewProjectModal.tsx` — 3 toast strings
- `components/team/InviteTeamMemberModal.tsx` — 2 inline error strings
- `components/team/InviteMemberModal.tsx` — 1 inline error string
- `components/settings/MasterItemFormModal.tsx` — 2 inline error strings
- `components/settings/CutSheetLibrary.tsx` — 1 `alert()` call
- `components/projects/RevisionHistory.tsx` — 1 `alert()` call
- `components/reports/ReportGenerationCenter.tsx` — 3 `alert()` calls
- `components/upload/ImageAnalysisModal.tsx` — 1 toast error

**Hooks:**
- `hooks/useProjectUploads.ts` — 8 error strings (throws + toasts)
- `hooks/useHardwareSetsManager.ts` — 3 throw strings
- `hooks/useDoorTableState.tsx` — 1 toast string
- `hooks/useDashboardState.ts` — 1 toast string
- `hooks/useProjectData.ts` — 1 toast string

**Utilities:**
- `utils/csvParser.ts` — 5 throw strings (2 duplicates to consolidate)
- `utils/xlsxParser.ts` — 5 throw strings (1 duplicate to consolidate)
- `utils/docxParser.ts` — 2 throw strings
- `utils/pdfParser.ts` — 1 throw string

**Services:**
- `services/reportExportService.ts` — 3 silent `console.error` catches → add toasts

**App pages:**
- `app/(auth)/login/page.tsx` — inline error `<div>` → `<ErrorDisplay>`
- `app/project/[id]/reports/hardware-set/page.tsx` — 1 `alert()` + 1 silent error

**Workers:**
- `workers/upload.worker.ts` — 1 error string (worker message, not user-facing — low priority)

**Total: 7 new files + 26 modified files**

---

## 8. Migration Complexity

### String Count by Domain

| Domain | Unique Strings | Duplicate/Consolidatable | Files Affected |
|--------|---------------|--------------------------|----------------|
| Auth | 8 | 1 (login failed variants) | 3 |
| Doors/Database | 12 | 2 (empty file) | 4 |
| Hardware | 12 | 3 (upload failed variants) | 5 |
| PDF/Export | 5 | 1 (export failed) | 5 |
| General | 8 | 2 (network error, form required) | 6 |
| **Total** | **~45** | **~9** | **~23** |

After deduplication: approximately **36 unique registry entries** across 5 domain files.

### Effort by Category

| Work Item | Complexity | Rationale |
|-----------|-----------|-----------|
| Create 5 registry files + index | Low | Pure string extraction, no logic |
| Create `<ErrorDisplay>` | Low | ~30 lines, no state |
| Fix `ErrorBoundary` | Low | Replace render output, update to conventions |
| Migrate `alert()` calls (5) | Low | Straight replacement |
| Migrate toast strings in contexts/hooks | Medium | 20+ strings across 10 files, require imports |
| Migrate inline form error divs (4) | Medium | Require `<ErrorDisplay>` import + prop change |
| Migrate utility `throw new Error()` strings | Low-Medium | String-only change, no component work |
| Fix silent `console.error` in services | Medium | Need `addToast` access (service layer is import-only, no hook access — must propagate error up to caller) |

### Critical Architectural Note: Service Layer Error Propagation

`services/reportExportService.ts` is a client-side service module with no React context access — it cannot call `addToast()` directly. Currently the `console.error` calls in its catch blocks are silent. The fix is: let errors propagate (rethrow or return an error object), and have the calling component/hook (e.g., `ReportsView.tsx`) catch and display via `addToast`. This is the correct architectural split: services throw, UI layers catch and surface.

---

## Architecture Patterns

### Error Registry Pattern (standard for TypeScript apps)

The `as const satisfies Record<string, AppError>` pattern gives:
- Literal type inference on values (no widening)
- Type-checking against the `AppError` interface
- Tree-shaking compatibility (no runtime type overhead)

This is the same pattern as `AUTH_CONFIG` and `COOKIE_CONFIG` in `constants/auth.ts`.

### Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Toast notification | Custom toast queue | Sonner via existing `ToastContext.addToast()` |
| Theme-aware error colors | Hardcoded hex colors | CSS variable tokens (`--error-bg`, etc.) already in `globals.css` |
| Error type safety | Custom validator | TypeScript `satisfies Record<string, AppError>` |
| Accessible error announcement | `aria-live` region | `role="alert"` on the `<ErrorDisplay>` div (browser handles announcement) |

---

## Common Pitfalls

### Pitfall 1: Migrating Parser Error Strings Breaks Worker Messages
**What goes wrong:** `csvParser.ts` and `xlsxParser.ts` are also used inside `workers/upload.worker.ts`. If the thrown error strings change meaning, the worker's catch blocks (`error.message || String(error)`) will still pass through the new registry message — this is fine. But if a caller depends on matching the exact error string, it could break.
**How to avoid:** Only change the string value in the registry file; the import site just references `ERRORS.DOORS.CSV_EMPTY.message` — the runtime value changes transparently.

### Pitfall 2: Service Layer Has No Toast Access
**What goes wrong:** `reportExportService.ts` functions are called with `exportHardwareSet(...)` — there's no way to inject `addToast` without a major refactor.
**How to avoid:** Make service functions throw (currently they catch and log). The calling component (`ReportsView.tsx`, `ReportGenerationCenter.tsx`) already has a try/catch — extend those to call `addToast`.

### Pitfall 3: ErrorBoundary is a Class Component
**What goes wrong:** `ErrorBoundary` cannot use React hooks (including `useToast`). It cannot call `addToast()` directly.
**How to avoid:** The ErrorBoundary fallback UI renders registry strings directly (import `GENERAL_ERRORS.UNEXPECTED` as a constant — no hook needed).

### Pitfall 4: `alert()` Is Synchronous and Blocks Rendering
**What goes wrong:** `alert()` in `ReportsView.tsx` and other places blocks the event loop.
**How to avoid:** Simple replacement with `addToast({ type: 'error', message: ERRORS.PDF.EXPORT_FAILED.message })`. The `addToast` prop is available at all these call sites.

### Pitfall 5: Worktree Files
**What goes wrong:** The `.claude/worktrees/` directory contains mirror copies of many files. Running a grep for error strings will show duplicate results from worktrees.
**How to avoid:** All edits go to canonical project files only. The worktrees update separately. Never edit worktree files directly.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this is a code/constants-only phase with no new npm packages required)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | No test runner detected (`jest.config.*` or `vitest.config.*` absent) |
| Config file | None present |
| Quick run command | N/A — no runner configured |
| Full suite command | N/A |

**Note:** `@testing-library/react` and `@testing-library/jest-dom` are installed but no test runner is configured. Testing for this phase will be manual verification (open the app, trigger each error condition).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ERR-01 | Registry files exist with correct shape | manual | — | ❌ Wave 0 creates them |
| ERR-02 | No inline strings outside registry | manual grep | `grep -r "throw new Error(" --include="*.ts" --include="*.tsx" contexts/ hooks/ views/ components/ services/ utils/` | N/A |
| ERR-03 | All failure points covered | manual review | — | N/A |
| ERR-04 | ErrorDisplay renders correctly | manual/visual | — | ❌ Wave 0 creates it |
| ERR-05 | ErrorBoundary shows no raw error | manual (throw from component) | — | Requires fix |
| ERR-06 | All surfaces use registry | manual grep | same as ERR-02 | N/A |
| ERR-07 | Single-file update propagates | manual (change a string, verify UI) | — | N/A |

### Wave 0 Gaps
- [ ] No test infrastructure to create — testing is manual for this phase
- [ ] Suggest adding a simple `__tests__/errors.test.ts` that imports the registry and asserts shape (no test runner needed to define the test, but it won't run without jest/vitest)

*(Existing test infrastructure: none configured — all verification is manual)*

---

## Sources

### Primary (HIGH confidence)
- Direct codebase audit — `contexts/ToastContext.tsx`, `app/globals.css`, `constants/auth.ts`, `components/shared/ErrorBoundary.tsx`, `components/shared/ErrorModal.tsx`, `components/ui/badge.tsx`, `components/ui/sonner.tsx`
- Grep output — all `throw new Error(`, `addToast`, `type: 'error'`, `alert(`, `console.error` patterns in canonical codebase files

### Secondary (MEDIUM confidence)
- TypeScript `satisfies` keyword (TS 4.9+) — confirmed valid given project uses TypeScript ~5.8.2
- `role="alert"` accessibility attribute — standard HTML; no library dependency

### Tertiary (LOW confidence)
- None — all findings are from direct codebase inspection

---

## Metadata

**Confidence breakdown:**
- Current error landscape audit: HIGH — direct grep of canonical files
- Toast system: HIGH — read `ToastContext.tsx` and `sonner.tsx` directly
- CSS tokens: HIGH — read `globals.css` directly
- Registry shape recommendation: HIGH — follows existing `constants/` conventions
- File change list: HIGH — enumerated from grep results
- String count (36 unique): MEDIUM — manual deduplication, exact number may shift ±3 during implementation

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (stable codebase; valid until next major refactor)
