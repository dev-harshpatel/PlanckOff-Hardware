# Domain Pitfalls: File Modularization (TypeScript/React)

**Domain:** Splitting large TypeScript 5.8 / Next.js 15 App Router / React 19 files into focused sub-modules  
**Codebase:** PlanckOff Hardware — 5 target files across `components/`, `hooks/`, `services/`  
**Researched:** 2026-05-13  
**Constraint:** Zero behavior change, all consumer imports preserved

---

## Pre-Split Checklist (run before touching each file)

Run these checks before starting any split. They take 5–10 minutes and prevent hours of debugging.

### Step 1 — Map the import graph for the file being split

```bash
# Find every file that imports from the target (direct consumers)
grep -rn "from.*<target-basename>" --include="*.ts" --include="*.tsx" . \
  --exclude-dir=node_modules --exclude-dir=.claude

# Find what the target itself imports (its direct dependencies)
head -40 <path/to/target-file>
```

For each target file, the known consumer list (as of 2026-05-13):

| Target file | Direct consumers |
|---|---|
| `components/doorSchedule/DoorScheduleConfig.tsx` | `views/ReportsView.tsx`, `services/excelExportService.ts`, `services/pdfExportService.ts`, `services/csvExportService.ts`, `services/reportExportService.ts`, `app/project/[id]/reports/door-schedule/page.tsx` |
| `hooks/useDoorTableState.tsx` | `components/doorSchedule/DoorScheduleManager.tsx` (imports `useDoorTableState`, `ALL_AVAILABLE_COLUMNS`, `StatusFilter`) |
| `services/excelExportService.ts` | `components/doorSchedule/DoorScheduleConfig.tsx` (import cycle risk), `views/` components |
| `components/hardware/HardwareSetConfig.tsx` | `views/ReportsView.tsx`, all `services/*ExportService.ts` files, `app/project/[id]/reports/hardware-set/page.tsx` |
| `components/pricing/PricingReportConfig.tsx` | Verify with grep before splitting |

### Step 2 — Confirm `'use client'` status

```bash
head -1 <path/to/target-file>
```

Capture the result. It determines the rule for every new sub-file (see Pitfall 2).

### Step 3 — List every exported name

```bash
grep -n "^export " <path/to/target-file>
```

Record every `export const`, `export function`, `export type`, `export interface`, `export default`. These are your preservation contract — every name must be reachable after the split at the same import path or via a re-export barrel.

### Step 4 — Check for existing circular imports before splitting

```bash
npx madge --circular --ts-config tsconfig.json --extensions ts,tsx . 2>/dev/null | head -30
```

If madge is not installed: `npm install -g madge` (dev tool, not a project dep). Document any pre-existing cycles so you do not incorrectly blame the split for them.

### Step 5 — Record TypeScript baseline

```bash
npx tsc --noEmit 2>&1 | wc -l
npx tsc --noEmit 2>&1 > /tmp/ts-baseline.txt
```

The project has `ignoreBuildErrors: true` in `next.config.ts` — TypeScript errors will not block the dev server. You must run `tsc --noEmit` manually or errors are invisible.

### Step 6 — Snapshot the public API surface

For each target, copy its full export list to a scratch note. After the split, diff against this list. Any missing or changed name is a regression.

---

## Post-Split Verification Checklist

Run after completing each file's split, before moving to the next.

1. `npx tsc --noEmit 2>&1 | diff - /tmp/ts-baseline.txt` — zero new errors
2. `npx next build 2>&1 | grep -E "error|Error"` — no new build errors (catches module boundary and SSR violations)
3. `npx madge --circular --ts-config tsconfig.json --extensions ts,tsx . 2>/dev/null` — no new circular dependency chains
4. `grep -rn "from.*<old-file-basename>" --include="*.ts" --include="*.tsx" . --exclude-dir=node_modules --exclude-dir=.claude` — all consumer imports still resolve (no import path changed)
5. For any file that previously had `'use client'`: run `grep -rn "use client" <new-sub-files>` — confirm directive is present in all new sub-files that use React hooks or browser APIs
6. Manual smoke test: open Door Schedule report page, Hardware Set report page, and Pricing report page in the browser. Confirm no blank screens or console errors.

---

## Critical Pitfalls

