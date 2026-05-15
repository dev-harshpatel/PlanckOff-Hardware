# Phase 8: Component Config Splits - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Split `components/doorSchedule/DoorScheduleConfig.tsx` (996 lines) and `components/hardware/HardwareSetConfig.tsx` (853 lines) into sub-directory modules. All consumers import identically after the split. No behavior change — pure structural refactor. Success gates: VER-01 (zero new TS errors), VER-02 (`'use client'` as first line), VER-03 (explicit `export { default }` in barrel).

</domain>

<decisions>
## Implementation Decisions

### DoorScheduleConfig Split Strategy

- **D-01:** Sub-directory: `components/doorSchedule/DoorScheduleConfig/` with barrel `index.tsx`
- **D-02:** Sub-files: `ColumnAccordion.tsx` (~70 lines), `GroupedTable.tsx` (~133 lines), `useDoorScheduleDownload.tsx` (custom hook — extracts the 382-line `handleDownload` function), `index.tsx` (orchestrator + JSX return)
- **D-03:** `handleDownload` extracted as **custom hook** `useDoorScheduleDownload.tsx` — accepts state values and setters as parameters, returns `{ handleDownload }`. Keeps React idioms, keeps index.tsx under 300 lines.
- **D-04:** The `export type { DoorScheduleExportConfig } from '../../types/doorScheduleTypes'` re-export must survive in `index.tsx` — consumers may import this named type from the component path.

### HardwareSetConfig Split Strategy

- **D-05:** Sub-directory: `components/hardware/HardwareSetConfig/` with barrel `index.tsx`
- **D-06:** Sub-files: `hardwareConstants.ts` (static config — REQUIRED_COLUMN_DEFS, GROUPING_OPTIONS, USAGE_OPTIONS), `hardwareHelpers.ts` (pure functions — getDoorHwSetName, formatDoorTags, getItemValue, getUsageCellValue, buildSetGroups, buildDoorFieldGroups, buildHardwareGroups), `HardwareGroupTable.tsx` (sub-component), `index.tsx` (main component)
- **D-07:** HardwareSetConfig's download handler stays **inline** in `index.tsx` — no hook extraction. Index.tsx may slightly exceed 300 lines; user preference is simpler structure over strict line limit for this component.
- **D-08:** The `export type { HardwareSetExportConfig } from '../../types/hardwareSetTypes'` re-export must survive in `index.tsx`.

### Execution Order

- **D-09:** Both splits execute in **Wave 1 (parallel)** — they touch independent files with no shared state. Same pattern used successfully in Phase 7.

### File Naming Convention

- **D-10:** Sub-components use **PascalCase**: `ColumnAccordion.tsx`, `GroupedTable.tsx`, `HardwareGroupTable.tsx`
- **D-11:** Hooks use **camelCase**: `useDoorScheduleDownload.tsx`
- **D-12:** Helpers and constants use **camelCase**: `hardwareHelpers.ts`, `hardwareConstants.ts`
- Matches existing project conventions (components are PascalCase, hooks/utils are camelCase throughout `hooks/` and `services/`)

### VER Gates (Hard Requirements — No Discretion)

- **D-13:** VER-02 — `'use client'` must be the **literal first line** (before imports, before comments) in every sub-file that uses React hooks or browser APIs. Both `DoorScheduleConfig/index.tsx` and `HardwareSetConfig/index.tsx` need it. So do `ColumnAccordion.tsx`, `GroupedTable.tsx`, `HardwareGroupTable.tsx`, and `useDoorScheduleDownload.tsx`.
- **D-14:** VER-03 — **Component-as-barrel approach**: `index.tsx` IS the main component file and uses `export default ComponentName` at the file end (not a separate thin barrel). This satisfies VER-03's intent — the default export is explicit, not via `export *`. No separate inner `DoorScheduleConfig.tsx` or `HardwareSetConfig.tsx` file is created inside the sub-directory.
- **D-16:** **Line limit exception for `useDoorScheduleDownload.tsx`**: The extracted hook will be ~420 lines due to the 382-line handleDownload body. This overage is accepted — the function is a single cohesive async operation that cannot be meaningfully split without behavioral risk. Equivalent exception to D-07 for HardwareSetConfig's inline handler.
- **D-15:** VER-01 — After each split, run `tsc --noEmit` and diff against `.planning/tsc-baseline.txt`. Zero new TS2305/TS2307/TS2306 errors required before marking plan complete.

