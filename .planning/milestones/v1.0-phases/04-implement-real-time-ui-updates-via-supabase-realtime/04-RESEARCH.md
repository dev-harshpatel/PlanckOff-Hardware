# Phase 4: Implement Real-Time UI Updates via Supabase Realtime - Research

**Researched:** 2026-05-09
**Domain:** Supabase Realtime postgres_changes, React state patching, optimistic updates
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Update Strategy:** Realtime events trigger in-memory patch — apply the event payload directly to the existing React state (insert/update/delete the single record). No network round-trip on receiving an event.

**D-02 — Transform behavior (mixed per table):** Some tables can be patched raw from the Supabase payload; others require a re-transform before patching. Full reload is the fallback if a patch cannot be applied cleanly.

**D-03 — Optimistic scope:** Doors + Hardware sets only. Pricing writes remain server-confirmed.

**D-04 — Conflict resolution:** Last write wins. No concurrent edit conflict detection.

**D-05 — Rollback behavior:** Claude's discretion — use existing `ToastContext` + silent state revert pattern (consistent with `useDashboardState`).

**D-06 — Table scope:** Subscribe to these 5 tables: `door_schedule_imports`, `project_hardware_finals`, `project_pricing_items`, `project_pricing_proposal`, `projects`. All scoped to `project_id=eq.{projectId}` where applicable; `projects` filtered to current project row.

**D-07 — Subscription location:** All new subscriptions go into existing `hooks/useProjectRealtime.ts`. Already integrated into `useProjectData.ts`. Channel naming must avoid collisions.

**D-08 — Self-event filtering:** Timestamp deduplication — module-level `Set` of `{table}:{id}:{iso_timestamp}` keys for writes made by the current tab. Skip Realtime event if key written within last 2 seconds. Prune stale keys after 5 seconds.

**D-09 — Network drop handling:** Supabase auto-reconnects the channel. On reconnect (channel status `SUBSCRIBED` after a prior `CLOSED`), trigger full data reload. No user-visible banner — silent recovery.

### Claude's Discretion

- Rollback UX: toast message text + whether to include a Retry action — match existing error toast patterns in the codebase
- Channel naming convention for the new subscriptions in `useProjectRealtime.ts`
- Exact pruning strategy for the deduplication Set
- Cleanup pattern for `removeChannel()` — follow existing teardown in `useProjectRealtime.ts`

### Deferred Ideas (OUT OF SCOPE)

- Redis cache invalidation on Realtime events
- Concurrent edit conflict detection
- Optimistic updates for pricing writes
- Session-based self-event filtering (would require schema change)
- 'Connection lost' banner / visibility for offline state
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RT-01 | Any update made by the user is reflected in the UI instantly without a page reload or manual re-fetch | In-memory patch strategy (D-01); optimistic updates for doors + hardware sets (D-03) |
| RT-02 | In a multi-tab scenario, a change made in Tab A is automatically reflected in Tab B within 1–2 seconds | Supabase Realtime postgres_changes subscription on all 5 tables; Supabase's typical event delivery is < 500ms on a healthy connection |
| RT-03 | Optimistic updates roll back cleanly if the server write fails, with an appropriate error message shown | `setOptimistic → await API → on error: restore via setState` pattern (see `useDashboardState`); toast via `ToastContext` |
| RT-04 | No stale subscriptions or memory leaks on navigation between pages | `useEffect` cleanup returning `supabase.removeChannel(channel)` — already done in existing `useProjectRealtime.ts` |
| RT-05 | Works correctly alongside any caching layer — cached data does not override a fresh Realtime update | No SWR/React Query in this codebase; state is raw `useState`. Patch must write directly to the setter — no cache layer exists to invalidate |
| RT-06 | Subscription reconnection on network drop is handled gracefully (no manual reload needed) | Channel status callback `SUBSCRIBED` after `CLOSED` triggers full reload (D-09); Supabase JS SDK handles TCP reconnect automatically |
| RT-07 | Self-events from current tab do not cause double-updates | Timestamp deduplication Set (D-08) — 2s skip window, 5s pruning |
| RT-08 | All 5 tables have `supabase_realtime` publication enabled | Migration required for `project_pricing_items`, `project_pricing_proposal`, `projects` — currently only `door_schedule_imports` and `project_hardware_finals` are in the publication |
</phase_requirements>

---

## Summary

Phase 4 wires Supabase Realtime `postgres_changes` subscriptions into five tables that drive the primary UI state. The existing `useProjectRealtime.ts` already handles one table (`door_schedule_imports`) with a clean pattern: single channel, per-project filter, ref-stabilised callbacks, and `removeChannel()` cleanup on unmount. The work is an additive extension of that hook to cover 4 more tables, plus implementing optimistic update logic for door and hardware set writes.

