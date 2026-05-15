---
phase: 13-implement-caching
plan: 06
subsystem: infra
tags: [npm, upstash, redis, cleanup, env, package-management]

# Dependency graph
requires:
  - phase: 13-05
    provides: "All @upstash/redis source imports removed; lib/cache/redis.ts deleted"
provides:
  - "package.json with @upstash/redis removed from dependencies"
  - "package-lock.json regenerated without @upstash/redis entries"
  - ".env.example cleaned of all UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN references"
affects: [future-developers, onboarding, dependency-audit]

# Tech tracking
tech-stack:
  added: []
  patterns: ["npm uninstall removes manifest + lockfile + node_modules atomically"]

key-files:
  created: []
  modified:
    - package.json
    - package-lock.json
    - .env.example

key-decisions:
  - "D-13: npm uninstall @upstash/redis used (not manual edit) to atomically update manifest + lockfile"
  - "D-14: Full Upstash Redis comment block + variable lines removed from .env.example (not just variable lines)"

patterns-established:
  - "Dependency cleanup: uninstall before env-template cleanup so tsc passes throughout"

requirements-completed: [CACHE-04, CACHE-05]

# Metrics
duration: 5min
completed: 2026-05-15
---

# Phase 13 Plan 06: Remove @upstash/redis Cleanup Summary

**npm uninstall @upstash/redis removed 2 packages from the dependency tree; .env.example reduced from 52 to 39 lines with zero UPSTASH references remaining**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-15T12:07:00Z
- **Completed:** 2026-05-15T12:11:00Z
- **Tasks:** 2
- **Files modified:** 3 (package.json, package-lock.json, .env.example)

## Accomplishments

- `npm uninstall @upstash/redis` succeeded: removed 2 packages (package + transitive dep), updated package-lock.json atomically
- `package.json` dependencies reduced from 41 to 40 entries — `@upstash/redis` entry completely gone
- `.env.example` cleaned: 13-line Upstash Redis block removed, file is 39 lines (within 38-42 acceptance range)
- Zero new TypeScript errors introduced — no TS2307 "Cannot find module '@upstash/redis'" because 13-05 already deleted all source imports
- All other sections of `.env.example` (Supabase, AI Providers, App URL) remain intact and unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Uninstall @upstash/redis package** - `0422dfa` (chore)
2. **Task 2: Remove Upstash Redis section from .env.example** - `b751e8b` (chore)

**Plan metadata:** (docs commit follows this summary)

## Files Created/Modified

- `package.json` - Removed `"@upstash/redis": "^1.38.0"` from dependencies (41 -> 40 entries)
- `package-lock.json` - Regenerated atomically by npm uninstall; zero `@upstash/redis` occurrences
- `.env.example` - Removed 13-line Upstash Redis section (lines 35-47); 52 -> 39 lines

## Decisions Made

- **D-13:** Used `npm uninstall @upstash/redis` (not manual package.json edit) to ensure lockfile and node_modules are updated atomically. Manual edits would leave orphan lockfile entries.
- **D-14:** Removed the entire Upstash Redis block including comment header, blank lines, variable definitions — leaving zero UPSTASH references and no misleading comments about Redis credentials.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Pre-flight checks confirmed 13-05 was complete (no source files importing `@upstash/redis` or `@/lib/cache/redis`). The `npm uninstall` ran cleanly in 4 seconds removing 2 packages. Pre-existing TypeScript errors (in components/hardware, components/projects, etc.) are unrelated to this plan and were present before execution.

## User Setup Required

None — no external service configuration required. This plan removes credentials from `.env.example`, not adds them.

## Next Phase Readiness

- Phase 13 caching implementation is complete: lib/cache wrappers use `next/cache` (unstable_cache + revalidateTag), API routes are wired, @upstash/redis is fully removed
- CACHE-04 and CACHE-05 reinforced: the only Redis client file (`lib/cache/redis.ts`) was deleted in 13-05; this plan removes the package and env template entries
- No follow-up work required for the caching layer

## Self-Check

Files exist:
- `F:\PlanckOff-Hardware\package.json` — FOUND, @upstash/redis removed
- `F:\PlanckOff-Hardware\.env.example` — FOUND, 39 lines, zero UPSTASH references

Commits exist:
- `0422dfa` — chore(13-06): uninstall @upstash/redis dependency
- `b751e8b` — chore(13-06): remove Upstash Redis section from .env.example

## Self-Check: PASSED

---
*Phase: 13-implement-caching*
*Completed: 2026-05-15*
