---
phase: "02"
plan: "02"
subsystem: error-display
tags: [error-handling, components, ui, accessibility, dark-mode]
dependency_graph:
  requires: [02-01-error-registry]
  provides: [ErrorDisplay-component, login-page-error-display]
  affects: [app/(auth)/login/page.tsx, components/shared/]
tech_stack:
  added: []
  patterns: [css-variable-tokens, named-export-component, cn-class-merging, role-alert-accessibility]
key_files:
  created:
    - components/shared/ErrorDisplay.tsx
  modified:
    - app/(auth)/login/page.tsx
decisions:
  - "Use CSS variable tokens exclusively (--error-bg, --error-text, --error-border) — no hardcoded Tailwind red-* classes"
  - "Component accepts AppError | string | null for migration-period backward compatibility with existing string-based error state"
  - "ErrorDisplay returns null when error is null/undefined — no empty DOM nodes, no conditional wrapper needed at call site"
  - "compact variant uses inline span for form field errors; default variant is block-level alert div with optional action hint"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-07"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 02 Plan 02: ErrorDisplay Component Summary

**One-liner:** Reusable ErrorDisplay component using CSS variable tokens with full alert and compact badge variants, wired into the login page replacing hardcoded red-* Tailwind classes.

## Objective

Build `<ErrorDisplay>` — a theme-aware, accessible error component that renders any registry `AppError` or plain string using the app's CSS variable token system, replacing four inline hardcoded red-color error divs across the codebase. This plan covers the component creation and the login page migration.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create `components/shared/ErrorDisplay.tsx` | `145f149` | `components/shared/ErrorDisplay.tsx` (created) |
| 2 | Wire ErrorDisplay into login page | `680d1f6` | `app/(auth)/login/page.tsx` (modified) |

## What Was Built

### `components/shared/ErrorDisplay.tsx`

Named export component with two rendering modes:

- **Full variant (default):** Block-level `<div role="alert">` with `rounded-md border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3`. Renders message as `text-sm font-medium` in `text-[var(--error-text)]`. Renders optional `action` hint below as `text-xs opacity-75`.
- **Compact variant (`compact={true}`):** Inline `<span role="alert">` with `px-2 py-1 text-xs` — badge-style for form field errors. No action hint.

Both variants:
- Accept `AppError | string | null` — returns `null` when error is falsy (no empty DOM nodes)
- Use `cn()` for class merging with optional `className` prop
- Use CSS variable tokens exclusively — zero hardcoded `red-*` or `rose-*` classes
- Carry `role="alert"` for screen reader accessibility

### Login Page Migration

Replaced lines 110-116 in `app/(auth)/login/page.tsx`:

```tsx
// Before
{error && (
  <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3">
    <p className="text-sm text-red-600 dark:text-red-400">
      {error}
    </p>
  </div>
)}

// After
<ErrorDisplay error={error} />
```

The `useState<string | null>` type is unchanged — `ErrorDisplay` accepts this directly and handles null internally.

## Verification Checklist

- [x] `components/shared/ErrorDisplay.tsx` exists with named export `ErrorDisplay`
- [x] No `export default` in `ErrorDisplay.tsx`
- [x] No hardcoded `red-*` or `rose-*` Tailwind classes in `ErrorDisplay.tsx`
- [x] No hardcoded `red-500/10`, `red-600`, `red-400` in `app/(auth)/login/page.tsx`
- [x] `ErrorDisplay` accepts `AppError | string | null` and returns `null` when falsy
- [x] `role="alert"` present on both variants
- [x] Both commits on branch `AP-Sprint-1`
- [x] TypeScript errors in `ErrorDisplay.tsx` — none (pre-existing errors in unrelated files confirmed not caused by this plan)

## Deviations from Plan

None — plan executed exactly as written. The component content matches the plan's exact specification verbatim.

## Known Stubs

None — the component is fully wired. `ErrorDisplay` receives live `error` state from `useState`, not mock/placeholder data.

## Remaining Inline Error Divs (Out of Scope for this Plan)

Three additional Pattern B locations still use hardcoded colors — to be addressed in a future plan:
- `components/team/InviteTeamMemberModal.tsx`
- `components/team/InviteMemberModal.tsx`
- `components/settings/MasterItemFormModal.tsx`