### Pitfall 1: Circular Import Creation

**Caught at:** TypeScript compile time (error), or webpack/Next.js bundler at runtime (silent value = `undefined`)

**What goes wrong:**  
`services/excelExportService.ts` (line 5–6) already imports `DoorScheduleExportConfig` from `components/doorSchedule/DoorScheduleConfig.tsx` AND `HardwareSetExportConfig` from `components/hardware/HardwareSetConfig.tsx`. At the same time, `DoorScheduleConfig.tsx` imports from `services/excelTheme.ts` (line 30). This is an existing cross-layer dependency: `components/ → services/`.

If during the split of `DoorScheduleConfig.tsx` you create a sub-file that imports from `excelExportService.ts` (or any sub-file of it), you will create a true circular chain:

```
components/doorSchedule/DoorScheduleConfig.tsx
  → services/excelExportService.ts
    → components/doorSchedule/DoorScheduleConfig.tsx   ← CYCLE
```

Webpack resolves this by returning `undefined` for the cyclically-imported module at initialization time. The result is not a compile error but a **silent runtime crash**: the imported type or value is `undefined` when the module initializes, producing `TypeError: X is not a function` or `Cannot read properties of undefined` at the first call site.

**Why it happens:**  
The `DoorScheduleExportConfig` interface lives inside the component file. Services import it as a type. After splitting, there will be a temptation to move `DoorScheduleExportConfig` into a new sub-file that also imports something back from the services layer.

**Prevention:**  
Move shared types (`DoorScheduleExportConfig`, `HardwareSetExportConfig`) into neutral files that nothing in this project imports from — specifically: place them alongside the existing `doorScheduleTypes.ts` pattern, which is pure types with no component or service imports. The destination for `DoorScheduleExportConfig` should be `components/doorSchedule/doorScheduleTypes.ts` (already exists). `HardwareSetExportConfig` should go to a new `components/hardware/hardwareSetTypes.ts`. Neither should import from `services/`.

**Pre-split check command:**
```bash
npx madge --circular --ts-config tsconfig.json --extensions ts,tsx . 2>/dev/null
```

**Warning signs:**  
- `TypeError: Cannot destructure property 'X' of undefined` at import time  
- Functions from a split sub-file are `undefined` when called  
- A component renders blank (no React error boundary catches module init failures cleanly)  
- TypeScript compiler does NOT always flag cycles — `isolatedModules: true` is set but it only catches per-file issues, not graph cycles

---

### Pitfall 2: Missing `'use client'` Directive in New Sub-Files

**Caught at:** Next.js App Router — runtime (RSC boundary violation), not TypeScript compile time

**What goes wrong:**  
`DoorScheduleConfig.tsx` does NOT have `'use client'` at line 1 (confirmed by inspection). However it uses `useState`, `useMemo`, `useCallback` — React hooks — and is imported by an App Router page that IS marked `'use client'` and uses `dynamic(..., { ssr: false })`. This is currently safe because the consumer boundary is `'use client'`.

`HardwareSetConfig.tsx` also does NOT have `'use client'` (line 1 is the React import). It uses hooks internally.

`PricingReportConfig.tsx` DOES have `'use client'` at line 1.

`useDoorTableState.tsx` DOES have `'use client'` at line 1 (it uses browser APIs: `window.localStorage`, `document.addEventListener`).

When you split any of these files:
- A sub-file that uses React hooks (`useState`, `useRef`, `useMemo`, `useEffect`) OR browser globals (`window`, `document`, `localStorage`) must carry `'use client'` as its **first line**.
- A sub-file that is purely types/interfaces/constants does NOT need `'use client'`.
- A sub-file that re-exports from other `'use client'` sub-files does NOT automatically inherit the directive — it must declare it independently.

**The specific error message:**
```
Error: useState can only be called in a Client Component.
Add the "use client" directive at the top of the file.
  at useState (...)
```

Or, more confusingly, a blank page with no error if the RSC boundary silently swallows the render.

**Why it happens:**  
Developers split a 900-line file into four sub-files and remember to put `'use client'` on the component sub-file but forget it on the hooks sub-file or the sub-component sub-file.

**Prevention:**  
For each of the 5 target files, here is the exact `'use client'` rule:

