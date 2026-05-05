# Architecture

**Analysis Date:** 2026-05-06

## Pattern Overview

**Overall:** Layered Next.js App Router architecture with clear separation between presentation, application logic, domain services, and infrastructure.

**Key Characteristics:**
- Next.js 15 (App Router) on the frontend/server boundary
- Client-side context providers (React Context) for global state
- Server-side API routes (`app/api/`) for business logic and external service integration
- Strict auth boundaries enforced by middleware
- Service layer for domain-specific operations (PDF parsing, AI, exports, pricing)
- Utility layer for pure helpers and parsers

## Layers

**Presentation Layer:**
- Purpose: User interface and page rendering
- Location: `app/`, `components/`, `views/`
- Contains: Server components (layout, routing), client components (interactive UX), page-level wrappers with dynamic imports
- Depends on: Context providers, hooks, services (via fetch calls)
- Used by: Browser/Next.js routing

**Application Layer:**
- Purpose: Orchestration of user interactions and business workflows
- Location: `contexts/` (ProjectContext.tsx, AuthContext.tsx, etc.), `hooks/`
- Contains: React Context providers, custom hooks for state management and side effects
- Depends on: API routes, local state
- Used by: Presentation components

**Domain/Service Layer:**
- Purpose: Business logic and core operations
- Location: `services/` (geminiService.ts, fileUploadService.ts, doorScheduleService.ts, etc.)
- Contains: PDF parsing, AI extraction, data validation, export generation, pricing calculations
- Depends on: Utilities, external SDKs (Google GenAI, OpenAI), database clients
- Used by: API routes, application layer

