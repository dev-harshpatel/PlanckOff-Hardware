# Phase 13: Implement Caching - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a Redis caching layer at each of the 3 core data-source fetch points (door schedule per-project, master hardware catalog, projects list) so all downstream derived/merged data is served from cache on repeat fetches. Cache is always consistent: every write path immediately invalidates the relevant cache key. Caching is server-side only — Redis client is never exposed to the browser.

This phase does NOT include: client-side stale-while-revalidate patterns, caching of derived/computed data (pricing calculations, hardware merges), or caching of auth/session data.

</domain>

<decisions>
## Implementation Decisions

### Redis Provider

- **D-01:** Use **Upstash Redis** — managed serverless Redis with a REST API. Package: `@upstash/redis`.
- **D-02:** Environment variables: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (standard Upstash env var names). These must be added to `.env.local` and production environment.
- **D-03:** No persistent TCP connection needed — `@upstash/redis` uses HTTP/REST, which is safe for Next.js API routes (serverless/edge-compatible).

### Cache Layer Location

- **D-04:** Create a new `lib/cache/` directory with one wrapper file per data source:
  - `lib/cache/doorSchedule.ts` — exports `getCachedDoorSchedule(projectId)` and `invalidateDoorSchedule(projectId)`
  - `lib/cache/masterHardware.ts` — exports `getCachedMasterHardware()` and `invalidateMasterHardware()`
  - `lib/cache/projects.ts` — exports `getCachedProjects()` and `invalidateProjects()`
  - `lib/cache/redis.ts` — shared Redis client singleton (initialized once from env vars)
- **D-05:** API route handlers call the `lib/cache/*` wrappers instead of `lib/db/*` directly for read paths. Write paths call `lib/db/*` first (existing behavior), then call the corresponding `invalidate*` function.
- **D-06:** `lib/db/*.ts` functions remain unchanged — they stay as pure Supabase repository functions. Cache logic does not enter the db layer.
- **D-07:** Redis client must only be instantiated server-side. Import guard: `lib/cache/redis.ts` must not be imported from any client component or context provider.

### Invalidation Strategy

- **D-08:** Primary invalidation mechanism is **delete-on-write**: when any write operation (POST/PUT/DELETE) for a given source succeeds, immediately call the corresponding `invalidate*` function before returning the response.
- **D-09:** TTL values (safety-net fallback, not primary consistency mechanism):
  - Door Schedule (`door-schedule:{projectId}`): **5 minutes** — per-project; small blast radius
  - Master Hardware (`master-hardware:all`): **60 minutes** — global catalog; almost never written
  - Projects list (`projects:all`): **30 minutes** — global; written on create/delete/restore
- **D-10:** Write operations that must trigger invalidation:
  - Door Schedule: `POST /api/projects/[id]/door-schedule` (Excel upload)
  - Master Hardware: `POST /api/master-hardware`, `PUT /api/master-hardware/[id]`, `DELETE /api/master-hardware/[id]`
  - Projects: `POST /api/projects`, `DELETE /api/projects/[id]` (includes soft delete + restore + hard delete)

### Cache Key Design

- **D-11:** Colon-namespaced Redis keys — industry-standard Redis convention:
  - `door-schedule:{projectId}` (e.g., `door-schedule:abc123`)
  - `master-hardware:all`
  - `projects:all`
- **D-12:** No app-level prefix needed — this Redis instance is dedicated to this application (no multi-tenant key collision risk).

### Claude's Discretion

- Error handling in cache wrappers: if Redis is unavailable (connection error, timeout), fall through to Supabase and log the error — never let a Redis failure break the API response. Claude can decide the exact error-handling pattern.
- Whether to cache the raw Supabase response or the parsed/transformed data: Claude can decide based on what's most practical at each API route.
- Redis client initialization pattern (singleton vs lazy init): Claude's discretion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core Data Source Entry Points
- `app/api/projects/[id]/door-schedule/route.ts` — GET (read) and POST (write) for door schedule; GET is the cache target; POST triggers invalidation
- `app/api/master-hardware/route.ts` — GET (read full catalog) and POST (create); GET is cache target; POST triggers invalidation
- `app/api/master-hardware/[id]/route.ts` — PUT and DELETE on individual items; both trigger invalidation
- `app/api/projects/route.ts` — GET (read all projects) and POST (create); GET is cache target; POST triggers invalidation
- `app/api/projects/[id]/route.ts` — DELETE (soft delete, hard delete, restore); all trigger projects invalidation

### Repository Layer (db functions being wrapped)
- `lib/db/hardware.ts` — `getDoorScheduleImport(projectId)` is the function to wrap for door schedule reads
- `lib/db/masterHardware.ts` — `getMasterHardwareItems()` is the function to wrap for master hardware reads
- `lib/db/projects.ts` — `getAllProjects()` is the function to wrap for projects list reads

### Architecture Reference
- `.planning/codebase/ARCHITECTURE.md` — Layered architecture overview; confirms `lib/db/` is server-only, `lib/cache/` must follow same constraint

### No external specs — requirements fully captured in decisions above

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/auth/api-helpers.ts` — `withAuth()` / `withRoleAuth()` HOFs wrap all API routes; cache wrapper calls happen inside these HOFs (after auth passes)
- `lib/supabase/admin.ts` — server-only Supabase admin client; `lib/cache/redis.ts` must follow the same server-only constraint

### Established Patterns
- **Repository pattern:** All Supabase queries in `lib/db/*.ts` — cache wrappers follow the same naming convention (`lib/cache/*.ts`)
- **HOF wrapping:** API routes use `withAuth(handler)` — cache logic goes inside the handler body, not in a new HOF
- **Server-only imports:** `lib/db/` is never imported from client — `lib/cache/` must follow the same rule
- **No persistent connections in API routes:** The existing codebase uses HTTP-based Supabase admin client — `@upstash/redis` (REST-based) matches this pattern perfectly

### Integration Points
- **Read path:** Each of the 3 GET handlers calls `lib/db/*` today → will call `lib/cache/*` instead
- **Write path:** Each write handler currently only calls `lib/db/*` → will additionally call `invalidate*` from `lib/cache/*` after a successful write
- **No changes needed to:** contexts, hooks, views, components — they call API routes via fetch(), which is unchanged

</code_context>

<specifics>
## Specific Ideas

- The Mermaid diagram discussed during planning shows the cache-aside pattern clearly: user → API → Redis check → (hit) instant return | (miss) Supabase → store in Redis → return. Write path: API → Supabase save → delete Redis key.
- The developer explicitly wants the cache to be server-side only with no Redis client exposure to the browser.
- Acceptance criteria from the ticket require: (1) noticeable speed improvement on repeat visits, (2) write operations correctly invalidate cache, (3) no stale data after writes, (4) namespaced keys with no collisions.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 13-implement-caching*
*Context gathered: 2026-05-15*
