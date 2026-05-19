# Codebase Structure

**Analysis Date:** 2026-05-07

## Directory Layout

```
PlanckOff-Hardware/
├── app/                        # Next.js App Router — pages and API routes
│   ├── (auth)/                 # Route group: unauthenticated pages
│   │   └── login/              # Login page
│   ├── api/                    # REST API route handlers
│   │   ├── ai/generate/        # AI generation endpoint
│   │   ├── auth/               # Auth endpoints (login, logout, me)
│   │   ├── master-hardware/    # Master hardware item CRUD + pending review
│   │   ├── project-locations/  # Project location lookup
│   │   ├── projects/           # Project CRUD + per-project sub-routes
│   │   │   └── [id]/           # Project-scoped endpoints
│   │   ├── settings/company/   # Company settings + logo upload
│   │   └── team/               # Team members, invites, set-password
│   ├── database/               # Database view page
│   ├── project/[id]/           # Project detail page + report sub-pages
│   │   └── reports/            # Per-project report pages
│   │       ├── door-schedule/
│   │       ├── hardware-set/
│   │       ├── pricing/
│   │       └── submittal-package/
│   ├── set-password/           # Accept-invite / set-password page
│   ├── settings/               # Company settings page
│   ├── team/                   # Team management page
│   ├── globals.css             # Global CSS custom properties and base styles
│   ├── layout.tsx              # Root layout — wraps all pages in Providers + AppShell
│   ├── page.tsx                # Dashboard (home) page
│   └── providers.tsx           # All context providers composed here
├── components/                 # Shared and feature-specific UI components
│   ├── skeletons/              # Loading skeleton components
│   ├── team/                   # Team-specific modal components
│   └── ui/                     # Primitive shadcn/ui components
├── constants/                  # App-wide constant values
│   ├── auth.ts                 # Auth config constants (cookie name, etc.)
│   ├── inventory.ts            # Inventory-related constants
│   └── roles.ts                # Role definitions
├── contexts/                   # React context providers
├── hooks/                      # Custom React hooks
├── lib/                        # Server-side library utilities
│   ├── ai/                     # AI-related server utilities
│   ├── auth/                   # Session management, RBAC, helpers
│   ├── db/                     # Supabase DB query modules
│   └── supabase/               # Supabase client factories (admin, client, server)
├── scripts/                    # One-off utility scripts
├── services/                   # Client-side service modules (PDF, CSV, merge, etc.)
├── supabase/                   # Supabase project config
│   ├── email-templates/        # Transactional email HTML templates
│   ├── migrations/             # Ordered SQL migration files
│   └── seeds/                  # Seed scripts for dev data
├── types/                      # Shared TypeScript type definitions
│   ├── auth.ts                 # AuthUser, Admin, RoleName
│   └── team.ts                 # TeamMember types
├── types.ts                    # Legacy root-level types file
├── utils/                      # Pure client-side utility functions
├── views/                      # Full-page view components (one per route)
├── workers/                    # Web Worker scripts
│   └── upload.worker.ts        # Background file upload worker
├── middleware.ts               # Edge middleware — auth guard + RBAC
├── next.config.ts              # Next.js configuration
├── tailwind.config.ts          # Tailwind CSS configuration
├── tsconfig.json               # TypeScript configuration
└── public/                     # Static assets (images, icons)
```

## Directory Purposes

**`app/`**
- Purpose: Next.js App Router — every file named `page.tsx` is a rendered route; every file named `route.ts` is an API handler
- Contains: Route pages, API handlers, the root layout, global CSS, and the providers wrapper
- Key files: `app/layout.tsx`, `app/page.tsx`, `app/providers.tsx`

**`app/(auth)/`**
- Purpose: Route group for pages that do not require authentication
- Contains: `login/page.tsx` — the login form
- Note: Parenthesised group name is invisible in the URL

