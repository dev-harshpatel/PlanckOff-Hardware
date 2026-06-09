# Architecture — Backend Extraction & Service Separation

## The Honest Assessment

"Microservices" is often implemented too early. True microservices — independent services with their own databases, teams, and deployment pipelines — make sense at 500+ concurrent users or when you have 5+ developers working on separate domains at the same time. You are not there yet.

What this project actually needs, in priority order:

1. **Extract the API server** from Next.js to a standalone Node.js/TypeScript process (Hono)
2. **Make PDF processing async** with a job queue (BullMQ) — same codebase, separate process
3. **Deploy the PDF worker separately** when it needs independent scaling
4. **Consider extracting the export service** when report generation becomes slow at scale

Each stage is a natural extension of the previous one. The codebase structure you build in Stage 1 makes Stages 2–4 straightforward — you don't rewrite anything, you just move files into the right place and change deployment config.

---

## Progression Map

```
Stage 0 — Now
  Single Next.js monolith on Vercel
  Frontend, API routes, services, DB queries all together
  Works fine for < 20 concurrent users

Stage 1 — Do next (highest priority)
  Monorepo: apps/web + apps/api + packages/shared
  Next.js frontend on Vercel (thin shell, no business logic)
  Hono API server on Railway (all current app/api/* routes)
  PDF processing still synchronous inside the API server

Stage 2 — At ~50 concurrent users (or when uploads start timing out)
  Add BullMQ + Redis inside apps/api
  PDF processing becomes async: enqueue → return jobId → worker picks up
  Same codebase — pdf-worker is just a process started alongside the API server
  No new deployment unit yet

Stage 3 — At ~100–200 concurrent users
  Extract apps/pdf-worker to its own deployed container on Railway
  Now 3 deployed units: Vercel (web), Railway (api), Railway (pdf-worker)
  This is the first true service boundary with a clean interface (job queue)

Stage 4 — At ~500+ concurrent users (or when exports slow down)
  Extract export service (PDF reports, Excel) using same BullMQ pattern
  Possibly add AI gateway package for centralized rate limiting and cost tracking
```

**The key insight about Stage 2 and Stage 3:** the PDF worker code is written once. In Stage 2 it runs as a `node src/worker.ts` process on the same server as the API. In Stage 3, you move it to its own container by changing one Railway config. Same code. No rewrite.

---

## Current State (What Needs to Change)

```
User Browser
    │
    ▼
Vercel Functions (stateless, max 300s)
    │
    ├── app/(pages)/*     React pages + SSR
    ├── app/api/*          API routes ← business logic is here, should not be
    ├── services/*         Business logic (PDF, merge, pricing, export...)
    ├── lib/db/*           Database queries
    └── lib/ai/*           PDF text extraction (pdfjs)
```

**Problems with this:**
- Vercel functions are stateless and cold-start — no persistent connections, no in-memory state
- One 300s PDF processing job blocks one Vercel worker for all other users' requests
- You can't scale AI/PDF work independently from web serving
- 3008 MB memory limit is shared between web serving and AI processing
- Vercel function cold starts (~300–800ms) affect all API calls, including trivial ones

---

## Target Architecture — Stage 1

```
┌─────────────────────────────────────────────────┐
│  apps/web — Next.js (Vercel)                    │
│  React pages, layouts, components, hooks        │
│  No business logic — only UI + API client calls │
│  Talks to apps/api via fetch (NEXT_PUBLIC_API_URL)│
└─────────────────────┬───────────────────────────┘
                      │ REST (JSON over HTTP)
┌─────────────────────▼───────────────────────────┐
│  apps/api — Hono on Node.js (Railway)            │
│  All current app/api/* routes, migrated          │
│  services/, lib/db/, lib/auth/ live here         │
│  Persistent process — connection pools, caches   │
│  No Vercel timeout limit — runs as long as needed│
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│  Supabase — PostgreSQL + Storage + Realtime      │
│  Unchanged — already external                    │
└─────────────────────────────────────────────────┘
```

---

## Technology Choice: Hono (not Express)

| | Express | Hono |
|---|---|---|
| TypeScript | Bolt-on (`@types/express`) | Native, first-class |
| API style | `req, res` callbacks | `c.req, c.json()` — cleaner |
| Speed | Baseline | ~3–5x faster (measured benchmarks) |
| Bundle size | ~57 KB | ~14 KB |
| Built-in validation | None — need express-validator | `@hono/zod-validator` |
| OpenAPI/docs | Manual setup | `@hono/swagger-ui` built-in |
| Deployment targets | Node.js only | Node, Vercel Edge, Cloudflare Workers, Bun |

Hono route handlers look almost identical to Next.js route handlers, so the migration is mechanical, not a rewrite:

```typescript
// Current — Next.js app/api/projects/route.ts
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  const projects = await getAllProjects();
  return NextResponse.json({ data: projects });
}

// Hono equivalent — apps/api/src/routes/projects.ts
app.get('/', async (c) => {
  const user = c.get('user');      // set by auth middleware
  const projects = await getAllProjects();
  return c.json({ data: projects });
});
```

The service calls inside don't change at all.

---

## Monorepo Structure — pnpm Workspaces + Turborepo

```
planckoff/                           ← monorepo root
├── apps/
│   ├── web/                         ← current Next.js, stripped of app/api/*
│   │   ├── app/                     ← pages, layouts
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── contexts/
│   │   ├── views/
│   │   └── package.json
│   │
│   ├── api/                         ← NEW — Hono API server
│   │   ├── src/
│   │   │   ├── routes/              ← one file per domain
│   │   │   │   ├── auth.ts          ← from app/api/auth/*
│   │   │   │   ├── projects.ts      ← from app/api/projects/route.ts
│   │   │   │   ├── hardware.ts      ← from app/api/projects/[id]/hardware-pdf/*
│   │   │   │   ├── process.ts       ← from app/api/projects/[id]/process/*
│   │   │   │   ├── pricing.ts       ← from app/api/projects/[id]/pricing/*
│   │   │   │   ├── team.ts          ← from app/api/team/*
│   │   │   │   ├── masterHardware.ts← from app/api/master-hardware/*
│   │   │   │   └── settings.ts      ← from app/api/settings/*
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts          ← withAuth, withRoleAuth, withProjectAuth
│   │   │   │   └── rateLimit.ts
│   │   │   ├── services/            ← moved from /services
│   │   │   ├── index.ts             ← Hono app entry, route registration
│   │   │   └── server.ts            ← node http.createServer wrapper
│   │   └── package.json
│   │
│   └── pdf-worker/                  ← Stage 2/3 — separate worker process
│       ├── src/
│       │   ├── worker.ts            ← BullMQ Worker, picks up jobs from queue
│       │   └── jobs/
│       │       └── processUpload.ts ← actual pipeline logic (moved from process route)
│       └── package.json
│
├── packages/
│   ├── shared/                      ← types + constants — used by all apps
│   │   ├── src/
│   │   │   ├── types.ts             ← current root types.ts
│   │   │   ├── constants/           ← current constants/
│   │   │   └── index.ts
│   │   └── package.json             ← "name": "@planckoff/shared"
│   │
│   ├── db/                          ← all DB queries — used by api + pdf-worker
│   │   ├── src/
│   │   │   ├── projects.ts          ← from lib/db/projects.ts
│   │   │   ├── hardware.ts          ← from lib/db/hardware.ts
│   │   │   ├── auth.ts              ← from lib/db/auth.ts
│   │   │   ├── team.ts              ← from lib/db/team.ts
│   │   │   ├── masterHardware.ts    ← from lib/db/masterHardware.ts
│   │   │   └── supabaseAdmin.ts     ← from lib/supabase/admin.ts
│   │   └── package.json             ← "name": "@planckoff/db"
│   │
│   └── tsconfig/                    ← shared TypeScript base config
│       └── base.json
│
├── turbo.json                        ← Turborepo build pipeline
└── pnpm-workspace.yaml
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

`packages/shared/package.json`:
```json
{
  "name": "@planckoff/shared",
  "version": "0.0.0",
  "exports": { ".": "./src/index.ts" },
  "devDependencies": { "typescript": "~5.8.2" }
}
```

Now `apps/web`, `apps/api`, and `apps/pdf-worker` all import from `@planckoff/shared` and `@planckoff/db`. One source of truth for types and DB queries. No drift.

---

## The Hono API Server — Key Implementation Details

### Entry point

```typescript
// apps/api/src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie } from 'hono/cookie';
import { authRoutes } from './routes/auth';
import { projectRoutes } from './routes/projects';
import { teamRoutes } from './routes/team';
import { masterHardwareRoutes } from './routes/masterHardware';
import { settingsRoutes } from './routes/settings';
import { authMiddleware } from './middleware/auth';

const app = new Hono();

app.use('*', cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  credentials: true,  // required for httpOnly session cookie
}));

// Public (no session needed)
app.route('/api/auth', authRoutes);
app.get('/api/team/invite/:token', ...);  // invite validation is public

// All other routes require a valid session
app.use('/api/*', authMiddleware);

app.route('/api/projects', projectRoutes);
app.route('/api/team', teamRoutes);
app.route('/api/master-hardware', masterHardwareRoutes);
app.route('/api/settings', settingsRoutes);

export default app;
```

### Auth middleware (replaces withAuth HOF)

```typescript
// apps/api/src/middleware/auth.ts
import { createMiddleware } from 'hono/factory';
import { getCookie, setCookie } from 'hono/cookie';
import { validateSession } from '@planckoff/db/auth';

