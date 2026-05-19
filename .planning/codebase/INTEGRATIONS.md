# External Integrations

**Analysis Date:** 2026-05-07

## APIs & External Services

**AI Providers:**
- **Google Gemini** — Primary AI for hardware set extraction, door schedule parsing, and image analysis
  - SDK: `@google/genai` ^1.29.1
  - Direct SDK usage: `services/geminiService.ts` (image analysis via `analyzeImageWithAI`)
  - Server-side route: `app/api/ai/generate/route.ts` uses `GoogleGenAI` for text generation
  - Models used: `gemini-2.0-flash-exp` (image), `gemini-2.5-flash` (default text), `gemini-2.0-flash-001` (via OpenRouter)
  - Auth env var: `GEMINI_API_KEY` (server-only, never `NEXT_PUBLIC_`)

- **OpenRouter** — Fallback/alternative AI provider; default provider for the app
  - SDK: `openai` ^6.19.0 with custom `baseURL: 'https://openrouter.ai/api/v1'`
  - Implementation: `app/api/ai/generate/route.ts` → `generateWithOpenRouter()`
  - Default model: `google/gemini-2.0-flash-001`
  - Auth env var: `OPENROUTER_API_KEY` (server-only)
  - Response format: `json_object` when schema is provided

**AI Routing Pattern:**
- All client-side AI calls go through `services/aiProviderService.ts` → `POST /api/ai/generate`
- Provider selection (`gemini` | `openrouter`) and model are passed in request body
- User preferences stored in `localStorage` key `tve_app_settings`; defaults to OpenRouter if not set
- API keys never leave the server

## Data Storage

**Databases:**
- **Supabase (PostgreSQL)** — Primary data store for all application data
  - Project URL env var: `NEXT_PUBLIC_SUPABASE_URL` (safe for browser)
  - Anon key env var: `NEXT_PUBLIC_SUPABASE_ANON_KEY` (safe for browser)
  - Service role key env var: `SUPABASE_SERVICE_ROLE_KEY` (server-only; bypasses RLS)
  - Browser client: `lib/supabase/client.ts` → `createBrowserClient()` from `@supabase/ssr`
  - Server client: `lib/supabase/server.ts` → `createServerClient()` from `@supabase/ssr` (reads cookies)
  - Admin client: `lib/supabase/admin.ts` → `createClient()` with service role key (RLS bypass)
  - Legacy client: `lib/supabase.ts` → direct `createClient()` (used during migration; new code uses typed clients above)

**Database Schema (via migrations in `supabase/migrations/`):**
| Migration | Table(s) |
|-----------|----------|
| `001_auth_tables.sql` | Auth: team_members, roles, sessions |
| `002_schema_updates_and_projects.sql` | Projects table |
| `003_project_location_lookup.sql` | Location reference data |
| `004_relational_hardware_schema.sql` | Hardware sets, items (relational) |
| `005_elevation_images.sql` | Elevation image storage metadata |
| `006_fix_elevation_policies.sql` | RLS policy fixes |
| `007_project_elevation_types.sql` | Elevation type enum |
| `008_master_hardware_items.sql` | Master hardware item library |
| `009_hardware_trash.sql` | Soft-delete trash table |
| `010_fix_master_hardware_uniqueness.sql` | Uniqueness constraints |
| `011_project_notes.sql` | Notes per project |
| `012_enable_realtime.sql` | Supabase Realtime publication |
| `013_pricing_report.sql` | Pricing report table |
| `014_pricing_proposal.sql` | Proposal table |
| `015_proposal_extras.sql` | Proposal extras |
| `016_proposal_remarks.sql` | Proposal remarks |
| `017_company_settings.sql` | Company-wide settings |
| `018_proposal_tax_rows.sql` | Tax rows for proposals |

**File Storage:**
- No dedicated cloud file storage integration detected (no S3/GCS/Supabase Storage bucket client found)
- Files are processed in-memory (PDF, Excel, DOCX) and exported to browser via `file-saver`

**Caching:**
- None detected (no Redis, Vercel KV, or similar)
- User settings cached in `localStorage` (`tve_app_settings`)

## Authentication & Identity

**Auth Provider:**
- **Custom session-based authentication** — not using Supabase Auth for session management
  - Sessions stored in Supabase DB (`sessions` table via `001_auth_tables.sql`)
  - Session token stored in HTTP-only cookie; cookie name from `AUTH_CONFIG.SESSION_COOKIE_NAME` (`constants/auth.ts`)
  - Password hashing: `bcryptjs` ^2.4.3
  - Session resolution: `lib/auth/sessionResolver.ts` → `resolveSessionFromToken()`
  - Session validation: `lib/auth/session.ts` → `validateSession()` / `quickSessionCheck()`
  - Auth enforcement: `middleware.ts` runs on all non-static routes