**`app/api/`**
- Purpose: All backend REST endpoints, each in their own `route.ts`
- Contains: Auth, projects, master hardware, team, settings, AI, and project-location routes
- Pattern: `app/api/projects/[id]/door-schedule/route.ts` handles `GET /api/projects/{id}/door-schedule`

**`app/project/[id]/`**
- Purpose: The main project workspace page and its report sub-pages
- Contains: `page.tsx` (project detail), `reports/layout.tsx`, and four report pages

**`components/`**
- Purpose: Reusable UI components shared across multiple views or pages
- Contains: Feature modals, editors, layout pieces, skeleton loaders, shadcn primitives
- Key files: `components/AppShell.tsx`, `components/Header.tsx`, `components/ErrorBoundary.tsx`
- Subdirectories:
  - `components/ui/` — primitive shadcn/ui components (button, dialog, input, etc.)
  - `components/skeletons/` — page-level loading skeletons
  - `components/team/` — team invite modal

**`views/`**
- Purpose: Full-page view components; one per major application route
- Contains: `Dashboard.tsx`, `ProjectView.tsx`, `DatabaseView.tsx`, `PricingView.tsx`, `ReportsView.tsx`, `TeamManagement.tsx`, `AppShell.tsx`
- Pattern: Pages in `app/` import view components from `views/` using `dynamic()` with `ssr: false` for browser-only APIs

**`lib/`**
- Purpose: Server-side shared utilities — never imported by client components
- Contains:
  - `lib/auth/` — session resolution (`session.ts`, `sessionResolver.ts`), RBAC (`rbac.ts`), API helpers (`api-helpers.ts`)
  - `lib/db/` — Supabase DB query functions grouped by domain (`projects.ts`, `hardware.ts`, `pricing.ts`, `team.ts`, etc.)
  - `lib/supabase/` — Supabase client factories (`client.ts` for browser, `server.ts` for server, `admin.ts` for service-role, `index.ts` barrel)
  - `lib/ai/` — Server-side AI utilities (`generate.ts`, `pdfTextExtractor.ts`)

**`services/`**
- Purpose: Client-side service modules that encapsulate complex business logic (PDF generation, export, merge, etc.)
- Contains: `doorSchedulePdfService.ts`, `hardwarePdfService.ts`, `csvExportService.ts`, `excelExportService.ts`, `pricingService.ts`, `mergeService.ts`, `geminiService.ts`, `emailService.ts`, and more
- Note: These are browser-executed modules, not server-side; they are imported inside view components

**`contexts/`**
- Purpose: React context providers for global client-side state
- Contains: `AuthContext.tsx`, `ProjectContext.tsx`, `ToastContext.tsx`, `BackgroundUploadContext.tsx`, `NavigationLoadingContext.tsx`, `ProcessingWidgetContext.tsx`, `AnnouncementContext.tsx`
- All providers are composed in `app/providers.tsx`

**`hooks/`**
- Purpose: Custom React hooks
- Contains: `useKeyboardShortcuts.ts`, `useProjectRealtime.ts`, `useRBAC.ts`

**`utils/`**
- Purpose: Pure utility functions with no React or server dependencies
- Contains: Parsers (`csvParser.ts`, `xlsxParser.ts`, `docxParser.ts`, `pdfParser.ts`), transformers (`hardwareTransformers.ts`), validators (`doorValidation.ts`), and generators (`reportGenerator.ts`, `csvExporter.ts`)

**`types/`**
- Purpose: Shared TypeScript type definitions
- Contains: `auth.ts` (RoleName, AuthUser, Admin), `team.ts` (TeamMember)
- Note: A legacy `types.ts` exists at the project root and contains older domain types

**`constants/`**
- Purpose: App-wide constant values (not environment variables)
- Contains: `auth.ts` (session cookie name, AUTH_CONFIG), `roles.ts` (role definitions), `inventory.ts`

**`supabase/`**
- Purpose: Supabase project configuration and database management files
- Contains: `migrations/` (sequential numbered SQL files), `seeds/` (dev seed data), `email-templates/` (HTML invite emails)
- Committed: Yes — hand-authored migrations

