# Scalability — Caching, Polling, Connection Pooling, Search

## Current State

The application works well for a small team. These are the specific patterns that will degrade as user count grows:

1. Every page load queries Supabase directly (some with caching, many without)
2. `useProjectData` polls every 3 seconds regardless of whether anything changed
3. Supabase Realtime subscriptions are created per-component (N components = N connections)
4. Master hardware search uses `ILIKE` on unindexed columns
5. The Supabase connection pool is shared across all Vercel function invocations with no configuration
6. AI extraction results are never cached (same PDF uploaded twice = two full AI runs)

---

## 1. Fix the 3-Second Polling Loop

**File:** `hooks/useProjectData.ts`

Every project page runs a `setInterval` that hits the database every 3 seconds to check for changes. For 20 concurrent users, that's 400 database queries per minute for data that rarely changes.

**Why it exists:** To catch changes made by other team members (e.g., another estimator edits a door).

**The right fix:** Supabase Realtime is already set up in `useProjectRealtime.ts`. Use it as the primary update mechanism and remove the polling:

```typescript
// Current (bad)
useEffect(() => {
  const interval = setInterval(() => fetchProjectData(), 3000);
  return () => clearInterval(interval);
}, []);

// Better — Realtime handles updates; only fetch on mount
useEffect(() => {
  fetchProjectData();  // initial load only
}, []);
// useProjectRealtime already subscribes and updates context on changes
```

If Realtime is unreliable in some edge cases, replace polling with exponential backoff reconnection — not a fixed interval:

```typescript
// Reconnect with backoff if Realtime drops
function reconnectWithBackoff(attempt: number) {
  const delay = Math.min(1000 * 2 ** attempt, 30000); // cap at 30s
  setTimeout(() => subscribeToRealtime(), delay);
}
```

---

## 2. Share Supabase Realtime Subscriptions

**Files:** `hooks/useProjectRealtime.ts`, `contexts/ProjectContext.tsx`

Currently, each component that calls `useProjectRealtime()` creates its own Supabase channel subscription. If 10 components on a project page all call this hook, there are 10 WebSocket subscriptions to the same tables.

**Fix:** Move the single subscription into `ProjectContext` (which already wraps the whole project page). All components consume from context — one subscription per user session.

```typescript
// contexts/ProjectContext.tsx — move realtime here
useEffect(() => {
  const channel = supabase
    .channel(`project-${projectId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'project_hardware_finals',
        filter: `project_id=eq.${projectId}` }, handleHardwareChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'door_schedule_imports',
        filter: `project_id=eq.${projectId}` }, handleScheduleChange)
    .subscribe();
  
  return () => { supabase.removeChannel(channel); };
}, [projectId]);
```

Components don't subscribe at all — they just read from context. One channel per project page per user.

---

## 3. Cache AI Extraction Results

If the same PDF is uploaded twice (re-upload after an edit, or two users uploading the same file), the system runs a full Tier 1 or Tier 2 extraction both times. This costs money and time.

**Fix:** Hash the file content before extraction. If the hash matches a previously processed file for the same project, return the cached result.

```typescript
// In hardwarePdfServiceV2.ts
import { createHash } from 'crypto';

function hashFile(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function extractHardwareSetsFromPdf(
  buffer: Buffer,
  fileName: string,
  projectId: string
) {
  const fileHash = hashFile(buffer);
  
  // Check if we've seen this exact file before
  const cached = await getCachedExtraction(projectId, fileHash);
  if (cached) {
    log.info({ projectId, fileHash }, 'Returning cached extraction result');
    return cached;
  }
  
  // Run extraction
  const result = await runTier1OrTier2(buffer, fileName, projectId);
  
  // Cache result keyed by file hash
  await cacheExtraction(projectId, fileHash, result);
  
  return result;
}
```

The cache can live in the `hardware_pdf_extractions` table — just add a `file_hash` column:

```sql
ALTER TABLE hardware_pdf_extractions ADD COLUMN file_hash text;
CREATE INDEX idx_hardware_extractions_hash ON hardware_pdf_extractions (project_id, file_hash);
```

---

## 4. Master Hardware Search — Full-Text Search

**File:** `lib/db/masterHardware.ts`

Current search:
```typescript
query = query.or(`name.ilike.%${search}%,manufacturer.ilike.%${search}%,description.ilike.%${search}%`);
```

`ILIKE` with a leading wildcard (`%term%`) cannot use a B-tree index. It scans the entire table. For 10,000+ master hardware items, this is a full table scan on every keystroke.

**Fix Option A — PostgreSQL Full-Text Search (no extra infra)**

```sql
-- Add a generated tsvector column
ALTER TABLE master_hardware 
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', 
      COALESCE(name, '') || ' ' || 
      COALESCE(manufacturer, '') || ' ' || 
      COALESCE(description, '')
    )
  ) STORED;

