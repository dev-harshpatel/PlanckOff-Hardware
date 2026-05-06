# PlanckOff — Architecture & Technology Decisions
> Interview Prep Guide · Part 2 of 3

---

## The Big Picture — Layered Architecture

Think of the app like an onion. Each layer only talks to the layer directly below it. No layer skips over another.

```
┌─────────────────────────────────────────────┐
│  PRESENTATION LAYER                          │
│  components/, views/                         │
│  What the user sees and interacts with       │
├─────────────────────────────────────────────┤
│  APPLICATION LAYER                           │
│  services/, hooks/                           │
│  Business logic, AI calls, pricing math      │
├─────────────────────────────────────────────┤
│  INFRASTRUCTURE LAYER                        │
│  app/api/ (Next.js API Routes)               │
│  API proxy, auth middleware, DB queries      │
├─────────────────────────────────────────────┤
│  DATA LAYER                                  │
│  Supabase PostgreSQL + Storage               │
│  The actual data store                       │
└─────────────────────────────────────────────┘
```

**Why enforce this?**
- If a UI component calls Supabase directly, you can't test the component in isolation
- If a component calls the AI directly, the API key is exposed in the browser
- Layers let you swap out the database or AI provider without touching the UI

---

## Tech Stack — Full List

| Layer | Technology | Version |
|---|---|---|
| Frontend Framework | React + Next.js App Router | React 19, Next.js 15 |
| Language | TypeScript | 5.8 |
| Styling | Tailwind CSS + CSS Custom Properties | 3.4 |
| Database | Supabase (PostgreSQL) | latest |
| Auth | Custom session-based (bcrypt) | — |
| AI — Primary | Google Gemini 2.5-Flash | via `@google/genai` |
| AI — Fallback | OpenRouter (multi-model API) | via REST |
| PDF Parsing | pdfjs-dist | — |
| Excel Parsing | xlsx (SheetJS) | — |
| CSV Parsing | Papaparse | — |
| Word Parsing | Mammoth | — |
| PDF Export | jsPDF | — |
| Background Processing | Web Workers | native browser API |
| Task Recovery | IndexedDB (via uploadPersistence) | native browser API |
| Build Tool | Next.js with Turbopack | — |

---

## Why These Technologies? (The "Why" Questions)

---

### Why Next.js instead of plain React + Vite?

The old codebase was React + Vite. We migrated to Next.js for three critical reasons:

1. **API Routes** — Next.js gives us server-side routes (`app/api/`). This is how we keep the Gemini API key on the server and never expose it to the browser. With plain Vite, you'd need a separate Express server.

2. **Server-Side Rendering** — The dashboard and project list can be rendered on the server, which makes the first paint faster.