**`workers/`**
- Purpose: Web Worker scripts for off-main-thread processing
- Contains: `upload.worker.ts` — handles background file uploads

**`public/`**
- Purpose: Static assets served at the root URL
- Contains: Images and icons

## Key File Locations

**Entry Points:**
- `app/layout.tsx` — root HTML shell, attaches Providers and AppShell
- `app/page.tsx` — dashboard home page
- `middleware.ts` — edge auth guard, runs before every non-static request

**Configuration:**
- `next.config.ts` — Next.js build and runtime config
- `tailwind.config.ts` — Tailwind CSS config
- `tsconfig.json` — TypeScript config, defines `@/*` path alias mapping to project root
- `postcss.config.js` — PostCSS config

**Core Logic:**
- `lib/auth/session.ts` — session creation and validation
- `lib/auth/rbac.ts` — role-based access control rules
- `lib/db/projects.ts` — all project-related DB queries
- `lib/db/hardware.ts` — hardware DB queries
- `lib/supabase/server.ts` — server-side Supabase client factory

**Provider Composition:**
- `app/providers.tsx` — single file that nests all context providers in correct order

## Naming Conventions

**Files:**
- React components: `PascalCase.tsx` (e.g., `DoorScheduleManager.tsx`)
- API routes: `route.ts` (fixed Next.js name)
- Service modules: `camelCaseService.ts` (e.g., `pricingService.ts`)
- Utility functions: `camelCase.ts` (e.g., `csvParser.ts`)
- Context files: `PascalCaseContext.tsx` (e.g., `AuthContext.tsx`)
- Hook files: `useCamelCase.ts` (e.g., `useRBAC.ts`)
- Type files: `camelCase.ts` (e.g., `auth.ts`, `team.ts`)

**Directories:**
- `kebab-case` for multi-word route segments (e.g., `door-schedule`, `master-hardware`)
- `camelCase` for non-route utility directories

## Where to Add New Code

**New API endpoint:**
- Route handler: `app/api/{resource}/route.ts` or `app/api/{resource}/[id]/route.ts`
- DB query functions: `lib/db/{domain}.ts`
- Auth helpers: `lib/auth/api-helpers.ts`

**New page:**
- App Router page: `app/{route}/page.tsx` (thin shell that imports from `views/`)
- View component: `views/{FeatureName}View.tsx` (full page component with all logic)

**New reusable component:**
- Primitive UI element: `components/ui/{ComponentName}.tsx` (shadcn pattern)
- Feature modal or panel: `components/{FeatureName}Modal.tsx` or `components/{FeatureName}Panel.tsx`
- Loading skeleton: `components/skeletons/{PageName}Skeleton.tsx`

**New client-side service:**
- Service file: `services/{domain}Service.ts`

**New context/global state:**
- Provider: `contexts/{Name}Context.tsx`
- Register in: `app/providers.tsx`

**New custom hook:**
- Hook file: `hooks/use{Name}.ts`

**New utility function:**
- Parser or transformer: `utils/{purpose}.ts`

**New constant:**
- Add to appropriate file in `constants/` or create `constants/{domain}.ts`

**New type:**
- Add to `types/{domain}.ts`; create a new file if no matching domain file exists
- Avoid adding to root-level `types.ts` (legacy file)

**New database migration:**
- Migration file: `supabase/migrations/{NNN}_{description}.sql` — increment the leading number

## Special Directories

**`.next/`** — Next.js build output; generated, not committed

**`node_modules/`** — npm package dependencies; generated, not committed

**`.claude/`** — Claude Code commands and skills configuration; committed

**`supabase/migrations/`** — Ordered SQL migration files applied by Supabase CLI; hand-authored, committed; files are prefixed `001_`, `002_`, etc. — always increment when adding a migration

---

*Structure analysis: 2026-05-07*
