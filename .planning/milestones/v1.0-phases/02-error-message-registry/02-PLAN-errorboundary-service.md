# Plan: Fix ErrorBoundary + Eliminate alert() Calls

**Phase:** 2 — Error Message Registry
**Goal:** Fix the two most critical error UX violations — ErrorBoundary leaking raw JS internals and five `alert()` call sites — and ensure the service layer propagates errors correctly so callers can surface them via toasts.
**Requirements:** ERR-05, ERR-06
**Dependencies:** 02-PLAN-error-registry.md (needs `GENERAL_ERRORS` and `PDF_ERRORS` from the registry)

---

## Context

**Files to read before starting:**
- `F:\PlanckOff-Hardware\components\shared\ErrorBoundary.tsx` — current implementation to rewrite; note it uses 4-space indentation (legacy), `export default`, and `error.toString()` + `componentStack` in the render output
- `F:\PlanckOff-Hardware\constants\errors\general.ts` — `GENERAL_ERRORS.UNEXPECTED` is the fallback message
- `F:\PlanckOff-Hardware\constants\errors\pdf.ts` — `PDF_ERRORS.EXPORT_FAILED`, `PDF_ERRORS.DOOR_SCHEDULE_EXPORT_FAILED`, `PDF_ERRORS.HARDWARE_SET_EXPORT_FAILED` for the alert() replacements
- `F:\PlanckOff-Hardware\contexts\ToastContext.tsx` — `addToast({ type: 'error', message: string, details?: string })` API; the `useToast()` hook is NOT available inside a class component
- `F:\PlanckOff-Hardware\services\reportExportService.ts` — already rethrows errors (has `throw error` in its catch blocks); the `alert()` calls are in the **callers**, not here
- `F:\PlanckOff-Hardware\views\ReportsView.tsx` lines 83–90 — `handleHardwareSetExport` has the `alert()` call; `addToast` is NOT currently available in this component
- `F:\PlanckOff-Hardware\components\reports\ReportGenerationCenter.tsx` lines 37–58 — two export handlers + one placeholder `alert()`; `addToast` is NOT currently available
- `F:\PlanckOff-Hardware\components\settings\CutSheetLibrary.tsx` — has `alert('Please fill in all required fields')`
- `F:\PlanckOff-Hardware\components\projects\RevisionHistory.tsx` — has `alert('Please fill in all required fields')`
- `F:\PlanckOff-Hardware\app\project\[id]\reports\hardware-set\page.tsx` — has `alert('Export failed. Please try again.')`

**Key constraints:**
- `ErrorBoundary` is a class component — React hooks (`useToast`) cannot be used inside it. Import registry constants directly as module-level imports — no hook needed.
- `ErrorBoundary` must keep its class component structure (React requires `getDerivedStateFromError` as a static method on a class). Migrate to a functional component is out of scope and not needed here.
- Switch `ErrorBoundary` from `export default` to named export: `export { ErrorBoundary }`. Check if any file imports it as default and update those imports.
- For `ReportsView.tsx` and `ReportGenerationCenter.tsx`: add `useToast` hook and call `addToast` in the catch blocks. Do NOT add `addToast` as a new prop — use the hook directly.
- For `CutSheetLibrary.tsx` and `RevisionHistory.tsx`: add `useToast` hook and replace `alert()`.
- For `hardware-set/page.tsx`: add `useToast` hook and replace `alert()`.
- Keep `console.error` calls alongside `addToast` calls in catch blocks for developer debugging — this is consistent with the existing pattern in `ReportsView.tsx` (`console.error('Export failed:', error)` stays, only `alert()` is replaced).
- 2-space indentation on all changed/new code. Existing 4-space sections in legacy components can be left as-is if not being touched; the ErrorBoundary rewrite uses 2-space throughout.

---

## Tasks

### Task 1: Rewrite `components/shared/ErrorBoundary.tsx`

Rewrite `F:\PlanckOff-Hardware\components\shared\ErrorBoundary.tsx` completely. The new version:

