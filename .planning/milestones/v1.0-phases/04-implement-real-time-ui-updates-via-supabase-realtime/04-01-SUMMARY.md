---
phase: 04-implement-real-time-ui-updates-via-supabase-realtime
plan: 01
subsystem: database
tags: [supabase, realtime, postgres, publication, migration]

# Dependency graph
requires:
  - phase: none
    provides: n/a
provides:
  - "Migration 019 enabling Supabase Realtime publication for project_pricing_items, project_pricing_proposal, and projects"
affects:
  - 04-02
  - any plan subscribing to pricing or projects tables via Supabase Realtime

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent IF NOT EXISTS guard pattern for ALTER PUBLICATION (mirrors migration 012)"

key-files:
  created:
    - "supabase/migrations/019_enable_realtime_pricing_projects.sql"
  modified: []

key-decisions:
  - "No REPLICA IDENTITY FULL — default identity retained so DELETE payloads contain PK columns only (handled by Plan 04-02 subscription code)"
  - "Mirrors migration 012 structure exactly so deploy pipeline applies it identically"
  - "Actual database application is a user deploy step (supabase db push) — out of scope for this plan"

patterns-established:
  - "Pattern: New Realtime tables always added via idempotent DO $$ IF NOT EXISTS ALTER PUBLICATION block, never by modifying existing migration files"

requirements-completed: [RT-08]

# Metrics
duration: 3min
completed: 2026-05-09
---

# Phase 4 Plan 01: Enable Realtime Publication for Pricing + Projects Tables

**Idempotent SQL migration adding project_pricing_items, project_pricing_proposal, and projects to the supabase_realtime publication, unblocking RT-02/RT-05/RT-07 subscription code in Plan 04-02**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-09T17:57:14Z
- **Completed:** 2026-05-09T18:00:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created migration 019 that adds 3 tables to the `supabase_realtime` PostgreSQL publication
- Used the same idempotent `IF NOT EXISTS` guard pattern from migration 012, ensuring safe re-runs
- No REPLICA IDENTITY FULL set — default identity is correct per the DELETE payload strategy documented in RESEARCH.md
- Migration 012 (`door_schedule_imports`, `project_hardware_finals`) untouched and unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration 019 to enable Realtime for the 3 missing tables** - `f17fabc` (feat)

## Files Created/Modified
- `supabase/migrations/019_enable_realtime_pricing_projects.sql` - Idempotent migration enabling Realtime publication for project_pricing_items, project_pricing_proposal, and projects

## Decisions Made
- No REPLICA IDENTITY FULL: DELETE events will only contain PK columns; Plan 04-02 subscription code handles this per-table strategy as documented in RESEARCH.md
- Exact same DO $$ block structure as migration 012 used verbatim — consistent deploy behaviour

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- The automated verify script (`node -e "..."`) failed its `DO $$` regex check due to shell `$` escaping in the CLI argument — verified manually that the file correctly contains `DO $$` (confirmed via node inline check showing `c.includes('DO \$\$')` returned true)

## User Setup Required

**Manual deploy step required before Plan 04-02 subscriptions can receive events.**

Run one of the following to apply this migration to the Supabase database:

```bash
supabase db push
```

Or manually execute the contents of `supabase/migrations/019_enable_realtime_pricing_projects.sql` in the Supabase SQL editor (Dashboard > SQL Editor).

Until this migration is applied, Realtime subscriptions to `project_pricing_items`, `project_pricing_proposal`, and `projects` will silently receive no events (channel shows SUBSCRIBED but callbacks never fire — "Pitfall 1" per RESEARCH.md).

## Next Phase Readiness
- Migration 019 is committed and ready for deploy
- Plan 04-02 can now write subscription code for the 3 tables — they will receive `postgres_changes` events once this migration is applied to the database
- No blockers — proceed to Plan 04-02

---
*Phase: 04-implement-real-time-ui-updates-via-supabase-realtime*
*Completed: 2026-05-09*