| File | Current directive | Rule for sub-files |
|---|---|---|
| `DoorScheduleConfig.tsx` | None (but loaded via `dynamic`, `ssr: false`) | Any sub-file using hooks OR JSX that uses hooks must add `'use client'`. Pure-type files and `doorScheduleTypes.ts` do not. |
| `useDoorTableState.tsx` | `'use client'` on line 1 | Every sub-file that contains any hook call or `window`/`document` access must have `'use client'` on line 1. |
| `excelExportService.ts` | None (pure service, no hooks) | No sub-file should need `'use client'` since these are not React components. If somehow a sub-file ends up needing `window` at module init time, prefer lazy access instead. |
| `HardwareSetConfig.tsx` | None (uses hooks internally) | Same rule as `DoorScheduleConfig.tsx` — sub-files with hooks need the directive. |
| `PricingReportConfig.tsx` | `'use client'` on line 1 | Every sub-file from this split must carry `'use client'`. |

**Post-split check command:**
```bash
# For every new sub-file in a split of a 'use client' parent:
for f in components/doorSchedule/new-subfile*.tsx; do head -1 "$f"; done
```

---

### Pitfall 3: Barrel Re-Export Type vs. Value Confusion — Silent TypeScript Failures

**Caught at:** TypeScript compile time — BUT only if `isolatedModules: true` is respected AND the wrong form is used. With `strict: false`, many failures are silent.

**What goes wrong:**  
When creating a barrel `index.ts` to re-export from sub-files, there is a difference between:

```typescript
// WRONG for type-only exports when isolatedModules: true
export { DoorScheduleExportConfig } from './doorScheduleExportTypes';

// CORRECT
export type { DoorScheduleExportConfig } from './doorScheduleExportTypes';
```

With `isolatedModules: true` (which IS set in `tsconfig.json`), the compiler cannot know whether `DoorScheduleExportConfig` is a type or a value when processing a barrel file in isolation. If you re-export it without `type`, esbuild/SWC (used by Next.js) will attempt to emit a runtime value that doesn't exist — resulting in an empty object at runtime or a build error.

The specific TypeScript error when this fires:
```
TS1205: Re-exporting a type when 'isolatedModules' is enabled requires using 'export type'.
```

However: this project has `ignoreBuildErrors: true` in `next.config.ts`. TypeScript errors will NOT block the dev server. The barrel will appear to work in development but can produce `undefined` where the type was expected at runtime in production.

**Why it happens:**  
A developer creates a barrel `components/doorSchedule/index.ts` and writes `export { SomeInterface, someFunction }` — mixing types and values in one export. SWC strips type-only exports at build time. The value `someFunction` is fine; `SomeInterface` becomes `undefined` at any call site that expected to import it as a value.

**Prevention:**  
- Use `export type { ... }` for every interface, type alias, and `const enum`.
- Use `export { ... }` only for runtime values (functions, `const` with runtime data).
- If in doubt, check the source file: if the declaration is `interface`, `type`, or `export type`, always use `export type` in the barrel.
- Avoid creating barrels at all unless there is a compelling reason. Direct imports are safer for this refactor because the consumer import paths are already known and should not change.

**For this codebase specifically:**  
`DoorScheduleExportConfig` (in `DoorScheduleConfig.tsx`) and `HardwareSetExportConfig` (in `HardwareSetConfig.tsx`) are both `interface` declarations imported as types by four service files each. When moved to their own files, every import site currently uses them as types — verify with:

```bash
grep -n "DoorScheduleExportConfig\|HardwareSetExportConfig" services/*.ts
# All uses should be in type positions (function parameter types, not runtime usage)
```

---

### Pitfall 4: Import Order / Module Initialization Order Bugs

**Caught at:** Runtime only — TypeScript does not model initialization order

**What goes wrong:**  
`useDoorTableState.tsx` exports runtime values that are used immediately at module load time:

```typescript
export const ALL_AVAILABLE_COLUMNS: ColumnDef[] = [ ... ];     // line 42 — runtime array
export const DOOR_SECTION_KEYS = new Set([...]);                // line 86 — runtime Set
export const FRAME_SECTION_KEYS = new Set([...]);               // line 90 — runtime Set
export const HARDWARE_SECTION_KEYS = new Set([...]);            // line 95 — runtime Set
```

