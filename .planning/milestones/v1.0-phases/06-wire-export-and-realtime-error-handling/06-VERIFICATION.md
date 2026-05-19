---
phase: 06-wire-export-and-realtime-error-handling
verified: 2026-05-13T08:00:00Z
status: passed
score: 10/10 must-haves verified
re_verification: true
  previous_status: gaps_found
  previous_score: 5/10
  gaps_closed:
    - "Changes from all three plans are merged into AP-Sprint-1 and present in the working tree"
    - "Pricing page load errors surface as registry-driven toasts (not hardcoded strings)"
    - "Subscription errors surface as toasts on the pricing page via the onError -> addToast path"
    - "All three plan worktree branches are internally consistent (no inter-branch conflicts when merged)"
  gaps_remaining: []
  regressions: []
---

# Phase 6: Wire Export and Realtime Error Handling — Verification Report

**Phase Goal:** Complete the error registry integration by adding error handling to all export paths and Realtime subscription failures — zero silent export failures, every failure point connected to the registry with user-visible feedback.
**Verified:** 2026-05-13T08:00:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (commits 32380de, 8c3eea4, 437e67e, e0d10ee, 26c1c00, b047f6e, 39fe61d, 84d71cb cherry-picked onto AP-Sprint-1)

---

## Commit Verification

All 8 gap-closure commits are confirmed present on AP-Sprint-1:

| Commit | Description |
|--------|-------------|
| 84d71cb | fix(06-gap): reconcile pricing page — keep useProjectData, real addToast, registry load-error toast |
| 39fe61d | feat(06-03): pass addToast into useProjectPersistence call in ProjectView.tsx |
| b047f6e | feat(06-03): add addToast to useProjectPersistence; replace console.warn with console.error + SAVE_FAILED toast |
| 26c1c00 | feat(06-02): wire onError in useProjectData to addToast with REALTIME_ERRORS.SUBSCRIPTION_FAILED |
| e0d10ee | feat(06-02): add onError callback to useProjectRealtime; invoke from subscribe err branch |
| 437e67e | feat(06-02): add REALTIME_ERRORS registry and wire into ERRORS namespace |
| 8c3eea4 | feat(06-01): thread addToast from PricingReportConfig into usePricingExport via useToast() |
| 32380de | feat(06-01): add addToast to usePricingExport; wrap all three handlers in try/catch with PDF_ERRORS.EXPORT_FAILED toast |

---

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | When handleDownloadExcel throws, an error toast with PDF_ERRORS.EXPORT_FAILED text appears | VERIFIED | hooks/usePricingExport.ts line 158-165: catch(err) calls addToast with PDF_ERRORS.EXPORT_FAILED.message/.action |
| 2 | When handleDownloadPdf throws, an error toast with PDF_ERRORS.EXPORT_FAILED text appears | VERIFIED | hooks/usePricingExport.ts line 271-278: same pattern confirmed |
| 3 | When handleDownloadProposalPdf throws, an error toast with PDF_ERRORS.EXPORT_FAILED text appears | VERIFIED | hooks/usePricingExport.ts line 568-574: same pattern confirmed |
| 4 | A REALTIME_ERRORS.SUBSCRIPTION_FAILED entry exists in the error registry | VERIFIED | constants/errors/realtime.ts confirmed present (14 lines, code: 'RT_SUBSCRIPTION_FAILED'); re-exported in constants/errors/index.ts; ERRORS.REALTIME key added |
| 5 | When a Supabase subscribe callback fires with err, an onError callback is invoked | VERIFIED | hooks/useProjectRealtime.ts line 54: onErrorRef.current?.(err as Error) inside subscribe(_status, err) if(err) branch |
| 6 | useProjectData wires the onError callback to addToast with REALTIME_ERRORS.SUBSCRIPTION_FAILED | VERIFIED | hooks/useProjectData.ts lines 278-284: onError lambda calls addToast({ type: 'error', message: ERRORS.REALTIME.SUBSCRIPTION_FAILED.message, details: ERRORS.REALTIME.SUBSCRIPTION_FAILED.action }) |
| 7 | Pricing page (app/project/[id]/reports/pricing/page.tsx) uses real addToast from useToast() — noopToast gone | VERIFIED | pricing/page.tsx line 28: const { addToast } = useToast(); line 31: addToast passed into useProjectData; grep for 'noopToast' returns zero matches |
| 8 | Pricing page load-error catch uses ERRORS.GENERAL.UNEXPECTED (no hardcoded strings) | VERIFIED | pricing/page.tsx line 73: addToast({ type: 'error', message: ERRORS.GENERAL.UNEXPECTED.message, details: ERRORS.GENERAL.UNEXPECTED.action }); no literal 'Failed to load' strings found |
| 9 | When saveToFinalJson fails, an error toast with GENERAL_ERRORS.SAVE_FAILED text appears | VERIFIED | hooks/useProjectPersistence.ts lines 150-154: catch block calls addToast({ type: 'error', message: GENERAL_ERRORS.SAVE_FAILED.message, details: GENERAL_ERRORS.SAVE_FAILED.action }) |
| 10 | When saveToHardwarePdf fails, an error toast with GENERAL_ERRORS.SAVE_FAILED text appears | VERIFIED | hooks/useProjectPersistence.ts lines 182-186: identical addToast pattern with GENERAL_ERRORS.SAVE_FAILED |

