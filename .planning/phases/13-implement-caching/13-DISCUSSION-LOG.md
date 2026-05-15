# Phase 13: Implement Caching - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 13-implement-caching
**Areas discussed:** Redis provider choice, Cache layer location, Invalidation strategy per source, Cache key design & namespacing

---

## Redis Provider Choice

| Option | Description | Selected |
|--------|-------------|----------|
| Upstash Redis | Managed Redis, serverless-native, REST API, @upstash/redis package, free tier | ✓ |
| Vercel KV | Only if deployed on Vercel — 1-click setup | |
| Self-hosted (Railway / fly.io) | User-managed Redis; ioredis package; cheaper at scale | |

**User's choice:** Upstash Redis
**Notes:** App has no existing Redis client. Upstash is the pragmatic winner for serverless Next.js — zero infra to manage, free tier covers dev and light usage, @upstash/redis uses REST (HTTP) which is safe for serverless/edge environments.

---

## Cache Layer Location

| Option | Description | Selected |
|--------|-------------|----------|
| New lib/cache/ wrapper layer | 3 wrapper files with getCached* and invalidate* exports; API routes call these | ✓ |
| Inside API route handlers | Cache check + write in each route.ts file; scattered across files | |
| Inside lib/db/*.ts functions | Cache transparent to API routes; blurs repository layer with infra concerns | |

**User's choice:** New lib/cache/ wrapper layer
**Notes:** Keeps db layer pure, makes cache logic findable in one place, API routes stay clean.

---

## Invalidation Strategy Per Source

| Option | Description | Selected |
|--------|-------------|----------|
| Short safety net: 5 min / 30 min / 60 min | Delete-on-write primary; TTLs as failsafe | ✓ |
| Long-lived: 30 min / 24 hr / 2 hr | Aggressive caching; safe only if delete-on-write is 100% reliable | |
| You decide | Claude picks TTLs | |

**User's choice:** Short safety net (5 min door schedule, 60 min master hardware, 30 min projects)
**Notes:** Delete-on-write is the primary consistency mechanism. TTLs are a safety net for missed invalidations, not the primary consistency strategy. This satisfies the acceptance criterion "no stale data after a write."

---

## Cache Key Design & Namespacing

| Option | Description | Selected |
|--------|-------------|----------|
| Colon-namespaced | door-schedule:{projectId} \| master-hardware:all \| projects:all | ✓ |
| Slash-namespaced | door-schedule/{projectId} \| master-hardware/all \| projects/all | |
| Flat with app prefix | planckoff:ds:{projectId} \| planckoff:mhw:all \| planckoff:proj:all | |

**User's choice:** Colon-namespaced
**Notes:** Industry-standard Redis key convention. No app-level prefix needed — this Redis instance is dedicated to this app.

---

## Claude's Discretion

- Redis client initialization pattern (singleton vs lazy init)
- Error handling strategy when Redis is unavailable (fail-open vs fail-closed) — user preference implied: fail-open (fall through to Supabase, log error)
- Whether to cache raw Supabase response or transformed data

## Deferred Ideas

None.
