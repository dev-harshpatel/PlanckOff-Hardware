# Phase 6: Wire Export & Realtime Error Handling - Research

**Researched:** 2026-05-12
**Domain:** TypeScript React hooks — error propagation, toast integration, Supabase Realtime subscription error handling
**Confidence:** HIGH

---

## Summary

Phase 6 is a surgical wiring phase — no new infrastructure, only three discrete error-surface closures. The error registry (`constants/errors/`), toast system (`ToastContext`/`sonner`), and Realtime hook (`useProjectRealtime`) are all fully operational. What is missing is the final wiring at specific call sites.

**Plan 06-01** wraps `handleDownloadExcel` and `handleDownloadPdf` in `usePricingExport.ts` with try/catch blocks and calls `PDF_ERRORS.EXPORT_FAILED` toast on failure. `handleDownloadProposalPdf` should receive the same treatment for completeness. The call site in `PricingReportConfig.tsx` uses `void handleDownload*()` — the try/catch must go inside the hook, not at the call site, because the functions are async and exceptions thrown inside them will be uncaught by the `void` wrapper.

**Plan 06-02** adds a `REALTIME_ERRORS` entry to the error registry (a new key in `general.ts` or a new `realtime.ts` domain file), wires it to the `err` branch in `useProjectRealtime.ts` subscribe callback, and replaces the `noopToast` in the pricing page with a real `useToast()` call for reconnect/subscription errors. The `useProjectRealtime` hook currently holds no reference to `addToast` — either a new option must be added, or errors must surface via the `onFullReload` path. The simplest correct approach: add an optional `onError?: (err: Error) => void` callback to `UseProjectRealtimeOptions`, call it from the `err` branch, and have callers wire it to their toast.

**Plan 06-03** upgrades the two `console.warn` calls in `useProjectPersistence.ts` (lines 153 and 180) to produce user-visible feedback. Since `useProjectPersistence` receives no `addToast` today, it must either accept one as a new parameter or use `useToast()` directly — the existing call sites (`useProjectData`) already hold `addToast`, making parameter threading the least-invasive path.

**Primary recommendation:** All three plans are pure wiring — no new UI components, no new libraries, no schema changes. Total implementation risk is LOW.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ERR-02 | No hardcoded inline error strings outside the registry in components, hooks, or services | `usePricingExport.ts` has no error strings today — adding try/catch with `PDF_ERRORS.EXPORT_FAILED` satisfies this for the export path |
| ERR-03 | Every known failure point maps to a named registry entry | `useProjectRealtime.ts` subscription error and `useProjectPersistence.ts` save failures are the two remaining unregistered failure points |
| ERR-06 | All existing error surfaces (toasts, inline form errors, modal errors) use the registry exclusively | Pricing page `noopToast` and `console.warn` save failures are the two surfaces not yet using the registry |
</phase_requirements>

---

## Standard Stack

No new libraries are required. All existing infrastructure is confirmed in place.

### Core (already installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `sonner` | (installed) | Toast notifications via `toast.error()/warning()/success()` | Wired through `ToastContext.addToast` |
| `@supabase/supabase-js` | (installed) | Realtime subscribe callback signature | Already imported in `useProjectRealtime.ts` |
| TypeScript | 5.8.2 | `as const satisfies` for registry entries | Already in use |

### Installation
No `npm install` needed.

---

## Architecture Patterns

### Pattern 1: Error Registry Entry Shape

All entries follow the established `AppError` interface in `constants/errors/index.ts`:

```typescript
// Source: constants/errors/index.ts
export interface AppError {
  code: string;        // SCREAMING_SNAKE_CASE, domain-prefixed
  message: string;     // user-facing sentence
  action?: string;     // optional follow-up hint
}
```

New `REALTIME_ERRORS` entries must use `as const satisfies Record<string, AppError>` — the pattern used by every existing domain file.

### Pattern 2: Toast Call Pattern (confirmed from ReportGenerationCenter.tsx and hardware-set/page.tsx)

```typescript
// Source: components/reports/ReportGenerationCenter.tsx lines 44-45
// Source: app/project/[id]/reports/hardware-set/page.tsx line 87
addToast({
  type: 'error',
  message: PDF_ERRORS.EXPORT_FAILED.message,
  details: PDF_ERRORS.EXPORT_FAILED.action,
});
```