- **Supabase Auth Admin** (for invite emails only)
  - `db.auth.admin.inviteUserByEmail()` in `services/emailService.ts`
  - Triggers Supabase's built-in "Invite User" email template
  - Email template stored in `supabase/email-templates/invite-user.html`

**RBAC (Role-Based Access Control):**
- Implemented in `lib/auth/rbac.ts`
- Roles: `Administrator`, `Team Lead`, `Estimator` (defined in `constants/roles.ts` via `ROLE_LEVELS`)
- Route permission table in `lib/auth/rbac.ts` → `ROUTE_PERMISSIONS[]`
- Middleware enforces role access on every request via `canAccessRoute()`
- Client-side RBAC hook: `hooks/useRBAC.ts`

**Login Flow:**
- Login page: `app/(auth)/login/`
- Login API: `app/api/auth/login/route.ts`
- Logout API: `app/api/auth/logout/route.ts`
- Current user: `app/api/auth/me/route.ts`
- Invite flow: `app/api/team/invite/`, `app/api/team/set-password/`, `app/set-password/`

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, Datadog, etc.)

**Logs:**
- `console.error()` / `console.warn()` used throughout services for error logging
- No structured logging framework

## Email

**Provider:** Supabase built-in email infrastructure
- Used exclusively for invite emails via `auth.admin.inviteUserByEmail()`
- Custom HTML template: `supabase/email-templates/invite-user.html`
- Redirect URL after invite: `NEXT_PUBLIC_APP_URL/set-password?token=<invite_token>`
- Redirect URL must be allowlisted in Supabase Dashboard → Authentication → URL Configuration

## Realtime

**Supabase Realtime (Postgres Changes):**
- Hook: `hooks/useProjectRealtime.ts`
- Subscribes to `door_schedule_imports` table changes per project (`project_id` filter)
- Channel pattern: `project-realtime-{projectId}`
- Enabled via migration `012_enable_realtime.sql`

## Background Processing

**Web Worker:**
- `workers/upload.worker.ts` — offloads file processing (PDF/Excel parsing + AI extraction) to a background thread
- Handles `door-schedule` and `hardware-set` upload types
- Communicates via `postMessage` with `progress`, `partial_data`, `complete`, `cancelled`, `error` message types
- Supports `STOP` and `CANCEL` abort signals via `AbortController`
- Context: `contexts/BackgroundUploadContext.tsx`

## Export Formats

**Client-side export services in `services/`:**
| Service | Format | Key Library |
|---------|--------|-------------|
| `pdfExportService.ts` / `hardwarePdfService.ts` / `hardwarePdfServiceV2.ts` | PDF | `jspdf`, `jspdf-autotable` |
| `excelExportService.ts` | XLSX | `exceljs` |
| `csvExportService.ts` | CSV | `papaparse` |
| `cobieExportService.ts` | COBie 2.4 XLSX | `xlsx`, `file-saver` |
| `reportExportService.ts` / `pricingReportService.ts` | PDF/Print | `react-to-print` |
| `doorSchedulePdfService.ts` | Door schedule PDF | `jspdf` |

## CI/CD & Deployment

**Hosting:**
- Not explicitly configured in repo (no `vercel.json`, `Dockerfile`, or platform config found)
- Next.js output suitable for Vercel, self-hosted Node, or any Node-compatible platform

**CI Pipeline:**
- None detected (no `.github/workflows/`, `.gitlab-ci.yml`, etc.)

## Environment Variables Reference

All required variables documented in `.env.example`:

| Variable | Scope | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + Server | Supabase public/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Supabase admin access (RLS bypass) |
| `GEMINI_API_KEY` | Server only | Google Gemini API authentication |
| `OPENROUTER_API_KEY` | Server only | OpenRouter API authentication |
| `NEXT_PUBLIC_APP_URL` | Browser + Server | App base URL (invite redirect links) |

**Legacy variable (dead code — referenced in `services/geminiService.ts` line 265):**
- `VITE_GEMINI_API_KEY` — leftover from a Vite migration; not in `.env.example`; should be removed

## Webhooks & Callbacks

**Incoming:**
- None detected (no webhook endpoint handlers)

**Outgoing:**
- None detected (no outgoing webhook calls)

---

*Integration audit: 2026-05-07*
