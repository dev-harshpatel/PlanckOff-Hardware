# Architecture

**Analysis Date:** 2026-05-07

## Pattern Overview

**Overall:** Layered Next.js 15 App Router application with a clear client/server split, context-driven state management, and a repository pattern for data access.

**Key Characteristics:**
- Next.js App Router with route-level code-splitting using `dynamic()` and `ssr: false` for browser-only pages
- REST API layer via Next.js Route Handlers under `app/api/`
- Custom cookie-based session auth (no Supabase Auth); Supabase used only as a database via the admin client
- React Context for global client-side state; no Redux or Zustand
- Web Worker offloads heavy file-parsing tasks off the main thread

---

## Layers

**Presentation — Views:**
- Purpose: Full-page screen-level components that compose feature components
- Location: `views/`
- Contains: `Dashboard.tsx`, `ProjectView.tsx`, `DatabaseView.tsx`, `PricingView.tsx`, `ReportsView.tsx`, `TeamManagement.tsx`
- Depends on: Context hooks, domain components, services
- Used by: Next.js page files in `app/`

**Presentation — Components:**
- Purpose: Reusable UI components from domain-specific widgets to primitive UI elements
- Location: `components/`
- Contains: Domain components (e.g., `DoorScheduleManager.tsx`, `HardwareSetsManager.tsx`), layout primitives (`AppShell.tsx`, `Header.tsx`), Radix-based UI kit (`components/ui/`), loading skeletons (`components/skeletons/`)
- Depends on: Contexts, hooks, types
- Used by: Views

**Pages — Route Entry Points:**
- Purpose: Thin Next.js pages; delegate rendering to views via `dynamic()` imports
- Location: `app/`
- Contains: `app/page.tsx` (dashboard), `app/project/[id]/page.tsx`, `app/(auth)/login/page.tsx`, `app/settings/page.tsx`, `app/team/page.tsx`
- Depends on: Views, context hooks
- Used by: Next.js router

**API Routes:**
- Purpose: Server-side REST endpoints; validate sessions, enforce RBAC, call DB layer
- Location: `app/api/`
- Contains: Auth (`app/api/auth/`), projects (`app/api/projects/`), per-project sub-resources (`app/api/projects/[id]/`), AI (`app/api/ai/generate/`), team (`app/api/team/`), master hardware (`app/api/master-hardware/`)
- Depends on: `lib/auth/api-helpers.ts`, `lib/db/`, `lib/supabase/`
- Used by: Client-side context providers and service modules via `fetch()`

**State — Contexts:**
- Purpose: Global client-side state; each context owns a specific domain
- Location: `contexts/`
- Contains:
  - `AuthContext.tsx` — current user, login/logout
  - `ProjectContext.tsx` — projects list, CRUD, masterInventory, appSettings
  - `BackgroundUploadContext.tsx` — upload task queue backed by Web Worker
  - `ProcessingWidgetContext.tsx` — processing log/progress widget
  - `ToastContext.tsx` — toast notifications
  - `NavigationLoadingContext.tsx` — route-transition loading bar
  - `AnnouncementContext.tsx` — in-app announcements
- Depends on: API routes via `fetch()`
- Used by: All client components/views

**Auth Layer:**
- Purpose: Custom session management; no Supabase Auth
- Location: `lib/auth/`
- Contains:
  - `session.ts` — `validateSession()` reads cookie and resolves user
  - `sessionResolver.ts` — resolves session token against DB
  - `rbac.ts` — `canAccessRoute()`, `hasRoleAccess()`, `ROUTE_PERMISSIONS` table
  - `api-helpers.ts` — `withAuth()` and `withRoleAuth()` HOFs wrapping API route handlers
- Depends on: `lib/supabase/`, `constants/auth.ts`, `constants/roles.ts`
- Used by: `middleware.ts`, all API route handlers

**Data Access — Repository:**
- Purpose: All Supabase queries isolated in typed repository functions
- Location: `lib/db/`
- Contains: `projects.ts`, `hardware.ts`, `auth.ts`, `team.ts`, `notes.ts`, `pricing.ts`, `masterHardware.ts`, `companySettings.ts`, `projectLocations.ts`
- Depends on: `lib/supabase/admin.ts` (admin client)
- Used by: API route handlers only (never called from client)

**Services:**
- Purpose: Browser-side business logic and export utilities
- Location: `services/`
- Contains: AI (`aiProviderService.ts`, `geminiService.ts`), export pipelines (`excelExportService.ts`, `pdfExportService.ts`, `csvExportService.ts`, `doorSchedulePdfService.ts`, `hardwarePdfService.ts`), domain logic (`pricingService.ts`, `mergeService.ts`, `elevationService.ts`)
- Depends on: Types, utils, `fetch('/api/ai/generate')`
- Used by: Views and components

**Utilities:**
- Purpose: Pure transformers, parsers, and helpers
- Location: `utils/`
- Contains: Parsers (`csvParser.ts`, `xlsxParser.ts`, `pdfParser.ts`, `docxParser.ts`), transformers (`hardwareTransformers.ts`), domain validators (`doorValidation.ts`), data migration helpers (`doorDataMigration.ts`, `hardwareDataMigration.ts`)
- Depends on: Types only

**Web Worker:**
- Purpose: Offloads heavy file parsing (door schedules, hardware sets) off main thread
- Location: `workers/upload.worker.ts`
- Depends on: `services/fileUploadService.ts`
- Used by: `BackgroundUploadContext.tsx`