`DoorScheduleManager.tsx` imports `ALL_AVAILABLE_COLUMNS` at its top level (line 9) and immediately references it in a `useState` initializer (line 139):

```typescript
const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
  new Set(ALL_AVAILABLE_COLUMNS.filter(c => c.isCore).map(c => c.key))
);
```

If during the split you put `ALL_AVAILABLE_COLUMNS` in a sub-file that depends on something else that depends back on the main hook file, the initialization order is undefined and `ALL_AVAILABLE_COLUMNS` may be `undefined` at the line above. The result: `ALL_AVAILABLE_COLUMNS.filter is not a function`.

**The second initialization hazard:**  
`excelExportService.ts` uses `import * as XLSX from 'xlsx-js-style'` at the top level (line 1). If sub-files import from each other in a circular way during the split, XLSX may not be initialized when a sub-file references it. The function `XLSX.utils.book_new()` will throw `Cannot read properties of undefined (reading 'utils')`.

**Why it happens:**  
ESM module evaluation order is deterministic but depends on the dependency graph. A split that introduces a new edge in the graph can change which module evaluates first.

**Prevention:**
- Ensure constants and data structures (`ALL_AVAILABLE_COLUMNS`, `SECTION_KEYS`, etc.) are in a sub-file that has NO imports from other sub-files in the same split. They should import only from `types.ts`, `utils/`, or external packages.
- For `excelExportService.ts`: put the `import * as XLSX` at the top of each sub-file that needs it independently — do not re-export the XLSX module object itself.
- Order of sub-file contents when creating a new file: constants/types at top, imports they depend on below, functions that reference both at the bottom.
- Prefer named imports over `import *` in sub-files derived from `excelExportService.ts`.

**Pre-split check:**  
Identify every module-level expression in the target file (anything not inside a function body):

```bash
grep -n "^export const\|^const\|^let\|^var\|^new " <target-file>
```

For each constant, trace its dependencies. If it depends on another file being evaluated first, note it.

---

### Pitfall 5: ESLint Import Rules Blocking Split Patterns

**Caught at:** ESLint lint step — blocked CI, not TypeScript compile time

**What goes wrong:**  
The project has no root `.eslintrc.json` (confirmed — file does not exist at project root). Next.js ships a built-in ESLint config (`eslint-config-next`) that is auto-enabled unless overridden.

The relevant rules in `eslint-config-next` for file splitting are:

1. **`import/no-cycle`** — Not enabled in the default Next.js config, but if a team has added it via `eslint-plugin-import`, any circular import introduced by the split will be caught at lint time.

2. **`@next/next/no-html-link-for-pages`** — Not relevant to splitting.

3. **React Hooks rules** — `react-hooks/rules-of-hooks` WILL flag if a sub-file that defines hooks is not a function/component (e.g., if hooks end up in a plain `.ts` file instead of a `.tsx` or named as `useSomething`). When splitting `useDoorTableState.tsx`, every sub-file that contains hook calls must either be named `use<Something>.ts/tsx` or be a React component.

4. **`@typescript-eslint/consistent-type-imports`** — If this rule is enabled (it is in some Next.js setups), then importing a type without `import type { }` will trigger a lint error. Check with:
   ```bash
   npx next lint 2>&1 | head -30
   ```

**Specific risk for this codebase:**  
`useDoorTableState.tsx` exports `renderCell` and `renderHeader` — these are functions that return JSX but are not React components (they are methods on the hook return object). If moved to a separate sub-file, ESLint may flag them as hooks violations or require `'use client'` to be explicit. More importantly, `renderCell` and `renderHeader` call `useState` setters passed in via closure — they cannot be moved to a file that doesn't have access to the parent hook's closed-over state. These two functions **must stay in the main hook file or in a sub-file that is called from within the hook function body**, not at module scope.

**Prevention:**
- Run `npx next lint` before and after each split and diff the output.
- Hook-returning functions (those that call `useState`, `useRef`, etc.) must be in files named `use*.ts` or `use*.tsx`.
- JSX-returning functions that are not React components (like `renderCell`, `renderHeader` in `useDoorTableState.tsx`) must remain co-located with the state they close over — do not extract them to standalone files.

---

### Pitfall 6: Next.js 15 Module Boundary Violations

