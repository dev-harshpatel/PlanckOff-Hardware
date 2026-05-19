---
phase: 06-wire-export-and-realtime-error-handling
plan: "01"
subsystem: pricing-export
tags: [error-handling, toast, export, try-catch]
dependency_graph:
  requires: [constants/errors/pdf.ts, contexts/ToastContext.tsx]
  provides: [export error toasts for all three pricing export handlers]
  affects: [hooks/usePricingExport.ts, components/pricing/PricingReportConfig.tsx]
tech_stack:
  added: []
  patterns: [try/catch async handlers, addToast from useToast hook, PDF_ERRORS registry]
key_files:
  modified:
    - hooks/usePricingExport.ts
    - components/pricing/PricingReportConfig.tsx
decisions:
  - "addToast is a required (not optional) param on UsePricingExportParams — single caller PricingReportConfig.tsx always provides it"
  - "catch blocks use console.error (not console.warn) — matches canonical hardware-set/page.tsx pattern"
  - "PDF_ERRORS.EXPORT_FAILED used exclusively; no raw err.message exposed to user"
metrics:
  duration: "~3 min"
  completed: "2026-05-12"
  tasks: 2
  files: 2
requirements_closed: [ERR-02, ERR-06]
---

# Phase 6 Plan 1: Wire Export Error Handling (usePricingExport) Summary

Wrapped all three async pricing export handlers in try/catch blocks that call addToast with PDF_ERRORS.EXPORT_FAILED on failure, threading addToast from useToast() into the hook via PricingReportConfig.tsx.

## Tasks Completed

### Task 1: Add addToast parameter to usePricingExport and wrap all three handlers in try/catch
- **File:** `hooks/usePricingExport.ts`
- **Changes:**
  - Added `import { PDF_ERRORS } from '@/constants/errors'`
  - Added `import type { Toast } from '@/types'`
  - Added required `addToast: (toast: Omit<Toast, 'id'>) => void` field to `UsePricingExportParams` interface
  - Added `addToast` to destructured function parameters
  - Wrapped `handleDownloadExcel` body in try/catch with EXPORT_FAILED toast on catch
  - Wrapped `handleDownloadPdf` body in try/catch with EXPORT_FAILED toast on catch
  - Wrapped `handleDownloadProposalPdf` body in try/catch with EXPORT_FAILED toast on catch
  - Appended `addToast` to all three `useCallback` deps arrays
- **Commit:** 94d5797

### Task 2: Thread addToast from PricingReportConfig.tsx into usePricingExport via useToast()
- **File:** `components/pricing/PricingReportConfig.tsx`
- **Changes:**
  - Added `import { useToast } from '@/contexts/ToastContext'`
  - Added `const { addToast } = useToast()` inside component body
  - Passed `addToast` as last property in `usePricingExport({...})` call
- **Commit:** 229f5a4

## Verification Results

```
# PDF_ERRORS.EXPORT_FAILED reference count in usePricingExport.ts
grep -c "PDF_ERRORS.EXPORT_FAILED" hooks/usePricingExport.ts
→ 6  (2 per handler: .message + .action; plan requires ≥ 3 — PASS)

# void handleDownload* call sites preserved in PricingReportConfig.tsx
grep -cE "void (handleDownloadExcel|handleDownloadPdf|handleDownloadProposalPdf)" components/pricing/PricingReportConfig.tsx
→ 3  (PASS)

# TypeScript compile
npx tsc --noEmit 2>&1 | grep -E "(usePricingExport|PricingReportConfig)"
→ (empty — no errors — PASS)
```

## Requirements Closed

- **ERR-02**: No hardcoded export-failure strings outside `constants/errors/pdf.ts` — catch blocks exclusively use `PDF_ERRORS.EXPORT_FAILED.message` and `.action`.
- **ERR-06**: All three export error surfaces use the registry exclusively — PASS for pricing-export path.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `hooks/usePricingExport.ts` — modified, committed at 94d5797
- `components/pricing/PricingReportConfig.tsx` — modified, committed at 229f5a4
- Both commits exist in git log
- TypeScript clean
