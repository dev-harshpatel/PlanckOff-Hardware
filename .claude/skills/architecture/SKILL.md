---
description: Enforces and evolves the layered architecture — data flow, state management, API routes, multi-tenancy, and scalability decisions
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Architecture Skill

You are executing the `/architecture` skill. Your job is to enforce, explain, or evolve the architectural decisions for this application. Use this skill when designing new features, evaluating where to add code, or making structural decisions that affect scalability.

---

## CONTEXT

**Application:** PlanckOff Hardware Estimating — a SaaS platform for construction professionals to manage door schedules, hardware specifications, pricing, AI-powered extraction, and multi-format exports.

**Current Migration State:** Migrating from React 19 + Vite to Next.js 15 (App Router) with TypeScript. Supabase as backend (transitioning from localStorage).

**Scale Target:** Multi-tenant SaaS. Must support multiple organizations, team-based access, concurrent users, large project datasets, and frequent AI API calls.

---

## ARCHITECTURAL LAYERS

The application is structured in strict layers. Each layer only communicates downward — never upward.

```
┌─────────────────────────────────────────────────────┐
│  PRESENTATION LAYER (app/, features/, components/)  │
│  React Server Components, Client Components, Pages  │
├─────────────────────────────────────────────────────┤
│  APPLICATION LAYER (store/, hooks/)                 │
│  State management, business orchestration           │
├─────────────────────────────────────────────────────┤
│  DOMAIN / SERVICE LAYER (services/)                 │
│  Business logic, pure functions, no UI dependencies │
├─────────────────────────────────────────────────────┤
│  INFRASTRUCTURE LAYER (lib/, utils/, workers/)      │
│  External integrations, parsers, DB clients         │
└─────────────────────────────────────────────────────┘
```

### What Each Layer Can Import

| Layer | Can import from | Cannot import from |
|---|---|---|
| Presentation | Application, Domain, Infrastructure | Nothing above itself |
| Application | Domain, Infrastructure | Presentation |
| Domain/Service | Infrastructure, types, constants | Presentation, Application |
| Infrastructure | types, constants, third-party libs | Any app layer |

Violation of this rule = architectural debt. Flag and refuse to implement violations.

---

## DATA FLOW ARCHITECTURE

```
User Action
    │
    ▼
React Component (UI Event Handler)
    │
    ▼
Custom Hook (useX) — manages loading/error state
    │
    ▼
Service Function — pure business logic
    │
    ├──► Supabase Client (lib/supabase/client.ts) — data persistence
    ├──► AI API Route (app/api/ai/generate/route.ts) — AI calls
    └──► Export Service — file generation
    │
    ▼
State Update (store / useState)
    │
    ▼
UI Re-render
```

**Principle:** Data flows DOWN through props, events flow UP through callbacks. State lives at the lowest common ancestor. Global state (auth, toast) lives in the store.

---

## STATE MANAGEMENT ARCHITECTURE

### Three Tiers of State

**Tier 1 — Server State (Supabase data)**
- Managed by a server state library
- Current approach: React Context with useEffect (acceptable short-term)
- Target approach: Add React Query (`@tanstack/react-query`) for caching, background refetch, optimistic updates
- Location: `store/projectStore.ts`, `store/authStore.ts`

**Tier 2 — Global Client State (auth, toast, settings)**
- Managed by React Context or Zustand
- Location: `store/`
- Examples: current user, active toast notifications, app settings

**Tier 3 — Local UI State (modals, form inputs, loading)**
- Managed by `useState` inside the component
- NEVER lift to global store unless 2+ distant components need it
- Examples: `isModalOpen`, `formData`, `isSubmitting`

### Decision Rule: Where Does This State Live?
1. Only 1 component needs it → `useState` inside that component
2. Parent + 1-2 children need it → `useState` in parent, pass via props
3. Many components across the tree need it → Global store
4. Data that comes from the database → Server state (React Query)
5. Data that should survive page refresh → `useLocalStorage` hook (short-term) or Supabase (production)

---

## ROUTING ARCHITECTURE

