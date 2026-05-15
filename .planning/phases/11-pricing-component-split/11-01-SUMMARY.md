---
phase: 11-pricing-component-split
plan: "01"
subsystem: components/pricing
tags: [component-split, presentational, pricing, phase-11]
dependency_graph:
  requires: []
  provides:
    - components/pricing/ProposalTab.tsx
  affects:
    - components/pricing/PricingReportConfig.tsx (wired in Plan 11-02)
tech_stack:
  added: []
  patterns:
    - "Flat sibling extraction (not sub-directory) — RESEARCH §Pattern 1"
    - "Duplicate module-level fmt constant — RESEARCH Pitfall 1 resolution"
    - "D-16 cohesion exception for ~474 line file — mirrors Phase 8 precedent"
key_files:
  created:
    - components/pricing/ProposalTab.tsx
  modified: []
decisions:
  - "fmt Intl.NumberFormat duplicated in ProposalTab.tsx rather than imported — pure 1-line constant, no shared module needed (RESEARCH Pitfall 1)"
  - "ProposalTab is purely presentational with zero hook calls — all state threaded as props from PricingReportConfig"
  - "D-16 cohesion exception granted: 474 lines acceptable since PRICING-01 names ~354 lines and forbids partial extraction"
  - "VER-03 N/A for ProposalTab.tsx: no default export; named-export only per RESEARCH §Pattern 3"
metrics:
  duration: "~10 min"
  completed: "2026-05-14"
  tasks: 1
  files: 1
---

# Phase 11 Plan 01: Create ProposalTab Presentational Component Summary

**One-liner:** New `components/pricing/ProposalTab.tsx` (474 lines) — purely presentational React component with 40-prop typed interface extracting the complete proposal JSX block verbatim from `PricingReportConfig.tsx` lines 356-709.

---

## What Was Built

Created `components/pricing/ProposalTab.tsx` as a new sibling file alongside `PricingReportConfig.tsx`. This is Wave 1 of Phase 11 — the extraction only. `PricingReportConfig.tsx` remains UNCHANGED at 781 lines; the wiring is deferred to Plan 11-02.

**File structure:**
- `'use client'` as literal first line (VER-02 satisfied)
- JSDoc cohesion exception comment (D-16 pattern from Phase 8)
- Module-level `fmt` Intl.NumberFormat constant (avoids cross-file import)
- `export interface ProposalTabProps` — 40 typed prop fields spanning all values from `usePricingFilters` and `usePricingProposal` returns
- `export const ProposalTab: React.FC<ProposalTabProps>` — named export, no default export
- Verbatim JSX from lines 356-709 of PricingReportConfig.tsx — all 7 inner sections preserved

**Props interface covers:**
- From usePricingFilters: projectName, doorGroups, frameGroups, hardwareGroups, proposalFilters, proposalMaterials, proposalFloors, proposalBuildings, proposalDoorBase, proposalFrameBase, proposalHwBase, proposalBreakdown, hwSetList, setProposalFilter
- From usePricingProposal: hiddenProposalTables, toggleProposalTable, profitPct, allocateExpenses, taxRows, remarks, extraExpenses, handleProfitChange, handleAllocateChange, handleAddTaxRow, handleTaxRowChange, handleRemoveTaxRow, handleRemarksChange, handleAddExpense, handleExpenseChange, handleRemoveExpense, proposalDoorTotal, proposalFrameTotal, proposalHwTotal, extraExpensesTotal, proposalGrandTotal, taxSubtotal, totalAfterTax, doorAlloc, frameAlloc, hwAlloc

**JSX sections preserved (verbatim from source):**
1. Header + filters row (proposalFilters MultiFilterSelect dropdowns)
2. Pricing Summary (`<PricingHierarchyView ... />`)
3. Door detail table (hidden/visible branches with restore button)
4. Frame detail table (hidden/visible branches with restore button)
5. Hardware detail table (hwSetList, hidden/visible branches)
6. Extra Expenses (allocateExpenses checkbox + dynamic rows + grand total)
7. Tax (dynamic tax rows + summary breakdown with subtotal/total-after-tax)
8. Remarks (textarea)

---

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | fd33c74 | feat(11-01): create components/pricing/ProposalTab.tsx presentational sub-component |

---

## Verification Results

- **VER-02:** PASS — `'use client'` is the literal first line of `ProposalTab.tsx`
- **VER-01 (partial):** PASS — `npx tsc --noEmit` returns zero new TS2304/TS2305/TS2306/TS2307 errors for `ProposalTab.tsx`; pre-split snapshot saved at `.planning/phases/11-pricing-component-split/pre-split-phase11.txt` (9 pre-existing errors, none related to this file)
- **VER-03:** N/A for ProposalTab.tsx (no default export; named exports only per RESEARCH §Pattern 3)
- **No default export:** `grep "^export default" ProposalTab.tsx` returns zero matches
- **No hook calls:** zero `useState/useEffect/useCallback/useMemo/useRef` calls — purely presentational
- **PricingReportConfig.tsx unchanged:** Still 781 lines; untouched in this plan

---

## Deviations from Plan

None — plan executed exactly as written.

The file landed at 474 lines (plan estimated 380-410). The extra ~64 lines come from JSX whitespace and the JSDoc comment being slightly longer than estimated. The D-16 cohesion exception still applies at 474 lines for the same reason: PRICING-01 mandates no partial extraction of the 7-section JSX block.

---

## Known Stubs

None. `ProposalTab.tsx` contains no stubs, placeholder text, or hardcoded empty values — it renders verbatim JSX from the source file. All props are required (no optional props with default-empty values flowing to render).

---

## Self-Check: PASSED

- [x] `components/pricing/ProposalTab.tsx` exists
- [x] Commit `fd33c74` exists in git log
- [x] Pre-split tsc snapshot at `.planning/phases/11-pricing-component-split/pre-split-phase11.txt`
- [x] PricingReportConfig.tsx unchanged (781 lines)
- [x] Zero new tsc errors for ProposalTab.tsx
