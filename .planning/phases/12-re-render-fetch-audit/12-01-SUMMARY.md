---
phase: 12-re-render-fetch-audit
plan: "01"
subsystem: contexts
tags: [performance, react, useCallback, useMemo, optimistic-update]
dependency_graph:
  requires: []
  provides: [stable-project-context-callbacks, optimistic-project-mutations]
  affects: [app/page.tsx, app/project/[id]/page.tsx, app/project/[id]/reports/layout.tsx, app/project/[id]/reports/page.tsx, app/project/[id]/reports/submittal-package/page.tsx, components/layout/AppShell.tsx]
tech_stack:
  added: []
  patterns: [useCallback-stabilization, useMemo-provider-value, optimistic-local-state-update]
key_files:
  created: [lib/realtime/dedupSet.ts]
  modified: [contexts/ProjectContext.tsx]
decisions:
  - "lib/realtime/dedupSet.ts created in worktree (Rule 3 deviation) — worktree branch was older than AP-Sprint-1 and lacked this file required by ProjectContext import; file ported verbatim from AP-Sprint-1"
  - "addProject optimistic append uses setProjects(prev => [...prev, json.data!]) — Realtime INSERT echo handler correctly short-circuits when project already present"
  - "restoreProjectFn optimistic prepend strips deletedAt before re-adding to active list — mirrors deleteProject's existing filter pattern"
  - "deleteProject deps include projects array — reads projects.find() to build trashed entry"
  - "restoreProjectFn deps include trash array — reads trash.find() post-Task-1 to find restored entry"
  - "updateInventory, overwriteInventory, saveSettings use [] deps — pure setters with no state reads"
metrics:
  duration: "~20 min"
  completed: "2026-05-15"
  tasks: 2
  files: 2
---

# Phase 12 Plan 01: ProjectContext Optimistic Updates and Callback Stabilization Summary

**One-liner:** Replaced full GET /api/projects re-fetches after addProject/restoreProject with optimistic local state appends, and wrapped all 8 action callbacks plus Provider value in useCallback/useMemo to stop wide re-renders across 6 consumers.

## Files Modified

| File | Change |
|------|--------|
| `contexts/ProjectContext.tsx` | Optimistic addProject + restoreProjectFn; 8 callbacks wrapped in useCallback; Provider value memoized with useMemo |
| `lib/realtime/dedupSet.ts` | Created (ported from AP-Sprint-1 — missing from worktree branch; required by ProjectContext import) |

## tsc --noEmit Error Count Delta

- Baseline: 142 lines
- Post-plan: 133 lines
- Delta: -9 lines (fewer errors than baseline — pre-existing errors in worktree vs AP-Sprint-1 main branch)
- **New TS2305/TS2307/TS2306 errors introduced by this plan: 0**

## Optimistic Update Patterns Applied

**addProject append** (replaces `await fetchProjects()`):
```typescript
if (json.data) {
  setProjects(prev => [...prev, json.data!]);
}
```

**restoreProjectFn prepend** (replaces `setTrash + await fetchProjects()`):
```typescript
const restored = trash.find(p => p.id === id);
setTrash(prev => prev.filter(p => p.id !== id));
if (restored) {
  // Strip deletedAt before re-adding to active list
  const { deletedAt: _del, ...activeProject } = restored;
  setProjects(prev => [activeProject as Project, ...prev]);
}
```

## Callbacks Wrapped in useCallback

| Callback | Deps | Notes |
|----------|------|-------|
| `addProject` | `[addToast]` | POST + optimistic append; setProjects setter always stable |
| `updateProject` | `[addToast]` | PUT + optimistic map; markPendingWrite is module-level stable |
| `deleteProject` | `[projects, addToast]` | Reads projects.find() to build trashed entry |
| `restoreProjectFn` | `[trash, addToast]` | Reads trash.find() to find restored entry |
| `permDeleteProject` | `[addToast]` | DELETE + setTrash filter |
| `updateInventory` | `[]` | Pure setter + localStorage |
| `overwriteInventory` | `[]` | Pure setter |
| `saveSettings` | `[]` | Pure setter + localStorage |
| `fetchProjects` | `[isAuthenticated]` | Pre-existing useCallback — unchanged |
| `fetchTrashed` | `[isAuthenticated]` | Pre-existing useCallback — unchanged |
| `updateProjectFromRealtime` | `[]` | Pre-existing useCallback — unchanged |
| `addToInventory` | `[]` | Pre-existing useCallback — unchanged |
| `deleteProject` | `[projects, addToast]` | newly wrapped |

**Total useCallback usages: 13** (was 4 before — fetchProjects, fetchTrashed, updateProjectFromRealtime, addToInventory)

## Memoized Provider Value

```typescript
const contextValue = useMemo<ProjectContextType>(() => ({
  projects, projectsHydrated, masterInventory, trash, appSettings,
  addProject, updateProject, updateProjectFromRealtime,
  deleteProject, restoreProject: restoreProjectFn, permDeleteProject, fetchTrashed,
  updateInventory, addToInventory, overwriteInventory, saveSettings,
}), [
  projects, projectsHydrated, masterInventory, trash, appSettings,
  addProject, updateProject, updateProjectFromRealtime,
  deleteProject, restoreProjectFn, permDeleteProject, fetchTrashed,
  updateInventory, addToInventory, overwriteInventory, saveSettings,
]);
```

`ProjectContext.Provider value={contextValue}` — no inline object literal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created lib/realtime/dedupSet.ts in worktree**
- **Found during:** Task 1 — TypeScript compile after adding `import { isOwnWrite, markPendingWrite } from '@/lib/realtime/dedupSet'` to ProjectContext
- **Issue:** Worktree branch `worktree-agent-aa571dfd36a26f3d9` was branched from an older commit that predates Phase 4 (when dedupSet was created). The AP-Sprint-1 branch has this file; the worktree did not.
- **Fix:** Created `lib/realtime/dedupSet.ts` with verbatim content from `git show origin/AP-Sprint-1:lib/realtime/dedupSet.ts`
- **Files modified:** `lib/realtime/dedupSet.ts` (new file)
- **Commit:** 3f85bca (included with Task 1 commit)

### No other deviations — plan executed as written.

## Known Stubs

None — no placeholder text, hardcoded empty values, or unwired data sources introduced.

## Self-Check: PASSED

- `contexts/ProjectContext.tsx` exists: FOUND
- `lib/realtime/dedupSet.ts` exists: FOUND
- Task 1 commit 3f85bca: FOUND
- Task 2 commit e1d6dff: FOUND
- `await fetchProjects()` count = 0: PASS
- `useCallback` count = 13 (>= 11): PASS
- `useMemo` count = 2 (>= 1): PASS
- `value={contextValue}` present: PASS
- `interface ProjectContextType` count = 1: PASS
- Zero new TS2305/TS2307/TS2306 errors: PASS