```
app/
├── layout.tsx                   # Root layout — fonts, metadata, providers
├── page.tsx                     # Dashboard (authenticated home)
├── (auth)/                      # Route group — no URL segment
│   └── login/page.tsx           # /login
├── projects/
│   ├── page.tsx                 # /projects — project list
│   └── [id]/
│       ├── page.tsx             # /projects/:id — project workspace
│       └── reports/
│           └── page.tsx         # /projects/:id/reports
├── database/page.tsx            # /database — master inventory
├── team/page.tsx                # /team — team management
└── api/                         # Server-only API routes
    ├── ai/generate/route.ts     # POST — AI content generation
    ├── export/pdf/route.ts      # POST — PDF generation
    ├── export/excel/route.ts    # POST — Excel generation
    └── export/cobie/route.ts    # POST — COBie export
```

### Route Protection
All routes under `app/` (except `(auth)/`) require authentication.
Implement in `middleware.ts`:

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Check Supabase session
  // Redirect to /login if no session and not on auth route
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login).*)'],
}
```

---

## API ARCHITECTURE (Next.js API Routes)

All server-side operations go through `app/api/`. Rules:

### API Route Structure
```typescript
// app/api/ai/generate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  // 1. Authenticate request
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Validate input
  const body = await request.json()
  // validate with zod schema

  // 3. Execute business logic
  // Call AI service with SERVER-SIDE API key (process.env.GEMINI_API_KEY)

  // 4. Return typed response
  return NextResponse.json({ result }, { status: 200 })
}
```

### API Route Rules
- Every API route validates authentication first
- Every API route validates input (use Zod schemas)
- API keys are ONLY accessed via `process.env` in API routes — never `NEXT_PUBLIC_`
- Return consistent JSON shape: `{ data: T }` on success, `{ error: string }` on failure
- HTTP status codes must be semantically correct (200, 201, 400, 401, 403, 404, 500)

---

## DATABASE ARCHITECTURE (Supabase)

### Client Types
```typescript
// lib/supabase/client.ts — browser client
import { createBrowserClient } from '@supabase/ssr'
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

// lib/supabase/server.ts — server client (API routes, Server Components)
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
export function createSupabaseServerClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { /* SSR cookie handling */ } }
  )
}
```

### Data Access Rules
- Server Components and API Routes: use `createSupabaseServerClient()` (server-side auth)
- Client Components: use the browser `supabase` client only for real-time subscriptions
- All write operations go through API routes — never from client components directly
- Use Supabase Row Level Security (RLS) as the security boundary — never trust client-side role checks

### Multi-Tenancy Schema (Target)
```sql
-- Every major table has organization_id for multi-tenancy
projects         (id, organization_id, name, ...)
doors            (id, project_id, ...)
hardware_items   (id, project_id OR organization_id, ...)
team_members     (id, organization_id, user_id, role, ...)

-- RLS Policies ensure users only see their org's data
CREATE POLICY "Users see own org projects"
ON projects FOR SELECT
USING (organization_id = get_user_org_id(auth.uid()));
```

---

## AI INTEGRATION ARCHITECTURE

The AI integration must be fully server-side. Architecture:

```
Client Component
    │  fetch('/api/ai/generate', { method: 'POST', body: prompt })
    ▼
app/api/ai/generate/route.ts  ← API key lives HERE (server only)
    │  process.env.GEMINI_API_KEY
    ▼
services/ai/geminiService.ts  ← Pure AI logic, no Next.js imports
    │
    ▼
Google Gemini API (external)
    │
    ▼
Structured response (typed JSON)
    │
    ▼
Client receives parsed data
```

### AI Service Interface
```typescript
// services/ai/aiProviderService.ts
export interface AIGenerationRequest {
  prompt: string
  schema: Record<string, unknown>
  temperature?: number
  maxRetries?: number
}

export interface AIGenerationResult<T> {
  data: T
  model: string
  tokensUsed: number
}

export async function generateStructuredContent<T>(
  request: AIGenerationRequest,
): Promise<AIGenerationResult<T>> {
  // Implementation — runs on server only
}
```

---

## FILE PROCESSING ARCHITECTURE

File uploads are CPU-intensive. Route through Web Workers:

```
User uploads file (PDF/Excel/DOCX)
    │
    ▼
UploadProgressWidget (client component)
    │  postMessage to worker
    ▼
workers/upload.worker.ts  ← Runs in separate thread
    │  Parse file, chunk if large
    ▼
AI extraction via /api/ai/generate
    │
    ▼
Parsed structured data
    │  postMessage back to main thread
    ▼