- `message` → from registry `.message` field
- `details` → from registry `.action` field (optional hint)
- `type: 'error'` → stays until user dismisses (Infinity duration in `ToastContext`)

### Pattern 3: useToast() Hook

```typescript
// Source: contexts/ToastContext.tsx
import { useToast } from '@/contexts/ToastContext';
const { addToast } = useToast();
```

Available in any client component. The pricing page already imports `useToast` — it imports from `@/contexts/ToastContext` and destructures `addToast`.

### Pattern 4: Try/Catch in async useCallback (export hooks)

The `handleDownloadExcel` and `handleDownloadPdf` functions are already async. The correct wrapper is:

```typescript
const handleDownloadExcel = useCallback(async (sections: ExportSections) => {
  try {
    // ... existing body ...
  } catch (err) {
    console.error('[usePricingExport] Excel export failed:', err);
    addToast({ type: 'error', message: PDF_ERRORS.EXPORT_FAILED.message, details: PDF_ERRORS.EXPORT_FAILED.action });
  }
}, [...existingDeps, addToast]);
```

This requires `addToast` to be passed into `usePricingExport` as a new parameter — it currently has no toast reference.

### Pattern 5: Supabase subscribe callback error parameter

```typescript
// Source: hooks/useProjectRealtime.ts lines 99-110
.subscribe((status, err) => {
  if (status === 'CLOSED') { wasClosedRef.current = true; }
  if (status === 'SUBSCRIBED' && wasClosedRef.current) {
    wasClosedRef.current = false;
    onFullReloadRef.current?.();
  }
  if (err) {
    console.error('[useProjectRealtime] subscription error:', err);
    // ERR-03/ERR-06 gap: no user-visible feedback here
  }
});
```

The `err` parameter is a `Error | undefined` from `@supabase/supabase-js`. Adding an `onError` optional callback to `UseProjectRealtimeOptions` allows callers to wire toast without requiring `useToast()` inside the hook itself (which would force the hook to be client-only in a stronger sense and break the existing ref-stable pattern).

### Pattern 6: useProjectPersistence addToast threading

`useProjectPersistence` is called from `useProjectData`, which already holds `addToast`:

```typescript
// Source: hooks/useProjectData.ts line 22
export function useProjectData({ projectId, addToast, saveToFinalJsonRef }: UseProjectDataOptions) {
```

Threading `addToast` from `useProjectData` → `useProjectPersistence` via the options interface is the minimal-change path. No new context usage required.

### Pattern 7: noopToast replacement in pricing page

The pricing page currently uses:

```typescript
// Source: app/project/[id]/reports/pricing/page.tsx lines 27-32
const noopToast = (toast: Omit<Toast, 'id'>) => { void toast; };
const { setPricingItemsCallback, setPricingProposalCallback } = useProjectData({
  projectId: id ?? '',
  addToast: noopToast,
  saveToFinalJsonRef: noopSaveRef,
});
```

The fix: replace `noopToast` with `addToast` from `useToast()`. The page does not currently call `useToast()` — adding it is a one-line import + one-line hook call.

### Anti-Patterns to Avoid

- **Throwing inside `void` async calls:** `void handleDownloadExcel(...)` in `PricingReportConfig.tsx` swallows any uncaught rejection. The try/catch MUST be inside the async function, not wrapped around the `void` call site.
- **Adding `useToast()` directly to `useProjectRealtime.ts`:** The hook is called from server-rendering contexts. Keep it side-effect free; use the `onError` callback pattern instead.
- **Showing raw `err.message` to users:** Always use the registry entry `.message`. The raw error can go to `console.error` only.
- **Adding `addToast` to `saveToHardwarePdf` without also wiring `saveToFinalJson`:** Both console.warn paths (lines 153 and 180) are success-criteria items — both need wiring.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast display | Custom toast component | `addToast` via `useToast()` from `ToastContext` | Already wired to sonner; error type persists until dismissed |
| Error message copy | Inline string literals | `PDF_ERRORS.EXPORT_FAILED`, `GENERAL_ERRORS.SAVE_FAILED`, or a new `REALTIME_ERRORS` entry | ERR-07: updating copy requires changing only the registry |
| Subscription error type narrowing | `instanceof Error` guards | Pass `err` as-is to `console.error`; show generic registry message to user | `err` from Supabase subscribe may not be a standard `Error` |