Three tables (`door_schedule_imports`, `project_hardware_finals`) already have Realtime publication enabled via migration 012. A new migration is required to add `project_pricing_items`, `project_pricing_proposal`, and `projects` to the `supabase_realtime` publication. Without this, subscriptions silently receive no events — this is the single most common deployment pitfall for this phase.

The update strategy is mixed. `project_pricing_items` and `project_pricing_proposal` hold simple row-level data (category/price pairs, profit percentages) that can be patched directly from the Realtime payload into the `prices` Map and proposal state inside `PricingReportConfig.tsx` and `usePricingProposal.ts` respectively. `project_hardware_finals` stores a `final_json` JSONB blob — receiving an update event means a new blob has been written; the payload contains the full row including `final_json`, which must be passed through `transformFromFinalJson()` before patching state. `door_schedule_imports` follows the existing pattern (full reload via `reloadDoorSchedule`). `projects` rows are simple metadata columns that map directly to the `Project` type after a `toProject()`-equivalent inline transform.

**Primary recommendation:** Extend `useProjectRealtime.ts` with 4 new `.on('postgres_changes', ...)` listeners on the single existing channel, add a migration enabling publication for the 3 missing tables, wire callbacks into the relevant state setters, and implement the timestamp deduplication Set at module level in `useProjectRealtime.ts`.

---

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.93.1 | Realtime channel API, `postgres_changes` subscriptions | Project's existing DB client; Realtime is built-in |
| `@supabase/ssr` | ^0.6.1 | Browser client factory (`createBrowserClient`) | Already used in `lib/supabase/client.ts` |
| React | ^19.2.0 | `useState`, `useEffect`, `useRef`, `useCallback` for state patching | Project framework |

### Supporting (already in codebase)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sonner` | ^2.0.7 | Toast notifications for rollback errors | Optimistic update failure notifications via `ToastContext` |

No new npm packages are required for this phase.

**Installation:** None required — all dependencies already present.

---

## Architecture Patterns

### Recommended Project Structure (no new files needed)

The phase extends two existing files and adds one migration:

```
hooks/
└── useProjectRealtime.ts    ← extend: add 4 table listeners + dedup Set + reconnect handler

supabase/migrations/
└── 019_enable_realtime_pricing_projects.sql   ← new: ADD TABLE for 3 missing tables

(Pricing state patching is wired into the callbacks passed INTO useProjectRealtime from:)
hooks/useProjectData.ts                        ← extend: new callbacks for hardware_finals
components/pricing/PricingReportConfig.tsx     ← extend: callback for pricing_items
hooks/usePricingProposal.ts                    ← extend: callback for pricing_proposal
contexts/ProjectContext.tsx                    ← extend: callback for projects table
```

### Pattern 1: Extended useProjectRealtime Channel (single channel, multiple listeners)

**What:** All 5 table listeners on the same channel object, using the existing `project-realtime-{projectId}` channel name. Callbacks are held in refs (`useSyncRef`) to prevent subscription recreation on render.

**When to use:** Every new table subscription in this phase.

**Example (extending existing pattern):**
```typescript
// hooks/useProjectRealtime.ts
// Source: existing codebase pattern + Supabase JS v2 chained .on() API

interface UseProjectRealtimeOptions {
  projectId: string;
  onDoorScheduleChange: () => void;
  onHardwareFinalsChange: (payload: RealtimePostgresChangesPayload<HardwareFinalsRow>) => void;
  onPricingItemsChange: (payload: RealtimePostgresChangesPayload<PricingItemRow>) => void;
  onPricingProposalChange: (payload: RealtimePostgresChangesPayload<PricingProposalRow>) => void;
  onProjectChange: (payload: RealtimePostgresChangesPayload<ProjectRow>) => void;
}

useEffect(() => {
  if (!projectId) return;
  const supabase = createSupabaseBrowserClient();

  const channel = supabase
    .channel(`project-realtime-${projectId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'door_schedule_imports',
        filter: `project_id=eq.${projectId}` }, () => {
      onDoorScheduleChangeRef.current();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'project_hardware_finals',
        filter: `project_id=eq.${projectId}` }, (payload) => {
      onHardwareFinalsChangeRef.current(payload);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'project_pricing_items',
        filter: `project_id=eq.${projectId}` }, (payload) => {
      onPricingItemsChangeRef.current(payload);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'project_pricing_proposal',
        filter: `project_id=eq.${projectId}` }, (payload) => {
      onPricingProposalChangeRef.current(payload);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects',
        filter: `id=eq.${projectId}` }, (payload) => {
      onProjectChangeRef.current(payload);
    })
    .subscribe((status, err) => {
      // Reconnect recovery (D-09)
      if (status === 'SUBSCRIBED' && wasClosedRef.current) {
        wasClosedRef.current = false;
        onFullReloadRef.current?.();
      }
      if (status === 'CLOSED') wasClosedRef.current = true;
      if (err) console.error('[useProjectRealtime] subscription error:', err);
    });

  return () => { supabase.removeChannel(channel); };
}, [projectId]);
```

### Pattern 2: Timestamp Deduplication Set (module-level)

**What:** Module-level `Set<string>` storing `{table}:{id}:{iso_timestamp}` keys for writes made by the current tab. Before applying an incoming Realtime event, check if the key is in the Set. If so, skip and prune.

**When to use:** In every write path that will trigger one of the 5 subscriptions.

```typescript
// hooks/useProjectRealtime.ts — module scope (outside the hook function)
const pendingWrites = new Set<string>();

