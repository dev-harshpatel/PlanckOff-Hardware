---
phase: "01"
plan: "pdf-theme"
subsystem: "pdf-exports"
tags: [pdf, theme, jspdf, branding, exports]
dependency_graph:
  requires: []
  provides: [pdfTheme]
  affects: [doorschedule-pdf, hardwareset-pdf]
tech_stack:
  added: []
  patterns: [shared-theme-module, two-pass-page-numbering, try-catch-logo-resilience]
key_files:
  created: [services/pdfTheme.ts]
  modified: []
decisions:
  - "Two-pass page numbering: drawPageHeader() in didDrawPage, addPageNumbers() called after autoTable() returns — avoids Page 1 of 1 bug"
  - "Logo embedded as 1x1 transparent PNG base64 placeholder — avoids async fetch and cross-browser SVG inconsistency"
  - "addImage wrapped in try/catch — logo failure must never crash the export"
  - "buildAutoTableOptions() sets rowPageBreak=avoid and repeatHeaders=true once — callers must not override"
  - "HEADER_BAR_HEIGHT=18 reserved via margin.top — table never overlaps branded header"
  - "No React imports, no browser globals at module scope — SSR-safe for Next.js"
metrics:
  duration: "< 10 minutes"
  completed: "2026-05-07"
  tasks_completed: 3
  files_created: 1
  files_modified: 0
---

# Phase 1 Plan pdf-theme: Create Shared PDF Theme Module Summary

**One-liner:** Branded jsPDF theme module with BRAND_NAVY constants, two-pass page numbering, and autotable options factory — single source of truth for all PlanckOff PDF exports.

## What Was Built

Created `services/pdfTheme.ts` — a new zero-dependency module that all PDF export paths in the codebase will import. The file establishes:

- **Brand constants** (RGB tuples): `BRAND_NAVY [30,41,59]`, `BRAND_TEXT_ON_DARK [255,255,255]`, `ROW_ALT_FILL [248,250,252]`, `SEPARATOR_COLOR [200,200,200]`
- **Layout constants**: `PDF_MARGIN=14`, `HEADER_BAR_HEIGHT=18`, `FOOTER_OFFSET=5`
- **Logo stub**: `LOGO_BASE64_PNG` — 1x1 transparent PNG base64 placeholder; real logo to be injected in a later plan
- **PdfTheme interface** + `DEFAULT_THEME` — typed configuration object consumed by `buildAutoTableOptions()`
- **`drawPageHeader()`** — draws branded bar (logo, "PlanckOff" name, centered report title, right-aligned export date, separator line) inside autotable's `didDrawPage` callback. Never writes page numbers here.
- **`addPageNumbers()`** — two-pass approach called AFTER `autoTable()` returns; iterates all pages and writes "Page N of M" in footer with project name left-aligned
- **`buildAutoTableOptions()`** — returns spread-ready autotable options: `rowPageBreak='avoid'`, `repeatHeaders=true`, `margin.top=HEADER_BAR_HEIGHT`, alternating row fill, head styles, and `didDrawPage` hook wired to `drawPageHeader()`

## Commits

| Hash | Message | Files |
|------|---------|-------|
| 3715ba8 | feat(exports): add shared PDF theme module | services/pdfTheme.ts |

## Deviations from Plan

None — plan executed exactly as written. All three tasks completed sequentially with no blocking issues. Pre-existing TypeScript errors in unrelated files (ElectrificationEditor, RevisionHistory, etc.) were present before this change; `pdfTheme.ts` introduced zero new TS errors.

## Verification Results

- `services/pdfTheme.ts` exists: PASSED
- TypeScript compile (pdfTheme.ts): zero errors PASSED
- All required exports present: BRAND_NAVY, DEFAULT_THEME, drawPageHeader, addPageNumbers, buildAutoTableOptions — PASSED
- LOGO_BASE64_PNG is non-empty string: PASSED
- No React import at module scope: PASSED
- No browser globals (window, document, navigator) at module scope: PASSED
- HEADER_BAR_HEIGHT = 18: PASSED
- margin.top uses HEADER_BAR_HEIGHT: PASSED
- rowPageBreak: 'avoid' in buildAutoTableOptions: PASSED
- repeatHeaders: true in buildAutoTableOptions: PASSED
- addImage wrapped in try/catch: PASSED

## Known Stubs

- `LOGO_BASE64_PNG`: Currently a 1x1 transparent PNG placeholder. The real PlanckOff logo must be converted to a base64 PNG and substituted here before shipping. This is intentional and documented in the file's inline comment. The stub does not prevent the plan's goal (theme module foundation) from being achieved — it only means the logo image in exported PDFs will be invisible until replaced.

## Self-Check: PASSED

File `services/pdfTheme.ts` exists and commit `3715ba8` is present in git log.
