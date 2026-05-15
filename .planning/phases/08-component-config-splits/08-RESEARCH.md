# Phase 8: Component Config Splits - Research

**Researched:** 2026-05-13
**Domain:** Next.js App Router component modularization — splitting large client components into sub-directory barrel modules
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**DoorScheduleConfig Split Strategy**
- D-01: Sub-directory: `components/doorSchedule/DoorScheduleConfig/` with barrel `index.tsx`
- D-02: Sub-files: `ColumnAccordion.tsx` (~70 lines), `GroupedTable.tsx` (~133 lines), `useDoorScheduleDownload.tsx` (custom hook — extracts the 382-line `handleDownload` function), `index.tsx` (orchestrator + JSX return)
- D-03: `handleDownload` extracted as custom hook `useDoorScheduleDownload.tsx` — accepts state values and setters as parameters, returns `{ handleDownload }`. Keeps React idioms, keeps index.tsx under 300 lines.
- D-04: The `export type { DoorScheduleExportConfig } from '../../types/doorScheduleTypes'` re-export must survive in `index.tsx` — consumers may import this named type from the component path.

**HardwareSetConfig Split Strategy**
- D-05: Sub-directory: `components/hardware/HardwareSetConfig/` with barrel `index.tsx`
- D-06: Sub-files: `hardwareConstants.ts` (static config — REQUIRED_COLUMN_DEFS, GROUPING_OPTIONS, USAGE_OPTIONS), `hardwareHelpers.ts` (pure functions — getDoorHwSetName, formatDoorTags, getItemValue, getUsageCellValue, buildSetGroups, buildDoorFieldGroups, buildHardwareGroups), `HardwareGroupTable.tsx` (sub-component), `index.tsx` (main component)
- D-07: HardwareSetConfig's download handler stays inline in `index.tsx` — no hook extraction. Index.tsx may slightly exceed 300 lines; user preference is simpler structure over strict line limit for this component.
- D-08: The `export type { HardwareSetExportConfig } from '../../types/hardwareSetTypes'` re-export must survive in `index.tsx`.

**Execution Order**
- D-09: Both splits execute in Wave 1 (parallel) — they touch independent files with no shared state.

**File Naming Convention**
- D-10: Sub-components use PascalCase: `ColumnAccordion.tsx`, `GroupedTable.tsx`, `HardwareGroupTable.tsx`
- D-11: Hooks use camelCase: `useDoorScheduleDownload.tsx`
- D-12: Helpers and constants use camelCase: `hardwareHelpers.ts`, `hardwareConstants.ts`

**VER Gates (Hard Requirements — No Discretion)**
- D-13: VER-02 — `'use client'` must be the literal first line (before imports, before comments) in every sub-file that uses React hooks or browser APIs. Required on: `DoorScheduleConfig/index.tsx`, `HardwareSetConfig/index.tsx`, `ColumnAccordion.tsx`, `GroupedTable.tsx`, `HardwareGroupTable.tsx`, `useDoorScheduleDownload.tsx`.
- D-14: VER-03 — Every barrel `index.tsx` must have `export { default } from './FileName'` — not covered by `export *`.
- D-15: VER-01 — After each split, run `tsc --noEmit` and diff against `.planning/tsc-baseline.txt`. Zero new TS2305/TS2307/TS2306 errors required.