export function markPendingWrite(table: string, id: string, isoTimestamp: string): void {
  const key = `${table}:${id}:${isoTimestamp}`;
  pendingWrites.add(key);
  setTimeout(() => pendingWrites.delete(key), 5000); // prune after 5s
}

export function isOwnWrite(table: string, id: string, isoTimestamp: string): boolean {
  const key = `${table}:${id}:${isoTimestamp}`;
  if (pendingWrites.has(key)) {
    // Key was written by this tab within the last 5s
    return true;
  }
  return false;
}
```

Callers (e.g., the save path in `useProjectPersistence.ts`) call `markPendingWrite(table, rowId, updatedAt)` after a successful write. The Realtime callback calls `isOwnWrite()` before applying the patch.

**Implementation note:** The `updated_at` column (auto-set by DB trigger on all 5 tables) is the timestamp to use. The write path must read the `updated_at` returned in the API response to get the exact value that will appear in the Realtime event payload.

### Pattern 3: In-Memory Patch by Table

**What:** Each incoming Realtime event is applied to the relevant React state via a targeted setState call. The patch strategy differs per table based on the data shape.

| Table | Event Type | Patch Target | Transform Required? | Payload Contents |
|-------|-----------|--------------|---------------------|------------------|
| `door_schedule_imports` | INSERT / UPDATE | Re-fetch via `reloadDoorSchedule()` | Full reload (existing behavior) | Has `schedule_json` blob |
| `project_hardware_finals` | INSERT / UPDATE | `setHardwareSets` + `setDoors` via `transformFromFinalJson` | YES — `final_json` JSONB blob needs `transformFromFinalJson()` | Full row with `final_json` array |
| `project_hardware_finals` | DELETE | Clear / no-op (row deleted means project has no merged data) | No | Minimal payload |
| `project_pricing_items` | INSERT / UPDATE | `setPrices` Map in `PricingReportConfig` | NO — patch `category:group_key → unit_price` directly | `{ id, project_id, category, group_key, unit_price, updated_at }` |
| `project_pricing_items` | DELETE | Remove key from `prices` Map | NO | `{ id, category, group_key }` |
| `project_pricing_proposal` | INSERT / UPDATE | `setProfitPct`, `setAllocateExpenses`, etc. in `usePricingProposal` | NO — simple scalar fields map directly | `{ project_id, profit_door, profit_frame, profit_hardware, allocate_expenses, remarks }` |
| `projects` | UPDATE | `setProjects(prev => prev.map(...))` in `ProjectContext` | YES — snake_case → camelCase transform needed (`project_number` → `projectNumber`, etc.) | Full row |
| `projects` | DELETE | Remove from projects list (soft delete via `deleted_at`) | NO | Minimal payload |

### Pattern 4: Optimistic Update for Doors and Hardware Sets

**What:** Apply state change immediately (optimistic), then await server write. On error, revert to the snapshot taken before the optimistic update and show a toast.

**When to use:** Any door or hardware set write in `useProjectData.ts`.

**Reference:** `useDashboardState.ts` (`handleProjectDropToStatus`) — exact pattern already in the codebase.

```typescript
// Pattern derived from useDashboardState.ts

// 1. Snapshot current state
const prevDoors = doorsRef.current;

// 2. Apply optimistic update
setDoors(nextDoors);

