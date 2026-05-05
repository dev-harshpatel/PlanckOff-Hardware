# Directory Structure

**Analysis Date:** 2026-05-06

## Top-Level Layout

```
F:/PlanckOff-Hardware/
├── app/                  Next.js 15 App Router pages, API routes, layouts
├── components/           Reusable UI components (~50 files, mixed concerns)
├── views/                Page-level composition components
├── contexts/             React Context providers (auth, project, UI state)
├── services/             Domain/business-logic layer (AI, exports, parsing)
├── lib/                  Infrastructure (auth, db, supabase, ai)
├── hooks/                Reusable React hooks
├── workers/              Web Workers (background file processing)
├── utils/                Pure utility functions and parsers
├── constants/            Centralised constant values
├── types/                Domain type definitions (split per area)
├── supabase/             Migrations, seeds, email templates
├── scripts/              One-off CLI scripts (e.g. test-merge)
├── public/               Static assets served at /
├── docs/                 In-repo design notes
├── debug-extractions/    Sample extraction outputs (not shipped)
├── .planning/            GSD planning artefacts (this directory)
├── .claude/              Claude Code config (commands, settings, skills)
├── types.ts              Legacy monolithic domain types (742 lines — Phase 3 split target)
├── middleware.ts         Auth + RBAC enforcement at the edge
├── next.config.ts        Build, transpile, externalise rules
├── tailwind.config.ts    Tailwind theme + dark-mode tokens
├── tsconfig.json         strict: false during migration
├── postcss.config.js     PostCSS pipeline
├── package.json          Dependencies + scripts (dev/build/start/lint)
├── README.md             Project overview
└── CLAUDE.md             Project guide for Claude Code (note: stale in some
                          places — auth/AI-proxy migration is further along
                          than CLAUDE.md describes)
```

## Layer-to-Folder Mapping

| Layer | Folder | Examples |
|---|---|---|
| Presentation | `app/` | `app/page.tsx`, `app/project/[id]/page.tsx`, `app/layout.tsx` |
| Presentation | `components/` | `components/Header.tsx`, `components/HardwareSetModal.tsx` |
| Presentation | `views/` | `views/Dashboard.tsx`, `views/ProjectView.tsx`, `views/PricingView.tsx` |
| Application | `contexts/` | `contexts/AuthContext.tsx`, `contexts/ProjectContext.tsx`, `contexts/ToastContext.tsx` |
| Application | `hooks/` | `hooks/useKeyboardShortcuts.ts`, `hooks/useProjectRealtime.ts`, `hooks/useRBAC.ts` |
| Domain/Service | `services/` | `services/geminiService.ts`, `services/fileUploadService.ts`, `services/pricingService.ts` |
| Domain/Service | `utils/` | `utils/pdfParser.ts`, `utils/csvParser.ts`, `utils/docxParser.ts`, `utils/doorValidation.ts` |
| Infrastructure | `lib/auth/` | `lib/auth/sessionResolver.ts`, `lib/auth/rbac.ts`, `lib/auth/api-helpers.ts` |
| Infrastructure | `lib/db/` | `lib/db/projects.ts`, `lib/db/hardware.ts`, `lib/db/team.ts` |
| Infrastructure | `lib/supabase/` | `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts` |
| Infrastructure | `lib/ai/` | `lib/ai/generate.ts`, `lib/ai/pdfTextExtractor.ts` |
| Infrastructure | `app/api/` | `app/api/ai/generate/route.ts`, `app/api/auth/login/route.ts`, `app/api/projects/route.ts` |
| Workers | `workers/` | `workers/upload.worker.ts` |

## App Router Structure (`app/`)

```
app/
├── layout.tsx                Root layout + provider tree
├── page.tsx                  Dashboard / home
├── providers.tsx             Combined ProviderTree wrapper
├── globals.css               Global styles + CSS variables
├── (auth)/                   Auth route group (login, register, etc.)
├── set-password/             Set/reset password flow
├── settings/                 User/company settings UI
├── team/                     Team management UI
├── project/                  Per-project workspace
├── database/                 Master inventory / database browser
└── api/                      Server-side API routes (see below)
```

### API Routes (`app/api/`)

```
app/api/
├── ai/
│   └── generate/route.ts            POST — server-side proxy for Gemini/OpenRouter
├── auth/
│   ├── login/route.ts               POST — credential check, set session cookie
│   ├── logout/route.ts              POST — clear session
│   └── me/route.ts                  GET — hydrate current user
├── master-hardware/
│   ├── route.ts                     CRUD for master inventory items
│   ├── pending/route.ts             Pending review queue
│   └── [id]/route.ts                Per-item operations
├── project-locations/route.ts       Project locations registry
├── projects/
│   ├── route.ts                     List/create projects
│   ├── trash/route.ts               Soft-deleted projects
│   └── [id]/route.ts                Per-project operations
├── settings/
│   └── company/route.ts             Company settings
└── team/
    ├── invite/route.ts              Send team invitations
    ├── members/route.ts             List/manage members
    └── set-password/route.ts        Initial password set for invited users
```

## Key Locations

**Entry points:**
- `app/layout.tsx` — root layout, mounts `app/providers.tsx`
- `app/page.tsx` — dashboard route
- `app/project/[id]/page.tsx` — project workspace route
- `middleware.ts` — runs before every request, enforces auth + RBAC