### Claude's Discretion
- Internal split of `index.tsx` JSX sections within the main component body — planner/executor decides how to group JSX into the file
- Whether `hardwareConstants.ts` and `hardwareHelpers.ts` are one file or two — requirement names them as separate domains; executor may merge if the combined file stays under 300 lines and cohesion is clear
- Exact parameter list for `useDoorScheduleDownload` hook — executor reads the function body and derives the minimal set of state inputs/setters

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMP-01 | `DoorScheduleConfig.tsx` (915 ln) replaced by `DoorScheduleConfig/` sub-directory with barrel `index.tsx`; sub-files cover all complete cohesive domains | Source analysis confirms: ColumnAccordion (lines 53–121), GroupedTable (lines 124–256), handleDownload (lines 337–718), main component (lines 260–996). All domains identified and mappable to D-02 files. |
| COMP-02 | All consumer imports of `DoorScheduleConfig` resolve unchanged after split; zero new tsc errors | Consumers verified: 4 files use default import or `dynamic()` import. Barrel pattern with `export { default }` preserves all import paths. |
| COMP-03 | `HardwareSetConfig.tsx` (780 ln) replaced by `HardwareSetConfig/` sub-directory with barrel `index.tsx`; sub-files cover all complete cohesive domains | Source analysis confirms: REQUIRED_COLUMN_DEFS/GROUPING_OPTIONS/USAGE_OPTIONS (lines 52–77), pure helpers (lines 80–269), HardwareGroupTable (lines 273–396), main component (lines 400–853). All domains identified and mappable to D-06 files. |
| COMP-04 | All consumer imports of `HardwareSetConfig` resolve unchanged after split; zero new tsc errors | Consumers verified: 4 files use default import or `dynamic()` import from the flat path. Barrel pattern preserves all paths. |
| VER-01 | `tsc --noEmit` diff against baseline shows zero new TS2305/TS2307/TS2306 errors after each split phase completes | Baseline has 142 lines of pre-existing errors; none are in DoorScheduleConfig.tsx or HardwareSetConfig.tsx. Split must not add to the count in these error categories. |
| VER-02 | Every sub-file using React hooks or browser APIs has `'use client'` as literal first line | 6 files require it: both index.tsx files plus ColumnAccordion.tsx, GroupedTable.tsx, HardwareGroupTable.tsx, useDoorScheduleDownload.tsx. Pure files (hardwareConstants.ts, hardwareHelpers.ts) do NOT need it. |
| VER-03 | Every barrel `index.tsx` explicitly re-exports the default export via `export { default } from './File'` | Must appear in both DoorScheduleConfig/index.tsx and HardwareSetConfig/index.tsx. `export *` alone is insufficient. |
</phase_requirements>

---

## Summary

Phase 8 is a pure structural refactor: two large client components are split into sub-directory modules. No logic changes, no new behaviors, no new abstractions. The primary technical risk is breaking consumer imports — guarded by VER-01 (tsc diff). The secondary risks are missing `'use client'` directives (VER-02) and omitting the explicit default re-export in barrels (VER-03).

Both source files were read in full. The split boundaries are clear and confirmed against CONTEXT.md decisions D-01 through D-12. The four consumer files were also read in full — all use default imports from the flat component path, so the barrel pattern will preserve compatibility without modification.

**Primary recommendation:** Execute both splits in parallel (Wave 1) as decided in D-09. The only coordination dependency is the final `tsc --noEmit` verification step, which gates wave completion.

---

## Standard Stack

No new libraries are introduced in this phase. All dependencies already exist in the codebase.

### Core (already installed)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| React | (project version) | Component rendering | `'use client'` directive controls RSC boundary |
| TypeScript | 5.8.2 (per STATE.md) | Type checking | `tsc --noEmit` for VER-01 verification |
| Next.js App Router | (project version) | Dynamic imports via `next/dynamic` | `ssr: false` on consumer pages — barrel must remain a client component |

### No installation needed
All required packages are already in the project. This phase creates new files and deletes old flat files only.

---

## Architecture Patterns

### Sub-directory barrel pattern (confirmed from source)