try {
  // 3. Await server write
  await saveToFinalJson(hardwareSets, nextDoors, trashItems);
  // 4. Success — no action needed (Realtime event will arrive but dedup Set skips it)
} catch (error) {
  // 5. Rollback
  setDoors(prevDoors);
  addToast({
    type: 'error',
    message: ERRORS.GENERAL.SAVE_FAILED.message,
    details: error instanceof Error ? error.message : undefined,
  });
}
```

**Interaction with `useProjectPersistence`:** The 1-second auto-save debounce in `useProjectPersistence.ts` fires when `hardwareSets` or `doors` change. An optimistic update will trigger `isInitialMount.current` check — since `isInitialMount.current` will be `false` at this point, the debounce fires. This means the optimistic state IS persisted on success (desired) and must be reverted AND the in-flight debounce must be cancelled on rollback. The rollback must also reset `isInitialMount.current = true` to prevent auto-save from firing on the revert `setState`.

### Anti-Patterns to Avoid

- **Starting a second Supabase channel per table:** Single channel with multiple `.on()` calls is correct; one channel per table creates N connections and hits Supabase channel limits.
- **Re-creating subscriptions on callback reference changes:** Callbacks must be in refs (`useSyncRef` or `useRef`) — do NOT put the callback function in the `useEffect` dependency array.
- **Applying Realtime patch before checking hasFinalJsonRef:** For `door_schedule_imports`, the existing guard `if (hasFinalJsonRef.current) return;` in `reloadDoorSchedule` must stay. When `final_json` is the source of truth, door schedule changes must not overwrite state.
- **Forgetting to enable Realtime publication on new tables:** Tables not in `supabase_realtime` publication silently produce no events. This is invisible to `.subscribe()` — the channel status is `SUBSCRIBED` but callbacks never fire.
- **Using admin client for Realtime:** `lib/supabase/admin.ts` is a server-only client. Realtime subscriptions must use `createSupabaseBrowserClient()` from `lib/supabase/client.ts`.
- **Patching `projects` with a stale `hardwareSets`/`doors`:** `ProjectContext.updateProject()` already handles this — it preserves `hardwareSets`, `doors`, `elevationTypes` from the local state when updating metadata. The Realtime patch for `projects` must follow the same pattern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket connection management | Custom WS reconnect logic | Supabase Realtime channel (built-in to `@supabase/supabase-js`) | Handles heartbeat, backoff, reconnect automatically |
| Diff/merge of incoming record with existing array | Custom deep merge | Simple `Array.prototype.map` replace-by-id | The payload `new` field is the complete updated record; no diffing needed |
| Channel multiplexing | Multiple channels for same projectId | Single channel, multiple `.on()` listeners | Supabase channels are multiplexed over one WebSocket |
| Duplicate event detection | Per-column fingerprint | `updated_at` timestamp key in module-level Set | The DB trigger guarantees `updated_at` changes on every write |

**Key insight:** Supabase Realtime's `postgres_changes` delivers the full updated row (or the minimal deleted row). There is no need to re-fetch after receiving an event for tables where the payload contains sufficient data to patch state directly.

---

## Table-by-Table Analysis

### 1. `door_schedule_imports`

- **Current state:** Already subscribed. `onDoorScheduleChange` fires `reloadDoorSchedule()`.
- **Payload:** Full row including `schedule_json` (large JSONB). Direct patch is NOT viable — `schedule_json` requires `transformDoors()` and merge logic already in `reloadDoorSchedule()`.
- **RT event → action:** Trigger `reloadDoorSchedule()` (existing behavior, no change needed except guarding against self-events via dedup Set).
- **Transform needed:** YES — via existing `reloadDoorSchedule` which calls `transformDoors()`.
- **Filter:** `project_id=eq.{projectId}`
- **Publication status:** Already enabled (migration 012).

### 2. `project_hardware_finals`

- **Current state:** Publication enabled (migration 012), but no subscription callback wired up yet.
- **Payload (INSERT/UPDATE):** Full row including `final_json` JSONB array (large).
- **RT event → action (INSERT/UPDATE):** Call `transformFromFinalJson(payload.new.final_json)` → `setHardwareSets(result.hardwareSets)` + `setDoors(result.doors)`. Must set `hasFinalJsonRef.current = true` and `isInitialMount.current = true` to prevent auto-save loop.
- **RT event → action (DELETE):** No-op or clear state — deletion of the finals row is rare (would only happen on full project re-process).
- **Transform needed:** YES — `final_json` must go through `transformFromFinalJson` from `utils/hardwareTransformers.ts`.
- **Filter:** `project_id=eq.{projectId}`
- **Publication status:** Already enabled (migration 012).
- **State target:** `setHardwareSets` and `setDoors` in `useProjectData.ts`.

### 3. `project_pricing_items`

- **Current state:** Not subscribed. Publication NOT enabled (missing from migration 012).
- **Payload:** Lightweight row: `{ id, project_id, category, group_key, unit_price, updated_at }`.
- **RT event → action (INSERT/UPDATE):** `setPrices(prev => new Map(prev).set(`${category}:${group_key}`, unit_price))`.
- **RT event → action (DELETE):** `setPrices(prev => { const m = new Map(prev); m.delete(`${category}:${group_key}`); return m; })`.
- **Transform needed:** NO — patch directly from payload fields.
- **Filter:** `project_id=eq.{projectId}`
- **Publication status:** NOT enabled — requires new migration.
- **State target:** `prices` state (local to `PricingReportConfig.tsx`). The callback must be passed from `PricingReportConfig` through `useProjectData` → `useProjectRealtime`.

### 4. `project_pricing_proposal`

- **Current state:** Not subscribed. Publication NOT enabled.
- **Payload:** `{ project_id, profit_door, profit_frame, profit_hardware, allocate_expenses, remarks, updated_at }` (plus columns from migration 015/016/018 but only the proposal row).
- **RT event → action (UPDATE):** Patch `setProfitPct`, `setAllocateExpenses`, `setRemarks` in `usePricingProposal.ts`.
- **RT event → action (INSERT):** Same as UPDATE.
- **RT event → action (DELETE):** Unlikely (row deleted only on project delete via CASCADE). No-op.
- **Transform needed:** NO — scalar fields map directly.
- **Filter:** `project_id=eq.{projectId}` (note: `project_id` is the PK on this table).
- **Publication status:** NOT enabled — requires new migration.
- **State target:** Local state in `usePricingProposal.ts`. Callback must flow: `usePricingProposal` → `PricingReportConfig` → `useProjectData` → `useProjectRealtime`.

### 5. `projects`

- **Current state:** Not subscribed. Publication NOT enabled.
- **Payload:** Full row — `{ id, name, client, location, ..., status, updated_at }` (all `ProjectRow` columns, snake_case).
- **RT event → action (UPDATE):** Transform snake_case → camelCase inline (same mapping as `toProject()` in `lib/db/projects.ts`), then `setProjects(prev => prev.map(p => p.id === id ? patched : p))` in `ProjectContext`.
- **RT event → action (INSERT):** Append to projects list (someone created a project in another tab).
- **RT event → action (DELETE):** Remove from list or move to trash depending on `deleted_at`.
- **Transform needed:** YES — snake_case DB columns → camelCase `Project` domain type. The `toProject` transformer in `lib/db/projects.ts` is server-side only and imports the admin client. A lightweight client-side inline transform must be written.
- **Filter:** `id=eq.{projectId}` (subscribe to a specific project row when inside a project view). For the dashboard (projects list), no filter — but D-06 says scope to current `projectId`. For dashboard context, we may need a separate non-filtered channel, but CONTEXT.md says filter to current project row — so the `ProjectContext` subscription is only used from within the project view.
- **Publication status:** NOT enabled — requires new migration.
- **State target:** `setProjects` in `ProjectContext.tsx`.

---

## Common Pitfalls

### Pitfall 1: Missing Realtime Publication for 3 Tables

**What goes wrong:** Subscriptions to `project_pricing_items`, `project_pricing_proposal`, and `projects` are written and deployed, but no events ever arrive. Channel status shows `SUBSCRIBED` but callbacks never fire. Extremely hard to debug.

**Why it happens:** Supabase Realtime requires tables to be in the `supabase_realtime` publication (`ALTER PUBLICATION supabase_realtime ADD TABLE tablename`). The existing migration 012 only added `door_schedule_imports` and `project_hardware_finals`.

**How to avoid:** Create migration 019 to add the three missing tables before wiring any subscription code.

**Warning signs:** Callback ref is correct, channel is subscribed, but no events appear in the Supabase Realtime inspector or console.

### Pitfall 2: `project_hardware_finals` Patch Triggers Auto-Save Loop

**What goes wrong:** Realtime event for `project_hardware_finals` arrives → `setHardwareSets` + `setDoors` called → `useProjectPersistence` debounce fires → write to DB → another Realtime event arrives → infinite loop.

**Why it happens:** `useProjectPersistence` watches `hardwareSets` and `doors` for any change and auto-saves. The dedup Set only skips events for writes made by the current tab, but the Realtime-triggered save IS a current-tab write — if its `updated_at` isn't recorded before the dedup Set check runs, the loop persists.

**How to avoid:** When applying a Realtime patch for `project_hardware_finals`, set `isInitialMount.current = true` on the ref before calling `setHardwareSets`/`setDoors`. `useProjectPersistence` skips auto-save when `isInitialMount.current` is `true` (it sets it to `false` on the first effect run after a state change). Alternatively, use the dedup Set by recording the `updated_at` of the incoming event before updating state, so the resulting auto-save's write is deduped.

**Warning signs:** Rapid successive saves visible in the network tab; `SaveStatusIndicator` cycling repeatedly after a Realtime event.

### Pitfall 3: Optimistic Update Fires Auto-Save Prematurely on Rollback

**What goes wrong:** Rollback `setDoors(prevDoors)` triggers the `useProjectPersistence` debounce (because `doors` changed), which then auto-saves the reverted state — an unnecessary write.

**Why it happens:** `useProjectPersistence` debounce is triggered by any change to `hardwareSets` or `doors`. Rollback is also a change.

**How to avoid:** Before rollback `setState`, set `isInitialMount.current = true` to suppress the next auto-save cycle.

### Pitfall 4: `pricing_proposal` Callback Prop-Drilling Depth

**What goes wrong:** The callback for `project_pricing_proposal` needs to reach `usePricingProposal.ts`, which is instantiated inside `PricingReportConfig.tsx` (a component several levels deep), not in `useProjectData.ts`.

**Why it happens:** `usePricingProposal` is a standalone hook, not part of the `useProjectData` state tree. `useProjectRealtime` is called from `useProjectData`, which has no visibility into pricing proposal state.

**How to avoid:** Two viable approaches (Claude's discretion):
1. **Pass callback down:** Add `onPricingProposalChange` to `useProjectRealtimeOptions`; caller (`useProjectData`) receives it as a prop and passes it through from whatever component instantiates pricing. This is verbose but consistent with the existing callback pattern.
2. **Separate mini-hook:** Create a second `useEffect` directly in `PricingReportConfig` or `usePricingProposal` that subscribes to only the `project_pricing_proposal` table. Cleaner separation, but adds a second channel (minor cost). Given D-07 says "all new subscriptions go into existing `useProjectRealtime.ts`", option 1 is preferred.

### Pitfall 5: `projects` Table — `project_id` Filter vs `id` Filter

**What goes wrong:** Subscribing to `projects` with filter `project_id=eq.{projectId}` — but the `projects` table does not have a `project_id` column; the primary key is `id`.

**Why it happens:** Developer copies the filter pattern from other tables without checking the schema.

**How to avoid:** For the `projects` table, the filter must be `id=eq.${projectId}`.

### Pitfall 6: `project_pricing_proposal` DELETE Payload

**What goes wrong:** For `project_pricing_proposal`, `project_id` is the PRIMARY KEY. Supabase Realtime DELETE payloads for tables with a non-UUID `id` PK send a minimal `old` record (only indexed/PK columns). For this table, the DELETE payload will only contain `{ project_id: '...' }` — no other fields.

**Why it happens:** Supabase only includes columns in the publication's replica identity. The default replica identity is `DEFAULT` (only the PK). For UPDATE events, the `new` field is full. For DELETE, only PK columns appear in `old`.

**How to avoid:** Don't destructure `profit_door`, etc. from DELETE payloads. Only use `payload.old.project_id` for DELETE handling.

---

## Code Examples

### Channel Status Callback for Reconnect Recovery (D-09)

```typescript
// Source: Supabase JS v2 .subscribe() signature + D-09 decision