1. Switches from `export default` to named export `export { ErrorBoundary }`
2. Uses 2-space indentation throughout
3. Imports `GENERAL_ERRORS` directly from `@/constants/errors` (no hook — class component)
4. Shows `GENERAL_ERRORS.UNEXPECTED.message` and `GENERAL_ERRORS.UNEXPECTED.action` instead of `error.toString()` and `componentStack`
5. Uses CSS variable tokens for styling (matching the ErrorDisplay pattern), NOT hardcoded gray/red classes
6. Keeps the "Reload Page" button (`window.location.reload()`)
7. Keeps `componentDidCatch` for `console.error` logging (developers still need the stack trace in the console — just not shown to users)
8. Accepts an optional `fallback` prop of type `ReactNode` for custom override

```tsx
import { Component, ErrorInfo, ReactNode } from 'react';

import { GENERAL_ERRORS } from '@/constants/errors';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional custom fallback UI. If provided, replaces the default error screen. */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches unhandled React render errors and shows a safe fallback UI.
 * Never exposes raw error messages or stack traces to users.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log full details for developer debugging — never shown to users
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg-subtle)] p-4">
          <div className="w-full max-w-md rounded-lg border border-[var(--error-border)] bg-[var(--bg)] p-8 shadow-xl">
            <h1 className="mb-2 text-xl font-semibold text-[var(--error-text)]">
              {GENERAL_ERRORS.UNEXPECTED.message}
            </h1>
            <p className="mb-6 text-sm text-[var(--text-muted)]">
              {GENERAL_ERRORS.UNEXPECTED.action}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-md bg-[var(--primary-action)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export { ErrorBoundary };
```

After writing the file, search for any files that currently import `ErrorBoundary` as a default import:
- Grep for `import ErrorBoundary from` across the project
- Update those imports to named: `import { ErrorBoundary } from '@/components/shared/ErrorBoundary'`

### Task 2: Replace all `alert()` calls with `addToast` using registry entries

Work through each file in this order. In each case: (1) add `useToast` import if not present, (2) add `const { addToast } = useToast();` at the top of the component body (after other hooks), (3) replace the `alert()` call.

**`F:\PlanckOff-Hardware\views\ReportsView.tsx` — line 88**

Current:
```tsx
} catch (error) {
  console.error('Export failed:', error);
  alert('Export failed. Please try again.');
}
```
Replace with:
```tsx
} catch (error) {
  console.error('Export failed:', error);
  addToast({ type: 'error', message: PDF_ERRORS.HARDWARE_SET_EXPORT_FAILED.message, details: PDF_ERRORS.HARDWARE_SET_EXPORT_FAILED.action });
}
```
Also add these imports near the top of the file (after existing imports, in the constants group):
```tsx
import { useToast } from '@/contexts/ToastContext';
import { PDF_ERRORS } from '@/constants/errors';
```
Add `const { addToast } = useToast();` inside the `ReportsView` component body, after the existing `useState` declarations.

**`F:\PlanckOff-Hardware\components\reports\ReportGenerationCenter.tsx` — lines 40–43 and 48–51**

This component currently has no `useToast` access and is a `React.FC`. Add:
```tsx
import { useToast } from '@/contexts/ToastContext';
import { PDF_ERRORS } from '@/constants/errors';
```
Add `const { addToast } = useToast();` inside the `ReportGenerationCenter` function body.

Replace `handleDoorScheduleExport` catch block:
```tsx
} catch (error) {
  console.error('Export failed:', error);
  addToast({ type: 'error', message: PDF_ERRORS.DOOR_SCHEDULE_EXPORT_FAILED.message, details: PDF_ERRORS.DOOR_SCHEDULE_EXPORT_FAILED.action });
}
```

Replace `handleHardwareSetExport` catch block:
```tsx
} catch (error) {
  console.error('Export failed:', error);
  addToast({ type: 'error', message: PDF_ERRORS.HARDWARE_SET_EXPORT_FAILED.message, details: PDF_ERRORS.HARDWARE_SET_EXPORT_FAILED.action });
}
```

