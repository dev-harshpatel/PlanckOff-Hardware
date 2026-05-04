# Data Sync Optimization Plan — PlanckOff
**Date:** 2026-05-04  
**Author:** Claude Code + Harsh Patel  
**Status:** Planning

---

## The Two Core Problems

### Problem 1 — Data Loss on Browser Refresh

Data disappears on refresh because the **source of truth is ambiguous** and the **auto-save has a race window**.

**Root causes:**

| Cause | Detail |
|---|---|
| 1000ms debounce race | User edits a door/set → 1000ms timer starts → user refreshes before timer fires → change is gone |
| Inconsistent initial load | On mount, `ProjectView` must fetch from `project_hardware_finals` to restore doors/sets, but if this fetch fails or is slow, stale data is shown |
| localStorage not synced | `masterInventory` and `appSettings` are localStorage-only — they survive refresh on the same device but are invisible to Supabase and lost on a new device |
| Fire-and-forget saves | `saveToFinalJson()` is not awaited in the auto-save path — a network failure silently drops the write with no retry |
| No save confirmation before unload | No `beforeunload` listener to warn users about in-flight saves |

**What IS persisted correctly:**
- Project metadata → `projects` table ✓
- Door schedule (Excel upload) → `door_schedule_imports` table ✓
- PDF extraction results → `hardware_pdf_extractions` table ✓
- Doors + hardware sets (final state) → `project_hardware_finals.final_json` ✓

**What is NOT persisted / can be lost:**
- Edits made within the 1000ms debounce window
- masterInventory (localStorage only)
- Export presets (localStorage only)
- Undo toast state (ephemeral — close page = lose undo)

---

### Problem 2 — No Real-Time Sync

Only one table has a Supabase realtime subscription:
- `door_schedule_imports` → `hooks/useProjectRealtime.ts` ✓

**Missing subscriptions (data changes are invisible until manual refresh):**
- `project_hardware_finals` — the main store for doors + hardware sets
- `hardware_pdf_extractions` — PDF extraction results
- `projects` — project metadata (name, status, client)
- `project_pricing_items` — pricing data

---

## Application Sections & Ownership

The app is divided into 5 functional areas. Each area's problems and fixes are treated independently.

| Section | Key Files | Tables Affected |
|---|---|---|
| **A — Project List & Metadata** | `ProjectContext.tsx`, `ProjectView.tsx` | `projects` |
| **B — Door Schedule** | `DoorScheduleManager.tsx`, `useProjectRealtime.ts` | `door_schedule_imports` |
| **C — Hardware Sets & Doors** | `HardwareSetsManager.tsx`, `HardwareSetModal.tsx`, `EnhancedDoorEditModal.tsx`, `ProjectView.tsx` | `project_hardware_finals` |
| **D — PDF Extraction** | `services/geminiService.ts`, `services/fileUploadService.ts` | `hardware_pdf_extractions` |
| **E — Settings & Inventory** | `ProjectContext.tsx` (appSettings, masterInventory) | localStorage → Supabase migration |

---

## Phase Plan

### Phase 1 — Fix the Data Loss (Critical — Do First)
**Goal:** No data is ever lost on refresh. Saves are reliable.  
**Risk:** High. This touches the core save/load path.  
**Effort:** ~2–3 days

#### 1.1 — Add `beforeunload` guard for in-flight saves

**Section:** C (Hardware Sets & Doors)  
**File:** [views/ProjectView.tsx](views/ProjectView.tsx)

When `saveStatus === 'saving'`, register a `beforeunload` event to warn the user. This is a safety net.

```typescript
// In ProjectView.tsx
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (saveStatus === 'saving') {
      e.preventDefault();
      e.returnValue = ''; // triggers browser dialog
    }
  };
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [saveStatus]);
```

#### 1.2 — Shorten the auto-save debounce + make it awaited

**Section:** C  
**File:** [views/ProjectView.tsx](views/ProjectView.tsx) (around line 651)

- Reduce debounce from 1000ms → 300ms
- Make the auto-save useEffect properly await `saveToFinalJson` and surface errors to the user

