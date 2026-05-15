# Plan: Verification — Error Message Registry

**Phase:** 2 — Error Message Registry
**Goal:** Confirm all seven ERR requirements are fully met: run grep audits to prove zero inline strings remain, manually exercise each error surface, and confirm no raw error internals are ever shown to users.
**Requirements:** ERR-02, ERR-03, ERR-05
**Dependencies:** All four preceding plans must be complete (error-registry, error-display, errorboundary-service, migrate-strings)

---

## Context

**Files to read before starting:**
- `F:\PlanckOff-Hardware\.planning\phases\02-error-message-registry\02-RESEARCH.md` — section 7 (Files That Will Change) is the definitive list; use it as the checklist backbone
- `F:\PlanckOff-Hardware\constants\errors\index.ts` — confirm the `ERRORS` namespace is fully assembled and all domain exports are present
- `F:\PlanckOff-Hardware\.planning\REQUIREMENTS.md` — ERR-01 through ERR-07 acceptance criteria

**Key constraints:**
- No test runner is configured in this project — all verification is grep-based + manual browser testing
- Grep must exclude `node_modules/`, `.next/`, `.planning/`, `.claude/`, and `constants/errors/` itself (the registry is the authorised location for strings)
- The worktrees directory `.claude/worktrees/` contains mirror copies — exclude it from all greps to avoid false negatives
- Manual test steps are listed per error surface — the executor must walk through each one in a running dev server (`npm run dev`)

---

## Tasks

### Task 1: Automated grep audit — zero inline error strings outside the registry

Run the following grep commands from the project root (`F:\PlanckOff-Hardware`) and confirm each returns zero results. A non-zero result means a string was missed in migration.

**Step 1 — Find remaining hardcoded toast error strings:**

The pattern targets `addToast` calls that still contain a string literal for `message` rather than a registry reference. Any result is a migration gap.

```
grep -rn "addToast.*type.*error.*message.*['\"]" \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude-dir=".claude" \
  --exclude-dir=.planning \
  contexts/ hooks/ views/ components/ app/ services/
```

Expected: zero matches.

**Step 2 — Find remaining `alert(` calls in component/view files:**

```
grep -rn "alert(" \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude-dir=".claude" \
  --exclude-dir=.planning \
  views/ components/ app/ hooks/ contexts/ services/
```

Expected: zero matches. (The two non-error `alert()` calls in `TeamManagement.tsx` — "Resending invite" — and `HardwareScheduleView.tsx` — "coming soon" — must also have been replaced with `addToast` calls during Plan 3/4; if they were not addressed, address them now using `ERRORS.GENERAL.UNEXPECTED.message` for the hardware placeholder and an appropriate info toast for the resend action.)

**Step 3 — Find `error.toString()` or `componentStack` renders:**

```
grep -rn "error\.toString()\|componentStack" \
  --include="*.tsx" \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude-dir=".claude" \
  --exclude-dir=.planning \
  components/ views/ app/
```

Expected: zero matches.

**Step 4 — Find inline hardcoded red Tailwind classes in error contexts:**

This catches any remaining Pattern B divs that were not migrated to `<ErrorDisplay>`:

```
grep -rn "bg-red-500\|text-red-600\|text-red-400\|border-red-500" \
  --include="*.tsx" \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude-dir=".claude" \
  --exclude-dir=.planning \
  components/ views/ app/
```

Expected: zero matches (except for any intentional non-error red uses like warning badges — inspect each match to confirm).

**Step 5 — Confirm registry files exist and have correct shape:**

```
grep -n "as const satisfies Record<string, AppError>" \
  constants/errors/auth.ts \
  constants/errors/doors.ts \
  constants/errors/hardware.ts \
  constants/errors/pdf.ts \
  constants/errors/general.ts
```

Expected: five matches, one per file.

```
grep -n "export interface AppError\|export const ERRORS" \
  constants/errors/index.ts
```

Expected: two matches.

**Step 6 — Confirm no `export default` in registry or ErrorDisplay:**

```
grep -rn "export default" \
  constants/errors/ \
  components/shared/ErrorDisplay.tsx \
  components/shared/ErrorBoundary.tsx
```

Expected: zero matches.

**Step 7 — TypeScript compilation check:**

```
npx tsc --noEmit
```

Expected: exits with code 0 (no new type errors introduced by the migration).

### Task 2: Manual browser verification — each error surface

Start the dev server (`npm run dev`). Walk through each scenario below. Record pass/fail.

**Auth errors (ERR-03):**
- [ ] Navigate to `/login`. Submit with wrong email/password → inline `<ErrorDisplay>` appears with "Invalid email or password." in the app's error token colors. No hardcoded red classes. Dark mode toggles colors correctly.
- [ ] Disconnect network (DevTools → Network → Offline). Submit login form → "Network error. Please check your connection." appears.

**Door errors (ERR-03):**
- [ ] Open a project's door database. If an import flow exists, attempt to import a malformed CSV (empty file or missing headers) → a Sonner toast appears with the relevant `ERRORS.DOORS.*` message. No alert dialog appears.

**Hardware errors (ERR-03):**
- [ ] Attempt a hardware PDF upload → if it fails (or simulate failure) → Sonner toast with `ERRORS.HARDWARE.*` message.

**PDF export errors (ERR-06):**
- [ ] Go to Reports. Click export Hardware Set. If the export succeeds normally, temporarily disable it to test failure path (or confirm the handler path exists). The key check: no `alert()` dialog appears under any export failure condition.

**ErrorBoundary (ERR-05):**
- [ ] Temporarily add `throw new Error('test')` inside any rendered child component. Reload the page.
- [ ] Confirm the fallback UI shows "Something went wrong." and "Please reload the page or try again."
- [ ] Confirm NO raw error class name, message string, or stack trace is visible in the UI.
- [ ] Confirm the "Reload Page" button is present and clicking it reloads.
- [ ] Remove the `throw` and restore the component.

**Inline form errors (ERR-04):**
- [ ] Open the Invite Team Member modal. Trigger a validation or network error → `<ErrorDisplay>` renders inline, no raw string `<div>` with hardcoded red classes.
- [ ] Open the Master Item form modal. Leave the Name field blank and attempt to save → `<ErrorDisplay>` renders the required field message.

**Single source of truth (ERR-07):**
- [ ] In `constants/errors/auth.ts`, change `INVALID_CREDENTIALS.message` to "Wrong email or password." (a test change). Reload the app and trigger a login failure → the new string appears everywhere `ERRORS.AUTH.INVALID_CREDENTIALS` is referenced without any other file changes. Revert the string after confirming.

---

## Verification

- [ ] All 7 grep commands in Task 1 return zero unexpected matches
- [ ] `npx tsc --noEmit` exits with code 0
- [ ] All manual browser scenarios in Task 2 pass
- [ ] ERR-01: `constants/errors/` directory has all 6 files with correct shapes — CONFIRMED
- [ ] ERR-02: No hardcoded inline error strings outside the registry — CONFIRMED by grep
- [ ] ERR-03: Auth, door, hardware, PDF, AI extraction failure points all map to named registry entries — CONFIRMED by manual test
- [ ] ERR-04: `<ErrorDisplay>` renders correctly in both light and dark mode — CONFIRMED
- [ ] ERR-05: ErrorBoundary shows no raw JS error or stack trace — CONFIRMED by boundary test
- [ ] ERR-06: All error surfaces (toasts, inline form errors, no more alert dialogs) use registry — CONFIRMED
- [ ] ERR-07: Single string change in `constants/errors/` propagates everywhere — CONFIRMED by ERR-07 test in Task 2