### Claude's Discretion

- Internal split of `index.tsx` JSX sections within the main component body — planner/executor decides how to group JSX into the file
- Whether `hardwareConstants.ts` and `hardwareHelpers.ts` are one file or two — requirement names them as separate domains; executor may merge if the combined file stays under 300 lines and cohesion is clear
- Exact parameter list for `useDoorScheduleDownload` hook — executor reads the function body and derives the minimal set of state inputs/setters

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source Files (Split Targets)
- `components/doorSchedule/DoorScheduleConfig.tsx` — Full source; confirm line 53 starts ColumnAccordion, line 124 starts GroupedTable, line 260 starts main component, line 337 starts handleDownload
- `components/hardware/HardwareSetConfig.tsx` — Full source; confirm line 52 starts static config, line 88 starts pure helpers, line 273 starts HardwareGroupTable, line 400 starts main component

### Consumer Files (Must Compile Unchanged After Split)
- `app/project/[id]/reports/door-schedule/page.tsx` — Uses `dynamic(() => import('@/components/doorSchedule/DoorScheduleConfig'), { ssr: false })`
- `app/project/[id]/reports/hardware-set/page.tsx` — Uses `dynamic(() => import('@/components/hardware/HardwareSetConfig'), { ssr: false })`
- `components/reports/ReportGenerationCenter.tsx` — Imports both `DoorScheduleConfig` and `HardwareSetConfig` as default imports
- `views/ReportsView.tsx` — Imports both as default imports

### Phase 7 Artifacts (Prerequisite)
- `.planning/tsc-baseline.txt` — 142-line baseline; all VER-01 diffs compare against this
- `types/doorScheduleTypes.ts` — Canonical location for `DoorScheduleExportConfig`
- `types/hardwareSetTypes.ts` — Canonical location for `HardwareSetExportConfig`

### Requirements
- `.planning/REQUIREMENTS.md` §COMP-01..COMP-04, §VER-01..VER-03 — acceptance criteria for this phase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `types/doorScheduleTypes.ts` and `types/hardwareSetTypes.ts` — already extracted in Phase 7; sub-directory index.tsx files re-export from these paths (not from within the sub-directory)
- Existing hook pattern in `hooks/` (camelCase file names, `'use client'` at top) — `useDoorScheduleDownload.tsx` should follow this pattern

### Established Patterns
- All consumers use **default import only** — `import DoorScheduleConfig from '...'` and `import HardwareSetConfig from '...'`. No named imports from these component paths (the type re-exports are rare and only matter for TypeScript tooling).
- `dynamic()` imports in page.tsx use `ssr: false` — the barrel `index.tsx` must remain a client component

### Integration Points
- Barrel `index.tsx` is the only file consumers see — all internal sub-file imports are local to the sub-directory
- The `export type { DoorScheduleExportConfig }` and `export type { HardwareSetExportConfig }` re-exports in the current flat files must be preserved in the new `index.tsx` files

</code_context>

<specifics>
## Specific Ideas

- User explicitly chose **custom hook** over plain module for DoorScheduleConfig download extraction — values React idiom consistency over functional purity
- User explicitly chose **inline handler** for HardwareSetConfig — values simpler structure; 300-line limit is a guideline here, not a blocker
- Parallel execution preference matches Phase 7's approach (Phase 7 ran 07-01 and 07-03 in parallel without issues)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 08-component-config-splits*
*Context gathered: 2026-05-13*