---

## Data Flow

**User Login:**
1. `app/(auth)/login/page.tsx` collects credentials
2. `AuthContext.login()` calls `POST /api/auth/login`
3. API handler in `app/api/auth/login/route.ts` validates password with bcrypt via `lib/db/auth.ts`
4. On success, sets `HttpOnly` session cookie via `lib/auth/api-helpers.setAuthCookie()`
5. `AuthContext` updates `user` state; Next.js router redirects to `/`

**Page Load Auth Guard:**
1. `middleware.ts` intercepts every non-static request
2. Reads session cookie; calls `resolveSessionFromToken()` from `lib/auth/sessionResolver.ts`
3. Calls `canAccessRoute()` from `lib/auth/rbac.ts`
4. Unauthenticated → redirect to `/login`; forbidden → redirect to `/` with `error=access_denied`

**API Request:**
1. Client code calls `fetch('/api/...')` with `credentials: 'include'`
2. Route handler is wrapped in `withAuth()` or `withRoleAuth()` from `lib/auth/api-helpers.ts`
3. HOF validates session via `validateSession()`, enforces role
4. Handler calls a `lib/db/` function which queries Supabase via admin client
5. Returns `NextResponse.json()`; cookie refresh is applied if session is near expiry

**File Upload (Background):**
1. User drops file in UI → `BackgroundUploadContext.queueUpload()` dispatches to `workers/upload.worker.ts`
2. Worker calls `services/fileUploadService.ts` which parses file (PDF, XLSX, CSV, DOCX)
3. Worker posts `progress` and `partial_data` messages back to main thread
4. Context updates task state; `UploadProgressWidget` reflects progress
5. On completion, result is confirmed via `UploadConfirmationModal` and saved to project via `ProjectContext.updateProject()`

**AI Generation:**
1. Service layer calls `services/aiProviderService.generateAIContent(prompt, schema, options)`
2. Client posts to `POST /api/ai/generate` with provider, model, prompt
3. Route handler in `app/api/ai/generate/route.ts` picks OpenRouter (via OpenAI SDK) or Gemini (`@google/genai`) based on provider field
4. Response streamed back as JSON `{ text }`

**Realtime Updates:**
1. `hooks/useProjectRealtime.ts` subscribes to Supabase Realtime Postgres Changes on `door_schedule_imports` for current `projectId`
2. On change event, fires callback in `ProjectView.tsx` to re-fetch door schedule data

---

## State Management

**Server state:** Fetched from REST API via `fetch()` in context providers on mount. No SWR or React Query — manual `useEffect` + `useState`.

**Global client state:** React Context providers stacked in `app/providers.tsx`:
```
ThemeProvider > ToastProvider > AuthProvider > ProjectProvider >
BackgroundUploadProvider > ProcessingWidgetProvider >
NavigationLoadingProvider > AnnouncementProvider
```

**Local UI state:** `useState` / `useReducer` inside views and components.

**Persistent browser state:** `localStorage` for `tve_master_inventory` and `tve_app_settings` (read in `ProjectContext` initial state).

**Realtime:** Supabase Realtime channel subscribed in `hooks/useProjectRealtime.ts`.

---

## API Design

**Style:** REST, JSON body, cookie-based auth (`credentials: 'include'`)

**Auth decoration:** `withAuth(handler)` — any authenticated role; `withRoleAuth(roles[], handler)` — specific roles

**Key endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/login` | Login, set session cookie |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/logout` | Clear cookie |
| GET/POST | `/api/projects` | List / create projects |
| GET/PUT/DELETE | `/api/projects/[id]` | Project CRUD; DELETE supports `?restore=true` and `?hard=true` |
| GET/POST | `/api/projects/[id]/door-schedule` | Door schedule for project |
| GET/PUT | `/api/projects/[id]/pricing` | Pricing rows |
| GET/PUT | `/api/projects/[id]/notes` | Project notes |
| GET/PUT | `/api/projects/[id]/hardware-merge` | Merged hardware data |
| POST | `/api/ai/generate` | AI text/JSON generation (OpenRouter or Gemini) |
| GET/POST | `/api/team/members` | Team member list / invite |
| GET/POST | `/api/master-hardware` | Master hardware library |

---

## Error Handling

**Strategy:** Errors bubble through layers; UI surfaces them via `ToastContext.addToast()`.

**Patterns:**
- API routes return `{ error: string }` with appropriate HTTP status
- Context actions `catch` fetch errors and call `addToast({ type: 'error', ... })`
- `ErrorBoundary.tsx` component wraps views for unexpected render errors
- `ErrorModal.tsx` used for structured in-view error display

---

## Cross-Cutting Concerns

**Authentication:** Custom session cookie (`AUTH_CONFIG.SESSION_COOKIE_NAME`) validated in middleware and in every API route via `withAuth` / `withRoleAuth`.

**RBAC:** Role levels (`Administrator > Team Lead > Estimator`) defined in `constants/roles.ts`; enforced in `lib/auth/rbac.ts` and applied in route handlers.

**Theme:** `next-themes` with CSS variable tokens; `ThemeProvider` at root.

**Type-safety:** TypeScript strict-ish; build errors suppressed via `ignoreBuildErrors: true` in `next.config.ts` (known debt).

**DB client:** Supabase admin client (`lib/supabase/admin.ts`) used exclusively server-side; browser client (`lib/supabase/client.ts`) used only for Realtime subscriptions.

---

*Architecture analysis: 2026-05-07*