**Key insight:** Every user-visible string must live in `constants/errors/`. The planner should never put string literals in hook or component code.

---

## Common Pitfalls

### Pitfall 1: Missing addToast in usePricingExport deps array
**What goes wrong:** Adding `addToast` to useCallback body but omitting it from the dependency array causes stale closure — toast fires with old function reference or is silently ignored by the linter rule.
**Why it happens:** `usePricingExport` currently has no `addToast` parameter, so its dep arrays are written without it.
**How to avoid:** Add `addToast` to both the function parameter list and the `useCallback` deps array for both `handleDownloadExcel` and `handleDownloadPdf`. `handleDownloadProposalPdf` shares the same pattern.
**Warning signs:** `react-hooks/exhaustive-deps` ESLint rule will flag if omitted.

### Pitfall 2: noopToast silently swallows Realtime reconnect errors
**What goes wrong:** Success criteria #5 says reconnect errors must not be silently swallowed. The `noopToast` in pricing page currently drops ALL toasts including subscription error toasts that would come from `addToast` calls wired through `useProjectData`.
**Why it happens:** The pricing page was written with a noop because it manages its own data loading and didn't need the normal toast path.
**How to avoid:** Replace `noopToast` with real `useToast()` result; any subscription error wired through `onError` → `addToast` in the `useProjectData` call will now surface.

### Pitfall 3: useProjectPersistence options interface mismatch
**What goes wrong:** Adding `addToast` as required (not optional) to `UseProjectPersistenceOptions` will break if any other call site doesn't pass it.
**Why it happens:** Only one call site exists (`useProjectData`), but the interface must be updated.
**How to avoid:** Make `addToast` required (not optional) since the only caller (`useProjectData`) already has it. Search for any other call sites first with: `grep -rn "useProjectPersistence" --include="*.ts" --include="*.tsx"`.
**Warning signs:** TypeScript will error at the call site if the signature changes and the caller doesn't update.

### Pitfall 4: REALTIME_ERRORS domain file placement
**What goes wrong:** Adding realtime errors to `general.ts` works but muddies domain separation. Using a new `realtime.ts` file is cleaner but requires updating `constants/errors/index.ts`.
**Why it happens:** The index.ts exports and the `ERRORS` namespace object both need updating when a new domain file is added.
**How to avoid:** Either approach is valid — the planner should choose one and be consistent. The safest (least diff) is adding a `REALTIME_ERRORS` object to `general.ts` unless the planner wants a new domain. If a new file, update both the export line and the `ERRORS` namespace in `index.ts`.

### Pitfall 5: subscribe err type is not Error
**What goes wrong:** Supabase `subscribe` callback types `err` as `Error | undefined` in some versions, but the actual runtime value may differ (could be a plain object or string in edge cases).
**Why it happens:** Supabase JS SDK internals.
**How to avoid:** Always use the generic registry message for the user-facing toast (`REALTIME_ERRORS.SUBSCRIPTION_FAILED.message`). Log the raw `err` to `console.error` for debugging. Do NOT pass `err?.message` to the user.

---

## Code Examples

### Export Try/Catch Pattern (confirmed from hardware-set/page.tsx)

```typescript
// Source: app/project/[id]/reports/hardware-set/page.tsx lines 82-89
const handleExport = (config: HardwareSetExportConfig) => {
  try {
    exportHardwareSet(doors, hardwareSets, config, projectName);
  } catch (error) {
    console.error('Export failed:', error);
    addToast({
      type: 'error',
      message: PDF_ERRORS.EXPORT_FAILED.message,
      details: PDF_ERRORS.EXPORT_FAILED.action,
    });
  }
};
```

For async hooks (`handleDownloadExcel`, `handleDownloadPdf`), wrap the entire body:

```typescript
const handleDownloadExcel = useCallback(async (sections: ExportSections) => {
  try {
    // ... existing xlsx-js-style logic ...
  } catch (err) {
    console.error('[usePricingExport] Excel export failed:', err);
    addToast({ type: 'error', message: PDF_ERRORS.EXPORT_FAILED.message, details: PDF_ERRORS.EXPORT_FAILED.action });
  }
}, [doorGroups, frameGroups, hardwareGroups, doorTotal, frameTotal, hwTotal, companySettings, projectName, addToast]);
```

