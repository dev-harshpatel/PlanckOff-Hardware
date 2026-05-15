# Phase 13: Implement Caching — Verification Report

**Verified:** 2026-05-15T12:15:28Z
**Replanning:** Switched from Upstash Redis (Plans 13-01..13-04) to Next.js `unstable_cache` (Plans 13-05..13-07)
**TS Baseline:** .planning/tsc-baseline.txt
**Status:** PASS (structural + functional both complete; human smoke test approved 2026-05-15)

## Summary

| Requirement | Structural | Functional | Notes |
|-------------|------------|------------|-------|
| CACHE-01 | PASS | PASS | unstable_cache wrappers with correct TTLs; cache hits confirmed under next build && next start |
| CACHE-02 | PASS | PASS | revalidateTag invalidation in all write paths; create-project cycle confirmed fresh data on refresh |
| CACHE-03 | PASS | PASS | tags & keyParts match D-11; per-project door schedule isolation confirmed |
| CACHE-04 | PASS | N/A | server-only structural enforcement (Next.js + deleted redis.ts) |
| CACHE-05 | PASS | PASS | no env vars; fail-open confirmed — app loads normally without UPSTASH credentials |

## tsc --noEmit Diff

Baseline error count: 142 lines (same as current)
Current error count:  142 lines
New TS2305/TS2307/TS2306 errors: 0 — no new errors introduced by Plans 13-05 or 13-06

The diff between `.planning/tsc-baseline.txt` and the post-13-06 `tsc --noEmit` output shows only
file-path renames caused by prior phases (Phase 9 excelExportService modularization, Phase 8
DoorScheduleConfig modularization) — the same errors now reference sub-files instead of flat files.
The union type ordering also changed from `"count" | "all" | "preview"` to `"all" | "count" | "preview"`
(TypeScript version formatting only). Total error line count: **142 in both baseline and current** — no
new errors from caching work.

Diff output (path renames only — pre-existing errors, not introduced by Phase 13):
```
11c11
< components/doorSchedule/DoorScheduleConfig.tsx(385,93): error TS2339: Property 'default' does not exist on type 'JSZip'.
---
> components/doorSchedule/DoorScheduleConfig/useDoorScheduleDownload.tsx(90,89): error TS2339: Property 'default' does not exist on type 'JSZip'.
(... excelExportService.ts lines → excelExportService/sub-files lines — same errors, renamed paths)
```

## CACHE-01 Evidence: Cache-aside reads with TTL

Source: lib/cache/doorSchedule.ts
- `unstable_cache` occurrences: 5 (import + 1 in getCachedDoorSchedule call)
- `revalidate: 300` in options: PRESENT (TTL = 5 min per D-09)
- Wrapped function: getDoorScheduleImport (called as `async (projectId: string) => getDoorScheduleImport(projectId)`)
- Status: PASS

Source: lib/cache/masterHardware.ts
- `unstable_cache` occurrences: 4 (import + 1 in getCachedMasterHardware call)
- `revalidate: 3600` in options: PRESENT (TTL = 60 min per D-09)
- Wrapped function: getMasterHardwareItems
- Status: PASS

Source: lib/cache/projects.ts
- `unstable_cache` occurrences: 4 (import + 1 in getCachedProjects call)
- `revalidate: 1800` in options: PRESENT (TTL = 30 min per D-09)
- Wrapped function: getAllProjects
- Status: PASS

## CACHE-02 Evidence: Write paths invalidate

| Route | Method | Invalidator call |
|-------|--------|------------------|
| app/api/projects/route.ts | POST | await invalidateProjects() |
| app/api/projects/[id]/route.ts | DELETE (soft) | await invalidateProjects() |
| app/api/projects/[id]/route.ts | DELETE (hard) | await invalidateProjects() |
| app/api/projects/[id]/route.ts | DELETE (restore) | await invalidateProjects() |
| app/api/projects/[id]/door-schedule/route.ts | POST | await invalidateDoorSchedule(projectId) |
| app/api/projects/[id]/door-schedule/route.ts | PATCH | await invalidateDoorSchedule(projectId) |
| app/api/master-hardware/route.ts | POST | await invalidateMasterHardware() |
| app/api/master-hardware/[id]/route.ts | PUT | await invalidateMasterHardware() |
| app/api/master-hardware/[id]/route.ts | DELETE | await invalidateMasterHardware() |

Grep counts confirming presence:
- `invalidateDoorSchedule` in door-schedule/route.ts: 3 matches (import + POST call + PATCH call)
- `invalidateMasterHardware` in master-hardware/route.ts: 2 matches (import + POST call)
- `invalidateMasterHardware` in master-hardware/[id]/route.ts: 3 matches (import + PUT + DELETE)
- `invalidateProjects` in projects/route.ts: 2 matches (import + POST call)
- `invalidateProjects` in projects/[id]/route.ts: 4 matches (import + restore + hard delete + soft delete)

All 9 invalidations verified present (carried over from Plan 13-03; route files unedited).
All 3 `invalidate*` functions in lib/cache/ now call `revalidateTag(<tag>)` instead of `redis.del(<key>)`.

grep counts for revalidateTag in lib/cache:
- `revalidateTag('door-schedule')` in doorSchedule.ts: 2 matches (comment + function body)
- `revalidateTag('master-hardware')` in masterHardware.ts: 1 match (function body)
- `revalidateTag('projects')` in projects.ts: 1 match (function body)

Status: PASS

