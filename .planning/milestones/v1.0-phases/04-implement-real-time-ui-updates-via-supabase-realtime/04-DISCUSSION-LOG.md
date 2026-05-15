# Phase 4: Implement Real-Time UI Updates via Supabase Realtime - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 04-implement-real-time-ui-updates-via-supabase-realtime
**Areas discussed:** Update strategy, Optimistic updates scope, Subscription table scope, Self-event filtering

---

## Update Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Full reload | Discard in-memory state, re-fetch full dataset. Simple, proven — matches existing pattern. | |
| In-memory patch | Apply event payload directly to state. No network round-trip. Fastest UX. | ✓ |
| Selective re-fetch | Targeted API call for just the affected entity. Middle ground. | |

**User's choice:** In-memory patch

**Follow-up — Data shape:**

| Option | Description | Selected |
|--------|-------------|----------|
| Raw DB rows | UI state mirrors DB shape, patch as-is. | |
| Transformed objects | UI state is processed, re-transform before patching. | |
| Mixed — depends on table | Some raw, some transformed. Researcher identifies per-table. | ✓ |

**User's choice:** Mixed — researcher identifies per table

---

## Optimistic Updates

| Option | Description | Selected |
|--------|-------------|----------|
| Doors only | Highest frequency writes. Hardware/pricing server-confirmed. | |
| Doors + Hardware sets | Covers two primary data models. Pricing stays server-confirmed. | ✓ |
| All write paths | Doors, hardware, pricing, project settings. Maximum responsiveness. | |

**User's choice:** Doors + Hardware sets

**Follow-up — Rollback UX:**

| Option | Description | Selected |
|--------|-------------|----------|
| Toast error + silent revert | Error toast + silently restore previous state. | |
| Toast error + revert + retry | Error toast includes Retry action. | |
| You decide | Claude picks based on existing patterns. | ✓ |

**User's choice:** Claude's discretion

**Follow-up — Conflict detection:**

| Option | Description | Selected |
|--------|-------------|----------|
| Last write wins | No conflict detection. Most recent write persists. | ✓ |
| Detect and warn | Compare updated_at on save, show conflict modal. | |
| Out of scope | Defer to later phase. | |

**User's choice:** Last write wins

---

## Subscription Table Scope

| Option | Description | Selected |
|--------|-------------|----------|
| project_hardware_finals + door_schedule_imports | Two tables driving door/hardware state. | ✓ (via "All") |
| project_pricing_items + project_pricing_proposal | Pricing report and proposal data. | ✓ (via "All") |
| projects table | Project metadata for dashboard sync. | ✓ (via "All") |
| All of the above | All 5 primary tables. | ✓ |

**User's choice:** All of the above (5 tables)

**Follow-up — Location:**

| Option | Description | Selected |
|--------|-------------|----------|
| Extend useProjectRealtime.ts | Add all subscriptions to existing hook. Minimal new files. | ✓ |
| Separate hooks per domain | useDoorsRealtime, usePricingRealtime, etc. | |
| Central useRealtimeSubscriptions | One new hook for all channels. | |

**User's choice:** Extend useProjectRealtime.ts

---

## Self-Event Filtering

| Option | Description | Selected |
|--------|-------------|----------|
| Timestamp deduplication | Local Set of {table}:{id}:{timestamp} keys, skip events within 2s. | ✓ |
| Accept double-apply (idempotent) | Design patch to be idempotent, no deduplication. | |
| Supabase session-based filtering | Filter by session ID stored on writes. Requires schema change. | |

**User's choice:** Timestamp deduplication (2s window, 5s pruning)

**Follow-up — Network drop:**

| Option | Description | Selected |
|--------|-------------|----------|
| Silent reconnect + full reload | Supabase auto-reconnects, trigger full reload on reconnect. | ✓ |
| Show 'Connection lost' banner | Visible offline indicator, reload on reconnect. | |
| You decide | Claude picks based on existing patterns. | |

**User's choice:** Silent reconnect + full reload

---

## Claude's Discretion

- Rollback UX: toast message text and whether to include Retry — match existing error toast patterns
- Channel naming convention for new subscriptions
- Exact deduplication Set pruning implementation
- Cleanup pattern for removeChannel() — follow existing teardown

## Deferred Ideas

- Redis cache invalidation on Realtime events — no Redis in codebase, moot for now
- Concurrent edit conflict detection — last-write-wins chosen
- Optimistic updates for pricing — pricing stays server-confirmed
- Session-based self-event filtering — timestamp approach chosen instead
- Connection lost banner — silent recovery chosen