### REALTIME_ERRORS Registry Entry

```typescript
// New entry — could go in constants/errors/general.ts or a new constants/errors/realtime.ts
export const REALTIME_ERRORS = {
  SUBSCRIPTION_FAILED: {
    code: 'RT_SUBSCRIPTION_FAILED',
    message: 'Live updates are temporarily unavailable.',
    action: 'Your changes are still saved. Reload the page if data appears out of date.',
  },
} as const satisfies Record<string, AppError>;
```

### onError callback in useProjectRealtime

```typescript
// Addition to UseProjectRealtimeOptions interface
onError?: (err: Error) => void;

// Inside subscribe callback:
if (err) {
  console.error('[useProjectRealtime] subscription error:', err);
  onErrorRef.current?.(err);
}
```

### useProjectPersistence addToast parameter thread

```typescript
// Add to UseProjectPersistenceOptions interface:
addToast: (toast: Omit<Toast, 'id'>) => void;

// Replace line 153:
// BEFORE: console.warn('[saveToFinalJson] Failed to persist final JSON:', err);
// AFTER:
console.error('[saveToFinalJson] Failed to persist final JSON:', err);
addToast({ type: 'error', message: GENERAL_ERRORS.SAVE_FAILED.message, details: GENERAL_ERRORS.SAVE_FAILED.action });

// Replace line 180:
// BEFORE: console.warn('[saveToHardwarePdf] Failed to persist hardware PDF extraction:', err);
// AFTER:
console.error('[saveToHardwarePdf] Failed to persist hardware PDF extraction:', err);
addToast({ type: 'error', message: GENERAL_ERRORS.SAVE_FAILED.message, details: GENERAL_ERRORS.SAVE_FAILED.action });
```

### noopToast replacement in pricing page

```typescript
// app/project/[id]/reports/pricing/page.tsx
// ADD:
import { useToast } from '@/contexts/ToastContext';

// INSIDE component, REPLACE noopToast:
const { addToast } = useToast();
// Remove: const noopToast = (toast: Omit<Toast, 'id'>) => { void toast; };
// Also remove the Toast import from @/types if it is now unused

const { setPricingItemsCallback, setPricingProposalCallback } = useProjectData({
  projectId: id ?? '',
  addToast,                 // was: addToast: noopToast
  saveToFinalJsonRef: noopSaveRef,
});
```

---

## Exact File Map

All files that will be touched in Phase 6:

| Plan | File | Change |
|------|------|--------|
| 06-01 | `hooks/usePricingExport.ts` | Add `addToast` param; wrap `handleDownloadExcel`, `handleDownloadPdf`, `handleDownloadProposalPdf` bodies in try/catch calling `PDF_ERRORS.EXPORT_FAILED` |
| 06-01 | `components/pricing/PricingReportConfig.tsx` | Pass `addToast` to `usePricingExport(...)` call |
| 06-02 | `constants/errors/general.ts` OR new `constants/errors/realtime.ts` | Add `REALTIME_ERRORS.SUBSCRIPTION_FAILED` entry |
| 06-02 | `constants/errors/index.ts` | Export `REALTIME_ERRORS` and add to `ERRORS` namespace (only if new file) |
| 06-02 | `hooks/useProjectRealtime.ts` | Add `onError` option; fire it from `err` branch; update refs |
| 06-02 | `hooks/useProjectData.ts` | Pass `onError` → `addToast` when wiring `useProjectRealtime` |
| 06-02 | `app/project/[id]/reports/pricing/page.tsx` | Replace `noopToast` with `useToast()` result |
| 06-03 | `hooks/useProjectPersistence.ts` | Add `addToast` to options interface; replace both `console.warn` calls with toast |
| 06-03 | `hooks/useProjectData.ts` | Pass `addToast` to `useProjectPersistence(...)` call |

---

## Current State Audit (confirmed by code inspection)