export const authMiddleware = createMiddleware(async (c, next) => {
  const token = getCookie(c, 'session');
  if (!token) return c.json({ error: 'Unauthorized' }, 401);

  const session = await validateSession(token);
  if (!session.isValid) return c.json({ error: 'Unauthorized' }, 401);

  // Renew cookie if expiring soon
  if (session.shouldRefreshCookie && session.sessionToken) {
    setCookie(c, 'session', session.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });
  }

  c.set('user', session.user);
  c.set('teamMember', session.teamMember);
  await next();
});
```

### Route with Zod validation

```typescript
// apps/api/src/routes/projects.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { getAllProjects, createProject } from '@planckoff/db/projects';

const CreateProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  client: z.string().max(200).optional(),
  location: z.string().max(500).optional(),
});

const projects = new Hono();

projects.get('/', async (c) => {
  const user = c.get('user');
  const data = user.role === 'Client'
    ? await getProjectsForClient(user.id)
    : await getAllProjects();
  return c.json({ data });
});

projects.post('/',
  zValidator('json', CreateProjectSchema),   // auto-validates, returns 400 on failure
  async (c) => {
    const body = c.req.valid('json');         // fully typed — no more `any`
    const user = c.get('user');
    const project = await createProject({ ...body, createdBy: user.id });
    return c.json({ data: project }, 201);
  }
);

export { projects as projectRoutes };
```

---

## Frontend Changes (apps/web)

The Next.js app keeps all its pages, components, hooks, and contexts. The only changes:

1. Remove `app/api/` directory entirely
2. Change all fetch calls from `/api/*` to `${process.env.NEXT_PUBLIC_API_URL}/api/*`
3. Add `NEXT_PUBLIC_API_URL=https://api.planckoff.com` to Vercel env vars

```typescript
// Before (implicit relative URL, works only in Next.js)
const res = await fetch('/api/projects');

// After (explicit, works from any deployment)
const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects`, {
  credentials: 'include',  // send session cookie cross-origin
});
```

Create a central API client to avoid scattering the base URL everywhere:

```typescript
// apps/web/lib/apiClient.ts
const BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include' });
  if (!res.ok) throw new ApiError(res.status, await res.json());
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, await res.json());
  return res.json();
}
```

---

## Deployment — After Stage 1

```
GitHub Actions CI/CD
    │
    ├── apps/web changed  → deploy to Vercel (auto, on push)
    └── apps/api changed  → deploy to Railway (Docker container)
                               PORT=3001
                               NODE_ENV=production
                               SUPABASE_URL=...
                               SUPABASE_SERVICE_ROLE_KEY=...
                               OPENROUTER_API_KEY=...
                               FRONTEND_URL=https://app.planckoff.com
```

Railway runs the Hono server as a persistent Node.js process. No 300s timeout. No cold starts. $5–10/month for the starter plan.

---

## Other Areas — Honest Assessment of Microservice Need

| Area | Extract to separate service? | Why / Why not |
|------|------------------------------|---------------|
| PDF processing pipeline | Yes — Stage 3 (async worker) | CPU-bound, long-running, needs independent scaling |
| Export service (PDF/Excel reports) | Eventually — Stage 4 | Also CPU-bound; extract when it causes latency |
| Auth | No | Single DB query, lightweight, coupled to user data |
| Email/notifications | No service — async job in same queue | Low volume, fire-and-forget |
| Master hardware catalog | No | Just a Postgres table; index + cache handles scale |
| Pricing | No | Pure business logic, fast DB queries |
| AI gateway | No service — shared package | Central rate limiting + cost tracking as a module, not HTTP service |
| Webhooks (future) | Maybe — when you add integrations | Only when you have external consumers that need it |

---

## Migration Order

1. **Initialize monorepo** — add `pnpm-workspace.yaml`, `turbo.json`, create `packages/` directory
2. **Create `packages/shared`** — move `types.ts` and `constants/` into it
3. **Create `packages/db`** — move `lib/db/*` into it; update all imports
4. **Create `apps/api`** — scaffold Hono server; migrate routes one by one, starting with auth
5. **Update `apps/web`** — remove `app/api/`, add `apiClient.ts`, update all fetch calls
6. **Deploy `apps/api` to Railway** — test in staging with `NEXT_PUBLIC_API_URL` pointing to Railway
7. **Migrate remaining routes** — hardware, pricing, team, settings
8. **Remove services/ from web** — they now live only in apps/api
9. **Stage 2: Add BullMQ** — when uploads start timing out or blocking

Migrate one route at a time. Run the old Next.js API routes and the new Hono server in parallel during migration — the frontend can be pointed at either. No big bang.