**Caught at:** Next.js build (`next build`) — not caught by `tsc --noEmit`

**What goes wrong:**  
Next.js 15 App Router enforces a hard boundary between Server Components and Client Components. The boundary rule:

- Server Components can import Client Components, but not the reverse.
- A Server Component cannot use hooks or browser APIs.
- A file without `'use client'` that is imported by a Server Component is treated as a Server Component.

**Current state:**  
`DoorScheduleConfig.tsx` has no `'use client'` directive but is loaded only via `dynamic(..., { ssr: false })` in `app/project/[id]/reports/door-schedule/page.tsx`. This is a deliberate pattern to keep the component out of the SSR pass entirely. The `dynamic` wrapper is the safety net.

**The risk during splitting:**  
If a sub-file extracted from `DoorScheduleConfig.tsx` is also imported somewhere else that does NOT use `dynamic(..., { ssr: false })`, it will be evaluated during SSR. If that sub-file contains `useState` or any browser API at module level, Next.js will throw:

```
Error: 'window' is not defined
```
or
```
Error: useState can only be called in a Client Component
```

This error only appears at build time or SSR runtime, not during hot-module dev reload.

**The second risk: `serverExternalPackages` boundary:**  
`next.config.ts` lists `jspdf`, `jspdf-autotable`, `xlsx`, `file-saver`, `pdfjs-dist` as `serverExternalPackages`. These packages access browser globals at module init time. If a sub-file from the `excelExportService.ts` split `import`s `xlsx-js-style` at the top level (as the original does), and that sub-file is then imported by any API route or Server Component, Next.js will attempt to load `xlsx-js-style` server-side. Note: `xlsx-js-style` is NOT in the `serverExternalPackages` list — only `xlsx` is. Verify with:

```bash
grep "xlsx-js-style\|xlsx" next.config.ts
```

`xlsx-js-style` is a different package from `xlsx`. If you split `excelExportService.ts` into sub-files that are imported in a server context, you may encounter `ReferenceError: self is not defined` or similar browser-global errors at runtime.

**Prevention:**
- After splitting `DoorScheduleConfig.tsx`, verify ALL import sites still use `dynamic(..., { ssr: false })` or are themselves `'use client'` components. Do not add any new import of the split sub-files to files that lack both.
- Keep all `import * as XLSX from 'xlsx-js-style'` statements in files that are only ever imported from client-side code paths. The existing `dynamic` + `ssr: false` pattern is the correct guard.
- For `excelExportService.ts` sub-files: use dynamic import (`await import('xlsx-js-style')`) instead of top-level import if there is any chance the sub-file reaches a server context. The original `DoorScheduleConfig.tsx` already uses `await import('xlsx-js-style')` inside the async handler (line 378) — this is safer than top-level imports and should be preserved in sub-files.

**Post-split check command:**
```bash
npx next build 2>&1 | grep -E "error:|Error:|warning: Server Component"
```

---

## Moderate Pitfalls

### Pitfall 7: Dead Code Silently Moving Into Sub-Files

**What goes wrong:**  
`excelExportService.ts` lines 711–900 contain `exportDoorScheduleToPDF` — noted in PROJECT.md as "unused — safe to delete". If this dead function is carried into a sub-file during the split without deletion, it continues to silently exist. Worse: if it's moved to a sub-file that doesn't exist before the split, it may cause confusion about whether it is newly added code or old code.

**Prevention:**  
Delete `exportDoorScheduleToPDF` (lines 711–900 of `excelExportService.ts`) as a separate commit before splitting the file. Verify it has no import references:

```bash
grep -rn "exportDoorScheduleToPDF" --include="*.ts" --include="*.tsx" . --exclude-dir=node_modules --exclude-dir=.claude
```

Do not carry dead code into new sub-files.

---

### Pitfall 8: Type-Only Files Acquiring `.tsx` Extension Unnecessarily

**What goes wrong:**  
When extracting pure-type files from component files, developers sometimes give them a `.tsx` extension because the source was a `.tsx`. A `.tsx` file with no JSX triggers no errors but adds overhead and signals to the reader that JSX is present. More importantly, in strict projects it can trigger ESLint JSX rules unnecessarily.