const wasClosedRef = useRef(false);
const onFullReloadRef = useSyncRef(onFullReload); // passed as prop

.subscribe((status: string, err?: Error) => {
  if (status === 'CLOSED') {
    wasClosedRef.current = true;
  }
  if (status === 'SUBSCRIBED' && wasClosedRef.current) {
    wasClosedRef.current = false;
    // Trigger full reload to catch missed events
    onFullReloadRef.current();
  }
  if (err) {
    console.error('[useProjectRealtime] channel error:', err);
  }
});
```

### Realtime Payload Type (Supabase JS v2)

```typescript
// Source: @supabase/supabase-js v2 type definitions
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// For INSERT / UPDATE events:
// payload.eventType === 'INSERT' | 'UPDATE'
// payload.new — the full updated row (all columns in the publication)
// payload.old — the old row (only PK columns for UPDATE by default)

// For DELETE events:
// payload.eventType === 'DELETE'
// payload.new — empty object {}
// payload.old — only PK columns (unless FULL replica identity is set)
```

### project_hardware_finals Patch

```typescript
// Source: useProjectData.ts load logic + transformFromFinalJson API

// In the onHardwareFinalsChange callback (inside useProjectData):
const handleHardwareFinalsChange = useCallback(
  (payload: RealtimePostgresChangesPayload<{ final_json: unknown }>) => {
    if (payload.eventType === 'DELETE') return; // rare, no-op
    const raw = payload.new?.final_json;
    if (!Array.isArray(raw) || raw.length === 0) return;

    // Check dedup
    if (isOwnWrite('project_hardware_finals', payload.new.id, payload.new.updated_at)) return;

    const result = transformFromFinalJson(raw as Parameters<typeof transformFromFinalJson>[0]);
    // Suppress auto-save cycle
    isInitialMount.current = true;
    setHardwareSets(result.hardwareSets);
    setDoors(result.doors);
    hasFinalJsonRef.current = true;
  },
  [],
);
```

### project_pricing_items Patch

```typescript
// Source: PricingReportConfig.tsx existing setPrices pattern