```typescript
// Current (problematic):
saveToFinalJson(hardwareSets, doors, trashItems); // fire-and-forget

// Target:
try {
  await saveToFinalJson(hardwareSets, doors, trashItems);
} catch (err) {
  addToast({ type: 'error', message: 'Auto-save failed. Changes may be lost.' });
}
```

#### 1.3 — Verify initial data load from `project_hardware_finals`

**Section:** C  
**File:** [views/ProjectView.tsx](views/ProjectView.tsx) (mount useEffect)

On project open, ensure `final_json` is loaded from Supabase and used to populate `hardwareSets` and `doors`. Confirm there's no race condition where empty state overwrites the fetched state.

Checklist:
- [ ] Initial fetch is awaited before rendering editable UI
- [ ] If fetch fails, show error state (not an empty project)
- [ ] Loading state prevents user interaction until data is ready

#### 1.4 — Move `masterInventory` to Supabase

**Section:** E  
**File:** [contexts/ProjectContext.tsx](contexts/ProjectContext.tsx)

Create a new table `user_inventory` (or `account_inventory`) with columns: `user_id`, `inventory_json`.  
Replace `localStorage.setItem('tve_master_inventory', ...)` with a Supabase upsert.  
On mount, fetch from Supabase instead of localStorage.

This is important because an estimator may work across multiple devices.

---

### Phase 2 — Real-Time Subscriptions
**Goal:** Any change to data (from any tab/device) is reflected instantly without a page refresh.  
**Risk:** Medium. Supabase Realtime is additive — it doesn't change the write path.  
**Effort:** ~1–2 days

The existing `useProjectRealtime.ts` hook is the right pattern. Extend it.

#### 2.1 — Subscribe to `project_hardware_finals` (Doors & Hardware Sets)

**Section:** C  
**File:** [hooks/useProjectRealtime.ts](hooks/useProjectRealtime.ts)

```typescript
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'project_hardware_finals',
  filter: `project_id=eq.${projectId}`,
}, (payload) => {
  // Merge incoming final_json into local state
  // Only apply if payload.new.updated_at > local state's last-save timestamp
  onHardwareFinalChange(payload.new);
})
```

**Conflict strategy:** Use an `updated_at` timestamp to decide whether to apply the incoming change. If local state is newer (user is mid-edit), skip. If remote is newer (another tab saved), apply.

#### 2.2 — Subscribe to `hardware_pdf_extractions`

**Section:** D  
**File:** [hooks/useProjectRealtime.ts](hooks/useProjectRealtime.ts)

The PDF upload happens in a background worker. When it completes and writes to `hardware_pdf_extractions`, the main tab should auto-refresh the extraction results.

```typescript
.on('postgres_changes', {
  event: 'INSERT',
  schema: 'public',
  table: 'hardware_pdf_extractions',
  filter: `project_id=eq.${projectId}`,
}, () => {
  onPdfExtractionComplete();
})
```

This eliminates the current `isPollingForResult` polling loop in ProjectView.

#### 2.3 — Subscribe to `projects` for metadata changes

**Section:** A  
**File:** [contexts/ProjectContext.tsx](contexts/ProjectContext.tsx)

When project name, status, or client changes from another tab/device, sync it.

```typescript
// In a new hook: hooks/useProjectsRealtime.ts
supabase.channel('projects-list')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'projects',
  }, () => {
    fetchProjects(); // re-fetch the list
  })
  .subscribe();
```

#### 2.4 — Enable Realtime on all relevant Supabase tables

Supabase Realtime must be explicitly enabled per table in the dashboard or via SQL:

```sql
-- Run once per table in Supabase SQL editor:
ALTER TABLE project_hardware_finals REPLICA IDENTITY FULL;
ALTER TABLE hardware_pdf_extractions REPLICA IDENTITY FULL;
ALTER TABLE projects REPLICA IDENTITY FULL;
ALTER TABLE project_pricing_items REPLICA IDENTITY FULL;
```

Then enable the tables in the Supabase Dashboard → Database → Replication → Tables.

---

### Phase 3 — Save Indicators (Loading States)
**Goal:** User always knows when a save is in-flight. Never a silent failure.  
**Risk:** Low. Pure UI changes.  
**Effort:** ~1 day