CREATE INDEX idx_master_hardware_search ON master_hardware USING GIN (search_vector);
```

```typescript
// Query using full-text search
query = query.textSearch('search_vector', search.split(' ').join(' & '));
```

**Fix Option B — Typesense or Meilisearch (dedicated search)**

More powerful (typo-tolerance, ranking, facets) but requires a dedicated search service. Overkill until master hardware catalog exceeds 50,000 items.

**Recommendation:** Option A (PostgreSQL FTS) now, Option B later.

---

## 5. Supabase Connection Pooling

Vercel functions are stateless — each invocation creates a new Supabase client. For high traffic, this means many short-lived connections to PostgreSQL, which has a limited connection count (Supabase free tier: 60 connections; Pro tier: 200).

**Fix:** Use Supabase's PgBouncer (transaction pooling) endpoint instead of the direct connection string.

```typescript
// lib/supabase/admin.ts
// Change the connection to go through PgBouncer
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: {
      schema: 'public',
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    // Use pooled connection for serverless
    global: {
      headers: { 'x-supabase-pool-mode': 'transaction' },
    },
  }
);
```

In Supabase dashboard: use the "Session pooler" or "Transaction pooler" connection string (port 5432 pooled vs direct). This is a configuration change, not a code change.

---

## 6. Next.js Cache Improvements

**Current:** `unstable_cache` with 30-minute TTL, tag-based invalidation. This only works in production (not in dev), which makes bugs in caching logic invisible during development.

**Issues:**

- Cache is global — all users share the same cached project list. A client user querying projects gets the admin's cached result, which is then filtered in JavaScript. This works but is wasteful (fetch all, filter to assigned).
- Realtime updates (Supabase Realtime subscriptions) do not invalidate the Next.js data cache. A realtime update triggers a re-render in the browser but the next SSR request still returns the stale cached data.
- `unstable_cache` is literally marked unstable — it may change without notice.

**Fix:**

For project lists: cache per-role, not globally:
```typescript
export const getCachedProjectsForRole = (role: string) =>
  unstable_cache(
    async () => getProjectsForRole(role),
    [`projects-${role}`],
    { tags: [`projects`, `projects-${role}`], revalidate: 300 }
  );
```

For Realtime → cache sync: on every Realtime event that modifies a project, call `revalidateTag('projects')` from a server action or API route. This keeps SSR cache fresh.

---

## 7. Soft Delete Accumulation

As noted in `04-database.md`, soft-deleted records accumulate forever. At scale:
- `getAllProjects()` queries `deleted_at IS NULL` — a filter, but if 90% of rows are soft-deleted, the table scan is slow
- Master hardware approval queue may have thousands of stale pending items

Add the auto-purge cron job described in `04-database.md` (migration 026). Until then, add an index on `deleted_at` to speed up the filter:

```sql
CREATE INDEX idx_projects_not_deleted ON projects (id) WHERE deleted_at IS NULL;
```

---

## 8. Client-Side Bundle Size

The project uses several large libraries:

| Library | Size | Loaded where |
|---------|------|-------------|
| `jsPDF` + `jsPDF-autotable` | ~500 KB | Every page (via import) |
| `ExcelJS` | ~800 KB | Every page |
| `pdfjs-dist` | ~3 MB | Every page |
| `xlsx` / `xlsx-js-style` | ~600 KB | Every page |

These are server-only (used in API routes), but if any import chain pulls them into the client bundle, every user downloads 5+ MB of PDF/Excel libraries on first load.

**Verify:** Run `next build` and look at the `.next/analyze` output (add `ANALYZE=true` with `@next/bundle-analyzer`). If any of these appear in client chunks, fix the import chain.

**Already mitigated (check these are working):**
- `next.config.ts` has `serverExternalPackages: ['jspdf', 'xlsx', 'pdfjs-dist', '@napi-rs/canvas']`
- Dynamic imports with `ssr: false` in components that use these libraries

---

## 9. API Route Cold Starts (Vercel)

Vercel functions have cold start latency (~300–800ms) when no request has hit them recently. For interactive user actions (clicking through the dashboard), this is noticeable.

**Mitigation strategies:**

- **Vercel Fluid Compute** (if on Pro plan): keeps function warm in background
- **Route grouping**: Combine related small routes into fewer, larger route handlers (reduces cold start surface)
- **Edge Runtime** for lightweight auth-check routes: Edge has no cold start, but lacks Node.js APIs — only works for routes that don't use `fs`, `crypto`, or native modules

---

## Summary: Impact vs Effort

| Change | User Impact | Effort | Priority |
|--------|------------|--------|---------|
| Replace polling with Realtime | High (reduces DB load 90%) | Low | High |
| Share Realtime subscriptions | Medium (fewer WS connections) | Low | High |
| Cache AI extraction by file hash | High (eliminates duplicate AI costs) | Medium | High |
| Master hardware FTS | Medium (faster search) | Low | Medium |
| Supabase connection pooling | High (prevents connection exhaustion) | Low (config) | Medium |
| Per-role project cache | Low (optimization) | Medium | Low |
| Bundle size audit | High if there's a problem | Low (verify only) | Medium |