```
components/doorSchedule/
├── DoorScheduleConfig/          ← new sub-directory
│   ├── index.tsx                ← barrel: orchestrates + JSX return + re-exports
│   ├── ColumnAccordion.tsx      ← sub-component (~70 lines)
│   ├── GroupedTable.tsx         ← sub-component (~133 lines)
│   └── useDoorScheduleDownload.tsx  ← custom hook (extracted handleDownload, ~382 lines)
├── DoorScheduleConfig.tsx       ← DELETED after split
├── DoorGroupingControls.tsx     ← untouched
└── doorScheduleTypes.ts         ← untouched

components/hardware/
├── HardwareSetConfig/           ← new sub-directory
│   ├── index.tsx                ← barrel: main component + re-exports
│   ├── hardwareConstants.ts     ← static config (REQUIRED_COLUMN_DEFS, GROUPING_OPTIONS, USAGE_OPTIONS)
│   ├── hardwareHelpers.ts       ← pure functions (getDoorHwSetName, formatDoorTags, getItemValue, etc.)
│   └── HardwareGroupTable.tsx   ← sub-component
├── HardwareSetConfig.tsx        ← DELETED after split
└── (other hardware files)       ← untouched
```

### Pattern 1: Barrel index.tsx — required structure

Every barrel `index.tsx` MUST include both:
1. `export { default } from './MainComponent'` — explicit default re-export (VER-03)
2. `export type { XExportConfig } from '../../types/xTypes'` — type re-export preserved from original flat file (D-04, D-08)

```typescript
// Source: DoorScheduleConfig/index.tsx — required barrel shape
'use client';

// ... (internal imports)

export { default } from './DoorScheduleConfig';  // VER-03: explicit default re-export
export type { DoorScheduleExportConfig } from '../../types/doorScheduleTypes';  // D-04: preserved type re-export
```

Note: The `'use client'` in the barrel ensures `dynamic(() => import(...), { ssr: false })` consumers continue to work correctly.

### Pattern 2: `'use client'` placement rule (VER-02)

`'use client'` must be the LITERAL FIRST LINE — before any imports, before any comments. This is a Next.js App Router requirement: the directive must precede all other content.

Files that REQUIRE `'use client'` (use React hooks or browser APIs):
- `DoorScheduleConfig/index.tsx` — uses useState, useCallback, useMemo, useElevationImages
- `DoorScheduleConfig/ColumnAccordion.tsx` — uses useState
- `DoorScheduleConfig/GroupedTable.tsx` — uses useMemo
- `DoorScheduleConfig/useDoorScheduleDownload.tsx` — async function that accesses `document`, `URL` (browser APIs), plus `setIsDownloading` setter
- `HardwareSetConfig/index.tsx` — uses useState, useMemo, useCallback
- `HardwareSetConfig/HardwareGroupTable.tsx` — React FC (renders JSX)

Files that do NOT require `'use client'` (no hooks, no browser APIs):
- `hardwareConstants.ts` — pure data (const arrays)
- `hardwareHelpers.ts` — pure functions only

### Pattern 3: Import path rules inside sub-directory

When sub-files import from the project, relative paths must account for the extra directory level:

| Import in flat file | Import in sub-directory file | Notes |
|--------------------|------------------------------|-------|
| `from '../../types'` | `from '../../../types'` | One level deeper |
| `from '../../types/doorScheduleTypes'` | `from '../../../types/doorScheduleTypes'` | One level deeper |
| `from '@/services/pdfTheme'` | `from '@/services/pdfTheme'` | Alias paths unchanged |
| `from '@/hooks/useDoorAggregation'` | `from '@/hooks/useDoorAggregation'` | Alias paths unchanged |
| `from './doorScheduleTypes'` | `from '../doorScheduleTypes'` | Local types file is one level up |
| `from './DoorGroupingControls'` | `from '../DoorGroupingControls'` | Sibling file is one level up |

### Pattern 4: Hook extraction (useDoorScheduleDownload)

The `handleDownload` function (lines 337–718 of DoorScheduleConfig.tsx) closes over component state. The hook pattern makes it self-contained:

```typescript
// useDoorScheduleDownload.tsx — shape inferred from function body
'use client';

import { /* all imports from handleDownload body */ } from '...';

interface UseDoorScheduleDownloadParams {
    selectedColumns: string[];
    groups: DoorGroup[];
    hiddenGroupKeys: Set<string>;
    includedDoors: Door[];
    uniqueData: boolean;
    format: ExportFormat;
    projectName: string;
    showElevationImages: boolean;
    elevationTypes: ElevationType[];
    preloadElevationImages: (groups: DoorGroup[]) => Promise<Map<string, ImageInfo>>;
    setIsDownloading: (v: boolean) => void;
}

export function useDoorScheduleDownload(params: UseDoorScheduleDownloadParams) {
    const handleDownload = async () => { /* extracted body */ };
    return { handleDownload };
}
```

The exact parameter list is at Claude's discretion — derive from the closed-over variables in the function body. Key items: `selectedColumns`, `groups`, `hiddenGroupKeys`, `includedDoors`, `uniqueData`, `format`, `projectName`, `showElevationImages`, `elevationTypes`, `preloadElevationImages`, `setIsDownloading`.

### Pattern 5: HardwareGroupTable dependency on helper functions

`HardwareGroupTable.tsx` calls `formatDoorTags`, `getUsageCellValue`, and `getItemValue` — all three are being extracted to `hardwareHelpers.ts`. `HardwareGroupTable.tsx` must import these from `./hardwareHelpers`. It also uses `REQUIRED_COLUMN_DEFS` from `./hardwareConstants`.

### Anti-Patterns to Avoid

- **`export *` as sole default re-export:** Named `export *` does NOT re-export default exports. Must use `export { default } from './File'` explicitly (VER-03).
- **`'use client'` on line 2 or after a comment:** Next.js requires it as the absolute first line. A file-level comment above it will silently fail the directive in some Next.js versions.
- **Relative paths not adjusted for sub-directory depth:** `from '../../types'` becomes `from '../../../types'` inside the new sub-directory. Forgetting this causes TS2307 errors that would show up in VER-01.
- **Importing from the barrel within the sub-directory:** Sub-files should import from siblings directly (e.g., `./hardwareHelpers`), never from the `index.tsx` barrel — that would create circular imports.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Circular import detection | Custom import graph | `tsc --noEmit` | TypeScript reports TS2306/circular module errors at compile time |
| Consumer import verification | Manual grep of import paths | `tsc --noEmit` diff vs baseline | Compiler detects TS2307 (module not found) and TS2305 (no export) definitively |
| `'use client'` presence check | Manual file scanning | `grep -n "^'use client'" file.tsx` | Simple line-1 exact match; must be literal first line |

---

## Source File Analysis

### DoorScheduleConfig.tsx — confirmed line ranges

Read from source (996 lines total):

| Block | Line Range | Target File | Size |
|-------|-----------|-------------|------|
| Imports | 1–31 | index.tsx (subset) | 31 lines |
| Type re-export + local types + props interface | 34–48 | index.tsx | 15 lines |
| `ColumnAccordion` sub-component | 53–121 | `ColumnAccordion.tsx` | 69 lines |
| `GroupedTable` sub-component | 124–256 | `GroupedTable.tsx` | 133 lines |
| Main component state/handlers (pre-download) | 260–336 | `index.tsx` | 77 lines |
| `handleDownload` async function | 337–718 | `useDoorScheduleDownload.tsx` | 382 lines |
| Main component JSX return | 720–996 | `index.tsx` | 277 lines |

**index.tsx size estimate (after extraction):** ~77 (state/handlers) + 277 (JSX) + 20 (imports/header) = ~374 lines. With the download logic extracted into a hook, this is manageable. If all hook call is condensed (one line), index.tsx lands under 300 lines.

### HardwareSetConfig.tsx — confirmed line ranges

Read from source (853 lines total):

