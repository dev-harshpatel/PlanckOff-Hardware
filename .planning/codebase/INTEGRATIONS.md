# External Integrations

**Analysis Date:** 2026-05-06

## APIs & External Services

**AI Data Extraction:**
- **Google Gemini** - Primary model for PDF/document data extraction
  - SDK: `@google/genai@1.29.1`
  - Models: `gemini-2.5-flash`, `gemini-2.0-flash-exp` (vision)
  - Auth: `GEMINI_API_KEY` (server-only, `app/api/ai/generate/route.ts`)
  - Usage: Extract doors, hardware sets, dimensions from PDFs via `/api/ai/generate`
  - Concurrency: Sequential (CONCURRENCY=1) due to Free Tier limits
  - Path: `app/api/ai/generate/route.ts` (POST endpoint)

- **OpenRouter** - Fallback/alternative provider
  - SDK: `OpenAI@6.19.0` (OpenAI-compatible API)
  - Default model: `google/gemini-2.0-flash-001`
  - Auth: `OPENROUTER_API_KEY` (server-only)
  - Usage: Multi-provider abstraction, load balancing fallback
  - Path: `app/api/ai/generate/route.ts` (dual implementation)

**Image Analysis:**
- **Google Gemini Vision** - Image-to-text analysis
  - Model: `gemini-2.0-flash-exp`
  - Function: `analyzeImageWithAI()` in `services/geminiService.ts`
  - Note: Currently uses `VITE_GEMINI_API_KEY` from client (Phase 1 security concern)

## Data Storage

**Primary Database:**
- **Supabase** (PostgreSQL + Realtime + Auth)
  - Version: `@supabase/supabase-js@2.93.1`
  - URL env var: `NEXT_PUBLIC_SUPABASE_URL`
  - Anon key: `NEXT_PUBLIC_SUPABASE_ANON_KEY` (browser-safe, RLS-controlled)
  - Service role key: `SUPABASE_SERVICE_ROLE_KEY` (server-only, admin ops)
  - Connection: Automatic in Server Components via `lib/supabase/server.ts`
  - Browser client: `lib/supabase/client.ts` (SSR-safe)
  - Admin client: `lib/supabase/admin.ts` (API routes only)
  - Tables (inferred from code):
    - `team_members` - User accounts with roles (Administrator, SeniorEstimator, Estimator, Viewer)
    - `sessions` - Auth session tracking (expiry tracking)
    - `projects` - Construction project records
    - `door_schedule` - Door specifications
    - `hardware_sets` - Hardware specifications
    - `master_hardware` - Shared hardware catalog
    - `project_locations` - Location/room assignments
    - `pricing` - Cost data
    - `company_settings` - Team configuration (logo, name)
    - `notes` - Project notes
  - Auth: Row-Level Security (RLS) policies in place

**Legacy Storage:**
- **localStorage** (temporary, Phase 1 migration target)
  - Current use: User authentication state, app settings, door/hardware project data
  - Phase 1 requirement: Migrate all localStorage to Supabase
  - Keys identified: `tve_app_settings`, project state, etc.
  - Status: Being replaced by Supabase integration

**File Storage:**
- **Supabase Storage** (implied, not yet active)
  - Intended for: Uploaded PDFs, generated reports
  - Current: Files processed in-memory, stored in JSON

**Caching:**
- None detected - all data flows real-time from Supabase or AI

## Authentication & Identity

**Auth Provider:**
- **Supabase Auth** (custom-managed with RLS)
  - Type: Email + password (self-managed in database)
  - Implementation:
    - Login: `/api/auth/login` (POST) → bcrypt password verification against `admin_users` table
    - Logout: `/api/auth/logout` (POST) → clears session cookie
    - Session check: `/api/auth/me` (GET) → reads `auth_token` cookie, verifies session
    - Password hashing: `bcryptjs@2.4.3`
  - Session storage: HTTP-only cookies (secure in production)
  - Cookie details: `lib/auth/api-helpers.ts` and `constants/auth.ts`
  - RLS: Row-level security on all tables (role-based: Administrator, SeniorEstimator, Estimator, Viewer)
  - Status: **NOT YET SUPABASE AUTH** - currently in-database with manual session management
  - Phase 1.1 target: Migrate to Supabase native auth

