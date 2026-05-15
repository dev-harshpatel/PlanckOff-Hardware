---
phase: 2
plan: 1
subsystem: constants/errors
tags: [error-registry, typescript, constants, as-const]
dependency_graph:
  requires: []
  provides: [constants/errors, AppError, ERRORS namespace]
  affects: [all error surfaces in auth, doors, hardware, pdf, general domains]
tech_stack:
  added: []
  patterns: [as const satisfies Record<string, AppError>, TypeScript satisfies keyword, barrel export pattern]
key_files:
  created:
    - constants/errors/index.ts
    - constants/errors/auth.ts
    - constants/errors/general.ts
    - constants/errors/pdf.ts
    - constants/errors/doors.ts
    - constants/errors/hardware.ts
  modified: []
decisions:
  - Used as const satisfies Record<string, AppError> for full literal inference with type-checking
  - AppError interface placed only in index.ts; domain files import type from index
  - ERRORS convenience namespace assembled in index.ts after all re-exports
  - No export default anywhere in the 6 files, per codebase convention
metrics:
  duration: ~10 minutes
  completed: 2026-05-07
  tasks_completed: 3
  files_created: 6
  files_modified: 0
requirements: [ERR-01, ERR-07]
---

# Phase 2 Plan 1: Error Registry Summary

**One-liner:** Typed error message registry with `AppError` interface across 5 domains (auth, doors, hardware, pdf, general) using `as const satisfies` pattern.

---

## What Was Built

Created `constants/errors/` as the single source of truth for all user-facing error strings. Six files in total:

### `constants/errors/index.ts`
- Defines the `AppError` interface: `{ code: string; message: string; action?: string }`
- Re-exports all five domain registries by name
- Assembles the `ERRORS` convenience namespace: `ERRORS.AUTH`, `ERRORS.DOORS`, `ERRORS.HARDWARE`, `ERRORS.PDF`, `ERRORS.GENERAL`

### `constants/errors/auth.ts` — `AUTH_ERRORS` (8 entries)
Covers: invalid credentials, network error, session failure, login failed, access denied, set password failed, invite failed, resend invite failed.

### `constants/errors/general.ts` — `GENERAL_ERRORS` (8 entries)
Covers: unexpected catch-all, network, server, unauthorized, not found, required field, save failed, timeout.

### `constants/errors/pdf.ts` — `PDF_ERRORS` (5 entries)
Covers: generic export failed, door schedule export, hardware set export, submittal export, PDF parse failed.

### `constants/errors/doors.ts` — `DOOR_ERRORS` (14 entries)
Covers: load/update/create/delete/review failed, column name required, CSV empty/missing columns/no valid data/missing set name, Excel empty/missing columns/no valid data/no hardware sets.

### `constants/errors/hardware.ts` — `HARDWARE_ERRORS` (13 entries)
Covers: upload failed, hardware PDF failed, door schedule failed, PDF file required, server error, processing failed, assignment failed, invalid response, prep generation failed, no prep data, DOCX library missing, DOCX read failed, timeout.

---

## Decisions Made

1. **`as const satisfies Record<string, AppError>`** — chosen over plain `as const` to get both literal type inference and structural type-checking against `AppError` without widening. TypeScript 5.8.2 fully supports this.

2. **`AppError` interface in `index.ts` only** — domain files import `type { AppError } from './index'`. Avoids a second declaration point and keeps the interface co-located with the ERRORS namespace.

3. **ERRORS namespace assembled after re-exports** — `index.ts` uses named re-exports first (`export { AUTH_ERRORS } from './auth'`) then imports for the namespace assembly. This is the pattern that avoids circular reference issues.

4. **No `export default`** — consistent with existing `constants/auth.ts` and `constants/roles.ts` pattern.

5. **Code prefixes**: `AUTH_`, `DOOR_`, `HW_`, `PDF_`, `GEN_` in SCREAMING_SNAKE_CASE — matches the recommended convention from RESEARCH.md.

---

## Verification Results

- `npx tsc --noEmit` — zero errors introduced in `constants/errors/`. Pre-existing errors in other files (ElectrificationEditor, RevisionHistory, etc.) are unaffected and were pre-existing before this plan.
- All 6 files confirmed in `constants/errors/` directory.
- No `export default` in any file.
- `ERRORS.AUTH.INVALID_CREDENTIALS.message` resolves to `'Invalid email or password.'`
- All registry keys map to strings identified in RESEARCH.md section 1 (no invented codes).

---

## Deviations from Plan

None — plan executed exactly as written. The exact content from the plan was used verbatim for all 6 files.

---

## Known Stubs

None. This plan creates constants-only files with no UI rendering or data wiring. All values are static string literals.

---

## Self-Check: PASSED

Files confirmed present:
- `constants/errors/index.ts` — FOUND
- `constants/errors/auth.ts` — FOUND
- `constants/errors/general.ts` — FOUND
- `constants/errors/pdf.ts` — FOUND
- `constants/errors/doors.ts` — FOUND
- `constants/errors/hardware.ts` — FOUND

Commit `06bb92e` confirmed in git log.
