# Observability — Logging, Tracing, Error Tracking

## Current State

The application has no structured observability. When something goes wrong in production:

- `console.log` statements exist throughout the code, but they're unstructured (no log level, no request ID, no timestamp beyond what Vercel adds)
- There is no way to correlate logs from a single request across multiple function calls
- There is no error tracking service — errors in user sessions are invisible unless the user reports them
- There is no performance monitoring — you don't know which routes are slow or which AI calls are failing
- The AI extraction debug files (`debug-extractions/`) are written to disk, which doesn't exist persistently on Vercel (ephemeral filesystem)

---

## 1. Structured Logging

Replace `console.log` with a structured logger. Every log entry should be a JSON object with consistent fields so it can be queried in a log aggregator.

### Logger Setup

```typescript
// lib/logger.ts
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    service: 'planckoff-api',
    env: process.env.NODE_ENV,
  },
});

export default logger;

// Scoped logger for a specific module
export function moduleLogger(module: string) {
  return logger.child({ module });
}
```

### Log Entry Shape

Every log line should have:
```json
{
  "level": "info",
  "time": "2026-06-09T10:23:11.000Z",
  "service": "planckoff-api",
  "env": "production",
  "module": "hardwarePdfServiceV2",
  "requestId": "req_abc123",
  "projectId": "uuid-here",
  "msg": "Tier 1 extraction complete",
  "duration_ms": 8431,
  "setCount": 12
}
```

### Replacing console.log in Services

```typescript
// Before (services/hardwarePdfServiceV2.ts)
console.log(`[HW-PDF] Starting Tier 1 extraction for project ${projectId}`);
console.error(`[HW-PDF] Tier 1 failed, falling back to Tier 2:`, err);

// After
import { moduleLogger } from '@/lib/logger';
const log = moduleLogger('hardwarePdfServiceV2');

log.info({ projectId, fileSize }, 'Starting Tier 1 extraction');
log.warn({ projectId, error: err.message }, 'Tier 1 failed, falling back to Tier 2');
```

---

## 2. Request IDs

Every API request should carry a unique ID that propagates through all log entries for that request. This lets you find all logs from a single problematic request.

```typescript
// middleware.ts or a shared helper
import { nanoid } from 'nanoid';

export function withRequestId(handler: NextRequest) {
  const requestId = req.headers.get('x-request-id') ?? nanoid(12);
  // Attach to AsyncLocalStorage so all downstream logs can read it
  return requestIdContext.run(requestId, () => handler(req));
}
```

```typescript
// lib/requestContext.ts
import { AsyncLocalStorage } from 'async_hooks';

const store = new AsyncLocalStorage<{ requestId: string; userId?: string }>();

export const requestContext = {
  run: store.run.bind(store),
  get: () => store.getStore(),
};

// In logger:
const context = requestContext.get();
log.info({ requestId: context?.requestId, userId: context?.userId, ...fields }, msg);
```

---

## 3. Error Tracking (Sentry)

Sentry captures unhandled exceptions and surfaces them in a dashboard with:
- Stack trace
- User context (who was affected)
- Breadcrumbs (what the user did before the error)
- Request context (URL, headers, body)
- Frequency (is this happening once or 100 times?)

```bash
npm install @sentry/nextjs
```

```typescript
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,      // 10% of requests traced (adjust as volume grows)
  beforeSend(event, hint) {
    // Strip sensitive data from error events
    if (event.request?.cookies) delete event.request.cookies;
    if (event.request?.headers?.['cookie']) delete event.request.headers['cookie'];
    return event;
  },
});
```

**What to tag in errors:**
```typescript
Sentry.setUser({ id: user.id, role: user.role });
Sentry.setTag('projectId', projectId);
Sentry.setContext('pdfProcessing', {
  tier: 'Tier2',
  fileSize: fileSize,
  batchIndex: i,
});
```

Sentry free tier covers 5,000 errors/month — sufficient for early scale.

---

## 4. AI Call Monitoring

Every call to the Gemini API (via OpenRouter) should be logged with:
- Input token count
- Output token count
- Duration
- Model used
- Tier (Tier1 vs Tier2 batch N)
- Success/failure
- Cost (approximate, from token counts)

