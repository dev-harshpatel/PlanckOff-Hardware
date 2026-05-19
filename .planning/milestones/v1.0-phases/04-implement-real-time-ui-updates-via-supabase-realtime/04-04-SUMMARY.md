---
plan: 04-04
phase: 04-implement-real-time-ui-updates-via-supabase-realtime
status: complete
completed: 2026-05-09
---

## Summary

Updated `lib/db/pricing.ts`, `app/api/projects/[id]/pricing/route.ts`, and `app/api/projects/[id]/pricing-proposal/route.ts` so PUT routes return the saved `updated_at` value in the response body — enabling the dedup Set in Plan 04-03 to key on `{table}:{id}:{updated_at}` for self-event filtering.

## Key Changes

- `upsertPricingItem` return type: `DbResult<boolean>` → `DbResult<{ id: string; updated_at: string }>` (chains `.select('id, updated_at').single()`)
- `upsertProposalProfit` return type: `DbResult<boolean>` → `DbResult<{ project_id: string; updated_at: string }>` (chains `.select('project_id, updated_at').single()`)
- PUT `/pricing` response: `{ data: { ok: true } }` → `{ data: { id, updated_at, category, group_key, unit_price } }`
- PUT `/pricing-proposal` response: `{ data: { ok: true } }` → `{ data: { project_id, updated_at } }`
- Added `if (!data)` guard returning 500 in both route handlers

## Commits

- `9f8e293`: feat(04-04): return updated_at from pricing PUT routes and db helpers

## Self-Check: PASSED

- All 3 files modified as specified
- Both db helpers return saved row data with updated_at
- Both PUT routes echo updated_at in response body
- Guards prevent null data from propagating
