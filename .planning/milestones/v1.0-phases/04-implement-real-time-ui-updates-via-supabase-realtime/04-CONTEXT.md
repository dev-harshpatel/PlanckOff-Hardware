# Phase 4: Implement Real-Time UI Updates via Supabase Realtime - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Subscribe to Supabase Realtime `postgres_changes` for the 5 tables that drive primary UI state, wire events into React state via in-memory patching, and add optimistic updates for door and hardware set writes. No page reload required for any data change.

</domain>

<decisions>
## Implementation Decisions

### Update Strategy
- **D-01:** Realtime events trigger **in-memory patch** — apply the event payload directly to the existing React state (insert/update/delete the single record). No network round-trip on receiving an event.
- **D-02:** Transform behavior is **mixed per table** — some tables can be patched raw from the Supabase payload, others require a re-transform before patching (researcher must identify which tables need transformation and document the mapping). Full reload remains the fallback if a patch cannot be applied cleanly.

### Optimistic Updates
- **D-03:** Scope: **Doors + Hardware sets only.** Pricing writes remain server-confirmed (less frequent, grouping recalculation makes rollback complex).
- **D-04:** **Last write wins** — no concurrent edit conflict detection. If two users edit the same door simultaneously, the most recent server write persists. Conflict resolution is a future phase.
- **D-05:** Rollback behavior: **Claude's discretion** — use the existing `ToastContext` + silent state revert pattern (consistent with how `useDashboardState` handles optimistic rollback for project status changes).

### Subscription Table Scope
- **D-06:** Subscribe to these **5 tables**: `door_schedule_imports`, `project_hardware_finals`, `project_pricing_items`, `project_pricing_proposal`, `projects`. All scoped to `project_id=eq.{projectId}` where applicable; `projects` filtered to the current project row.
- **D-07:** All new subscriptions go into the **existing `hooks/useProjectRealtime.ts`** — extend it rather than creating separate hooks. Already integrated into `useProjectData.ts`. Researcher should identify any channel naming conventions to avoid collision.

### Self-Event Filtering
- **D-08:** **Timestamp deduplication** — maintain a module-level `Set` of `{table}:{id}:{iso_timestamp}` keys for writes made by the current tab. When a Realtime event arrives, check if it matches a key written within the last **2 seconds**; if so, skip it. Prune stale keys after 5 seconds to avoid memory growth.
- **D-09:** **Network drop handling:** Supabase auto-reconnects the channel. On reconnect (channel status `SUBSCRIBED` after a prior `CLOSED`), trigger a **full data reload** to catch any events missed during the gap. No user-visible banner — silent recovery.

### Claude's Discretion
- Rollback UX: toast message text + whether to include a Retry action — match existing error toast patterns in the codebase
- Channel naming convention for the new subscriptions in `useProjectRealtime.ts`
- Exact pruning strategy for the deduplication Set
- Cleanup pattern for `removeChannel()` — follow existing teardown in `useProjectRealtime.ts`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Realtime Implementation
- `hooks/useProjectRealtime.ts` — The only current Supabase Realtime subscription. Pattern to extend: channel setup, filter syntax, cleanup, callback integration with `useProjectData`.
- `hooks/useProjectData.ts` — Calls `useProjectRealtime` internally. This is where in-memory state lives (`hardwareSets`, `doors`). Integration point for new subscriptions.

### State & Persistence
- `hooks/useProjectPersistence.ts` — Auto-save (1s debounce) for hardware+door state. Must remain compatible with optimistic updates (optimistic state must not trigger a premature auto-save).
- `contexts/ProjectContext.tsx` — Root project list state. `projects` table subscription patches this context.

### Optimistic Update Reference Pattern
- `hooks/useDashboardState.ts` — Only existing optimistic update pattern in codebase (project status drag-drop). Rollback pattern: `setOptimistic → await API → on error: restore via effect`.

### Supabase Client
- `lib/supabase/client.ts` — Browser Supabase client (use this for Realtime subscriptions, not admin/server clients).

### Error & Toast
- `contexts/ToastContext.tsx` — Existing toast system. Use for rollback error notifications.

### No external specs — requirements fully captured in decisions above

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `hooks/useProjectRealtime.ts`: Extend this. Already handles subscribe/unsubscribe lifecycle, `project_id` filter, and callback invocation.
- `contexts/ToastContext.tsx`: Use for optimistic rollback error messages — already used throughout the app.
- `useDashboardState.ts` optimistic pattern: Reference for `setOptimistic → await → restore on error`.

### Established Patterns
- **useSyncRef pattern**: `useProjectData.ts` uses `useSyncRef()` to maintain stable callback refs across renders — follow this for Realtime callbacks to avoid subscription re-creation on every render.
- **Cleanup**: Existing `useProjectRealtime.ts` calls `supabase.removeChannel(channel)` in useEffect cleanup — follow exactly.
- **State shape**: `hardwareSets` and `doors` are kept in `useProjectData` local state, not in Context. Patches must target those `useState` setters.
- **No React Query/SWR**: All data management is manual fetch + useState. Optimistic updates must be implemented with raw `setState` + rollback ref.

### Integration Points
- `useProjectData.ts` → `useProjectRealtime.ts` (line ~50): Add new table callbacks alongside `reloadDoorSchedule`.
- `useProjectData.ts` state setters for `hardwareSets` and `doors`: Target of in-memory patches.
- `ProjectContext.tsx` `updateProject` method: Target for `projects` table patch.
- `project_pricing_items` / `project_pricing_proposal`: Researcher must identify which hook/context holds pricing state to know where to patch.

</code_context>

<specifics>
## Specific Ideas

- Deduplication window: **2 seconds** for skip, **5 seconds** for key pruning (user-specified in discussion).
- Realtime scope: `postgres_changes` event type for all 5 tables (INSERT, UPDATE, DELETE).
- Multi-tab acceptance criteria: change in Tab A visible in Tab B within **1–2 seconds** (from acceptance criteria).

</specifics>

<deferred>
## Deferred Ideas

- **Redis cache invalidation on Realtime events** — No Redis cache exists in this codebase. Moot. If a cache layer is added later, cache invalidation on Realtime events should be revisited then.
- **Concurrent edit conflict detection** — Last-write-wins chosen. Conflict modal with merge/overwrite would be a future phase.
- **Optimistic updates for pricing writes** — Grouping recalculation complexity deferred. Pricing remains server-confirmed for now.
- **Session-based self-event filtering** — Would require storing session ID on DB writes. Schema change deferred; timestamp deduplication chosen instead.
- **'Connection lost' banner** — Silent reconnect + reload chosen. Visibility banner for offline state is a UX enhancement for a later iteration.

</deferred>

---

*Phase: 04-implement-real-time-ui-updates-via-supabase-realtime*
*Context gathered: 2026-05-09*