This is essential because AI API costs can spike unexpectedly, and you need to know which operations are expensive.

```typescript
// lib/ai/monitoredCall.ts
interface AiCallResult<T> {
  result: T;
  usage: { inputTokens: number; outputTokens: number };
  duration_ms: number;
  model: string;
}

export async function monitoredAiCall<T>(
  label: string,
  projectId: string,
  callFn: () => Promise<AiCallResult<T>>
): Promise<T> {
  const start = Date.now();
  log.info({ label, projectId }, 'AI call starting');
  
  try {
    const { result, usage, duration_ms, model } = await callFn();
    
    log.info({
      label,
      projectId,
      model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      estimatedCostUsd: estimateCost(model, usage),
      duration_ms,
    }, 'AI call complete');
    
    return result;
  } catch (err) {
    log.error({ label, projectId, error: (err as Error).message, duration_ms: Date.now() - start }, 'AI call failed');
    throw err;
  }
}
```

---

## 5. Debug Extractions — Fix the Ephemeral Filesystem Problem

Currently, debug files are written to `debug-extractions/` on disk:

```typescript
// services/hardwarePdfServiceV2.ts
fs.writeFileSync(`debug-extractions/${projectId}_raw.txt`, rawResponse);
```

**This does not work on Vercel.** The filesystem is ephemeral and read-only except for `/tmp`. Debug files written here are lost when the function ends.

**Fix options:**

**Option A — Upload to Supabase Storage (best for searchable debug data)**
```typescript
async function saveDebugArtifact(projectId: string, label: string, content: string) {
  if (process.env.NODE_ENV !== 'production') return; // local only in dev
  const path = `debug/${projectId}/${Date.now()}_${label}`;
  await supabaseAdmin.storage.from('debug-artifacts').upload(path, content);
}
```

**Option B — Log as structured JSON (simplest)**
```typescript
log.debug({
  projectId,
  label: 'tier1_raw_response',
  response: rawResponse.slice(0, 10000), // truncate if huge
}, 'AI extraction debug output');
```

**Recommendation:** Option B in production (structured logs → log aggregator). Option A in staging where you need to inspect full responses.

---

## 6. Performance Monitoring

Track response times for the routes that users actually wait on:

| Route | P50 target | P99 alert threshold |
|-------|-----------|---------------------|
| `GET /api/projects` | < 200ms | > 1s |
| `GET /api/projects/[id]` | < 300ms | > 1s |
| `POST /api/projects/[id]/process` | N/A (async) | Job queue length > 10 |
| `GET /api/master-hardware` | < 400ms | > 2s |

With Sentry's performance monitoring or Vercel Analytics, you get this for free with minimal setup.

---

## 7. Recommended Log Levels

Codify what each level means in this codebase:

| Level | When to use |
|-------|------------|
| `error` | Unhandled exception; operation failed and cannot recover; data may be corrupted |
| `warn` | Tier 1 fell back to Tier 2; door has no matching hardware set; stale lock detected |
| `info` | Request received; processing phase started/completed; job enqueued/completed |
| `debug` | Per-batch AI call details; per-row matching decisions; cache hit/miss |
| `trace` | Individual token counts; row-by-row parsing details (dev only, never production) |

Set `LOG_LEVEL=info` in production. `LOG_LEVEL=debug` in staging. Never `trace` in production.

---

## 8. Alerting

Once logs and errors are in an aggregator (Sentry + Datadog / Logtail / Axiom), set up alerts:

- **Error rate > 1% of requests** → Slack alert (critical)
- **AI call failure rate > 10%** → Slack alert (OpenRouter may be down)
- **Processing job queue depth > 20** → Slack alert (worker can't keep up)
- **Response time P99 > 3s on dashboard routes** → Slack alert (DB slow)
- **Any 500 on /api/auth/login** → immediate alert (possible attack)

---

## Recommended Tool Stack

| Purpose | Tool | Cost |
|---------|------|------|
| Structured logging | Pino | Free (npm) |
| Log aggregation | Axiom or Logtail | Free tier available |
| Error tracking | Sentry | Free up to 5k errors/mo |
| Performance monitoring | Sentry Performance or Vercel Analytics | Free tier |
| Uptime monitoring | Better Uptime or UptimeRobot | Free tier |