| Failure Point | Current Behaviour | Target Behaviour | File:Line |
|---------------|-------------------|-----------------|-----------|
| `handleDownloadExcel` throws | Uncaught rejection, `void` swallows it | try/catch → `PDF_ERRORS.EXPORT_FAILED` toast | `usePricingExport.ts:82` |
| `handleDownloadPdf` throws | Uncaught rejection, `void` swallows it | try/catch → `PDF_ERRORS.EXPORT_FAILED` toast | `usePricingExport.ts:131` |
| `handleDownloadProposalPdf` throws | Uncaught rejection, `void` swallows it | try/catch → `PDF_ERRORS.EXPORT_FAILED` toast | `usePricingExport.ts:204` |
| Supabase `subscribe` callback `err` branch | `console.error` only | also fire `onError` → toast | `useProjectRealtime.ts:107-109` |
| Pricing page subscription errors | `noopToast` drops all toasts | `useToast()` real toast | `app/.../pricing/page.tsx:27-32` |
| `saveToFinalJson` catch | `console.warn` line 153 | `GENERAL_ERRORS.SAVE_FAILED` toast | `useProjectPersistence.ts:153` |
| `saveToHardwarePdf` catch | `console.warn` line 180 | `GENERAL_ERRORS.SAVE_FAILED` toast | `useProjectPersistence.ts:180` |

**`PDF_ERRORS.EXPORT_FAILED` current reference count (excluding worktrees):** 1 — only `app/project/[id]/reports/hardware-set/page.tsx`. Zero references in `usePricingExport.ts` or `PricingReportConfig.tsx`.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 6 is purely code/config changes. No external services, CLIs, or runtimes beyond what is already installed.

---

## Validation Architecture

Step 2.6: nyquist_validation is explicitly set to `false` in `.planning/config.json`. Validation Architecture section omitted per config.

---

## Open Questions

1. **Should `handleDownloadProposalPdf` also get try/catch?**
   - What we know: Success criteria #1 names only `handleDownloadExcel` and `handleDownloadPdf` by name; `handleDownloadProposalPdf` is also called with `void` in `PricingReportConfig.tsx` and has the same gap.
   - What's unclear: Whether the success criteria intentionally excludes proposal PDF.
   - Recommendation: Wrap all three for completeness. The extra 5 lines are zero risk and close the gap fully.

2. **Where to place REALTIME_ERRORS — existing `general.ts` or new `realtime.ts`?**
   - What we know: `general.ts` already has `SAVE_FAILED`, `NETWORK`, `SERVER` — cross-domain errors live there. Realtime is domain-specific.
   - Recommendation: New `constants/errors/realtime.ts` for clean separation, with corresponding updates to `index.ts`. If planner prefers minimal diff, appending to `general.ts` is acceptable.

3. **`useProjectPersistence` `addToast` as required vs optional?**
   - What we know: Only one call site exists (`useProjectData.ts`).
   - Recommendation: Make it required — the single caller already has it. Optional would hide bugs.

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `hooks/usePricingExport.ts` — confirmed no try/catch, no PDF_ERRORS import
- Direct code inspection: `hooks/useProjectRealtime.ts` — confirmed `console.error` only in err branch, no onError callback
- Direct code inspection: `hooks/useProjectPersistence.ts` — confirmed `console.warn` at lines 153 and 180
- Direct code inspection: `app/project/[id]/reports/pricing/page.tsx` — confirmed `noopToast` pattern
- Direct code inspection: `constants/errors/pdf.ts` — `PDF_ERRORS.EXPORT_FAILED` confirmed present
- Direct code inspection: `constants/errors/general.ts` — `GENERAL_ERRORS.SAVE_FAILED` confirmed present
- Direct code inspection: `contexts/ToastContext.tsx` — `useToast()` / `addToast` API confirmed
- Direct code inspection: `app/project/[id]/reports/hardware-set/page.tsx` — canonical pattern for try/catch + toast in export handler confirmed

### Secondary (MEDIUM confidence)
- `components/reports/ReportGenerationCenter.tsx` — additional confirmation of `addToast` with registry error pattern

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all infrastructure confirmed present in codebase
- Architecture: HIGH — all patterns sourced from existing working code in the same repo
- Pitfalls: HIGH — based on static analysis of the exact lines to be changed
- File map: HIGH — grep-verified file paths and line numbers

**Research date:** 2026-05-12
**Valid until:** 2026-06-12 (stable — no external dependencies)