#### 3.1 — `HardwareSetModal` save indicator

**Section:** C  
**File:** [components/HardwareSetModal.tsx](components/HardwareSetModal.tsx)

Currently: No loading state. Save button does not indicate in-flight status.

```tsx
// Add isSaving state
const [isSaving, setIsSaving] = useState(false);

const handleSave = async () => {
  setIsSaving(true);
  try {
    await onSave(editedSet);
  } finally {
    setIsSaving(false);
  }
};

// Save button:
<button disabled={isSaving}>
  {isSaving ? <Spinner /> : 'Save'}
</button>
```

#### 3.2 — `EnhancedDoorEditModal` save indicator

**Section:** C  
**File:** [components/EnhancedDoorEditModal.tsx](components/EnhancedDoorEditModal.tsx)

Same pattern as above. The `onSave` prop is currently synchronous from the modal's perspective. It needs to become async and the modal needs to await it before closing.

#### 3.3 — Global save status bar

**Section:** C  
**File:** [views/ProjectView.tsx](views/ProjectView.tsx)

The `saveStatus` state (`'idle' | 'saving' | 'saved'`) already exists. A persistent status indicator (bottom bar or top-right badge) should show:

- `saving` → spinning icon + "Saving…"
- `saved` → checkmark + "Saved" (fades after 2s)
- error → warning icon + "Save failed — retry?"

The existing `setSaveStatus` logic needs a fourth state: `'error'`.

#### 3.4 — `DoorScheduleManager` upload progress

**Section:** B  
**File:** [components/DoorScheduleManager.tsx](components/DoorScheduleManager.tsx)

Already has skeleton rows for loading state (line 1844). Verify:
- [ ] Skeleton is shown during initial load
- [ ] Skeleton is shown during re-fetch after realtime event
- [ ] Upload button shows spinner during file processing

#### 3.5 — Project list loading state

**Section:** A  
**File:** [contexts/ProjectContext.tsx](contexts/ProjectContext.tsx) + project list view

`projectsHydrated` is set but the loading state is not always shown to the user. Add a skeleton card list while `!projectsHydrated`.

---

### Phase 4 — Resilience & Edge Cases
**Goal:** App handles network failures, stale state, and tab conflicts gracefully.  
**Risk:** Low-Medium.  
**Effort:** ~1–2 days

#### 4.1 — Retry failed auto-saves

**Section:** C  
**File:** [views/ProjectView.tsx](views/ProjectView.tsx)

If `saveToFinalJson()` throws, retry up to 3 times with exponential backoff before showing the error toast. This handles transient network blips.

```typescript
const saveWithRetry = async (fn: () => Promise<void>, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      await fn();
      return;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 500 * 2 ** i)); // 500ms, 1s, 2s
    }
  }
};
```

#### 4.2 — Conflict resolution for realtime updates

**Section:** C  
**File:** [hooks/useProjectRealtime.ts](hooks/useProjectRealtime.ts)

When a realtime event fires for `project_hardware_finals` while the user has unsaved local changes:

- **Strategy:** Show a toast "Another device updated this project. Reload to see changes?" with [Reload] / [Keep mine] buttons.
- Do NOT silently overwrite local unsaved state.

#### 4.3 — Persist `appSettings` to Supabase

**Section:** E  
**File:** [contexts/ProjectContext.tsx](contexts/ProjectContext.tsx)

API key handling is a separate security concern (see P0 constraints in CLAUDE.md), but model/provider preferences should be persisted to a `user_preferences` Supabase table so they survive device changes.

Note: The actual API key must NOT be stored in Supabase — it must move to a server-side env var or user-provided vault.

#### 4.4 — Replace PDF extraction polling with realtime

**Section:** D  
**File:** [views/ProjectView.tsx](views/ProjectView.tsx)

The current `isPollingForResult` loop polls every N seconds waiting for extraction to complete. With Phase 2.2 in place, delete the polling loop entirely and rely on the `hardware_pdf_extractions` subscription instead.

---

## Phase Summary & Priority

