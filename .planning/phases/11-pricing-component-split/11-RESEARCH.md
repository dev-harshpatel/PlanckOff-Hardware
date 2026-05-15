# Phase 11: Pricing Component Split - Research

**Researched:** 2026-05-14
**Domain:** React component structural refactor — extract `ProposalTab` sub-component from `PricingReportConfig.tsx`
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRICING-01 | `PricingReportConfig.tsx` (745 ln) split by extracting the complete `ProposalTab` sub-component (~354 lines of cohesive JSX) into its own file — no partial extraction of individual tables | ProposalTab block spans lines 354–710 in the file (the `{activeTab === 'proposal' && ...}` block); all inner tables move together as one cohesive unit |
| PRICING-02 | All existing consumer imports of `PricingReportConfig` resolve to the same named exports without modification after split; `tsc --noEmit` diff shows zero new errors | Single consumer: `app/project/[id]/reports/pricing/page.tsx` uses `dynamic(() => import('@/components/pricing/PricingReportConfig'))` — default import, no named exports consumed; split is transparent to consumers |

</phase_requirements>

---

## Summary

`PricingReportConfig.tsx` is 781 lines (current state — flat file, not yet split). The file contains a single React component that hosts four tab views: Doors, Frames, Hardware, and Proposal. The `ProposalTab` content (the `{activeTab === 'proposal' && (...)}` block) is a cohesive chunk of ~354 lines of JSX and zero hook logic — it is purely a presentational block that renders proposal-state values already computed by `usePricingProposal` and `usePricingFilters` in the parent. This makes it safe to extract without any hook or closure constraint.

The split strategy is: extract the `{activeTab === 'proposal' && (...)}` JSX block into a new `ProposalTab.tsx` file in `components/pricing/`, give it a named `ProposalTab` React component with an explicit props interface, and replace the inline block in `PricingReportConfig.tsx` with `{activeTab === 'proposal' && <ProposalTab ... />}`. `PricingReportConfig.tsx` remains the flat file (no sub-directory needed — only one extraction), carries `'use client'` as its existing literal first line, and still ends with `export default PricingReportConfig`. No consumer file needs modification.

The single consumer `app/project/[id]/reports/pricing/page.tsx` imports via `dynamic(() => import('@/components/pricing/PricingReportConfig'))` — a default import with no named symbols — so the split is fully transparent to it.

**Primary recommendation:** Extract ProposalTab as `components/pricing/ProposalTab.tsx`; keep `PricingReportConfig.tsx` as the flat (non-sub-directory) main file with a `<ProposalTab ... />` import. No barrel, no sub-directory. The component-as-barrel pattern (D-14) is not needed here because there is only one extracted sub-file.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 (project-pinned) | Component model | Project standard |
| TypeScript | 5.8.2 (project-pinned) | Static typing | Project standard |
| Next.js | 15 (project-pinned) | App framework | Project standard |

No new dependencies are introduced by this phase. The extraction is purely structural.

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure (after split)

```
components/pricing/
├── PricingReportConfig.tsx    # Main component (reduced ~354 lines, existing file)
├── ProposalTab.tsx            # NEW — extracted ProposalTab sub-component
├── MultiFilterSelect.tsx      # Unchanged
├── PricingDetailModal.tsx     # Unchanged
├── PricingHierarchyView.tsx   # Unchanged
├── PricingTableRows.tsx       # Unchanged
└── PriceBookManager.tsx       # Unchanged
```

This is a **flat extraction** — not a sub-directory split. Unlike Phases 8/9/10 which used sub-directories with barrel `index.tsx` files, Phase 11 extracts a single component into a peer file in the same directory. The main file `PricingReportConfig.tsx` retains its path; no import path changes for any consumer.

### Pattern 1: Flat Sibling Extraction (this phase)

**What:** Extract a self-contained JSX block into a sibling `.tsx` file in the same directory. The parent imports it as a named component.

