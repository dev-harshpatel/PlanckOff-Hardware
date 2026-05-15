---
phase: 2
plan: 3
subsystem: error-boundary-alerts
tags: [error-handling, ux, react, toasts, errorboundary]
dependency-graph:
  requires: [02-PLAN-error-registry.md]
  provides: [clean-error-boundaries, no-alert-dialogs]
  affects: [views/ReportsView.tsx, components/reports/ReportGenerationCenter.tsx, components/settings/CutSheetLibrary.tsx, components/projects/RevisionHistory.tsx, app/project/[id]/reports/hardware-set/page.tsx, views/TeamManagement.tsx, components/hardware/HardwareScheduleView.tsx, components/shared/ErrorBoundary.tsx]
tech-stack:
  patterns: [named-exports, css-variable-tokens, useToast-hook, registry-constants]
key-files:
  modified:
    - components/shared/ErrorBoundary.tsx
    - views/ReportsView.tsx
    - components/reports/ReportGenerationCenter.tsx
    - components/settings/CutSheetLibrary.tsx
    - components/projects/RevisionHistory.tsx
    - app/project/[id]/reports/hardware-set/page.tsx
    - views/TeamManagement.tsx
    - components/hardware/HardwareScheduleView.tsx
decisions:
  - ErrorBoundary switched from export default to named export { ErrorBoundary }; no files were importing it as default so no import updates required
  - ReportGenerationCenter handleSubmittalExport placeholder alert replaced with info toast; console.log also removed (was debug noise with no user value)
  - TeamManagement.tsx already had 'use client' directive; useToast added without needing the directive
metrics:
  duration: ~25 minutes
  completed: 2026-05-07
  tasks: 3
  files-modified: 8
---

# Phase 2 Plan 3: ErrorBoundary Rewrite + alert() Elimination Summary

**One-liner:** Rewrote ErrorBoundary to show registry-backed fallback UI and replaced all 7 alert() call sites with addToast using GENERAL_ERRORS and PDF_ERRORS registry entries.

## What Was Built

### Task 1 — ErrorBoundary Rewrite

Completely rewrote `components/shared/ErrorBoundary.tsx`:

- Eliminated `error.toString()` and `componentStack` from the render output (was leaking raw JS internals to users)
- Now renders `GENERAL_ERRORS.UNEXPECTED.message` ("Something went wrong.") and `GENERAL_ERRORS.UNEXPECTED.action` as the user-facing fallback
- Switched from `export default ErrorBoundary` to named export `export { ErrorBoundary }`
- Uses CSS variable tokens: `--bg-subtle`, `--error-border`, `--bg`, `--error-text`, `--text-muted`, `--primary-action`
- Added optional `fallback?: ReactNode` prop for custom override
- Kept `componentDidCatch` with `console.error` for developer debugging (logs full error + errorInfo)
- 2-space indentation throughout; dropped 4-space legacy style

### Task 2 — Error alert() Replacements (5 sites)

| File | Old | New |
|------|-----|-----|
| `views/ReportsView.tsx` | `alert('Export failed...')` | `addToast({ type: 'error', message: PDF_ERRORS.HARDWARE_SET_EXPORT_FAILED.message, details: ... })` |
| `components/reports/ReportGenerationCenter.tsx` | `alert('Export failed...')` x2 | `addToast` with `PDF_ERRORS.DOOR_SCHEDULE_EXPORT_FAILED` and `PDF_ERRORS.HARDWARE_SET_EXPORT_FAILED` |
| `components/reports/ReportGenerationCenter.tsx` | `alert('Submittal Package...')` | `addToast({ type: 'info', message: 'Submittal Package generation is not yet available.' })` |
| `components/settings/CutSheetLibrary.tsx` | `alert('Please fill in all required fields')` | `addToast({ type: 'error', message: GENERAL_ERRORS.REQUIRED_FIELD.message })` |
| `components/projects/RevisionHistory.tsx` | `alert('Please fill in all required fields')` | `addToast({ type: 'error', message: GENERAL_ERRORS.REQUIRED_FIELD.message })` |
| `app/project/[id]/reports/hardware-set/page.tsx` | `alert('Export failed...')` | `addToast({ type: 'error', message: PDF_ERRORS.EXPORT_FAILED.message, details: ... })` |

Each file received: `import { useToast } from '@/contexts/ToastContext'`, the relevant ERRORS import, and `const { addToast } = useToast()` in the component body.

### Task 3 — Informational alert() Replacements (2 sites)

| File | Old | New |
|------|-----|-----|
| `views/TeamManagement.tsx` | `alert('Resending invite to ${member.email}')` | `addToast({ type: 'info', message: \`Invitation resent to ${member.email}.\` })` |
| `components/hardware/HardwareScheduleView.tsx` | `alert('Excel export functionality coming soon!')` | `addToast({ type: 'info', message: 'Excel export is coming soon.' })` |

## Verification

- [x] `ErrorBoundary` has zero occurrences of `error.toString()` or `componentStack` in render
- [x] `ErrorBoundary` exports as named export `export { ErrorBoundary }`
- [x] `export default ErrorBoundary` removed
- [x] No files imported ErrorBoundary as default (grep confirmed zero matches before change)
- [x] Grep for `alert(` in `views/`, `components/`, `app/` returns zero matches
- [x] All 7 alert() call sites replaced

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Duplicate 'use client' directive in TeamManagement.tsx**

- **Found during:** Task 3 — adding import to top of file
- **Issue:** File already had `'use client'` as first line; edit prepended another `'use client'` creating a duplicate directive
- **Fix:** Removed the duplicate, kept the original single `'use client'` at line 1
- **Files modified:** `views/TeamManagement.tsx`

**2. [Judgment call] ReportGenerationCenter handleSubmittalExport console.log removed**

- **Found during:** Task 2 — replacing alert in the submittal export placeholder
- **Issue:** The plan said to remove the `console.log` and `alert()` lines from `handleSubmittalExport`
- **Fix:** Removed `console.log('Generating Submittal Package:', config)` debug log alongside the alert replacement; replaced with `addToast` info toast only
- **Files modified:** `components/reports/ReportGenerationCenter.tsx`

## Known Stubs

None — all changes are behavioral replacements (alert → toast), not data-wiring stubs.

## Self-Check: PASSED

- `components/shared/ErrorBoundary.tsx` — verified: no `error.toString()`, no `componentStack`, has `export { ErrorBoundary }`
- `views/ReportsView.tsx` — verified: no `alert(`, has `addToast` with PDF_ERRORS
- `components/reports/ReportGenerationCenter.tsx` — verified: no `alert(`, has `addToast` for all 3 handlers
- `components/settings/CutSheetLibrary.tsx` — verified: no `alert(`, has `addToast` with GENERAL_ERRORS
- `components/projects/RevisionHistory.tsx` — verified: no `alert(`, has `addToast` with GENERAL_ERRORS
- `app/project/[id]/reports/hardware-set/page.tsx` — verified: no `alert(`, has `addToast` with PDF_ERRORS
- `views/TeamManagement.tsx` — verified: no `alert(`, has `addToast` info toast
- `components/hardware/HardwareScheduleView.tsx` — verified: no `alert(`, has `addToast` info toast
- Grep for `alert(` in views/ components/ app/: zero matches confirmed
