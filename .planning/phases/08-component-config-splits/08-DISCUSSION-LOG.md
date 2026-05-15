# Phase 8: Component Config Splits - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 08-component-config-splits
**Areas discussed:** handleDownload extraction, Execution order, File naming inside sub-directories

---

## handleDownload extraction

| Option | Description | Selected |
|--------|-------------|----------|
| Custom hook: useDoorScheduleDownload | Accepts state values/setters, returns `{ handleDownload }`. Keeps React idioms. index.tsx calls hook and stays under 300 lines. | ✓ |
| Plain async module with injected params | Non-hook async function receiving all state as plain args. More functional/testable, but ~10 param list. | |

**User's choice:** Custom hook — `useDoorScheduleDownload.tsx`
**Notes:** Follow-up confirmed same pattern should NOT apply to HardwareSetConfig — user prefers simpler structure (inline handler) for HardwareSetConfig even if index.tsx slightly exceeds 300 lines.

---

## Execution order

| Option | Description | Selected |
|--------|-------------|----------|
| Parallel — both in Wave 1 | DoorScheduleConfig and HardwareSetConfig splits run simultaneously. No conflict risk (independent files). | ✓ |
| Sequential — DoorScheduleConfig first | Slower but easier to review first split before second starts. | |

**User's choice:** Parallel Wave 1
**Notes:** Consistent with Phase 7 approach.

---

## File naming inside sub-directories

| Option | Description | Selected |
|--------|-------------|----------|
| PascalCase for components, camelCase for hooks/helpers | ColumnAccordion.tsx, GroupedTable.tsx, useDoorScheduleDownload.tsx, hardwareHelpers.ts, hardwareConstants.ts | ✓ |
| PascalCase for everything | UseDoorScheduleDownload.tsx, HardwareHelpers.ts — deviates from hook/util conventions | |
| kebab-case for everything | column-accordion.tsx — doesn't match component naming | |

**User's choice:** PascalCase for sub-components, camelCase for hooks/helpers
**Notes:** Matches existing project conventions throughout `hooks/` and `services/`.

---

## Claude's Discretion

- Internal JSX grouping within index.tsx
- Whether hardwareConstants.ts and hardwareHelpers.ts are merged or kept separate
- Exact parameter list for useDoorScheduleDownload hook

## Deferred Ideas

None.