**Score:** 10/10 truths verified

---

## Required Artifacts

### Plan 06-01

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `hooks/usePricingExport.ts` | addToast param, 3 try/catch blocks, PDF_ERRORS.EXPORT_FAILED (3x) | VERIFIED | Lines 49: addToast field in interface; lines 82+: addToast destructured; 3 try blocks confirmed; PDF_ERRORS.EXPORT_FAILED at lines 162, 275, 572 |
| `components/pricing/PricingReportConfig.tsx` | useToast import, addToast destructure, passed to usePricingExport | VERIFIED | Line 18: import { useToast }; line 43: const { addToast } = useToast(); line 201: addToast passed into usePricingExport |

### Plan 06-02

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `constants/errors/realtime.ts` | REALTIME_ERRORS.SUBSCRIPTION_FAILED, min 12 lines | VERIFIED | File exists, 14 lines, contains SUBSCRIPTION_FAILED with code/message/action; satisfies Record<string, AppError> |
| `constants/errors/index.ts` | REALTIME_ERRORS re-export and ERRORS.REALTIME namespace key | VERIFIED | Line 18: export { REALTIME_ERRORS } from './realtime'; line 37: REALTIME: REALTIME_ERRORS in ERRORS const |
| `hooks/useProjectRealtime.ts` | onError? optional callback, onErrorRef, invocation from subscribe err branch | VERIFIED | Line 11: onError?: (err: Error) => void; line 29-30: onErrorRef stored; line 54: onErrorRef.current?.(err as Error) in err branch |
| `hooks/useProjectData.ts` | onError property in useProjectRealtime call referencing REALTIME_ERRORS.SUBSCRIPTION_FAILED | VERIFIED | Lines 278-284: onError lambda with ERRORS.REALTIME.SUBSCRIPTION_FAILED message and action |
| `app/project/[id]/reports/pricing/page.tsx` | useToast wired, no noopToast, ERRORS.GENERAL.UNEXPECTED in load-error catch, useProjectData retained | VERIFIED | All four conditions confirmed; setPricingItemsCallback and setPricingProposalCallback still destructured from useProjectData and passed to PricingReportConfig |

### Plan 06-03

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `hooks/useProjectPersistence.ts` | addToast required param; GENERAL_ERRORS.SAVE_FAILED in both catch blocks; zero console.warn | VERIFIED | Line 19: addToast in interface; lines 150-154 and 182-186: both catch blocks use GENERAL_ERRORS.SAVE_FAILED; grep for console.warn returns zero matches |
| `views/ProjectView.tsx` | addToast passed into useProjectPersistence call | VERIFIED | Line 62: addToast property present in useProjectPersistence options object |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| usePricingExport catch blocks (3) | PDF_ERRORS.EXPORT_FAILED | addToast({ type: 'error', message: PDF_ERRORS.EXPORT_FAILED.message, details: PDF_ERRORS.EXPORT_FAILED.action }) | WIRED | Pattern confirmed at lines 160-164, 273-277, 570-574 of hooks/usePricingExport.ts |
| PricingReportConfig | usePricingExport addToast param | addToast passed in usePricingExport({...}) at line 201 | WIRED | Confirmed: useToast imported, addToast destructured, passed as named prop |
| useProjectRealtime subscribe err branch | onErrorRef callback | onErrorRef.current?.(err as Error) at line 54 | WIRED | Optional chaining call confirmed in working tree |
| useProjectData onError lambda | ERRORS.REALTIME.SUBSCRIPTION_FAILED | addToast({ type: 'error', message: ERRORS.REALTIME.SUBSCRIPTION_FAILED.message, details: ERRORS.REALTIME.SUBSCRIPTION_FAILED.action }) | WIRED | Lines 278-284 confirmed |
| pricing page load-error catch | ERRORS.GENERAL.UNEXPECTED | addToast({ type: 'error', message: ERRORS.GENERAL.UNEXPECTED.message, details: ERRORS.GENERAL.UNEXPECTED.action }) | WIRED | Line 73 confirmed; no hardcoded strings present |
| useProjectPersistence saveToFinalJson catch | GENERAL_ERRORS.SAVE_FAILED | addToast({ type: 'error', message: GENERAL_ERRORS.SAVE_FAILED.message, details: GENERAL_ERRORS.SAVE_FAILED.action }) | WIRED | Lines 150-154 confirmed |
| useProjectPersistence saveToHardwarePdf catch | GENERAL_ERRORS.SAVE_FAILED | same pattern | WIRED | Lines 182-186 confirmed |
| ProjectView useProjectPersistence call | addToast prop | addToast property in options object | WIRED | Line 62 confirmed |

---

## Data-Flow Trace (Level 4)