| Phase | Section(s) | Problem Solved | Priority | Effort |
|---|---|---|---|---|
| **1.1** — beforeunload guard | C | Data loss on refresh | P0 | 1h |
| **1.2** — shorter debounce + awaited save | C | Data loss race condition | P0 | 2h |
| **1.3** — verify initial load | C | Data not appearing on refresh | P0 | 2h |
| **1.4** — masterInventory to Supabase | E | Loss across devices | P1 | 4h |
| **2.1** — realtime hardware finals | C | Stale UI after save | P1 | 3h |
| **2.2** — realtime PDF extractions | D | PDF result not auto-shown | P1 | 2h |
| **2.3** — realtime projects list | A | Project list stale | P2 | 2h |
| **2.4** — enable realtime on tables | Infra | Prerequisite for all Phase 2 | P1 | 30m |
| **3.1** — HardwareSetModal spinner | C | Silent saves | P1 | 1h |
| **3.2** — DoorEditModal spinner | C | Silent saves | P1 | 1h |
| **3.3** — Global save status bar | C | User unaware of save state | P1 | 2h |
| **3.4** — DoorSchedule upload progress | B | Upload progress not clear | P2 | 1h |
| **3.5** — Project list skeleton | A | Layout shift on load | P2 | 1h |
| **4.1** — Retry failed saves | C | Silent data loss on network blip | P2 | 2h |
| **4.2** — Conflict resolution UI | C | Silent overwrite from other device | P2 | 3h |
| **4.3** — appSettings to Supabase | E | Settings lost across devices | P3 | 3h |
| **4.4** — Remove polling loop | D | Dead code after Phase 2.2 | P2 | 1h |

---

## Suggested Sprint Order

### Sprint 1 — Stop the Bleeding (Phase 1)
Do items 1.1, 1.2, 1.3 in order. These are the highest-impact, lowest-risk changes.  
**Outcome:** Data no longer disappears on refresh.

### Sprint 2 — Real-Time Infrastructure (Phase 2)
Do 2.4 first (enable realtime on tables in Supabase dashboard), then 2.1, 2.2, 2.3.  
**Outcome:** UI stays in sync across tabs/devices without any manual refresh.

### Sprint 3 — Loading States (Phase 3)
Do 3.1, 3.2, 3.3 together — they're in the same area (ProjectView + modals).  
**Outcome:** User always knows when a save is in-flight. No more silent failures.

### Sprint 4 — Resilience (Phase 4)
Do 4.1 and 4.2 together. Do 4.4 after Sprint 2 is validated.  
**Outcome:** App handles network failures gracefully and never silently loses data.

### Sprint 5 — Supabase Migration for Settings & Inventory (Phase 1.4 + 4.3)
These touch the Supabase schema and require a migration. Do last after the core save path is stable.  
**Outcome:** All user data is in Supabase. localStorage is only used for UI preferences (panel ratios, etc.).

---

## Files That Will Be Modified

| File | Phase | Change Type |
|---|---|---|
| [views/ProjectView.tsx](views/ProjectView.tsx) | 1.1, 1.2, 1.3, 3.3, 4.1, 4.4 | Logic + UI |
| [hooks/useProjectRealtime.ts](hooks/useProjectRealtime.ts) | 2.1, 2.2, 4.2 | New subscriptions |
| [components/HardwareSetModal.tsx](components/HardwareSetModal.tsx) | 3.1 | UI |
| [components/EnhancedDoorEditModal.tsx](components/EnhancedDoorEditModal.tsx) | 3.2 | UI |
| [contexts/ProjectContext.tsx](contexts/ProjectContext.tsx) | 1.4, 2.3, 3.5, 4.3 | Logic |
| [components/DoorScheduleManager.tsx](components/DoorScheduleManager.tsx) | 3.4 | UI |
| Supabase Dashboard | 2.4 | Infra config |
| New migration SQL | 1.4, 4.3 | Schema |

---

## What NOT To Do

- Do not add optimistic updates without a rollback strategy — silent failures are worse than a brief delay
- Do not increase the debounce window — 1000ms is already too long, not too short
- Do not subscribe to entire tables without a `project_id` filter — this will receive all users' changes
- Do not store API keys in Supabase (see CLAUDE.md P0 constraint)
- Do not add new localStorage keys — everything new goes through Supabase