| Block | Line Range | Target File | Size |
|-------|-----------|-------------|------|
| Imports | 1–10 | index.tsx (subset) | 10 lines |
| Type re-export + local types | 13–48 | index.tsx | 36 lines |
| `REQUIRED_COLUMN_DEFS`, `GROUPING_OPTIONS`, `USAGE_OPTIONS` | 52–77 | `hardwareConstants.ts` | 26 lines |
| Pure helper functions (7 functions) | 80–269 | `hardwareHelpers.ts` | 190 lines |
| `HardwareGroupTable` sub-component | 273–396 | `HardwareGroupTable.tsx` | 124 lines |
| Main component `HardwareSetConfig` | 400–853 | `index.tsx` | 454 lines |

**index.tsx size note:** D-07 explicitly permits index.tsx to slightly exceed 300 lines for HardwareSetConfig. The main component block alone is 454 lines, which is acceptable per user decision.

**hardwareConstants.ts and hardwareHelpers.ts merge option:** Combined = 26 + 190 = 216 lines. Well under 300 lines. Executor may choose to merge into a single `hardwareUtils.ts` if cohesion is clear — but CONTEXT.md names them separately, so keep separate unless executor has strong reason to merge.

---

## Common Pitfalls

### Pitfall 1: Missing `'use client'` on JSX-rendering sub-components

**What goes wrong:** A sub-component like `GroupedTable.tsx` renders JSX and calls `useMemo` — without `'use client'`, Next.js App Router treats it as a Server Component. Hooks are not allowed in Server Components.
**Why it happens:** Easy to focus on the main index.tsx and forget sub-files.
**How to avoid:** VER-02 checklist: every file containing `useState`, `useMemo`, `useCallback`, `useEffect`, or browser APIs (`document`, `URL`, `window`) must have `'use client'` as line 1.
**Warning signs:** Next.js error "useState is not allowed in Server Components."

### Pitfall 2: `export *` does not re-export defaults

**What goes wrong:** Using `export * from './DoorScheduleConfig'` in the barrel omits the default export. Consumer code like `import DoorScheduleConfig from '...'` gets `undefined`.
**Why it happens:** ES module spec: `export *` re-exports named exports only, never `export default`.
**How to avoid:** Always include `export { default } from './DoorScheduleConfig'` explicitly (VER-03).
**Warning signs:** Runtime error "DoorScheduleConfig is not a function" or TypeScript TS2305 on default import.

### Pitfall 3: Relative paths not adjusted for sub-directory depth

**What goes wrong:** A sub-file copied from the flat component still has `from '../../types'`, which resolves to the wrong path from inside the sub-directory.
**Why it happens:** Copy-paste during extraction; the relative path was correct in the flat file but is one level short in the sub-directory.
**How to avoid:** Any `../..` becomes `../../..` for most project-root imports. `@/` alias paths are unchanged.
**Warning signs:** VER-01 catches these as TS2307 (Cannot find module '../../types').

### Pitfall 4: HardwareGroupTable referencing helpers not yet imported

**What goes wrong:** `HardwareGroupTable.tsx` calls `formatDoorTags`, `getUsageCellValue`, `getItemValue`, and uses `REQUIRED_COLUMN_DEFS` — these live in sibling files after extraction. If forgotten, the file compiles with TS2304 (Cannot find name).
**Why it happens:** In the flat file these were in the same file scope. After extraction to a sub-directory, they must be explicitly imported.
**How to avoid:** Add `import { formatDoorTags, getUsageCellValue, getItemValue } from './hardwareHelpers'` and `import { REQUIRED_COLUMN_DEFS } from './hardwareConstants'` at the top of `HardwareGroupTable.tsx`.

### Pitfall 5: Deleting the flat file before verifying the barrel resolves

**What goes wrong:** Deleting `DoorScheduleConfig.tsx` before confirming `tsc --noEmit` passes means any import errors have no rollback.
**Why it happens:** Working too fast; delete and verify steps run in wrong order.
**How to avoid:** The plan must sequence: create sub-directory + all sub-files → verify `tsc --noEmit` → only then delete flat file.