Replace `handleSubmittalExport` (currently an `alert()` with a placeholder message):
```tsx
const handleSubmittalExport = (_config: SubmittalExportConfig) => {
  addToast({ type: 'info', message: 'Submittal Package generation is not yet available.' });
};
```
Remove the `console.log` and `alert()` lines entirely.

**`F:\PlanckOff-Hardware\components\settings\CutSheetLibrary.tsx` — `alert('Please fill in all required fields')`**

Read the file first to locate the exact context. Add:
```tsx
import { useToast } from '@/contexts/ToastContext';
import { GENERAL_ERRORS } from '@/constants/errors';
```
Add `const { addToast } = useToast();` in the component body.

Replace:
```tsx
alert('Please fill in all required fields')
```
with:
```tsx
addToast({ type: 'error', message: GENERAL_ERRORS.REQUIRED_FIELD.message })
```

**`F:\PlanckOff-Hardware\components\projects\RevisionHistory.tsx` — `alert('Please fill in all required fields')`**

Read the file first to locate the exact context. Add:
```tsx
import { useToast } from '@/contexts/ToastContext';
import { GENERAL_ERRORS } from '@/constants/errors';
```
Add `const { addToast } = useToast();` in the component body.

Replace:
```tsx
alert('Please fill in all required fields')
```
with:
```tsx
addToast({ type: 'error', message: GENERAL_ERRORS.REQUIRED_FIELD.message })
```

**`F:\PlanckOff-Hardware\app\project\[id]\reports\hardware-set\page.tsx` — `alert('Export failed. Please try again.')`**

Read the file first to locate the full context. This is an App Router page component. Add:
```tsx
import { useToast } from '@/contexts/ToastContext';
import { PDF_ERRORS } from '@/constants/errors';
```
Add `const { addToast } = useToast();` in the component body (this is a `'use client'` page).

Replace:
```tsx
alert('Export failed. Please try again.')
```
with:
```tsx
addToast({ type: 'error', message: PDF_ERRORS.EXPORT_FAILED.message, details: PDF_ERRORS.EXPORT_FAILED.action })
```

---

### Task 3: Replace Informational `alert()` Calls

Two remaining `alert()` calls are informational (not errors) and not covered in the migrate-strings plan. Replace both with `addToast` info toasts.

**File:** `components/team/TeamManagement.tsx`
- Find: `alert('Resending invite to ${member.email}')`  
- Replace with: `addToast({ type: 'info', message: \`Invitation resent to ${member.email}.\` })`
- Ensure `useToast` (or equivalent `addToast` hook) is imported at the top of the component

**File:** `views/HardwareScheduleView.tsx` (or wherever the "coming soon" alert lives — grep for `coming soon` to confirm path)
- Find: `alert('Excel export functionality coming soon!')`  
- Replace with: `addToast({ type: 'info', message: 'Excel export is coming soon.' })`
- Note: this is a placeholder, not an error — do NOT use an error registry entry here

---

## Verification

- [ ] `components/shared/ErrorBoundary.tsx` has zero occurrences of `error.toString()` or `componentStack`
- [ ] `ErrorBoundary` exports as named export: grep for `export { ErrorBoundary }` returns a match; grep for `export default ErrorBoundary` returns zero matches
- [ ] All files that previously imported `ErrorBoundary` as default now import it as named
- [ ] `npx tsc --noEmit` passes with no new errors
- [ ] Grep across the codebase for `alert(` in `views/`, `components/`, `app/` returns zero matches (excluding node_modules and `.planning/`)
- [ ] Trigger an export from `ReportsView.tsx` with an intentional error condition (e.g., temporarily throw inside `exportHardwareSet`) — confirm a Sonner toast appears instead of a browser `alert()` dialog
- [ ] Manually trigger an ErrorBoundary by temporarily throwing inside a child component — confirm the fallback UI shows `GENERAL_ERRORS.UNEXPECTED.message` ("Something went wrong.") and the action hint, with NO raw error class name or stack trace visible
- [ ] The "Reload Page" button in the ErrorBoundary fallback is functional (clicking it reloads the page)
