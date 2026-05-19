---
status: complete
phase: 04-implement-real-time-ui-updates-via-supabase-realtime
source: [04-01-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md, 04-06-SUMMARY.md, 04-07-SUMMARY.md, 04-08-SUMMARY.md]
started: 2026-05-13T00:00:00Z
updated: 2026-05-13T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Migration 019 Applied to Supabase
expected: |
  In the Supabase SQL editor, run:
    SELECT tablename FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    ORDER BY tablename;
  All 5 tables appear: door_schedule_imports, project_hardware_finals,
  project_pricing_items, project_pricing_proposal, projects.
  (project_pricing_items, project_pricing_proposal, and projects were added by migration 019)
result: skipped
reason: Will verify when Supabase access is available

### 2. Multi-tab Door Update (RT-01, RT-02)
expected: |
  Open the same project in two browser tabs (Tab A and Tab B).
  In Tab A, edit a door tag (e.g. D-01 → D-01X).
  Without refreshing Tab B, the door tag updates there within 1–2 seconds.
result: pass

### 3. Multi-tab Pricing Items Update (RT-01, RT-02)
expected: |
  With both tabs on the Pricing Report page, set a door group unit price to 100 in Tab A.
  Wait ~1s for the 600ms debounce + network round-trip.
  Tab B's price input shows 100 within 1–2 seconds — no manual refresh needed.
result: pass

### 4. Multi-tab Pricing Proposal Update (RT-01, RT-02)
expected: |
  In Tab A, set door profit % to 25 on the Pricing Report (Proposal tab).
  Wait ~1s for the 800ms debounce + network.
  Tab B (Proposal tab) shows 25 within 1–2 seconds.
result: pass

### 5. Multi-tab Project Metadata Update (RT-01, RT-02)
expected: |
  In Tab A, edit a project metadata field (e.g. due date or project name) and save.
  Tab B's project header reflects the new value within 1–2 seconds — no reload.
result: pass

### 6. Self-event Dedup — No Echo Flicker (RT-07)
expected: |
  In a single tab, open DevTools → Network → filter "realtime".
  Edit a door tag and watch the UI.
  The UI updates exactly once (no flicker, no momentary revert).
  The Realtime echo arrives in the Network panel but the UI does NOT visibly re-render,
  confirming isOwnWrite() skipped the echo.
result: pass

### 7. No Stale Subscriptions on Navigation (RT-04)
expected: |
  Open DevTools → Network → filter "wss".
  Navigate away from the project page (e.g. to project list), then back. Repeat 5 times.
  The active wss:// connection count stays at 1 at all times — no leaked connections.
result: pass

### 8. Network Reconnect Recovery (RT-06)
expected: |
  With a project open in Tab A, block the Supabase WebSocket in DevTools
  (right-click the wss:// connection → "Block request URL", or use the Network offline toggle).
  In a second tab, make a change (edit a door tag).
  Unblock Tab A's WebSocket.
  Tab A's channel transitions CLOSED → SUBSCRIBED, onFullReload fires,
  and the door edit made during the offline window appears — no manual page refresh needed.
result: pass

### 9. No Stale-Cache Override (RT-05)
expected: |
  In Tab A, make any Realtime-triggering edit (e.g. change a unit price).
  Tab B shows the update within 1–2s.
  Now reload Tab B completely (F5).
  Tab B still shows the edited value after reload — no reversion to stale cached data.
result: pass

### 10. Optimistic Rollback (RT-03)
expected: |
  Note: useOptimisticDoorWrite is implemented but no call site has adopted it yet
  (confirmed in 04-07-SUMMARY.md — adoption is opt-in for future PRs).
  Skip this test (mark N/A) unless a door-edit or hardware-edit call site
  has since adopted the hook.
result: skipped
reason: No call site has adopted useOptimisticDoorWrite yet — opt-in for future PRs per 04-07-SUMMARY.md

## Summary

total: 10
passed: 8
issues: 0
pending: 0
skipped: 2
blocked: 0

## Gaps