3. **App Router** — Cleaner file-based routing, layouts that persist across pages (so the sidebar doesn't re-render on every navigation).

**Trade-off:** Next.js adds more complexity than Vite. Cold starts are slower. But for a SaaS with API key security requirements, it's worth it.

---

### Why Supabase instead of MongoDB?

This is a very common interview question. Here's the honest breakdown:

| Reason | Supabase (PostgreSQL) | MongoDB |
|---|---|---|
| **Data shape** | Doors and hardware have fixed schemas with known fields | Better for truly flexible/unknown schemas |
| **Relationships** | A door belongs to a project, a hardware set has many items — relational fits perfectly | Embedding everything in one document can work but gets messy |
| **Row Level Security (RLS)** | Built-in at the DB level — one company CANNOT see another's data, enforced in Postgres | Would need application-level enforcement (more risk) |
| **Auth + Storage** | Supabase gives you auth, file storage, and a DB in one product | MongoDB Atlas doesn't include auth or file storage out of the box |
| **JSON support** | PostgreSQL has excellent JSONB columns when you need flexibility | Native |
| **Free tier** | Generous free tier for a startup/MVP | Atlas free tier has stricter limits |
| **Open source** | Can self-host Supabase | MongoDB has open-source version but Atlas is cloud-only |

**The short answer for an interview:** "Our data is fundamentally relational — projects have doors, doors have hardware sets, hardware sets have items. PostgreSQL is the natural fit. We also needed Row Level Security for multi-tenancy, and Supabase gives us that built in."

---

### Why JSON? (The "Why not just store everything in tables?" question)

We actually use **both** — relational tables for structure AND JSONB for flexibility.

**Where we use JSONB:**
- `projects` table stores doors as a JSONB blob (`doors jsonb`) instead of a separate normalized table
- This was the MVP approach: ship fast, validate the data model, normalize later
- Migration 004 (`004_relational_hardware_schema.sql`) started moving toward normalized tables for hardware

**Why JSONB specifically?**
- Postgres JSONB is indexed, queryable, and validated
- You can run `WHERE data->>'fireRating' = '1 HR'` directly in SQL
- It compresses well and stores binary (faster than plain `json` column)

**When is JSON the right choice?**
- When the shape of the data changes frequently (we were still discovering what fields doors needed)
- When you need to store the full object for export or AI input without extra joins
- When you want to avoid premature schema normalization before you know all requirements

**When should you normalize?**
- When you need to query individual fields frequently at scale
- When you need foreign key constraints and data integrity
- When multiple tables need to reference the same record

**Our current situation:** We store pricing, sections, and hardware specs as JSONB inside the door record. This was intentional — a door has 50+ possible fields and many are optional. Normalizing all of that into separate tables would have slowed down early development. The trade-off is that reporting/querying is harder.

---

### Why Web Workers?

PDF parsing of a 200-page file is CPU-intensive. If you do this on the main JavaScript thread:
- The browser UI **freezes** — buttons don't respond, no progress updates
- Users think the app is broken and close the tab

Web Workers run JavaScript on a **separate thread**. The main thread stays responsive, shows a progress bar, lets users navigate away, and receives results when the worker is done.

```
Main Thread (UI)          Worker Thread (background)
────────────────          ───────────────────────────
Show progress bar   ←─── postMessage({ progress: 45 })
User can click X    ←─── postMessage({ progress: 70 })
Receive results     ←─── postMessage({ done: true, doors: [...] })
```

**Trade-off:** Workers can't access the DOM or any browser APIs directly. Communication is message-passing only. IndexedDB is used for task persistence so if the user refreshes the page, uploads can resume.

---

### Why TypeScript?

A hardware spec object has 50+ fields. Without TypeScript:
- You don't know if `door.fireRating` is a string, number, or undefined
- Refactoring breaks things you didn't know were connected
- AI-generated code suggestions are less accurate

With TypeScript:
- The IDE tells you exactly what fields a `Door` has
- You can't pass a `HardwareSet` where a `HardwareItem` is expected
- Refactors are safe — the compiler catches all the breakages

**Rule in this project:** No `any`. Use `unknown` + type guards. This is strictly enforced.

---

### Why CSS Custom Properties for dark mode instead of Tailwind's built-in `dark:` prefix?

Tailwind's `dark:bg-white` approach requires duplicating every color class. When you have 50+ components, that's `dark:bg-gray-900 bg-white dark:text-gray-100 text-gray-900` everywhere.

Instead, we define tokens:
```css
:root {
  --bg: #ffffff;
  --text: #0f172a;
  --border: #e2e8f0;
}

.dark {
  --bg: #0f172a;
  --text: #f8fafc;
  --border: #1e293b;
}
```

Then every component just writes `bg-[var(--bg)] text-[var(--text)]`. Flip the `.dark` class, every component updates automatically. One place to change the whole theme.

---

## Folder Structure — Where Things Live

```
app/                    Next.js App Router pages + API routes
├── api/
│   ├── ai/generate/    ← Server proxy for Gemini/OpenRouter (API keys SAFE here)
│   ├── auth/           ← Login, logout, session check
│   ├── projects/       ← Project CRUD
│   ├── master-hardware/← Global hardware inventory
│   └── team/           ← Team member management
├── (auth)/login/       ← Login page (outside main app layout)
├── project/[id]/       ← Dynamic project page
├── database/           ← Global database view
└── team/               ← Team management page

components/             UI components (forms, tables, modals)
views/                  Full-page components (Dashboard, ProjectView, etc.)
contexts/               React Context providers (global state)
services/               Business logic (AI, pricing, export, merge)
utils/                  Pure helpers (parsers, transformers, generators)
hooks/                  Custom React hooks
lib/
├── supabase/           ← 3 Supabase clients: browser, server, admin
├── db/                 ← Database query functions
└── auth/               ← Auth middleware helpers
workers/                Web Worker for background file processing
types.ts                All TypeScript types (715 lines — being split)
constants/              App-wide constants (auth config, roles, seed data)
supabase/migrations/    SQL migration files (10 migrations so far)
```

---

## Database Schema — Key Tables

### Migration History (What was built when)

| Migration | What It Created |
|---|---|
| 001 | `admins`, `team_members`, `auth_sessions` tables |
| 002 | `projects` table (stores doors as JSONB) |
| 003 | Location lookup data |
| 004 | `hardware_items`, `hardware_sets` — normalized hardware tables |
| 005 | `elevation_images` — Supabase Storage integration |
| 006 | Fixed RLS policies for elevations |
| 007 | `project_elevation_types` junction table |
| 008 | `master_hardware_items` — global inventory |
| 009 | `hardware_trash` — soft delete support |
| 010 | Fixed uniqueness constraints on master hardware |

### Core Tables

```sql
-- Teams / Auth
admins (id, email, password_hash, name, created_at)
team_members (id, admin_id, email, name, role, invited_at, joined_at)
auth_sessions (id, user_id, user_type, expires_at, created_at)

-- Projects (JSONB approach)
projects (
  id, admin_id, name, client, location, status,
  doors jsonb,          -- array of Door objects
  hardware_sets jsonb,  -- array of HardwareSet objects
  elevation_types jsonb,
  created_at, updated_at, deleted_at
)

-- Normalized Hardware (migration 004+)
hardware_sets (id, project_id, name, description, division)
hardware_items (id, set_id, name, quantity, manufacturer, finish, unit_price, ...)

-- Elevations (Supabase Storage)
elevation_images (id, project_id, name, storage_path, image_url, created_at)

-- Global Inventory
master_hardware_items (id, admin_id, name, manufacturer, category, unit_price, ...)
hardware_trash (id, admin_id, item_data jsonb, deleted_at)
```

### Row Level Security (RLS) — Multi-tenancy Enforcement

Every table has RLS policies. For example:
```sql
-- A team member can only see projects belonging to their admin
CREATE POLICY "team_can_view_projects" ON projects
  FOR SELECT USING (
    admin_id = (
      SELECT admin_id FROM team_members 
      WHERE id = auth.uid()
    )
    OR admin_id = auth.uid()
  );
```

This means even if someone guesses another project's UUID, Postgres will return zero rows. The security is at the data level, not just the application level.

---

## Auth Flow

The app uses custom session-based auth (not Supabase Auth — a deliberate choice for more control).

```
1. User submits login form
   ↓
2. POST /api/auth/login
   ↓
3. Server looks up user in admins or team_members table
4. bcrypt.compare(password, stored_hash)  ← password never stored plain
   ↓
5. If valid: create row in auth_sessions (token, expires_at)
6. Set HttpOnly cookie with session token
   ↓
7. Every subsequent request:
   middleware.ts reads cookie → validates session → attaches user to request
   ↓
8. API routes use withAuth() helper to check session before proceeding
```

**Why HttpOnly cookies?**
- The cookie is invisible to JavaScript (`document.cookie` can't read it)
- Prevents XSS attacks from stealing the session token
- Automatically sent with every request

**Why custom session auth instead of Supabase Auth?**
- More control over session management
- Can store additional fields (role, admin_id) in the session
- Supabase Auth is OAuth-focused; we needed email+password for an internal tool

---

## State Management

| State | Where It Lives | Why |
|---|---|---|
| Auth (logged-in user) | `AuthContext` + cookie | Needs to be global, verified server-side |
| Projects + Doors + Hardware | `ProjectContext` | ~1000 lines, being split into smaller contexts |
| Toast notifications | `ToastContext` | Lightweight, fire-and-forget UI state |
| Background upload tasks | `BackgroundUploadContext` | Tracks active Web Worker jobs with progress |
| Processing widget | `ProcessingWidgetContext` | Shows/hides the floating progress widget |

**Why React Context instead of Redux?**
- This is a focused domain app, not a massive social media platform
- Context is simpler, less boilerplate, and sufficient for this scale
- Redux would add `actions`, `reducers`, `selectors`, `middleware` — too much ceremony
- Trade-off: Context re-renders all consumers when any value changes; we mitigate by splitting contexts

**Current problem:** `ProjectContext.tsx` is ~1000 lines with too much mixed state. It should be split into `ProjectListContext`, `ActiveProjectContext`, `HardwareContext`.

---

## API Route Patterns

All Next.js API routes follow the same pattern:

```typescript
// app/api/projects/route.ts
export async function GET(request: NextRequest) {
  // 1. Authenticate
  const { user, error } = await withAuth(request);
  if (error) return NextResponse.json({ error }, { status: 401 });

  // 2. Query database (scoped to user's admin_id)
  const projects = await getProjectsByAdmin(user.adminId);

  // 3. Return response
  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const { user, error } = await withAuth(request);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await request.json() as NewProjectData;
  const project = await createProject(user.adminId, body);

  return NextResponse.json({ project }, { status: 201 });
}
```

---

## Expected Interview Questions — Architecture

---

**Q: How do you ensure API keys are never exposed to the browser?**

A: All AI API calls go through a Next.js API route (`/api/ai/generate`). The client sends the prompt to our server. The server reads `GEMINI_API_KEY` from environment variables (never in the client bundle) and calls Gemini directly. The client only ever sees our own domain's response.

---

**Q: How does multi-tenancy work in PlanckOff?**

A: Two layers. First, every DB query is scoped by `admin_id` — so each company's data stays separate at the query level. Second, Supabase Row Level Security (RLS) policies enforce this at the PostgreSQL level, so even a miscoded query can't leak another company's data.

---

**Q: Why did you choose Supabase over Firebase?**

A: Several reasons. Our data is relational — doors belong to projects, hardware sets have items. PostgreSQL is the natural fit. Firebase is document-based and would require denormalization. Also, Supabase's RLS is more expressive than Firebase's security rules for fine-grained multi-tenancy. And Supabase is open-source, so we can self-host if needed.

---

**Q: How do you handle background processing in the browser?**

A: Web Workers. When a user uploads a PDF, the file parsing and AI extraction happen in a background worker thread. The main thread stays responsive, shows a progress bar, and receives results via message passing. We also persist task state to IndexedDB so if the user refreshes, the upload can resume.

---

**Q: Why TypeScript? Is it worth the overhead?**

A: Definitely, especially for a data-heavy domain like this. A `Door` object has 50+ optional fields. TypeScript catches mistakes at compile time — if a function expects a `HardwareSet` and you pass a `HardwareItem`, the compiler tells you immediately. We also use strict `no-any` rules. The overhead is front-loaded (writing types) but the savings in debugging are ongoing.

---

**Q: How do you handle database migrations?**

A: We use SQL migration files in `supabase/migrations/`. Each migration is numbered (001, 002, etc.) and run in order. We never modify existing migrations — if we need to change a table, we add a new migration. This gives us a full history of schema changes and makes deployments predictable.

---

**Q: Why JSONB in PostgreSQL instead of normalized tables for doors?**

A: It was a deliberate MVP trade-off. Doors have 50+ optional fields and we were still discovering the full data model. Storing doors as JSONB in the projects table let us iterate fast without running migrations every time we added a field. The downside is that complex SQL queries on door fields are harder. We're now incrementally normalizing as the schema stabilizes.

---

**Q: What is your authentication mechanism?**

A: Custom session-based auth. On login, bcrypt compares the password to a stored hash. If valid, we create a session record in Postgres with an expiry time and set an HttpOnly cookie with the session token. The middleware validates this cookie on every request. We didn't use Supabase Auth because we needed custom role management and the team-invitation flow.

---