**Provider tree:**
- `app/providers.tsx` — composes `AuthProvider`, `ToastProvider`, `ProjectProvider`,
  `BackgroundUploadProvider`, `ProcessingWidgetProvider`, `NavigationLoadingProvider`,
  `AnnouncementProvider`, `next-themes` `ThemeProvider`

**State:**
- `contexts/AuthContext.tsx` (123 lines) — real Supabase-backed session, hydrates
  from `/api/auth/me`. Note: CLAUDE.md describes a stub here, but the file has
  already been migrated.
- `contexts/ProjectContext.tsx` (243 lines) — projects, master inventory, app
  settings. Significantly smaller than CLAUDE.md's "1000+ lines" claim.
- `contexts/BackgroundUploadContext.tsx` — long-running upload tracking
- `contexts/ProcessingWidgetContext.tsx` — global processing indicator
- `contexts/ToastContext.tsx` — Sonner toast adapter
- `contexts/AnnouncementContext.tsx`, `contexts/NavigationLoadingContext.tsx` — UI helpers

**AI / extraction:**
- `services/geminiService.ts` (771 lines) — extraction orchestration, JSON repair
- `services/aiProviderService.ts` — provider abstraction (Gemini / OpenRouter)
- `lib/ai/generate.ts` — server-side generation helper (used by API route)
- `lib/ai/pdfTextExtractor.ts` — server-side PDF text extraction helper
- `app/api/ai/generate/route.ts` — actual server-side proxy

**PDF pipeline:**
- `utils/pdfParser.ts` (96 lines) — `extractTextGenerator` async generator yielding
  page batches
- `services/fileUploadService.ts` (337 lines) — upload routing → parsers → AI
- `workers/upload.worker.ts` (69 lines) — single Web Worker for offloaded parsing

**Auth/RBAC:**
- `lib/auth/sessionResolver.ts` — cookie-based session resolution
- `lib/auth/rbac.ts` — `ROUTE_PERMISSIONS`, `canAccessRoute`, role hierarchy
- `lib/auth/api-helpers.ts` — auth wrappers for API routes
- `lib/auth/session.ts` — session token helpers
- `middleware.ts` — wires the above into edge enforcement

**Domain types:**
- `types.ts` (742 lines) — legacy monolithic types (Door, HardwareSet, Project, etc.)
- `types/auth.ts` — auth-specific types (already split out)
- `types/team.ts` — team-management types

**Constants:**
- `constants/auth.ts` — session cookie name, timing constants
- `constants/inventory.ts` — master inventory seed (TODO marker for Supabase migration)
- `constants/roles.ts` — role identifiers and hierarchy

**Database:**
- `supabase/migrations/` — SQL migrations (canonical schema source)
- `supabase/seeds/` — seed data
- `supabase/email-templates/` — Supabase Auth email templates
- `lib/supabase/client.ts` — browser client
- `lib/supabase/server.ts` — server-side client
- `lib/supabase/admin.ts` — service-role client
- `lib/db/*.ts` — typed query helpers (one per domain area)

## Naming Conventions Observed

| Asset | Convention | Examples |
|---|---|---|
| React components | `PascalCase.tsx` | `Header.tsx`, `HardwareSetModal.tsx`, `EnhancedDoorEditModal.tsx` |
| Page components | `page.tsx` (Next.js convention) | `app/page.tsx`, `app/project/[id]/page.tsx` |
| Route handlers | `route.ts` (Next.js convention) | `app/api/ai/generate/route.ts` |
| Layouts | `layout.tsx` (Next.js convention) | `app/layout.tsx` |
| Services | `camelCaseService.ts` | `geminiService.ts`, `pricingService.ts`, `fileUploadService.ts` |
| Utilities | `camelCase.ts` | `pdfParser.ts`, `csiMasterFormat.ts`, `hardwareMatcher.ts` |
| Hooks | `useCamelCase.ts` | `useKeyboardShortcuts.ts`, `useRBAC.ts`, `useProjectRealtime.ts` |
| Contexts | `PascalCaseContext.tsx` | `AuthContext.tsx`, `ProjectContext.tsx` |
| Types | `camelCase.ts` (split) or monolithic `types.ts` | `types/auth.ts`, `types/team.ts`, `types.ts` |
| Constants | `camelCase.ts` | `auth.ts`, `inventory.ts`, `roles.ts` |
| Migrations | `<timestamp>_<slug>.sql` | (in `supabase/migrations/`) |
| Workers | `<name>.worker.ts` | `upload.worker.ts` |

## Path Aliases

- `@/*` → project root (configured in `tsconfig.json`)
- Imports typically: React/Next → third-party → `@/lib`/`@/services` → relative

## Notable Anomalies

- `components/HardwareSetsManager_fix.txt` — orphaned working file, should be removed
- `components/HardwareSetsManager.tsx` exists alongside it (the live version)
- `services/hardwarePdfService.ts` and `services/hardwarePdfServiceV2.ts` coexist —
  V2 likely the active path; V1 may be legacy
- `App.tsx`, `index.tsx`, `views/ReportsViewWrapper.tsx` are excluded from `tsconfig.json`
  — leftover Vite entry points from before the Next.js migration
- `metadata.json`, `prompt.txt`, `pdf_example.json`, `door_schedule_excel_sheet.json`,
  `final-json-format.json` at repo root — fixture/sample files; consider moving under
  `docs/` or `debug-extractions/`

---

*Structure analysis: 2026-05-06*
