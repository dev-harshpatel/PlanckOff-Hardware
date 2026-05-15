# Phase 12: Re-render & Fetch Audit — Research

**Researched:** 2026-05-15
**Domain:** React performance optimization — render profiling, Supabase fetch deduplication, state management
**Confidence:** HIGH

---

## Summary

Phase 12 is a performance audit across the application's data-heavy pages (ProjectView, DoorScheduleManager, HardwareSetsManager, PricingReportConfig) with three distinct problem categories: unnecessary React re-renders, redundant Supabase API calls, and write operations that trigger full dataset re-fetches.

The codebase was read directly. Every finding below is sourced from the actual source files. No assumptions are made from training data alone.

**Key findings from code audit:**

1. `useProjectPersistence.ts:229` intentionally suppresses `react-hooks/exhaustive-deps` on the auto-save `useEffect` (`[hardwareSets, doors, trashItems]`). This is a deliberate design — the `isInitialMount` ref guard prevents unnecessary saves on load. This pattern must be preserved.
2. `useProjectData.ts:232` also suppresses exhaustive-deps on the primary data-load `useEffect` (`[projectId]`). This is equally intentional — the effect must NOT re-run when `addToast` or `saveToFinalJsonRef` change identity between renders.
3. `ProjectView.tsx` passes `hardwareSetsPanel` and `doorSchedulePanel` as JSX variables (not components), which means they re-compute on every render of ProjectView. Both panels contain large prop lists passed to child components; none of the callback props in ProjectView are wrapped in `useCallback`.
4. `ProjectContext.tsx:137` — `addProject` calls `fetchProjects()` after a create, triggering a full project list re-fetch rather than appending the new project optimistically to local state.
5. `ProjectContext.tsx:259` — `restoreProject` also calls `fetchProjects()` unconditionally.
6. Every report page (`door-schedule/page.tsx`, `hardware-set/page.tsx`, `pricing/page.tsx`) fetches its own data independently on mount — the same `/api/projects/${id}/hardware-merge`, `/api/projects/${id}/door-schedule`, and `/api/projects/${id}/hardware-pdf` endpoints are hit by every report page. No shared cache layer exists.
7. `pricing/page.tsx:35` — the `useEffect` that loads data has `[id]` as its dependency array, but `addToast` (used inside) is not in the dep array. This is a missing dep (low risk — addToast identity is stable, but it's technically incorrect).
8. `useProjectUploads.ts:161` — one `useEffect` intentionally suppresses exhaustive-deps for the expand handler registration. This is a one-time mount effect with empty `[]` intent.
9. No component in the codebase uses `React.memo`. `DoorScheduleManager` and `HardwareSetsManager` re-render on every parent render when their props change — even when the change is a UI-only state (e.g. `viewMode` switch in ProjectView).
10. `ProjectContext` is a single monolithic context holding `projects`, `masterInventory`, `trash`, `appSettings`, plus all action callbacks. Any state change in any slice causes all 8+ consumers to re-render: `app/page.tsx`, `app/project/[id]/page.tsx`, `app/project/[id]/reports/layout.tsx`, `app/project/[id]/reports/page.tsx`, `app/project/[id]/reports/submittal-package/page.tsx`, `components/layout/AppShell.tsx`.

**Primary recommendation:** Target five surgical fixes in order of impact: (1) wrap callbacks in ProjectView with `useCallback` to stop cascading re-renders into DoorScheduleManager and HardwareSetsManager; (2) replace full `fetchProjects()` re-fetch in `addProject`/`restoreProject` with local state append/restore; (3) split ProjectContext into `ProjectListContext` (project array) and `ProjectActionsContext` (write callbacks + inventory) so read-only consumers stop re-rendering on writes; (4) stabilize the `addToast` dep in `pricing/page.tsx`; (5) document and mark intentional `eslint-disable` suppressions so they are not disturbed.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERF-01 | Stable values and callbacks on data-heavy pages wrapped in `useMemo`/`useCallback`; no component re-renders more than once for a single user action; large Context providers split so consumers only re-render on their slice | Code audit identified: ProjectView lacks `useCallback` on handlers passed to child components; ProjectContext is monolithic causing wide re-renders; no `React.memo` present |
| PERF-02 | No `useEffect` triggers a Supabase fetch with overly-broad or missing dep array; shared data fetched once at top level; fetch deduplication for rapid duplicate calls | Code audit identified: report pages each independently fetch the same 3 endpoints on mount; pricing page `useEffect` missing `addToast` dep; two confirmed `eslint-disable react-hooks/exhaustive-deps` suppressions that are intentional and must be preserved |
| PERF-03 | Write operations update local React state directly without triggering a full dataset re-fetch; UI-only state changes do not cause Supabase read calls | Code audit identified: `addProject` and `restoreProject` call `fetchProjects()` after writes; `deleteProject` already uses optimistic state update (good pattern to follow) |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

No `CLAUDE.md` exists in this project. Constraints are sourced from the skills files.

**From `code-standards` skill (mandatory):**
- No `any` types; use `unknown` + type guards
- No non-null assertion `!`; use optional chaining
- Named exports only for components — no `export default` for components (note: existing files use `export default` via Next.js page conventions; this applies to new code only)
- Event handlers prefixed `handle*`
- `import type` for type-only imports
- `useCallback` for all functions returned from hooks
- Handle loading, error, and data states explicitly
- Services are plain TypeScript — no React, no hooks

**From `architecture` skill (mandatory):**
- Data flows DOWN through props; events flow UP through callbacks
- State lives at the lowest common ancestor
- Global state (auth, toast) lives in the store
- All write operations go through API routes — never from client components directly
- React Context + `useEffect` is acceptable short-term; React Query is the target for server state

**Intentional eslint-disable lines — DO NOT REMOVE:**
- `hooks/useProjectData.ts:86` — `startPollingForResult` dep intentionally excluded from polling useCallback
- `hooks/useProjectData.ts:232` — loadProjectData effect dep array is `[projectId]` only by design
- `hooks/useProjectPersistence.ts:229` — auto-save effect dep array is `[hardwareSets, doors, trashItems]` only by design
- `hooks/useProjectUploads.ts:161` — expand handler registration is a mount-only effect by design

---

## Standard Stack

### Core (already installed — no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.0 | Component model, hooks | Already in use |
| Next.js | 15.3.0 | App Router, SSR | Already in use |
| TypeScript | 5.8.2 | Type safety | Already in use |

### No New Libraries Required

This phase is a code-quality audit and targeted refactor. No new libraries should be introduced:

- **React Query / TanStack Query** — explicitly listed as the target server-state approach in the architecture skill, but adopting it now would be a large structural change. Out of scope for this phase per PERF-02 which targets specific useEffect fixes, not a full server-state migration.
- **Why-did-you-render** — useful for profiling in development but not a production dependency. Use React DevTools Profiler instead.
- **zustand** — listed as a target store solution in the architecture skill, but ProjectContext migration is scoped to splitting not re-implementing.

### Tools (development-time only, no install needed)

| Tool | Purpose | How to Access |
|------|---------|---------------|
| React DevTools Profiler | Record flamebar, identify unnecessary renders | Browser extension |
| Supabase Dashboard | Monitor read operation count during sessions | supabase.com dashboard |

---

## Architecture Patterns

### Recommended Project Structure (no changes)

Phase 12 is a behavioral fix phase — no new files or folders are needed beyond what exists. Modifications target existing files.

### Pattern 1: useCallback Stabilization for Prop Callbacks

**What:** Wrap every callback that is passed as a prop to a child component in `useCallback` inside the parent that owns it.
**When to use:** Any callback defined inline in a component body that is passed as a prop — these create new function references on every render, forcing child re-renders even when the child's visible output would not change.
**Source:** `code-standards` SKILL.md §4 Hooks Rules — "Use `useCallback` for all functions returned from hooks."

**ProjectView gap — handlers passed without useCallback:**
```typescript
// views/ProjectView.tsx — these are passed as props but defined inline:
// onCancelTask={() => setProcessingTasks(prev => prev.filter(t => t.id !== hardwareActiveTask.id))
// onCancelTask={() => setProcessingTasks(prev => prev.filter(t => t.id !== doorActiveTask.id))
// These should be:
const handleCancelHardwareTask = useCallback(() => {
  if (hardwareActiveTask) {
    setProcessingTasks(prev => prev.filter(t => t.id !== hardwareActiveTask.id));
  }
}, [hardwareActiveTask]);

const handleCancelDoorTask = useCallback(() => {
  if (doorActiveTask) {
    setProcessingTasks(prev => prev.filter(t => t.id !== doorActiveTask.id));
  }
}, [doorActiveTask]);
```

**Note on JSX variables:** `hardwareSetsPanel` and `doorSchedulePanel` in ProjectView are JSX variables (not components). They recompute on every render. They cannot be `useMemo`-d directly (JSX is not pure enough for stable memoization), but wrapping the callbacks they contain in `useCallback` is the correct fix — it ensures the child components receive stable prop references.

### Pattern 2: Optimistic State Update for Write Operations

**What:** Update local state directly after a write operation rather than refetching the full dataset.
**When to use:** Any `create`, `restore`, or `update` operation that currently calls `fetchProjects()` or similar after the write completes.
**Source:** `ProjectContext.tsx:232-248` — `deleteProject` already does this correctly (removes project from state directly). Apply the same pattern to `addProject` and `restoreProject`.

```typescript
// CURRENT (causes full re-fetch):
const addProject = async (projectData: NewProjectData) => {
  const json = await fetch('/api/projects', { ... });
  await fetchProjects(); // triggers GET /api/projects — re-fetches all
};

// IMPROVED (optimistic append):
const addProject = async (projectData: NewProjectData) => {
  const res = await fetch('/api/projects', { ... });
  const json = await res.json();
  if (json.data) {
    setProjects(prev => [...prev, json.data]); // append only — no re-fetch
  }
};
```

**Existing good example:** `deleteProject` in `ProjectContext.tsx:239-244`:
```typescript
setProjects(prev => prev.filter(p => p.id !== id));
if (trashed) {
  setTrash(prev => [{ ...trashed, deletedAt: new Date().toISOString() }, ...prev]);
}
```

### Pattern 3: Context Splitting (ProjectContext)

**What:** Split a monolithic Context into sub-contexts so consumers only subscribe to the slice they use.
**When to use:** When a context holds multiple independent state slices AND consumers that only need one slice re-render when another slice changes.
**Source:** PERF-01 requirement; architecture SKILL.md §State Management.

**Current problem:**
`ProjectContext` holds: `projects` (list), `projectsHydrated`, `masterInventory`, `trash`, `appSettings` + 10 action callbacks.

All 8+ consumers re-render on every state change, including:
- `AppShell.tsx` — only reads `projects` (for project count)
- `app/project/[id]/reports/layout.tsx` — only reads `projects` and `projectsHydrated`
- `app/project/[id]/reports/page.tsx` — only reads `projects` and `projectsHydrated`

**Recommended split:**
```typescript
// contexts/ProjectListContext.tsx — read-only project list data
interface ProjectListContextType {
  projects: Project[];
  projectsHydrated: boolean;
  trash: Project[];
}

// contexts/ProjectActionsContext.tsx — write actions + inventory + settings
interface ProjectActionsContextType {
  addProject: ...
  updateProject: ...
  deleteProject: ...
  restoreProject: ...
  permDeleteProject: ...
  fetchTrashed: ...
  updateInventory: ...
  addToInventory: ...
  overwriteInventory: ...
  saveSettings: ...
  masterInventory: HardwareItem[];
  appSettings: AppSettings;
  updateProjectFromRealtime: ...
}
```

**IMPORTANT constraint:** The split must preserve the `ProjectProvider` wrapper — all existing consumers use `useProject()`. After split, export a combined `useProject()` that returns both slices for backward compatibility, OR update all 8 call sites to use the appropriate sub-context.

**Scope guidance:** If the context split proves complex, PERF-01 can be satisfied partially by wrapping the callbacks inside the single context in `useCallback`/`useMemo` to prevent reference-change-induced re-renders, without a structural split. A structural split is the preferred approach but not mandatory if it would risk regressions.

### Pattern 4: Stabilizing useEffect Dependency Arrays

**What:** Ensure every `useEffect` that triggers a fetch has a correct, complete dependency array. Where intentional suppressions exist, document them with a comment explaining why the suppression is safe.
**When to use:** Any effect that calls fetch/API but has a suppressed or incomplete deps array.

**Known intentional suppressions (verified safe — do not change):**

| File | Line | Dep Array | Why Safe |
|------|------|-----------|----------|
| `useProjectData.ts` | 232 | `[projectId]` | `addToast` is stable (ref-setter pattern); `saveToFinalJsonRef` is a ref (never changes identity) |
| `useProjectData.ts` | 86 | `[projectId, addToast]` | `clearWidget` is stable; startPollingForResult is the function being defined |
| `useProjectPersistence.ts` | 229 | `[hardwareSets, doors, trashItems]` | `performSave` must not be in deps — would cause circular; `isInitialMount` is a ref |
| `useProjectUploads.ts` | 161 | `[]` | Mount-only effect for expand handler; registerExpandHandler/unregisterExpandHandler are stable |

**Actual missing dep (needs fix):**
```typescript
// app/project/[id]/reports/pricing/page.tsx:35
// Current:
useEffect(() => {
  // ... uses addToast inside
}, [id]); // addToast missing

// Fix:
const { addToast } = useToast();
// ... (addToast is stable from useToast, but the dep array should still be correct)
useEffect(() => {
  // ...
}, [id, addToast]);
```

### Anti-Patterns to Avoid

- **Wrapping every function in useCallback blindly:** Only wrap when the function is passed as a prop to a child or as a dep to another hook. Wrapping internal-only functions adds overhead without benefit.
- **Memoizing cheap computations:** `useMemo` is only valuable when the computation is expensive (e.g. filtering/sorting 500+ doors) or produces a new object reference that would cause child re-renders. Don't wrap simple string interpolations.
- **Breaking intentional eslint-disable suppressions:** The four suppressions listed above are load-bearing. Removing them would cause real bugs (infinite fetch loops, double-saves on load).
- **React.memo on every component:** Only apply `React.memo` to components that receive stable props AND are verified to re-render unnecessarily via the Profiler. Blanket memoization is not the goal.
- **Introducing React Query or Zustand in this phase:** Would be a milestone-level change, not a phase-level fix.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request deduplication for identical concurrent fetches | Custom singleton fetch manager | AbortController + `useRef` flag OR React's `use()` (React 19) | AbortController is already idiomatic in this codebase (see `loadProjectData` cancelled guard) |
| Profiling which components re-render | `console.log` in render body | React DevTools Profiler | Built-in; flame graph shows render count and duration per component |
| Global fetch cache | Custom Map<string, Promise> | React's built-in `cache()` (React 19, server-only) or a ref-based in-flight tracker | For client-side: AbortController pattern is sufficient |

**Key insight:** This codebase already uses the correct guard pattern (`let cancelled = false`) in `useProjectData` to prevent state updates after unmount. The same pattern should be applied to `addProject`/`restoreProject` if they are made async — they already are, but the full `fetchProjects()` call should be replaced with direct state mutation.

---

## Common Pitfalls

### Pitfall 1: Breaking the isInitialMount Guard

**What goes wrong:** The auto-save effect in `useProjectPersistence.ts` uses `isInitialMount.current` as a one-shot skip. If a refactor removes or bypasses this guard, every data load triggers an immediate save back to the server.
**Why it happens:** The guard pattern looks like dead code to anyone unfamiliar with it. The `eslint-disable` comment makes it look suspect.
**How to avoid:** Read `useProjectPersistence.ts:218-231` carefully before any changes near `isInitialMount`. The guard is set to `true` in `useProjectData` at lines 71, 72, 97, 98, 204, 208.
**Warning signs:** Save toasts appearing immediately on project open; Supabase dashboard showing unexpected writes on every page load.

### Pitfall 2: hasFinalJsonRef Invalidation

**What goes wrong:** `hasFinalJsonRef.current = true` is set in `useProjectData` when `final_json` is the data source. The `reloadDoorSchedule` function returns early when this is true. If a refactor causes `hasFinalJsonRef.current` to be reset incorrectly, realtime updates to `door_schedule_imports` will overwrite user-edited final state.
**Why it happens:** The ref is reset to `false` on `projectId` change (lines 37-38). Any code that triggers a new project load path must be aware of this.
**How to avoid:** Do not reset `hasFinalJsonRef.current` anywhere except the `useEffect(() => { ... }, [projectId])` cleanup/setup block.
**Warning signs:** User edits to door fields disappearing when another browser tab triggers a realtime event.

### Pitfall 3: Context Split Breaks Realtime Wiring

**What goes wrong:** `ProjectContext` contains `updateProjectFromRealtime` which is called from somewhere to wire realtime project updates. If context is split, this callback must remain accessible to wherever the realtime subscription fires it.
**Why it happens:** The realtime callback registration is not visible in `ProjectContext.tsx` itself — it is called from a higher-level provider.
**How to avoid:** Before splitting, search for all callers of `updateProjectFromRealtime`. If it belongs to the realtime subscription layer (not the UI layer), keep it in the data/actions context slice.
**Warning signs:** Project list not updating in real-time after split; `updateProjectFromRealtime is not a function` runtime error.

### Pitfall 4: Report Pages Already Use Their Own Data Fetch

**What goes wrong:** The report pages (`door-schedule/page.tsx`, `hardware-set/page.tsx`, `pricing/page.tsx`) independently fetch the same endpoints as `useProjectData`. This is intentional — they load data on-demand when the user navigates to that report, not from the ProjectView's state. Refactoring these to share state with ProjectView would require threading state across page boundaries, which is complex.
**Why it happens:** Each report is a separate Next.js page with its own state. There is no shared cache between pages.
**How to avoid:** PERF-02 acceptance ("data shared across sibling components is fetched once at the top level") applies to sibling components within the same page — not across page boundaries. Report pages are intentionally isolated. Do NOT attempt to share `useProjectData` state with report pages in this phase.
**Warning signs:** If a refactor passes `doors` and `hardwareSets` from ProjectView into report pages via URL params or sessionStorage, that is out of scope and likely to introduce bugs.

### Pitfall 5: addProject Full Re-fetch is Load-Bearing for Realtime Echo Dedup

**What goes wrong:** `addProject` currently calls `fetchProjects()` after creation. If this is replaced with an optimistic local append, the dedup logic in `updateProjectFromRealtime` must still correctly handle the incoming Realtime INSERT event (which will arrive after the local state is already updated).
**Why it happens:** The existing `isOwnWrite` check in `updateProjectFromRealtime` uses `markPendingWrite` which is only called from `updateProject`, not from `addProject`. A new project CREATE does not call `markPendingWrite`.
**How to avoid:** When making `addProject` optimistic, check the `updateProjectFromRealtime` INSERT branch — it already correctly handles the "project already in list" case by looking for `existing = prev.find(p => p.id === id)`. If the optimistic append runs before the Realtime INSERT fires, the INSERT handler will see `existing` and return the mapped row, effectively replacing the optimistic entry with the server-confirmed version. This is correct behavior.
**Warning signs:** Duplicate project entries appearing in the project list after creation.

### Pitfall 6: processingTasks Inline Callbacks in ProjectView

**What goes wrong:** ProjectView passes `onCancelTask` as an inline arrow function `() => setProcessingTasks(prev => prev.filter(...))` with a closure over `hardwareActiveTask` and `doorActiveTask`. These tasks are derived values (`find` results), so they change reference on every render. The resulting `onCancelTask` prop reference changes every render, forcing both `HardwareSetsManager` and `DoorScheduleManager` to re-render even when no task-related state changed.
**Why it happens:** `hardwareActiveTask` is defined as `const hardwareActiveTask = processingTasks.find(...)` (line 137) — a new object every render.
**How to avoid:** Memoize `hardwareActiveTask` and `doorActiveTask` with `useMemo`, then wrap the cancel handlers in `useCallback` scoped to the task ID.
**Warning signs:** React Profiler showing `HardwareSetsManager` or `DoorScheduleManager` re-rendering on unrelated state changes (e.g. `isNotesOpen` toggle).

---

## Code Examples

### Stabilizing a callback in ProjectView

```typescript
// Source: views/ProjectView.tsx audit

// BEFORE — inline arrow creates new reference every render:
onCancelTask={hardwareActiveTask ? () => setProcessingTasks(prev => prev.filter(t => t.id !== hardwareActiveTask.id)) : undefined}

// AFTER — stable reference via useCallback:
const hardwareActiveTask = useMemo(
  () => processingTasks.find(t => t.type === 'hardware-pdf'),
  [processingTasks]
);

const handleCancelHardwareTask = useCallback(() => {
  if (!hardwareActiveTask) return;
  setProcessingTasks(prev => prev.filter(t => t.id !== hardwareActiveTask.id));
}, [hardwareActiveTask]);
```

### Optimistic addProject (replacing fetchProjects re-fetch)

```typescript
// Source: contexts/ProjectContext.tsx:125-142 audit

const addProject = async (projectData: NewProjectData, _doorFile?: File, _hwFile?: File) => {
  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(projectData),
    });

    const json = (await res.json()) as { data?: Project; error?: string };
    if (!res.ok) throw new Error(json.error ?? ERRORS.GENERAL.SAVE_FAILED.message);

    // Append optimistically rather than re-fetching entire list
    if (json.data) {
      setProjects(prev => [...prev, json.data!]);
    }
    addToast({ type: 'success', message: `Project "${json.data!.name}" created.` });
  } catch (error: unknown) {
    addToast({ type: 'error', message: ERRORS.GENERAL.SAVE_FAILED.message, details: ERRORS.GENERAL.SAVE_FAILED.action });
    throw error;
  }
};
```

### Correct dependency array for pricing page useEffect

```typescript
// Source: app/project/[id]/reports/pricing/page.tsx:35 audit

const { addToast } = useToast();

useEffect(() => {
  if (!id) return;

  async function load() {
    // ... existing load logic
  }

  load();
}, [id, addToast]); // addToast is stable — this is safe to add
```

### Context splitting (ProjectListContext slice)

```typescript
// NEW: contexts/ProjectListContext.tsx
'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import type { Project } from '../types';

interface ProjectListContextType {
  projects: Project[];
  projectsHydrated: boolean;
  trash: Project[];
}

export const ProjectListContext = createContext<ProjectListContextType | undefined>(undefined);

export function useProjectList() {
  const ctx = useContext(ProjectListContext);
  if (!ctx) throw new Error('useProjectList must be used within ProjectProvider');
  return ctx;
}
```

---

## Detailed Findings by File

### views/ProjectView.tsx (578 lines)

**PERF-01 issues found:**
- No `useCallback` on `handleElevationUpdate` (line 112), `handleSingleElevationTypeUpdate` (line 118), `persistElevationTypes` (line 99)
- `hardwareSetsPanel` and `doorSchedulePanel` are JSX variables recomputed every render (lines 144-185)
- Inline arrow `onCancelTask` callbacks reference `hardwareActiveTask`/`doorActiveTask` which are `find()` results — new object every render (lines 157, 178)
- Only `report` is memoized (line 129) — nothing else is

**PERF-02 issues found:** None — data fetching is delegated to `useProjectData`

**PERF-03 issues found:** None in this file directly

**PERF-01 fixes needed:**
1. `useCallback` on `handleElevationUpdate`, `handleSingleElevationTypeUpdate`
2. `useMemo` on `hardwareActiveTask`, `doorActiveTask`
3. `useCallback` on cancel task handlers using the memoized task values

### hooks/useProjectData.ts

**PERF-01 issues:** No — this is a hook, not a component. Its internal `useCallback` usage is appropriate.
**PERF-02 issues:**
- `loadProjectData` effect `[projectId]` suppression is intentional and correct (line 232)
- `reloadDoorSchedule` is correctly gated by `hasFinalJsonRef.current` (line 237) — no unnecessary fetch
- Three parallel fetches on mount (`Promise.all`) are correct and intentional

**PERF-03 issues:** None — this hook is the data loader, not the writer

### hooks/useProjectPersistence.ts

**PERF-03 issues:**
- `performSave` (line 190) calls `saveToFinalJson(hardwareSets, doors, trashItems)` — this is a PUT to `/api/projects/${projectId}/hardware-merge`. This is a write, not a read. Correct behavior.
- The auto-save effect `[hardwareSets, doors, trashItems]` fires 1 second after any state change (line 218-231). This is intentional — a debounced save. The `isInitialMount` guard prevents it from firing on load.
- **Issue:** `performSave` also calls `onProjectUpdate(updatedProject)` which calls `updateProject` in `ProjectContext` which does a full `PUT` to `/api/projects/${projectId}`. This is a separate write path and is not a re-fetch.

**PERF-01 issues found:**
- `saveToFinalJson` dep array `[projectId, addToast]` — correct
- `performSave` dep array `[project, hardwareSets, doors, trashItems, onProjectUpdate, saveToFinalJson]` — correct but `onProjectUpdate` identity could change if the parent re-renders. However `ProjectView` receives `onProjectUpdate` as the `updateProject` function from `ProjectContext` via a prop, so if `updateProject` is not wrapped in `useCallback` inside ProjectContext, it will have a new identity on every ProjectContext render.

**Fix needed:** Wrap `updateProject` in ProjectContext with `useCallback`.

### contexts/ProjectContext.tsx

**PERF-01 issues found:**
- `addProject`, `updateProject`, `deleteProject`, `restoreProjectFn`, `permDeleteProject`, `saveSettings`, `overwriteInventory` are NOT wrapped in `useCallback` — they are plain async functions or plain arrow functions defined in the component body. These create new references on every context re-render, causing all 8+ consumers to re-render unnecessarily.
- Only `fetchProjects`, `fetchTrashed`, `updateProjectFromRealtime`, and `addToInventory` are wrapped in `useCallback`.

**PERF-03 issues found:**
- `addProject` (line 137): calls `await fetchProjects()` — full re-fetch after create
- `restoreProjectFn` (line 259): calls `await fetchProjects()` — full re-fetch after restore
- `deleteProject` is already optimistic (good, no fix needed)
- `updateProject` is already optimistic (line 170) (good, no fix needed)

**Fix needed (PERF-01):** Wrap `addProject`, `updateProject`, `deleteProject`, `restoreProjectFn`, `permDeleteProject`, `saveSettings` in `useCallback`
**Fix needed (PERF-03):** Replace `fetchProjects()` in `addProject` and `restoreProjectFn` with local state mutations

### app/project/[id]/reports/pricing/page.tsx

**PERF-02 issues found:**
- `useEffect` deps `[id]` — missing `addToast` (line 80). This is low-risk since `addToast` is stable, but the dep array is technically incorrect.
- `useProjectData` is called for its realtime subscription side-effect only (comment on line 25-27). The `noopSaveRef` approach is correct. This second call to `useProjectData` fires the primary data-load effect (line 88-232 in `useProjectData.ts`), which makes 3 parallel fetches to `/api/projects/${id}/hardware-pdf`, `/api/projects/${id}/door-schedule`, and `/api/projects/${id}/hardware-merge`. These are the **same endpoints** that the `load()` function in `pricing/page.tsx` also fetches on lines 41-43.

**Duplicate fetches on pricing page mount:**
1. The page's own `useEffect` fires `load()` — fetches door-schedule + hardware-merge + project
2. `useProjectData` fires its own `loadProjectData` — fetches hardware-pdf + door-schedule + hardware-merge

This means 3 of the same endpoints are hit twice on every pricing page mount. The `useProjectData` call is needed only for the realtime subscription (Supabase channel); the actual data load inside it is wasted.

**Fix needed (PERF-02):** Pass a flag or use a separate lightweight hook variant that subscribes to realtime without triggering the full data load. Alternatively, use the existing `hasFinalJsonRef` guard to short-circuit: if `final_json` is confirmed loaded by the page's own fetch, `useProjectData`'s data load will short-circuit at line 147 anyway since `loadProjectData` checks `sessionStorage` first. However, the 3 parallel fetches still fire regardless because `loadProjectData` runs the fetches before checking `finalRaw`.

### app/project/[id]/reports/door-schedule/page.tsx, hardware-set/page.tsx

**PERF-02 issues found:**
- Each fetches 2-3 endpoints independently on mount — this is intentional (report pages are separate pages with independent data needs)
- **These are acceptable** per Pitfall 4 above — cross-page data sharing is out of scope

---

## State of the Art

| Old Approach | Current Approach | Status | Impact |
|--------------|------------------|--------|--------|
| Monolithic Context for all state | Split contexts per domain | Target approach per architecture skill | Reduces re-render blast radius |
| Full re-fetch after every mutation | Optimistic local state update | deleteProject already does this; addProject/restoreProject do not | Eliminates GET /api/projects on every create/restore |
| Inline arrow callbacks in JSX | useCallback for all prop callbacks | Not yet applied in ProjectView | Prevents DoorScheduleManager/HardwareSetsManager from re-rendering on parent UI state changes |
| No component memoization | React.memo on stable components | Not present anywhere | Selective use on DoorTableRow could help large door lists |

---

## Open Questions

1. **DoorTableRow memoization**
   - What we know: `DoorScheduleManager` renders potentially 200+ `DoorTableRow` components in a table. If any door changes, the entire list re-renders via `filteredAndSortedDoors`.
   - What's unclear: Whether `DoorTableRow` receives stable props. `renderCell` is defined in the orchestrator hook and passed as a prop — its identity depends on `useDoorTableState`.
   - Recommendation: Check `DoorTableRow` props interface and whether `renderCell` changes reference. If so, `React.memo(DoorTableRow)` would be high-impact. This is a MEDIUM priority investigation for the planner to add as a task.

2. **updateProjectFromRealtime caller**
   - What we know: `updateProjectFromRealtime` is exported from `ProjectContext` but the file that calls it (presumably a realtime subscription hook) was not found in the code read above — it is likely called in a layout or `AppShell` that was not fully read.
   - What's unclear: Whether it is called from `app/layout.tsx`, `AppShell.tsx`, or a dedicated realtime hook.
   - Recommendation: The planner should add a task to `grep -rn "updateProjectFromRealtime"` to find the call site before any context split.

3. **Can the pricing page avoid double-fetch?**
   - What we know: The pricing page calls `useProjectData` only for realtime subscription, but `useProjectData`'s full data load fires anyway.
   - What's unclear: Whether a `subscribeOnly: true` option can be added to `useProjectData` without breaking the `hasFinalJsonRef` guard.
   - Recommendation: The simplest fix is to check `hasFinalJsonRef.current` at the top of `loadProjectData` — if the page has already loaded data via its own `load()`, setting `hasFinalJsonRef.current = true` before calling `useProjectData` would cause `loadProjectData` to skip most of its work. However this requires coordinating between the page's `useEffect` and the hook's internal effect. A safer approach: add a `skipInitialLoad?: boolean` option to `UseProjectDataOptions`.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 12 is purely code changes (React hooks, context modifications). No external services, CLI tools, or build infrastructure beyond the existing Next.js development server are required.

---

## Sources

### Primary (HIGH confidence)
- Direct file reads of F:/PlanckOff-Hardware source — all findings are from actual code, not inference
  - `views/ProjectView.tsx` (lines 1-578)
  - `hooks/useProjectData.ts` (lines 1-302)
  - `hooks/useProjectPersistence.ts` (lines 1-234)
  - `hooks/useProjectUploads.ts` (lines 1-100, 150-270 via grep)
  - `contexts/ProjectContext.tsx` (lines 1-328)
  - `contexts/ProcessingWidgetContext.tsx` (lines 1-95)
  - `app/project/[id]/page.tsx` (lines 1-42)
  - `app/project/[id]/reports/pricing/page.tsx` (lines 1-109)
  - `app/project/[id]/reports/door-schedule/page.tsx` (lines 1-60)
  - `app/project/[id]/reports/layout.tsx` (lines 1-137)
  - `hooks/useOptimisticDoorWrite.ts` (lines 1-82)
  - `app/providers.tsx` (lines 1-38)
  - `package.json` (dependency versions)
- `.claude/skills/code-standards/SKILL.md` — useCallback/useMemo rules
- `.claude/skills/architecture/SKILL.md` — state management tiers, data flow

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — confirmed PERF-01/02/03 requirements and project history
- `.planning/REQUIREMENTS.md` — verbatim requirement text
- `.planning/ROADMAP.md` — phase dependencies and success criteria

### Tertiary (LOW confidence)
- None — all findings sourced from actual code reads

---

## Metadata

**Confidence breakdown:**
- PERF-01 (render issues): HIGH — code read confirmed absence of useCallback in ProjectView and ProjectContext
- PERF-02 (fetch issues): HIGH — code read confirmed suppressed deps and duplicate fetches in pricing page
- PERF-03 (write → re-fetch issues): HIGH — code read confirmed addProject and restoreProject call fetchProjects

**Research date:** 2026-05-15
**Valid until:** 2026-07-15 (stable codebase — no fast-moving external libraries involved)
