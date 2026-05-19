# Plan: Create ErrorDisplay Component

**Phase:** 2 — Error Message Registry
**Goal:** Build a reusable `<ErrorDisplay>` component that renders any registry error using the app's CSS variable tokens, with a compact inline variant for form fields and a full alert variant for page/modal-level errors.
**Requirements:** ERR-04
**Dependencies:** 02-PLAN-error-registry.md (needs `AppError` type from `constants/errors/index.ts`)

---

## Context

**Files to read before starting:**
- `F:\PlanckOff-Hardware\constants\errors\index.ts` — import `AppError` type from here
- `F:\PlanckOff-Hardware\app\globals.css` — confirm the four CSS variable tokens exist in both `:root` and `.dark`: `--error-bg`, `--error-text`, `--error-border`, `--error-dot`
- `F:\PlanckOff-Hardware\components\ui\badge.tsx` — reference for how the `destructive` variant uses the same tokens; follow the same `cn()` + CVA pattern
- `F:\PlanckOff-Hardware\lib\utils.ts` — import `cn` from here
- `F:\PlanckOff-Hardware\app\(auth)\login\page.tsx` lines 110–116 — the existing inline error `<div>` pattern this component replaces; the hardcoded `red-500/10` classes must become CSS variable tokens in the new component

**Key constraints:**
- File location: `F:\PlanckOff-Hardware\components\shared\ErrorDisplay.tsx`
- Named export only — `export function ErrorDisplay(...)` — no `export default`
- `'use client'` directive at top (renders in browser)
- Props: `error: AppError | string | null`, `className?: string`, `compact?: boolean`
- When `compact={true}`: inline badge-style — single line, tighter padding (`px-2 py-1`), text-xs, no action hint rendered
- When `compact={false}` (default): alert-style block — `px-4 py-3`, renders `message` as `text-sm font-medium` and `action` as `text-xs opacity-75` on a second line
- Always returns `null` when `error` is `null` — no empty DOM nodes
- `role="alert"` on the wrapper div for accessibility (browser handles screen reader announcement)
- Uses CSS variable tokens exclusively: `border-[var(--error-border)]`, `bg-[var(--error-bg)]`, `text-[var(--error-text)]` — no hardcoded `red-*` Tailwind classes
- 2-space indentation, single quotes, trailing commas
- Import order: React → internal types → internal lib/utils → (no UI components needed)

---

## Tasks

### Task 1: Create `components/shared/ErrorDisplay.tsx`

Create `F:\PlanckOff-Hardware\components\shared\ErrorDisplay.tsx` with the following exact content:

```tsx
'use client';

import type { AppError } from '@/constants/errors';
import { cn } from '@/lib/utils';

interface ErrorDisplayProps {
  /** Registry AppError object or plain string. Renders nothing when null. */
  error: AppError | string | null;
  /** Additional Tailwind classes merged onto the wrapper element. */
  className?: string;
  /**
   * compact — inline badge-style for use inside form fields.
   * Default (false) — full alert block with optional action hint.
   */
  compact?: boolean;
}

/**
 * Renders a user-facing error from the registry or a plain string.
 * Uses CSS variable tokens (--error-bg, --error-text, --error-border) so it
 * is automatically correct in both light and dark modes.
 */
export function ErrorDisplay({ error, className, compact = false }: ErrorDisplayProps) {
  if (!error) return null;

  const message = typeof error === 'string' ? error : error.message;
  const action = typeof error === 'string' ? undefined : error.action;

  if (compact) {
    return (
      <span
        role="alert"
        className={cn(
          'inline-flex items-center rounded border border-[var(--error-border)] bg-[var(--error-bg)] px-2 py-1 text-xs text-[var(--error-text)]',
          className,
        )}
      >
        {message}
      </span>
    );
  }

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

### Task 2: Replace the login page inline error `<div>` with `<ErrorDisplay>`

This is the most visible instance of Pattern B (inline form error div with hardcoded red classes). Replacing it validates the component in its primary use case.

Edit `F:\PlanckOff-Hardware\app\(auth)\login\page.tsx`:

1. Add the import after the existing `useAuth` import line:
   ```tsx
   import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
   ```

2. Replace lines 110–116 (the inline error block):
   ```tsx
   {error && (
     <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3">
       <p className="text-sm text-red-600 dark:text-red-400">
         {error}
       </p>
     </div>
   )}
   ```
   with:
   ```tsx
   <ErrorDisplay error={error} />
   ```

   Note: `error` here is `string | null` — `ErrorDisplay` accepts this type directly and renders `null` when `error` is `null`, so the conditional wrapper is no longer needed.

3. The `error` state type stays `string | null` — no change to the `useState` declaration. The `ErrorDisplay` component is typed to accept `string | null` and handles both cases.

---

## Verification

- [ ] `components/shared/ErrorDisplay.tsx` exists with a named export `ErrorDisplay`
- [ ] No `export default` in `ErrorDisplay.tsx`
- [ ] `npx tsc --noEmit` passes with no new errors
- [ ] Open the app at `/login` in a browser and submit the form with wrong credentials — the error message appears styled with the app's error token colors (red-tinted background + border, NOT the former `red-500/10` hardcoded class)
- [ ] Inspect the error element in DevTools — confirm `role="alert"` attribute is present
- [ ] Toggle dark mode — the error block colors shift correctly (dark token values apply) without any additional CSS
- [ ] Pass `compact={true}` in a temporary test render — confirm inline badge-style renders (can be verified by temporarily adding `<ErrorDisplay error="test" compact />` to a page, then removing it)
- [ ] When `error={null}` nothing is rendered — no empty `<div>` in the DOM