Store updates with extracted data
```

### Worker Communication Pattern
```typescript
// Always use typed messages between main thread and worker
interface WorkerMessage {
  type: 'PARSE_FILE' | 'EXTRACT_HARDWARE' | 'EXTRACT_DOORS'
  payload: { file: ArrayBuffer; fileName: string; projectId: string }
}

interface WorkerResponse {
  type: 'SUCCESS' | 'ERROR' | 'PROGRESS'
  payload: ParsedFileResult | ErrorDetails | ProgressUpdate
}
```

---

## EXPORT ARCHITECTURE

Exports are CPU-intensive. Route large exports through API routes:

```
ReportGenerationCenter
    │  fetch('/api/export/pdf', { projectId })
    ▼
app/api/export/pdf/route.ts
    │  Generate PDF on server (jsPDF)
    ▼
Response: blob or signed Supabase Storage URL
    │
    ▼
Client triggers download
```

Small exports (CSV) can happen client-side. Large exports (PDF, Excel, COBie) must be server-side.

---

## SCALABILITY DECISIONS

### When the App Needs to Scale:

**More users → Add:**
- Supabase connection pooling (PgBouncer)
- Row-level caching with Redis (Upstash)
- React Query for client-side cache + deduplication of API calls

**More AI calls → Add:**
- Queue system for AI jobs (Inngest or Supabase Edge Functions + pg_message_queue)
- Rate limiting per organization (Upstash Ratelimit)
- AI result caching (same PDF parsed before → return cached result)

**More data → Add:**
- Pagination on all list endpoints (cursor-based, not offset)
- Virtual scrolling for large door lists (react-virtual)
- Database indexes on `organization_id`, `project_id`, `created_at`

**More features → Maintain:**
- Feature-based folder structure (`features/`)
- No cross-feature direct imports (each feature is a closed module)
- API routes for all server operations (easy to move to microservices later)

---

## SECURITY ARCHITECTURE

### Authentication Flow (Target — Supabase Auth)
```
User submits login form
    │
    ▼
Supabase Auth (email/password or OAuth)
    │
    ▼
JWT stored in httpOnly cookie (via @supabase/ssr)
    │
    ▼
middleware.ts validates cookie on every request
    │
    ▼
Server Components read user from cookie
    │
    ▼
Supabase RLS enforces data access at DB level
```

### Security Rules
- AI API keys: ONLY in server environment variables (`process.env.GEMINI_API_KEY`)
- Supabase service role key: ONLY in server environment variables — never `NEXT_PUBLIC_`
- User input: validate with Zod before passing to any service
- File uploads: validate MIME type AND file signature (magic bytes) — not just extension
- All API routes: authenticate before executing any logic
- RLS on all Supabase tables: default deny, explicit allow

---

## FEATURE DEVELOPMENT WORKFLOW

When adding a new feature, always follow this sequence:

1. **Define types** in `types/domain.ts` — what does the data look like?
2. **Define constants** in `constants/` — what are the fixed values?
3. **Define API route** in `app/api/` — what server operation is needed?
4. **Implement service** in `services/` — pure business logic
5. **Create database query** (Supabase) — how is data stored/retrieved?
6. **Create custom hook** in `features/{feature}/hooks/` — UI data management
7. **Build components** in `features/{feature}/components/` — UI rendering
8. **Create page** in `app/.../page.tsx` — compose the feature
9. **Update barrel exports** in `features/{feature}/index.ts`
10. **Write tests** for service functions and critical hooks

---

## WHAT TO REFUSE (ANTI-PATTERNS)

These patterns must be rejected and refactored:

| Anti-Pattern | Why | Alternative |
|---|---|---|
| AI API key in client bundle | Security breach — key exposed | Move to `app/api/` route |
| Business logic in component | Untestable, bloated UI | Extract to `services/` |
| Direct Supabase writes from client component | Bypasses RLS, auth | Route through API routes |
| `any` TypeScript type | Loses type safety | Use `unknown` + type guard |
| `localStorage` as primary DB | Data lost on cache clear | Supabase + localStorage as cache |
| 500+ line component | Impossible to maintain | Split into feature + sub-components |
| Cross-feature imports (`features/doors` imports from `features/hardware`) | Coupling | Shared types in `types/`, shared utils in `utils/` |
| Hardcoded strings for routes/roles/keys | Brittle | Extract to `constants/` |
| No error boundaries | Crashes entire app | Wrap features in ErrorBoundary |
| Polling instead of real-time | Wasteful | Supabase real-time subscriptions |