## CACHE-03 Evidence: Namespaced tags & keyParts

| Source | tags | keyParts | D-11 match |
|--------|------|----------|------------|
| lib/cache/doorSchedule.ts | ['door-schedule'] | ['door-schedule'] (projectId as fn arg) | YES |
| lib/cache/masterHardware.ts | ['master-hardware'] | ['master-hardware-all'] | YES |
| lib/cache/projects.ts | ['projects'] | ['projects-all'] | YES |

Grep results:
- `grep -c "tags: ['door-schedule']" lib/cache/doorSchedule.ts` → 1 match: CONFIRMED
- `grep -c "tags: ['master-hardware']" lib/cache/masterHardware.ts` → 1 match: CONFIRMED
- `grep -c "tags: ['projects']" lib/cache/projects.ts` → 1 match: CONFIRMED
- `grep -c "['master-hardware-all']" lib/cache/masterHardware.ts` → 2 matches (comment + code): CONFIRMED
- `grep -c "['projects-all']" lib/cache/projects.ts` → 2 matches (comment + code): CONFIRMED

Pitfall 1 guard (Pitfall 1: projectId in keyParts):
- `grep "door-schedule', projectId" lib/cache/doorSchedule.ts` returns 0 matches: CONFIRMED.
- `grep "door-schedule\",\s*projectId" lib/cache/doorSchedule.ts` returns 0 matches: CONFIRMED.
- projectId is correctly a runtime function argument that extends the keyParts prefix at call time.
- Pattern 2 implementation: `unstable_cache(async (projectId: string) => ..., ['door-schedule'], { tags: [...] })` — the projectId flows as a function arg, not hardcoded in keyParts.

Status: PASS

## CACHE-04 Evidence: Server-only enforcement

- `lib/cache/redis.ts` exists: NO (deleted in Plan 13-05 Task 4). `ls lib/cache/redis.ts` → "No such file or directory": CONFIRMED.
- Source files importing `@/lib/cache/redis`: 0 matches across lib/, app/ (grep -rln returns no output, exit code 1): CONFIRMED.
- Source files importing `@upstash/redis`: 0 matches across lib/, app/: CONFIRMED.
- Source files calling `getRedisClient`: 0 matches across lib/, app/: CONFIRMED.
- Client-side dirs (components, contexts, hooks, views) importing `next/cache`: 0 matches (Next.js would error at build if they did, but grep confirms this): CONFIRMED.
- `unstable_cache` is server-only by Next.js design (RESEARCH § Pattern + Pitfall 4).

Status: PASS

## CACHE-05 Evidence: Fail-open / no env vars

- `process.env` references in lib/cache/doorSchedule.ts: 0 (grep exit code 1 = no matches): CONFIRMED.
- `process.env` references in lib/cache/masterHardware.ts: 0: CONFIRMED.
- `process.env` references in lib/cache/projects.ts: 0: CONFIRMED.
- `UPSTASH` references in .env.example: 0 (section removed in Plan 13-06 Task 2): CONFIRMED.
- `@upstash/redis` in package.json: 0 (removed in Plan 13-06 Task 1): CONFIRMED.
- `@upstash/redis` in package-lock.json: 0: CONFIRMED.
- Structural fail-open: a cache miss in `unstable_cache` simply calls the wrapped function — no error path, no env-var-absence failure mode (RESEARCH § State of the Art). No Upstash credentials are required at runtime.

Structural status: PASS
Functional status: PASS (approved 2026-05-15 — no UPSTASH env vars present; app loads normally; no UPSTASH-related errors in server logs)

## Route files unchanged (Plan 13-03 invariant preserved)

Last commit on each (from `git log --oneline -5 -- <file>`):
- app/api/projects/route.ts: 478b87f feat(13-03): wire projects routes — GET via getCachedProjects, POST/DELETE invalidateProjects
- app/api/projects/[id]/route.ts: 478b87f feat(13-03): wire projects routes — GET via getCachedProjects, POST/DELETE invalidateProjects
- app/api/projects/[id]/door-schedule/route.ts: 07d8013 feat(13-03): wire door-schedule route — GET via getCachedDoorSchedule, POST+PATCH invalidateDoorSchedule
- app/api/master-hardware/route.ts: d735f4a feat(13-03): wire master-hardware routes — export GET via getCachedMasterHardware, POST/PUT/DELETE invalidateMasterHardware
- app/api/master-hardware/[id]/route.ts: d735f4a feat(13-03): wire master-hardware routes — export GET via getCachedMasterHardware, POST/PUT/DELETE invalidateMasterHardware

No new commits to these files in Plans 13-05 or 13-06: CONFIRMED. All last commits are from 13-03.

## Functional smoke test results (Task 2 — approved 2026-05-15)

Human smoke test conducted under `next build && next start`. All functional checks PASS:

| Check | Result |
|-------|--------|
| Build succeeded (zero new errors) | YES |
| CACHE-05 functional (no env vars, no UPSTASH errors) | PASS |
| CACHE-01 functional — projects list cache hit (30s window) | PASS |
| CACHE-02 functional — create project, refresh, new project still appears | PASS |
| CACHE-01 functional — door schedule cache hit after navigate-away | PASS |
| CACHE-03 per-project isolation — Project A and Project B show own schedules | PASS |
| Any unexpected console errors | NO |

Human response: "approved" — all functional checks passed.

## Deviations from plan

None — plan executed exactly as written. All structural checks used exact commands specified in the plan.