const handlePricingItemsChange = useCallback(
  (payload: RealtimePostgresChangesPayload<PricingItemDbRow>) => {
    if (payload.eventType === 'DELETE') {
      const { category, group_key } = payload.old as { category: string; group_key: string };
      setPrices(prev => {
        const next = new Map(prev);
        next.delete(`${category}:${group_key}`);
        return next;
      });
      return;
    }
    const { category, group_key, unit_price, id, updated_at } = payload.new;
    if (isOwnWrite('project_pricing_items', id, updated_at)) return;
    setPrices(prev => new Map(prev).set(`${category}:${group_key}`, unit_price));
  },
  [],
);
```

### project_pricing_proposal Patch

```typescript
// Source: usePricingProposal.ts existing fetch/parse logic

const handlePricingProposalChange = useCallback(
  (payload: RealtimePostgresChangesPayload<PricingProposalDbRow>) => {
    if (payload.eventType === 'DELETE') return; // CASCADE only
    const { profit_door, profit_frame, profit_hardware, allocate_expenses, remarks, project_id, updated_at } = payload.new;
    if (isOwnWrite('project_pricing_proposal', project_id, updated_at)) return;
    const next = {
      door:     profit_door     > 0 ? String(profit_door)     : '',
      frame:    profit_frame    > 0 ? String(profit_frame)    : '',
      hardware: profit_hardware > 0 ? String(profit_hardware) : '',
    };
    setProfitPct(next);
    setAllocateExpenses(allocate_expenses);
    setRemarks(remarks ?? '');
  },
  [],
);
```

### projects Row Inline Transform (client-side)

```typescript
// Source: lib/db/projects.ts toProject() — adapted for client-side use