### Pitfall 6: local types import path in sub-components

**What goes wrong:** `GroupedTable.tsx` and `ColumnAccordion.tsx` both import from `./doorScheduleTypes` (the local types file at `components/doorSchedule/doorScheduleTypes.ts`). From inside the `DoorScheduleConfig/` sub-directory, this path must be `'../doorScheduleTypes'` — one level up.
**Why it happens:** The original import in the flat file was `from './doorScheduleTypes'` (same directory), but the sub-directory is one level deeper.
**Warning signs:** TS2307 for `./doorScheduleTypes` not found.

---

## Code Examples

### Barrel index.tsx — DoorScheduleConfig (required shape)

```typescript
// Source: derived from CONTEXT.md D-01, D-03, D-04 and VER gates
'use client';

// All imports that DoorScheduleConfig main component needs go here
// (moved from flat file, paths adjusted for sub-directory depth where needed)

export { default } from './DoorScheduleConfig';        // VER-03
export type { DoorScheduleExportConfig } from '../../../types/doorScheduleTypes';  // D-04
```

Wait — path note: the barrel `index.tsx` is at `components/doorSchedule/DoorScheduleConfig/index.tsx`. To reach `types/doorScheduleTypes.ts` from there: `../../../types/doorScheduleTypes`. Confirm: `components/doorSchedule/DoorScheduleConfig/` → `../` = `components/doorSchedule/` → `../../` = `components/` → `../../../` = project root → `types/doorScheduleTypes`. Correct.

### Barrel index.tsx — HardwareSetConfig (required shape)

```typescript
// Source: derived from CONTEXT.md D-05, D-08 and VER gates
'use client';

export { default } from './HardwareSetConfig';         // VER-03
export type { HardwareSetExportConfig } from '../../../types/hardwareSetTypes';  // D-08
```

### VER-01 verification command

```bash
# Run after each split; compare to baseline
npx tsc --noEmit 2>&1 | grep -E "TS2305|TS2307|TS2306" > /tmp/post-split.txt
diff .planning/tsc-baseline.txt /tmp/post-split.txt
# Expected: zero new lines in diff output
```

Note: The baseline already contains 142 lines of pre-existing errors, none of which are in `DoorScheduleConfig.tsx` or `HardwareSetConfig.tsx`. The diff should show no new TS2305/TS2307/TS2306 lines.

### VER-02 verification command

```bash
# Check 'use client' is line 1 in every required sub-file
for f in \
  components/doorSchedule/DoorScheduleConfig/index.tsx \
  components/doorSchedule/DoorScheduleConfig/ColumnAccordion.tsx \
  components/doorSchedule/DoorScheduleConfig/GroupedTable.tsx \
  components/doorSchedule/DoorScheduleConfig/useDoorScheduleDownload.tsx \
  components/hardware/HardwareSetConfig/index.tsx \
  components/hardware/HardwareSetConfig/HardwareGroupTable.tsx; do
  head -1 "$f"
done
# All should output: 'use client'
```

### VER-03 verification command

```bash
# Check explicit default re-export in both barrels
grep "export { default }" components/doorSchedule/DoorScheduleConfig/index.tsx
grep "export { default }" components/hardware/HardwareSetConfig/index.tsx
# Both should match
```

---

## Consumer Import Verification

The four consumer files were read in full. Their import patterns are:

| Consumer File | Import Pattern | Path Used |
|--------------|----------------|-----------|
| `app/project/[id]/reports/door-schedule/page.tsx` | `dynamic(() => import('@/components/doorSchedule/DoorScheduleConfig'), { ssr: false })` | `@/components/doorSchedule/DoorScheduleConfig` |
| `app/project/[id]/reports/hardware-set/page.tsx` | `dynamic(() => import('@/components/hardware/HardwareSetConfig'), { ssr: false })` | `@/components/hardware/HardwareSetConfig` |
| `components/reports/ReportGenerationCenter.tsx` | `import DoorScheduleConfig from '../doorSchedule/DoorScheduleConfig'` and `import HardwareSetConfig from '../hardware/HardwareSetConfig'` | Relative default imports |
| `views/ReportsView.tsx` | `import DoorScheduleConfig from '../components/doorSchedule/DoorScheduleConfig'` and `import HardwareSetConfig from '../components/hardware/HardwareSetConfig'` | Relative default imports |

The `dynamic()` call resolves to `components/doorSchedule/DoorScheduleConfig` — which after the split resolves to the `index.tsx` barrel in the new sub-directory. Next.js resolves directory imports to `index.tsx` automatically. No consumer file modification is needed.

**Type imports found in consumers:**
- `ReportGenerationCenter.tsx`: `import type { DoorScheduleExportConfig } from '../../types/doorScheduleTypes'` — imports directly from canonical path, not from the component. No action needed.
- `ReportGenerationCenter.tsx`: `import type { HardwareSetExportConfig } from '../../types/hardwareSetTypes'` — same.
- `views/ReportsView.tsx`: `import type { HardwareSetExportConfig } from '../types/hardwareSetTypes'` — canonical path.
- `app/project/[id]/reports/hardware-set/page.tsx`: `import type { HardwareSetExportConfig } from '@/types/hardwareSetTypes'` — canonical path.

None of these import the type from the component path. D-04 and D-08 (type re-exports in barrels) are a forward-compatibility measure; no current consumer depends on them. They must still be preserved per locked decisions.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code/file restructuring with no external tool or service dependencies beyond the project's existing TypeScript compiler.

The `tsc` command used for VER-01 is `npx tsc --noEmit`, which uses the project's existing TypeScript installation (5.8.2 per STATE.md).

---

## Validation Architecture

> `workflow.nyquist_validation` is explicitly `false` in `.planning/config.json` — this section is SKIPPED.

---

## Sources

### Primary (HIGH confidence)
- Direct file read: `components/doorSchedule/DoorScheduleConfig.tsx` (996 lines) — confirmed all block boundaries
- Direct file read: `components/hardware/HardwareSetConfig.tsx` (853 lines) — confirmed all block boundaries
- Direct file read: `08-CONTEXT.md` — all locked decisions D-01 through D-15
- Direct file read: `.planning/tsc-baseline.txt` — 142 lines of pre-existing errors; none in the two target files
- Direct file read: `app/project/[id]/reports/door-schedule/page.tsx` — consumer import pattern confirmed
- Direct file read: `app/project/[id]/reports/hardware-set/page.tsx` — consumer import pattern confirmed
- Direct file read: `components/reports/ReportGenerationCenter.tsx` — consumer import pattern confirmed
- Direct file read: `views/ReportsView.tsx` — consumer import pattern confirmed
- Direct file read: `components/doorSchedule/doorScheduleTypes.ts` — local types file location confirmed
- Direct file read: `types/doorScheduleTypes.ts` and `types/hardwareSetTypes.ts` — canonical type paths confirmed

### Secondary (MEDIUM confidence)
- Next.js App Router documentation behavior (from training, well-established): `'use client'` must be literal first line; `dynamic()` resolves index.tsx in directory imports.

---

## Metadata

**Confidence breakdown:**
- Source file analysis: HIGH — both files read in full, all line ranges confirmed
- Consumer import compatibility: HIGH — all 4 consumer files read in full
- VER gate requirements: HIGH — locked decisions, no ambiguity
- `useDoorScheduleDownload` parameter list: MEDIUM — the exact parameters are at executor discretion; the list provided is derived from the closed-over variables in the function body but may need minor adjustment during implementation

**Research date:** 2026-05-13
**Valid until:** Indefinite — this is a structural analysis of static source files, not an ecosystem survey