All error toast paths deliver registry-sourced strings directly from the const objects — no raw `err.message` fields reach the user anywhere in the Phase 6 changes. Data flow summary:

- Export handlers: thrown Error caught → `PDF_ERRORS.EXPORT_FAILED.message` / `.action` passed to addToast (string literals from registry, not from the caught error)
- Subscription errors: Supabase Error object caught → `ERRORS.REALTIME.SUBSCRIPTION_FAILED.message` / `.action` passed to addToast (registry only)
- Load-error catch (pricing page): caught error → `ERRORS.GENERAL.UNEXPECTED.message` / `.action` passed to addToast (registry only)
- Persistence save failures: fetch rejection caught → `GENERAL_ERRORS.SAVE_FAILED.message` / `.action` passed to addToast (registry only)

No HOLLOW or STATIC data-flow issues detected.

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — application requires a running Next.js + Supabase server session. Grep-level checks confirm all error paths are structurally wired.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| ERR-02 | 06-01, 06.1-02 | No hardcoded inline error strings outside the registry | SATISFIED | Export handlers: PDF_ERRORS exclusively. Pricing page load-error: ERRORS.GENERAL.UNEXPECTED exclusively (no literal strings in catch block). grep for 'Failed to load' and 'Please reload' in pricing/page.tsx returns zero matches. |
| ERR-03 | 06-02, 06-03 | Every known failure point maps to a named registry entry | SATISFIED | Subscription failure → REALTIME_ERRORS.SUBSCRIPTION_FAILED. Persistence save failure → GENERAL_ERRORS.SAVE_FAILED (both catch blocks). Pricing page load failure → ERRORS.GENERAL.UNEXPECTED. |
| ERR-06 | 06-01, 06-02, 06-03 | All error surfaces use the registry exclusively | SATISFIED | All four error surfaces (export, subscription, load-error, persistence) reference registry entries. Zero console.warn in useProjectPersistence. Zero raw err.message in any toast call. |

**Orphaned requirements:** None. ERR-02, ERR-03, ERR-06 are the only requirements mapped to Phase 6 in REQUIREMENTS.md and all three appear in plan frontmatter.

---

## Anti-Patterns Found

No blockers or warnings found.

| Check | Result |
|-------|--------|
| grep 'noopToast' in pricing/page.tsx | Zero matches |
| grep 'console.warn' in useProjectPersistence.ts | Zero matches |
| grep hardcoded error strings in pricing/page.tsx catch block | Zero matches |
| grep 'PDF_ERRORS.EXPORT_FAILED' in usePricingExport.ts | 3 matches (one per handler) |
| grep 'return null\|return {}\|return []' in modified hooks | No stub patterns |

---

## Human Verification Required

### 1. Export failure toast appearance

**Test:** Open the pricing report for a project, trigger a PDF or Excel export while temporarily patching the PDF/xlsx import to throw, confirm a red toast with "Export failed." and "Please try again." appears.
**Expected:** Red error toast appears within 2 seconds; no console.error message leaks to the UI.
**Why human:** Requires browser UI interaction and manual export failure triggering.

### 2. Realtime subscription error toast appearance

**Test:** Trigger a Supabase subscription error (network drop or channel force-close while on a project page), confirm a red toast with "Live updates are temporarily unavailable." appears.
**Expected:** Red error toast with the registry message; no raw JavaScript error message visible.
**Why human:** Requires network manipulation or Supabase client mocking in a live browser session.

### 3. Persistence save failure toast appearance

**Test:** While on a project page, trigger a save failure (intercept the hardware-merge PUT request to return 500), confirm a red toast with "Save failed." appears.
**Expected:** Red error toast; save status indicator shows failure state.
**Why human:** Requires network interception in a running browser session.

---

## Re-verification Summary

**Previous status:** gaps_found (5/10 — all commits existed but were unmerged from worktree branches)

**Gaps closed (4/4):**

1. **Merge gap closed** — All 8 commits (32380de through 84d71cb) are confirmed on AP-Sprint-1. The working tree now reflects all Phase 6 changes.

2. **ERR-02 violation closed** — The pricing page load-error catch previously used hardcoded literal strings. Commit 84d71cb replaced them with `ERRORS.GENERAL.UNEXPECTED.message` / `.action`.

3. **Subscription error on pricing page closed** — The previous worktree version of the pricing page had dropped `useProjectData` entirely, making the `onError` path unreachable. Commit 84d71cb reconciled this: `useProjectData` is retained with `addToast` passed in, so the `onError → addToast` chain fires on this page.

4. **Inter-branch conflict resolved** — The reconciliation commit (84d71cb) produced a clean merge: `useProjectData` call preserved (Phase 4 Realtime callbacks intact), `noopToast` removed, `addToast` from `useToast()` passed through.

**Regressions:** None detected. `setPricingItemsCallback` and `setPricingProposalCallback` are still destructured from `useProjectData` and passed to `PricingReportConfig` in the pricing page (Phase 4 wiring intact).

---

_Verified: 2026-05-13T08:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Mode: Re-verification after gap closure_