function projectRowToProject(row: Record<string, unknown>): Project {
  return {
    id:            row.id as string,
    name:          (row.name as string) ?? '',
    client:        (row.client as string) ?? '',
    location:      (row.location as string) ?? '',
    country:       (row.country as string) ?? undefined,
    province:      (row.province as string) ?? undefined,
    description:   (row.description as string) ?? '',
    projectNumber: (row.project_number as string) ?? '',
    status:        (row.status as Project['status']) ?? 'Active',
    dueDate:       (row.due_date as string) ?? undefined,
    assignedTo:    (row.assigned_to as string) ?? undefined,
    createdAt:     new Date(row.created_at as string),
    updatedAt:     new Date(row.updated_at as string),
    lastModified:  row.updated_at as string,
    elevationTypes:(row.elevation_types as ElevationType[]) ?? [],
    deletedAt:     (row.deleted_at as string) ?? undefined,
  };
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling for updates | Supabase Realtime `postgres_changes` | Supabase JS v2 | No polling needed; push-based |
| Separate channel per table | Single channel, chained `.on()` calls | Supabase JS v2 | Fewer WebSocket connections |
| `REPLICA IDENTITY FULL` for DELETE payloads | Default replica identity (PK only on DELETE) | Always | DELETE events include minimal data — must handle |

**Deprecated/outdated:**
- `supabase.from().on()` — old Realtime v1 API. Removed in Supabase JS v2. This codebase correctly uses `supabase.channel().on('postgres_changes', ...)`.

---

## Critical Migration Gap

**3 tables are not yet in the `supabase_realtime` publication.** This must be the first deliverable of the phase — before any subscription code is written.

Required new migration (`019_enable_realtime_pricing_projects.sql`):

```sql
-- Enable Realtime for tables not covered by migration 012

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'project_pricing_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE project_pricing_items;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'project_pricing_proposal'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE project_pricing_proposal;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'projects'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE projects;
  END IF;
END $$;
```

---

## Callback Wiring Map

This maps each new RT event to the exact React state it must patch:

```
useProjectRealtime.ts
  ├── door_schedule_imports     → onDoorScheduleChange()       → useProjectData.reloadDoorSchedule()
  ├── project_hardware_finals   → onHardwareFinalsChange()     → useProjectData.setHardwareSets() + setDoors()
  ├── project_pricing_items     → onPricingItemsChange()       → PricingReportConfig.setPrices()
  ├── project_pricing_proposal  → onPricingProposalChange()    → usePricingProposal.setProfitPct() etc.
  └── projects                  → onProjectChange()            → ProjectContext.setProjects()
```

**Callback threading challenge:** `useProjectRealtime` is called from `useProjectData`, which is called from inside a project view component. `PricingReportConfig` and `usePricingProposal` are deeper in the tree. The callbacks for pricing must be passed as optional props to `useProjectRealtime` (and `useProjectData`), with null-safe defaults when not in a pricing context.

For `ProjectContext`, the subscription for `projects` should be added to a separate `useEffect` directly in `ProjectContext.tsx` (or extracted into a `useProjectsRealtime` hook) rather than routing through `useProjectData` — since `ProjectContext` doesn't use `useProjectData`. D-07 says "all new subscriptions go into existing `useProjectRealtime.ts`" — this is satisfied by having `ProjectContext` call `useProjectRealtime` directly for the `projects` table only, passing a `projectId` to scope to the current project. However, `ProjectContext` is a global provider that doesn't have a single `projectId`. Resolution: only subscribe to the `projects` table when `projectId` is known (i.e., from within the project view via `useProjectData`), not at the global context level.

---

## Environment Availability Audit

Step 2.6: SKIPPED (no external dependencies beyond what is already in the project — Supabase is already connected, all npm packages are installed).

---

## Open Questions

1. **`project_pricing_proposal` callback threading**
   - What we know: `usePricingProposal` is instantiated inside `PricingReportConfig.tsx`, which is called from deep in the project view tree. `useProjectRealtime` is called from `useProjectData`.
   - What's unclear: Whether to thread the callback through `useProjectData` (adding a new optional prop) or instantiate a second lightweight channel subscription directly inside `usePricingProposal`.
   - Recommendation: Thread through `useProjectData` as an optional callback to stay consistent with D-07. Mark it optional with a `?` so the hook works when pricing is not mounted.

2. **`projects` table subscription scope**
   - What we know: D-06 scopes to `id=eq.{projectId}` for the `projects` table. D-07 says subscriptions go in `useProjectRealtime.ts`. `ProjectContext` is a global provider without a per-project scope.
   - What's unclear: Whether the `projects` RT subscription should be at the global `ProjectContext` level (multi-project awareness) or only inside a project view.
   - Recommendation: Scope to current project only (via `useProjectRealtime` called from `useProjectData`). Global multi-project Realtime is a future phase concern and is not in D-06's stated scope.

3. **Dedup Set: `updated_at` availability at write time**
   - What we know: The API response for `PUT /api/projects/{id}/hardware-merge` (and pricing endpoints) returns the saved row. The `updated_at` is set by the DB trigger.
   - What's unclear: Whether the existing API routes return the updated row's `updated_at` in the response body.
   - Recommendation: Audit API route responses during planning. If `updated_at` is not returned, modify routes to return it (small change), or use `Date.now()` with a 2-second fuzzy match instead of exact timestamp matching.

---

## Sources

### Primary (HIGH confidence)
- `hooks/useProjectRealtime.ts` — existing Supabase Realtime implementation, channel API, cleanup pattern
- `hooks/useProjectData.ts` — state shape, `useSyncRef` pattern, `hasFinalJsonRef` guard, `transformFromFinalJson` usage
- `hooks/useDashboardState.ts` — optimistic update pattern with rollback
- `hooks/usePricingProposal.ts` — pricing proposal state shape and setters
- `contexts/ProjectContext.tsx` — `setProjects` API, `updateProject` pattern
- `contexts/ToastContext.tsx` — `addToast` API, error toast pattern
- `lib/db/projects.ts` — `toProject()` transformer (model for client-side transform)
- `supabase/migrations/012_enable_realtime.sql` — which tables are already in publication
- `supabase/migrations/013_pricing_report.sql` — `project_pricing_items` schema
- `supabase/migrations/014_pricing_proposal.sql` — `project_pricing_proposal` schema
- `package.json` — `@supabase/supabase-js ^2.93.1` confirmed

### Secondary (MEDIUM confidence)
- `components/pricing/PricingReportConfig.tsx` — `prices` Map state shape and `setPrices` setter pattern
- `hooks/useProjectPersistence.ts` — auto-save debounce behavior, `isInitialMount` suppression pattern

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already present, no new installs
- Architecture patterns: HIGH — derived entirely from reading actual codebase files
- Table transform analysis: HIGH — based on reading migration SQL + existing transformer code
- Pitfalls: HIGH — derived from real code interactions (auto-save loop, missing publication) not speculation
- Callback threading: MEDIUM — two viable approaches documented; planner must choose one

**Research date:** 2026-05-09
**Valid until:** 2026-06-09 (Supabase JS v2 API is stable; internal code analysis is valid until the codebase changes)