**Infrastructure Layer:**
- Purpose: External service integration and low-level operations
- Location: `lib/` (auth/*, db/*, ai/*, supabase/)
- Contains: Supabase client initialization, auth session resolution, RBAC logic, database helpers
- Depends on: External APIs (Supabase, Google, OpenRouter)
- Used by: Services, API routes

## Data Flow

**User Authentication Flow:**

1. Browser requests any protected route
2. `middleware.ts` reads session cookie (`SESSION_COOKIE_NAME`)
3. `lib/auth/sessionResolver.ts` validates token against Supabase
4. `lib/auth/rbac.ts` checks role-based access (route must match user role)
5. If valid → request passes through, else → redirects to `/login`
6. On login, `POST /api/auth/login` creates session and sets secure cookie
7. `AuthContext.tsx` hydrates user state from `/api/auth/me` on app load

**Project Data Flow:**

1. `page.tsx` (home) calls `useProject()` context hook
2. `ProjectContext.tsx` fetches `/api/projects` on mount (if authenticated)
3. Projects populate local React state
4. Components read from context and trigger handlers (e.g., `onSelectProject`)
5. Actions (create, update, delete) call API endpoints via context methods
6. API routes handle Supabase mutations and return updated state
7. Context updates local state, triggering component re-renders

**PDF Processing & AI Extraction Flow:**

1. User uploads PDF in project view
2. Upload triggers `fileUploadService.ts` handler
3. `extractTextGenerator` (from `utils/pdfParser.ts`) yields text batches (20 pages at a time)
4. Each batch is sent to `/api/ai/generate` with extraction prompt
5. API route calls either `generateWithGemini` or `generateWithOpenRouter` (server-side)
6. AI returns structured JSON (doors, hardware sets)
7. `geminiService.ts` validates and cleans JSON using `safeParseJson` heuristics
8. Validated data is stored in project context and Supabase
9. User sees validation report with errors/warnings

**State Management:**

- **Authentication:** AuthContext.tsx (user, isLoading, login/logout functions)
- **Projects/Hardware:** ProjectContext.tsx (projects, masterInventory, appSettings from localStorage/Supabase)
- **UI State:** ToastContext.tsx, ProcessingWidgetContext.tsx, NavigationLoadingContext.tsx, AnnouncementContext.tsx
- **Local Component State:** Form state, modals, temporary UI toggles

## Key Abstractions

**Project:**
- Purpose: Represents a hardware estimating job
- Examples: `types/index.ts`, `services/doorScheduleService.ts`, API routes in `app/api/projects/`
- Pattern: Interfaces define shape; services handle mutations; context provides access

**Door:**
- Purpose: Individual opening/penetration in building
- Examples: Door objects have `doorTag`, `width`, `height`, `material`, `handingType`
- Pattern: Validated during extraction; stored in project; rendered in schedules

**HardwareSet:**
- Purpose: Specification of hardware for a category of doors
- Examples: Set name, hardware items, finish, pricing group
- Pattern: Can be imported from CSV/Excel, extracted from PDFs, or manually created

**HardwareItem:**
- Purpose: Individual product specification
- Examples: Item code, description, cost, supplier, CSI code
- Pattern: Stored in master inventory; linked to hardware sets for costing

**ValidationReport:**
- Purpose: Results of data extraction/parsing
- Examples: `{ data: T[], errors: ValidationError[], warnings: ValidationError[], summary }`
- Pattern: Used for doors, hardware sets, and file imports

## Entry Points

**Home Page:**
- Location: `app/page.tsx`
- Triggers: App load, user navigates to `/`
- Responsibilities: Fetch projects, render Dashboard component, handle project CRUD actions

**Project Page:**
- Location: `app/project/[id]/page.tsx`
- Triggers: User selects a project from dashboard
- Responsibilities: Load project by ID, render ProjectView with all editing features

**API - AI Generation:**
- Location: `app/api/ai/generate/route.ts`
- Triggers: Client calls `/api/ai/generate` (POST)
- Responsibilities: Route to Gemini or OpenRouter, execute AI extraction, return structured JSON

**API - Auth Login:**
- Location: `app/api/auth/login/route.ts`
- Triggers: User submits login form
- Responsibilities: Validate credentials, create session, set secure cookie, return user object

**API - Projects:**
- Location: `app/api/projects/route.ts` (POST to create, handled by page context)
- Triggers: Dashboard "New Project" button or context call
- Responsibilities: Create project record in Supabase, return with ID

## Error Handling

**Strategy:** Three-tier approach:
1. **Validation errors** (JSON parsing, data validation) → caught in services, returned in ValidationReport
2. **Network/API errors** → caught in fetch calls, surfaced as toast notifications
3. **Critical errors** → caught by ErrorBoundary component, displayed in error modal

**Patterns:**

- `fileUploadService.ts`: validateDoors, validateHardwareSets return `ValidationReport<T>` with error arrays
- `geminiService.ts`: safeParseJson wraps JSON parsing with heuristic fixing; throws SyntaxError if unfixable
- Context methods: Try-catch blocks that call `addToast(message, 'error')` on failure
- Components: useErrorHandler hook for route-level error catching
- API routes: Return `NextResponse.json({ error: string }, { status })` for error responses

## Cross-Cutting Concerns

**Logging:**
- Approach: console.log for informational, console.error for errors
- Examples: `utils/pdfParser.ts` logs PDF page count; services log extraction progress
- No centralized logging system; suitable for development

**Validation:**
- Approach: Dual validation at extraction (AI output) and import (manual file upload)
- Pattern: Validators return ValidationReport with field-level errors and suggestions
- Coverage: Door tags (unique, required), hardware set names, dimensions, cost values

**Authentication:**
- Approach: Session-based with Supabase as auth backend
- Pattern: Middleware enforces protected routes; context hydrates user state; RBAC checks role on every API call
- Roles: Administrator, Team Lead, Estimator (role hierarchy in `ROLE_LEVELS`)

**Authorization:**
- Approach: Role-based access control (RBAC) with route-level permissions
- Pattern: `lib/auth/rbac.ts` maintains ROUTE_PERMISSIONS table; canAccessRoute checks user role
- Examples: `/team` requires Administrator or Team Lead; `/project` requires Estimator or higher

**PDF Processing:**
- Approach: Generator-based streaming with batch yields
- Pattern: `extractTextGenerator` yields PDFBatchResult objects; allows early exit and UI responsiveness
- Concurrency: CONCURRENCY=1 (sequential); architectural target for Phase 2 is parallel queue

**AI Integration:**
- Approach: Server-side proxy pattern
- Pattern: Client calls `/api/ai/generate`; server selects provider (Gemini or OpenRouter)
- Security: API keys never exposed to client; always used server-side

---

*Architecture analysis: 2026-05-06*