**Prevention:**  
Pure-type files (no JSX, no hooks, no browser APIs) must use `.ts`, not `.tsx`. Example: `doorScheduleTypes.ts` already exists and follows this correctly. Any new type-extraction files must follow the same pattern.

---

### Pitfall 9: Re-Exported Default Not Preserved

**What goes wrong:**  
`DoorScheduleConfig.tsx` has `export default DoorScheduleConfig` (line 1007). `HardwareSetConfig.tsx` similarly exports a default. If you create a barrel that only re-exports named exports, the consumer `import DoorScheduleConfig from '../components/doorSchedule/DoorScheduleConfig'` will receive `undefined`.

**Prevention:**  
The original file must remain and continue to export the default component, OR the barrel must include:

```typescript
export { default } from './DoorScheduleConfigMain';
```

The simplest approach: keep the original file as a thin shell that imports from sub-files and re-exports everything. This preserves all consumer import paths without change.

---

## Minor Pitfalls

### Pitfall 10: `'use client'` Not on Line 1

**What goes wrong:**  
Next.js requires `'use client'` to be the **first non-comment, non-whitespace token** of the file. If it appears after an import or blank line, it is silently ignored in some versions.

**Prevention:**  
When adding `'use client'` to a new sub-file, it must be literally line 1, before any import statements, before any comments.

---

### Pitfall 11: TypeScript Path Aliases Breaking in Sub-Directories

**What goes wrong:**  
`tsconfig.json` maps `@/*` to `./*` (project root). This means `@/services/pdfTheme` resolves from root regardless of where the importing file is. However, relative imports like `../../services/excelTheme` (used in `DoorScheduleConfig.tsx` line 30) depend on the importing file's location. If a sub-file is placed in a new subdirectory, relative imports must be re-counted.

**Prevention:**  
When splitting `DoorScheduleConfig.tsx` into sub-files within `components/doorSchedule/`, prefer `@/` alias imports over relative imports — `@/services/excelTheme` rather than `../../services/excelTheme`. This is resilient to subdirectory depth changes. The existing `@/hooks/useDoorAggregation` and `@/services/pdfTheme` imports in `DoorScheduleConfig.tsx` already use this pattern correctly.

---

## Phase-Specific Warnings

| File | Key Pitfall | Mitigation |
|---|---|---|
| `DoorScheduleConfig.tsx` | Services import `DoorScheduleExportConfig` from this file — split must move the type without breaking 4+ service import paths | Move interface to `doorScheduleTypes.ts` first (separate commit), update service imports, then split component |
| `useDoorTableState.tsx` | `renderCell`/`renderHeader` close over hook state — cannot be extracted to standalone files | Keep them in the main hook return, only extract stateless utilities (column defs, filter logic) |
| `excelExportService.ts` | Cross-import with `DoorScheduleConfig.tsx` — any new edge risks a circular chain | Move `DoorScheduleExportConfig` out of the component file before splitting the service |
| `HardwareSetConfig.tsx` | Services import `HardwareSetExportConfig` from this file AND an App Router page imports it with `import type` | Move interface to `hardwareSetTypes.ts` first; ensure new file has no component imports |
| `PricingReportConfig.tsx` | Has `'use client'` — all sub-files must carry it | Apply `'use client'` as first line to every sub-file before adding any other content |

---

## Sources

Findings are based on direct codebase inspection of the following files:

- `components/doorSchedule/DoorScheduleConfig.tsx` (915 lines) — confirmed no `'use client'`, imports from services
- `hooks/useDoorTableState.tsx` (783 lines) — confirmed `'use client'` on line 1, uses `window.localStorage`
- `services/excelExportService.ts` (794 lines) — confirmed imports from component files (cross-layer)
- `components/doorSchedule/doorScheduleTypes.ts` — correct pattern for type-only extraction
- `app/project/[id]/reports/door-schedule/page.tsx` — confirmed `dynamic(..., { ssr: false })` guard
- `next.config.ts` — `serverExternalPackages`, `ignoreBuildErrors: true`, `transpilePackages: ['jszip']`
- `tsconfig.json` — `isolatedModules: true`, `strict: false`, `@/*` path alias
- TypeScript 5.8 `isolatedModules` documentation behavior (HIGH confidence — standard behavior)
- Next.js 15 App Router `'use client'` boundary rules (HIGH confidence — standard behavior)