**When to use:** When the extracted piece is purely presentational (no hooks needed beyond what's passed as props), and the parent file stays as the consumer entry point.

**Example (Phase 11 target):**
```typescript
// components/pricing/ProposalTab.tsx
'use client';

import React from 'react';
import { X } from 'lucide-react';
import type { DoorPricingGroup, HardwarePricingGroup } from '@/utils/pricingGrouping';
// ... other imports the ProposalTab JSX body references
import { MultiFilterSelect } from './MultiFilterSelect';
import { PricingHierarchyView } from './PricingHierarchyView';

interface ProposalTabProps {
  // All values the ProposalTab JSX block closes over from PricingReportConfig state
  projectName: string;
  doorGroups: DoorPricingGroup[];
  frameGroups: DoorPricingGroup[];
  hwSetList: Array<{ name: string; doorCount: number }>;
  // ... proposal filter props, hide/restore handlers, tax rows, expenses, etc.
}

export const ProposalTab: React.FC<ProposalTabProps> = ({ ... }) => {
  return (
    <div className="rounded-lg border ...">
      {/* exact JSX from lines 356–710 of PricingReportConfig.tsx */}
    </div>
  );
};
```

```typescript
// components/pricing/PricingReportConfig.tsx (after split)
'use client';
// ... existing imports, plus:
import { ProposalTab } from './ProposalTab';

// In JSX return, replace the inline block:
{activeTab === 'proposal' && (
  <ProposalTab
    projectName={projectName}
    doorGroups={doorGroups}
    // ... all props
  />
)}
```

### Pattern 2: VER-02 Directive Placement

**What:** Every sub-file using React hooks or browser APIs must have `'use client'` as its LITERAL FIRST LINE — before all imports, before all comments.

**When to use:** Always for any `.tsx` file in this project that contains client-side logic.

**Correct:**
```typescript
'use client';

import React from 'react';
```

**Wrong (violates VER-02):**
```typescript
// ProposalTab component
'use client';
import React from 'react';
```

### Pattern 3: VER-03 Default Export

**What:** The main file `PricingReportConfig.tsx` must still end with `export default PricingReportConfig`. `ProposalTab.tsx` uses a named export (`export const ProposalTab`), not a default export.

**Why:** `PricingReportConfig` has one consumer that uses a default import via `dynamic()`. The default export must remain at the original path. `ProposalTab` is an internal component — named export per project `.claude/skills/code-standards/SKILL.md` §3.

**Note on VER-03 scope:** VER-03 requires barrel `index.ts(x)` files to explicitly re-export defaults via `export { default } from './File'`. Phase 11 does NOT create a barrel/index file — it is a flat extraction, not a sub-directory split. VER-03 does not apply to `ProposalTab.tsx` itself (it has no default export) and does not apply to `PricingReportConfig.tsx` (it is not a barrel file). VER-03 is satisfied by confirming `PricingReportConfig.tsx` still ends with `export default PricingReportConfig`.

### Anti-Patterns to Avoid

- **Partial extraction:** Do NOT extract only some of the proposal tables and leave others inline in `PricingReportConfig.tsx`. The requirement (PRICING-01) mandates moving the complete ProposalTab block — all 5 inner sections (summary, doors, frames, hardware, extra expenses, tax, remarks) move together.
- **Sub-directory over-engineering:** Do NOT create a `PricingReportConfig/` sub-directory with an `index.tsx` barrel. Only one component is being extracted; a flat sibling file is the right structure.
- **Hooks in ProposalTab:** ProposalTab is purely presentational — it does NOT call `usePricingProposal`, `usePricingFilters`, or any other hook. All computed values are passed in as props from `PricingReportConfig`. Moving hook calls into `ProposalTab` would be a behavior change and is forbidden.
- **Moving `fmt` formatter:** The `fmt` Intl.NumberFormat constant at line 27 of `PricingReportConfig.tsx` is used by BOTH the main component (lines 229–235) and the ProposalTab JSX. Either: (a) move `fmt` to `ProposalTab.tsx` and also keep/import it in `PricingReportConfig.tsx`, or (b) define `fmt` in `PricingReportConfig.tsx` and pass it as a prop to `ProposalTab`. Option (a) is simpler — define `fmt` locally in both files as a module-level constant (it is pure, stateless, and cheap to instantiate). Option (b) avoids duplication but passes a non-serializable object as prop. Recommended: define `fmt` in each file independently (no prop passing needed, no shared module needed — both files are small and the definition is 1 line).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Import path depth | Manual path counting | Match existing sibling imports in `components/pricing/` | All existing sibling imports use `'./ComponentName'` — no depth adjustment needed |
| 'use client' placement | Guessing | Literal first line, no leading whitespace | VER-02 enforces exact placement; Phase 8 verification shows even a comment before it fails the gate |
| VER-01 tsc diffing | Custom diffing logic | `npx tsc --noEmit 2>&1 | grep -E "TS2305|TS2307|TS2306"` diff against `.planning/tsc-baseline.txt` | Established pattern from Phases 8, 9, 10 |

**Key insight:** ProposalTab has zero hooks — it is entirely driven by props. The props interface will be large (20+ values), but all values are already computed by `usePricingProposal` and `usePricingFilters` in `PricingReportConfig`. This means: no closure constraints, no re-subscription risk, no hook-ordering concerns.

---

## Common Pitfalls

### Pitfall 1: `fmt` used in both parent and child
**What goes wrong:** `ProposalTab` JSX uses `fmt.format(...)` extensively. If `fmt` is not defined or imported in `ProposalTab.tsx`, all those calls fail with a runtime reference error.
**Why it happens:** The extractor copies the JSX block but doesn't notice `fmt` is a module-level constant defined in the parent file.
**How to avoid:** Define `fmt` as a module-level constant in `ProposalTab.tsx`:
```typescript
const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
```
Keep the same definition in `PricingReportConfig.tsx` for the summary banner (lines 229–235). Both files define it independently — acceptable for a 1-line pure constant.
**Warning signs:** TypeScript would NOT catch this at compile time if `fmt` somehow shadowed from a global — test with `tsc --noEmit` and check for TS2304 (`Cannot find name 'fmt'`).

### Pitfall 2: Wrong `from` path for sibling imports
**What goes wrong:** Using `'../../utils/pricingGrouping'` in `ProposalTab.tsx` instead of `'@/utils/pricingGrouping'` or `'../pricingGrouping'`.
**Why it happens:** Forgetting that `ProposalTab.tsx` lives in `components/pricing/` — the same directory as `PricingReportConfig.tsx` — so sibling imports use `'./'` prefix.
**How to avoid:** `ProposalTab.tsx` imports from the same paths as `PricingReportConfig.tsx`. Since `PricingReportConfig` already uses `@/` alias paths for hooks/utils/types and `'./'` for sibling components, `ProposalTab` uses the same patterns. No depth change.
**Warning signs:** VER-01 tsc diff will show TS2307 (`Cannot find module`) if paths are wrong.

### Pitfall 3: ProposalTab importing hooks instead of receiving props
**What goes wrong:** Adding `const { usePricingProposal, ... } = usePricingProposal(...)` inside `ProposalTab`.
**Why it happens:** Noticing that `ProposalTab` uses `hiddenProposalTables`, `taxRows`, `extraExpenses` etc. and assuming it should own those hooks.
**How to avoid:** All proposal state comes from `usePricingProposal` which is called in `PricingReportConfig`. Pass all required values as props to `ProposalTab`. Zero-behavior-change constraint forbids moving hook call sites.
**Warning signs:** Any `useState`, `useEffect`, or `useCallback` inside `ProposalTab.tsx` is a red flag — they should NOT be there.

### Pitfall 4: Forgetting `'use client'` in ProposalTab
**What goes wrong:** `ProposalTab.tsx` renders without the directive; in Next.js 15 App Router this may cause SSR hydration mismatches or silent client-only API errors.
**Why it happens:** Extractor copies JSX but doesn't add the directive.
**How to avoid:** `'use client';` must be the LITERAL FIRST LINE (before any imports, before any comments).
**Warning signs:** VER-02 gate explicitly checks `head -1` of the file.

### Pitfall 5: Losing `handleDownloadProposalPdf` button in the banner
**What goes wrong:** The "Export Proposal" button in the top banner (lines 238–245 of `PricingReportConfig.tsx`) is rendered when `activeTab === 'proposal'`. This button stays in `PricingReportConfig.tsx` (it is in the banner, not in the ProposalTab block). Extractor might accidentally move it to `ProposalTab` or leave the conditional broken.
**Why it happens:** The banner contains tab-conditional rendering that is visually related to the proposal tab but structurally outside the `{activeTab === 'proposal' && (...)}` block.
**How to avoid:** Extract only the block starting at line 355 (`{/* ── Proposal tab ── */}`) through line 710 (the closing `})}` of the proposal block). The banner (lines 221–315) stays entirely in `PricingReportConfig.tsx`.
**Warning signs:** Runtime regression — "Export Proposal" button appears in wrong location or is missing when proposal tab active.

### Pitfall 6: Baseline vs. current tsc errors
**What goes wrong:** Comparing against the original baseline which includes errors from `DoorScheduleConfig.tsx` (now deleted). The baseline has 142 TS2305/TS2307/TS2306 lines — but many of those referenced files no longer exist after Phases 8/9/10.
**Why it happens:** The baseline file is stale relative to the current state of the codebase.
**How to avoid:** The correct VER-01 procedure is: run `tsc --noEmit` before the split (capture pre-split output), run `tsc --noEmit` after the split (capture post-split output), diff the two. NEW errors (`>` lines in diff) are the gate. The pre-existing baseline.txt is not the right comparison target after 4 phases of deletions — use a fresh pre-split snapshot.
**Warning signs:** If diffing against `.planning/tsc-baseline.txt` shows many `<` (removed) lines but no `>` (added) lines, the gate is still PASS. The planner should clarify VER-01 instructions to use a fresh pre-split capture or confirm the existing baseline is still the reference.

---

## Code Examples

### Props Interface Derivation

The `ProposalTab` props must include every value the proposal JSX block (lines 355–710) references from outer scope. Scanning the block:

```typescript
// Source: PricingReportConfig.tsx lines 355-710 (scanned manually)
interface ProposalTabProps {
  // From usePricingFilters
  projectName: string;
  doorGroups: DoorPricingGroup[];
  frameGroups: DoorPricingGroup[];
  proposalFilters: { material: string[]; floor: string[]; building: string[] };
  proposalMaterials: string[];
  proposalFloors: string[];
  proposalBuildings: string[];
  proposalDoorBase: number;
  proposalFrameBase: number;
  proposalHwBase: number;
  proposalBreakdown: unknown; // actual type from usePricingFilters return
  hwSetList: Array<{ name: string; doorCount: number }>;
  setProposalFilter: (key: 'material' | 'floor' | 'building', value: string[]) => void;

  // From usePricingProposal
  hiddenProposalTables: Set<'doors' | 'frames' | 'hardware'>;
  toggleProposalTable: (key: 'doors' | 'frames' | 'hardware') => void;
  profitPct: { door: string; frame: string; hardware: string };
  allocateExpenses: boolean;
  taxRows: Array<{ id: string; description: string; taxPct: string }>;
  remarks: string;
  extraExpenses: Array<{ id: string; delivery: string; totalPrice: string }>;
  handleProfitChange: (category: 'door' | 'frame' | 'hardware', val: string) => void;
  handleAllocateChange: (val: boolean) => void;
  handleAddTaxRow: () => void;
  handleTaxRowChange: (id: string, field: 'description' | 'taxPct', val: string) => void;
  handleRemoveTaxRow: (id: string) => void;
  handleRemarksChange: (val: string) => void;
  handleAddExpense: () => void;
  handleExpenseChange: (id: string, field: 'delivery' | 'totalPrice', val: string) => void;
  handleRemoveExpense: (id: string) => void;
  proposalDoorTotal: number;
  proposalFrameTotal: number;
  proposalHwTotal: number;
  extraExpensesTotal: number;
  proposalGrandTotal: number;
  taxSubtotal: number;
  totalAfterTax: number;
  doorAlloc: number;
  frameAlloc: number;
  hwAlloc: number;
}
```

**Note:** The exact types for `proposalBreakdown` and filter types should be read from the return type of `usePricingFilters` (in `hooks/usePricingFilters.ts`) before writing the plan. The planner should instruct the executor to read that hook's return type signature.

### Exact ProposalTab Block Boundaries

```
Line 354: {/* ── Proposal tab ── */}
Line 355: {activeTab === 'proposal' && (
Line 356:   <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-6 space-y-6">
   ...
Line 710:   </div>
Line 711: )}
```

The extraction is: lines 354–711 of `PricingReportConfig.tsx`. The opening comment and the `activeTab === 'proposal' &&` conditional wrapper stay in `PricingReportConfig.tsx`; the extracted `<div>` block (lines 356–710) becomes the JSX return body of `ProposalTab`.

Alternatively: `ProposalTab` renders the outer `<div className="rounded-lg ...">` — `PricingReportConfig.tsx` calls `{activeTab === 'proposal' && <ProposalTab ... />}`.

### VER-01 Command (Phase 11)

```bash
# Capture pre-split state (run BEFORE creating ProposalTab.tsx)
npx tsc --noEmit 2>&1 | grep -E "TS2305|TS2307|TS2306" > /tmp/pre-split-phase11.txt

# Capture post-split state (run AFTER split + deletion)
npx tsc --noEmit 2>&1 | grep -E "TS2305|TS2307|TS2306" > /tmp/post-split-phase11.txt

# Diff — zero ">" lines required
diff /tmp/pre-split-phase11.txt /tmp/post-split-phase11.txt
```

---

## File-Level Analysis

### PricingReportConfig.tsx (current: 781 lines)

| Lines | Content | Action |
|-------|---------|--------|
| 1–26 | `'use client'`, imports | Keep in PricingReportConfig.tsx |
| 27 | `const fmt = ...` | Keep in PricingReportConfig.tsx; also define in ProposalTab.tsx |
| 29–203 | Component function: state, hooks, handlers | Keep all in PricingReportConfig.tsx |
| 204–216 | TABS array, handleExportConfirm | Keep in PricingReportConfig.tsx |
| 218–315 | JSX banner (totals, export buttons) | Keep in PricingReportConfig.tsx |
| 317–352 | JSX tabs + filter bar | Keep in PricingReportConfig.tsx |
| 354–711 | JSX proposal block | **EXTRACT to ProposalTab.tsx** |
| 712–777 | JSX door/frame/hardware tables + loading | Keep in PricingReportConfig.tsx |
| 771–777 | PricingDetailModal | Keep in PricingReportConfig.tsx |
| 779–781 | `export default PricingReportConfig` | Keep in PricingReportConfig.tsx |

**Post-split PricingReportConfig.tsx expected line count:** ~430 lines (781 - 354 extracted + ~3 for `<ProposalTab .../>` call). Well under 300-line target but that's acceptable — the remaining orchestration logic (hooks, state, banner, tabs, table) is cohesive.

**Wait — line count concern:** Requirements SC-1 says "no extracted file exceeds 300 lines." The extracted `ProposalTab.tsx` will be ~354 lines. This is a potential issue.

**Resolution:** The requirement says "no extracted file exceeds 300 lines." ProposalTab.tsx at ~354 lines is ~18% over the 300-line ceiling. However, the REQUIREMENTS.md text for PRICING-01 says "extracting the complete ProposalTab sub-component (~354 lines of cohesive JSX)" — the requirement itself names the ~354 line figure, and uses "no partial extraction" as a constraint. The ROADMAP.md Success Criteria SC-1 says: "ProposalTab sub-component (~354 lines of cohesive JSX) exists in its own file... no extracted file exceeds 300 lines." This is an internal contradiction in the requirements — the named size (~354 lines) exceeds the general ceiling (300 lines).

**Precedent:** Phase 8 granted a D-16 exception for `useDoorScheduleDownload.tsx` (~420 lines) because it was a single cohesive operation that could not be split. The same logic applies here: ProposalTab is a single cohesive JSX block. The planner must explicitly document a line-limit exception for `ProposalTab.tsx` at ~354 lines (same pattern as D-16). The exception is justified because:
1. PRICING-01 explicitly names ~354 lines as the expected size.
2. No partial extraction is permitted — all 7 inner sections move together.
3. 354 lines is the lower bound; trying to split it further would require extracting individual tables (e.g., DoorDetailTable, FrameDetailTable), which creates unnecessary nesting without cohesion benefit.

---

## Consumer Analysis

### Confirmed Consumers

| File | Import Style | Impact of Split |
|------|-------------|-----------------|
| `app/project/[id]/reports/pricing/page.tsx:15` | `dynamic(() => import('@/components/pricing/PricingReportConfig'), { ssr: false })` | None — default import from same path; split is transparent |

**No other consumers found.** `PricingReportConfig` is a leaf component consumed by exactly one page. VER-01 (no new tsc errors) is the authoritative gate.

**Note on baseline errors:** The tsc baseline contains errors referencing `components/pricing/PricingReportConfig.tsx` at lines 102, 29, 36 (from `app/project/[id]/reports/pricing/page.tsx`) related to `registerPricingItemsCallback` / `registerPricingProposalCallback` props that don't exist in the current Props interface. These are pre-existing baseline errors — VER-01 only blocks NEW errors introduced by the split.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — purely in-repo TypeScript/React refactor; `npx tsc` is already confirmed working from prior phases).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monolithic flat component | Sub-directory splits with barrel index | Phase 8 (2026-05-14) | DoorScheduleConfig, HardwareSetConfig now use sub-dirs |
| Sub-directory split | Flat sibling extraction (Phase 11) | Phase 11 | Only one component extracted; no sub-directory needed |

**Phase 11 is the only flat extraction in the v2.0 roadmap.** All prior splits (Phases 8, 9, 10) created sub-directories because they extracted multiple sub-files. Phase 11 extracts exactly one component; a flat sibling file is the correct, simpler approach.

---

## Open Questions

1. **`fmt` constant duplication**
   - What we know: `fmt` is defined at line 27 of `PricingReportConfig.tsx` and used in the banner AND in the ProposalTab block.
   - What's unclear: Whether to duplicate the 1-line constant in both files or introduce a shared module.
   - Recommendation: Duplicate — it is a 1-line pure constant, no risk, no maintenance concern. Adding a shared module for one constant would be over-engineering.

2. **`proposalBreakdown` type**
   - What we know: `proposalBreakdown` is returned from `usePricingFilters` and passed to `<PricingHierarchyView>`.
   - What's unclear: The exact TypeScript type (may be `ProposalBreakdown | undefined` or similar).
   - Recommendation: Executor reads `hooks/usePricingFilters.ts` return type to extract the correct type before writing `ProposalTabProps`.

3. **VER-01 baseline reference**
   - What we know: `.planning/tsc-baseline.txt` contains 142 lines captured pre-Phase-7; Phases 8/9/10 deleted files that contributed to those errors.
   - What's unclear: Whether to diff against the original baseline or capture a fresh pre-split snapshot.
   - Recommendation: Capture a fresh pre-split snapshot (call it `/tmp/pre-split-phase11.txt`) and diff post-split against it. This is more accurate and avoids noise from prior phase deletions.

---

## Sources

### Primary (HIGH confidence)

- `components/pricing/PricingReportConfig.tsx` — full file read; ProposalTab block boundaries identified at lines 354–711; `fmt` usage confirmed at lines 229, 235 (banner) and within proposal block; single consumer confirmed
- `app/project/[id]/reports/pricing/page.tsx` — single consumer; uses default dynamic import; no named export consumption
- `.planning/phases/08-component-config-splits/08-01-PLAN.md` — precedent for VER-02/VER-03 patterns, line-limit exception (D-16), component-as-barrel vs. flat extraction decision
- `.planning/phases/08-component-config-splits/08-VERIFICATION.md` — VER-01/02/03 exact command patterns
- `.planning/REQUIREMENTS.md` — PRICING-01/02 requirement text; inherent contradiction between ~354 line extract and 300-line ceiling identified
- `.planning/tsc-baseline.txt` — baseline error set; no PricingReportConfig.tsx-specific TS2305/TS2307/TS2306 errors in baseline (existing errors are TS2339/TS2769 type errors, not import resolution errors)

### Secondary (MEDIUM confidence)

- `.claude/skills/code-standards/SKILL.md` — named export rule, component structure order, import ordering
- `.claude/skills/modularize/SKILL.md` — large component split pattern (Pattern E)

---

## Metadata

**Confidence breakdown:**
- File analysis (ProposalTab boundaries, line counts): HIGH — read from source file directly
- Consumer analysis: HIGH — grep confirmed single consumer
- VER gate commands: HIGH — copied from prior-phase verification docs
- Line-limit exception analysis: HIGH — matches D-16 precedent from Phase 8
- `proposalBreakdown` type: MEDIUM — not read from usePricingFilters return type; executor must verify

**Research date:** 2026-05-14
**Valid until:** Indefinite — this research is based on file contents that will change when this phase executes; re-read source before writing plans.