**Team Invitation:**
- Invite flow: `/api/team/invite` (POST)
  - Generates token, sends email via Supabase
  - Invite acceptance: `/api/team/invite/[token]` (GET/POST)
  - Password reset: `/api/team/set-password` (POST)
  - Path: `app/api/team/invite/route.ts`

## Monitoring & Observability

**Error Tracking:**
- None detected - errors logged to console

**Logs:**
- Console logging (development)
- No centralized logging service detected

**Analytics:**
- None detected

## CI/CD & Deployment

**Hosting:**
- Not specified - assumed Next.js-compatible cloud (Vercel, etc.)

**CI Pipeline:**
- GitHub Actions (repo indicated by `@` prefix in commits)
- Pull request workflow: Branch `dev-harshpatel/optimization` merged to `main`
- Recent commits show active development and bug fixes

**Build Process:**
- `npm run build` - Next.js compilation
- `npm run dev` - Turbopack dev server (port 3000)
- `npm run start` - Production server

## Environment Configuration

**Required env vars (for full functionality):**

Public (browser-safe):
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000  # or production domain
```

Server-only (NEVER expose):
```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-api-key
OPENROUTER_API_KEY=your-openrouter-api-key
NODE_ENV=production  # or development
```

**Secrets location:**
- `.env.local` - Local development (git-ignored)
- Production platform (Vercel/Railway/etc): Config variables

**Load defaults:**
- `lib/supabase.ts` - Fallback placeholders if missing (warns to console)
- `app/api/ai/generate/route.ts` - Throws if API keys missing

## Webhooks & Callbacks

**Incoming:**
- `/api/ai/generate` - AI content generation (internal)
- `/api/auth/*` - Authentication endpoints (login, logout, session)
- `/api/projects/*` - Project CRUD and sub-routes
- `/api/team/*` - Team management
- `/api/settings/*` - Company settings
- `/api/master-hardware/*` - Shared hardware catalog

**Outgoing:**
- **Supabase email invitations** - Team member invites via `auth.users.send_invite_link()`
- **Supabase Realtime** - Push updates if subscribed to channels (not yet active in UI)

**Polling/Batching:**
- PDF processing: Sequential chunks (CONCURRENCY=1)
- Chunk size: 10 pages per AI request
- Retry logic: 5 retries with exponential backoff (2s base delay)

## Data Extraction Pipeline

**PDF → Doors + Hardware:**

1. **Upload** → `services/fileUploadService.ts`
   - Accepts: PDF, DOCX, CSV, XLSX
   - Size limit: 10MB (enforced in upload handler)

2. **Parse** → `utils/pdfParser.ts` (PDF) or format-specific parsers
   - PDF: `pdfjs-dist` → text extraction
   - DOCX: `mammoth` → text conversion
   - XLSX/CSV: `xlsx` + `papaparse` → direct parsing
   - Generator-based batch yielding for memory efficiency

3. **Extract via AI** → `services/geminiService.ts`
   - Batch 1: `extractDoorsFromText()` → Door array schema
   - Batch 2: `extractHardwareSetsFromText()` → HardwareSet array schema
   - Model: `gemini-2.5-flash` (default)
   - Provider fallback: OpenRouter if Gemini unavailable
   - Retry: 5 attempts with exponential backoff

4. **Validate** → Inline validation
   - Door validation: unique tags, dimension sanity, type inference
   - Hardware validation: unique set names, item completeness
   - Errors/warnings collected and returned to UI

5. **Store** → Supabase
   - `door_schedule` table
   - `hardware_sets` table

**Hardware Assignment:**
- Function: `assignHardwareWithAI()` in `services/geminiService.ts`
- Heuristics: Exact match → normalized match → AI fuzzy match
- Quantity adjustment: Auto-scale hinges based on door height

---

*Integration audit: 2026-05-06*
