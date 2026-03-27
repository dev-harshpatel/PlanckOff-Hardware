---
description: Migrates this project from React 19 + Vite to Next.js 15 App Router with a clean, scalable folder structure
user-invocable: true
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Next.js Migration Skill

You are executing the `/nextjs-migration` skill. Your job is to migrate this project from React 19 + Vite to Next.js 15 (App Router) with a clean, professional, scalable folder structure.

---

## CONTEXT

**Current Stack:** React 19, Vite 6, React Router DOM 7, TypeScript 5.8, Tailwind CSS (CDN), Supabase, Google Gemini AI, OpenRouter
**Target Stack:** Next.js 15 (App Router), TypeScript 5.8, Tailwind CSS (local install), Supabase, Google Gemini AI, OpenRouter
**Current Root Files:** App.tsx, index.tsx, types.ts, constants.ts, vite.config.ts
**Current Folders:** components/, views/, contexts/, services/, utils/, hooks/, lib/, workers/

---

## TARGET FOLDER STRUCTURE

Migrate to this exact structure — no deviation:

```
planckoff-estimating/
├── app/                              # Next.js App Router (pages & layouts)
│   ├── layout.tsx                    # Root layout (replaces index.html + App.tsx wrapper)
│   ├── page.tsx                      # Dashboard (/ route)
│   ├── globals.css                   # Global styles (replaces index.css)
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx              # Login/Register page
│   ├── projects/
│   │   ├── page.tsx                  # Project list
│   │   └── [id]/
│   │       ├── page.tsx              # ProjectView
│   │       └── reports/
│   │           └── page.tsx          # ReportsView
│   ├── database/
│   │   └── page.tsx                  # DatabaseView
│   ├── team/
│   │   └── page.tsx                  # TeamManagement
│   └── api/                          # Next.js API Routes (server-side)
│       ├── ai/
│       │   └── generate/
│       │       └── route.ts          # AI content generation (moves API key server-side)
│       ├── export/
│       │   ├── pdf/route.ts
│       │   ├── excel/route.ts
│       │   └── cobie/route.ts
│       └── supabase/
│           └── [...path]/route.ts    # Supabase proxy if needed
│
├── components/                       # Reusable UI components
│   ├── ui/                           # Generic, domain-agnostic primitives
│   │   ├── Button.tsx
│   │   ├── Modal.tsx
│   │   ├── Toast.tsx
│   │   ├── ToastContainer.tsx
│   │   ├── Tooltip.tsx
│   │   ├── SkeletonLoader.tsx
│   │   ├── ResizablePanels.tsx
│   │   ├── ContextualProgressBar.tsx
│   │   └── index.ts                  # Barrel export
│   ├── layout/                       # Layout-level components
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx               # (if applicable)
│   │   └── index.ts
│   └── icons/
│       └── index.tsx                 # All SVG icons in one barrel
│
├── features/                         # Domain feature modules (replaces components/ + views/)
│   ├── projects/
│   │   ├── components/
│   │   │   ├── NewProjectModal.tsx
│   │   │   ├── ProjectCard.tsx
│   │   │   └── index.ts
│   │   ├── hooks/
│   │   │   └── useProject.ts
│   │   └── index.ts
│   ├── doors/
│   │   ├── components/
│   │   │   ├── DoorScheduleManager.tsx
│   │   │   ├── EnhancedDoorEditModal.tsx
│   │   │   ├── DoorScheduleConfig.tsx
│   │   │   ├── DoorHandingSelector.tsx
│   │   │   ├── DoorMaterialSelector.tsx
│   │   │   └── index.ts
│   │   ├── hooks/
│   │   │   └── useDoorSchedule.ts
│   │   └── index.ts
│   ├── hardware/
│   │   ├── components/
│   │   │   ├── HardwareSetsManager.tsx
│   │   │   ├── HardwareSetModal.tsx
│   │   │   ├── HardwareSetConfig.tsx
│   │   │   ├── HardwarePrepEditor.tsx
│   │   │   ├── HardwareScheduleView.tsx
│   │   │   └── index.ts
│   │   ├── hooks/
│   │   │   └── useHardware.ts
│   │   └── index.ts
│   ├── pricing/
│   │   ├── components/
│   │   │   ├── PriceBookManager.tsx
│   │   │   ├── ProcurementSummaryView.tsx
│   │   │   └── index.ts
│   │   ├── hooks/
│   │   │   └── usePricing.ts
│   │   └── index.ts
│   ├── estimation/
│   │   ├── components/
│   │   │   ├── EstimationReport.tsx
│   │   │   ├── EstimatingReportBanner.tsx
│   │   │   ├── ReportPreviewModal.tsx
│   │   │   ├── ReportGenerationCenter.tsx
│   │   │   ├── ReportDataPreview.tsx
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── submittals/
│   │   ├── components/
│   │   │   ├── SubmittalGenerator.tsx
│   │   │   ├── SubmittalCoverPage.tsx
│   │   │   ├── SubmittalPackageConfig.tsx
│   │   │   ├── CutSheetLibrary.tsx
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── uploads/
│   │   ├── components/
│   │   │   ├── UploadProgressWidget.tsx
│   │   │   ├── UploadConfirmationModal.tsx
│   │   │   ├── ImageAnalysisModal.tsx
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── auth/
│   │   ├── components/
│   │   │   ├── UserAuthDashboard.tsx
│   │   │   ├── InviteUserPanel.tsx
│   │   │   ├── InviteMemberModal.tsx
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── settings/
│   │   ├── components/
│   │   │   └── SettingsModal.tsx
│   │   └── index.ts
│   └── revisions/
│       ├── components/
│       │   └── RevisionHistory.tsx
│       └── index.ts
│
├── services/                         # Pure business logic (no React, no Next.js imports)
│   ├── ai/
│   │   ├── aiProviderService.ts      # Unified AI entry point
│   │   ├── geminiService.ts          # Gemini-specific logic
│   │   └── index.ts
│   ├── exports/
│   │   ├── excelExportService.ts
│   │   ├── pdfExportService.ts
│   │   ├── csvExportService.ts
│   │   ├── cobieExportService.ts
│   │   ├── reportExportService.ts
│   │   ├── pricingReportService.ts
│   │   └── index.ts
│   ├── pricing/
│   │   ├── pricingService.ts
│   │   └── index.ts
│   ├── procurement/
│   │   ├── procurementSummaryService.ts
│   │   └── index.ts
│   └── ml/
│       ├── mlOpsService.ts
│       └── index.ts
│
├── lib/                              # Third-party client initialization
│   ├── supabase/
│   │   ├── client.ts                 # Browser Supabase client
│   │   ├── server.ts                 # Server-side Supabase client (SSR)
│   │   └── index.ts
│   └── ai/
│       └── gemini.ts                 # Gemini client singleton
│
├── store/                            # Global state (replaces contexts/)
│   ├── projectStore.ts               # Zustand store OR React Context
│   ├── authStore.ts
│   ├── toastStore.ts
│   ├── uploadStore.ts
│   └── index.ts
│
├── hooks/                            # Shared custom React hooks
│   ├── useKeyboardShortcuts.ts
│   ├── useToast.ts
│   ├── useLocalStorage.ts
│   └── index.ts
│
├── utils/                            # Pure functions, zero side effects
│   ├── parsers/
│   │   ├── csvParser.ts
│   │   ├── xlsxParser.ts
│   │   ├── pdfParser.ts
│   │   └── docxParser.ts
│   ├── exporters/
│   │   └── csvExporter.ts
│   ├── migrations/
│   │   ├── hardwareDataMigration.ts
│   │   └── doorDataMigration.ts
│   ├── validation/
│   │   └── doorValidation.ts
│   ├── csiMasterFormat.ts
│   ├── reportGenerator.ts
│   ├── uploadPersistence.ts
│   └── index.ts
│
├── workers/                          # Web Workers (unchanged, Next.js supports them)
│   └── upload.worker.ts
│
├── types/                            # All TypeScript types (replaces root types.ts)
│   ├── domain.ts                     # Core domain types (Project, Door, HardwareItem, etc.)
│   ├── api.ts                        # API request/response types
│   ├── ui.ts                         # UI-specific types (Toast, Modal props, etc.)
│   └── index.ts                      # Barrel export
│
├── constants/                        # All constants (replaces root constants.ts)
│   ├── hardware.ts                   # Hardware-related constants & seed data
│   ├── doors.ts                      # Door-related constants
│   ├── pricing.ts                    # Pricing-related constants
│   ├── roles.ts                      # Role definitions & permissions
│   ├── routes.ts                     # Route path constants
│   └── index.ts                      # Barrel export
│
├── middleware.ts                     # Next.js middleware (auth protection, redirects)
├── next.config.ts                    # Next.js configuration (replaces vite.config.ts)
├── tailwind.config.ts                # Tailwind CSS local config (remove CDN)
├── postcss.config.js                 # PostCSS config (required for Tailwind)
└── tsconfig.json                     # Updated for Next.js paths
```

---

## MIGRATION RULES — FOLLOW EXACTLY

### Rule 1: React Router → Next.js App Router
- DELETE all `<Route>`, `<BrowserRouter>`, `<Switch>` usage
- CONVERT each `views/*.tsx` into `app/.../page.tsx`
- Use `<Link href="...">` from `next/link` instead of `<Link to="...">`
- Use `useRouter()` from `next/navigation` instead of `react-router-dom`
- Use `useParams()` from `next/navigation` for route params
- Use `useSearchParams()` from `next/navigation` for query strings

### Rule 2: Environment Variables
- ALL server-only secrets (AI API keys, Supabase service role key): use `process.env.VAR_NAME` (no NEXT_PUBLIC_ prefix) — accessible only in server components and API routes
- ALL client-safe variables: use `NEXT_PUBLIC_VAR_NAME` prefix
- MOVE Gemini API key calls to `app/api/ai/generate/route.ts` — never expose in browser bundle
- Current `VITE_*` → rename to `NEXT_PUBLIC_*` (for client-safe) or plain `VAR_NAME` (server-only)

### Rule 3: Client vs Server Components
- Default: every component in `app/` is a **Server Component** — no useState, no useEffect, no browser APIs
- Add `'use client'` directive ONLY when component uses: useState, useEffect, useContext, useRef, browser events, browser APIs
- All components in `components/`, `features/`, that use React hooks MUST have `'use client'` at top
- Layout files (`layout.tsx`) wrap client providers via a separate `Providers.tsx` client component

### Rule 4: Providers in Next.js
Create `app/providers.tsx` as a client component containing all Context providers:
```typescript
'use client'
// Wrap all providers here, import into app/layout.tsx
```

### Rule 5: API Keys — Security Fix (Critical)
- NEVER put AI API keys in client-side code
- ALL AI generation calls go through `app/api/ai/generate/route.ts`
- Client-side code calls `/api/ai/generate` via fetch — never calls Gemini directly
- This is non-negotiable

### Rule 6: Tailwind CSS
- REMOVE CDN link from `<head>` in index.html
- INSTALL: `npm install -D tailwindcss postcss autoprefixer`
- RUN: `npx tailwindcss init -p`
- Import in `app/globals.css`: `@tailwind base; @tailwind utilities; @tailwind components;`
- Configure `tailwind.config.ts` content paths to cover all source files

### Rule 7: next.config.ts Essentials
```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // For PDF.js and xlsx compatibility
  webpack: (config) => {
    config.resolve.alias.canvas = false
    return config
  },
}

export default nextConfig
```

### Rule 8: Image & Static Assets
- Move all static assets to `public/` directory
- Use `next/image` for any `<img>` tags referencing local images

### Rule 9: Metadata
- Replace `<head>` tags in index.html with Next.js Metadata API
- In `app/layout.tsx`:
```typescript
export const metadata: Metadata = {
  title: 'PlanckOff - Hardware Estimating',
  description: 'Professional hardware estimating platform',
}
```

### Rule 10: Web Workers
- Keep `workers/upload.worker.ts` unchanged
- Use `new Worker(new URL('../workers/upload.worker.ts', import.meta.url))` — same pattern works in Next.js with webpack

---

## MIGRATION EXECUTION ORDER

Execute in this exact sequence. Do NOT skip steps.

1. **Initialize Next.js project** — `npx create-next-app@latest` with TypeScript, Tailwind, App Router, src/ directory disabled
2. **Copy & reorganize types** — Move `types.ts` → `types/domain.ts`, `types/api.ts`, `types/ui.ts`
3. **Copy & reorganize constants** — Move `constants.ts` → `constants/*.ts` by domain
4. **Copy utilities** — Move `utils/*` into `utils/` subdirectories
5. **Copy services** — Move `services/*` into `services/` subdirectories
6. **Copy lib** — Update `lib/supabase.ts` to `lib/supabase/client.ts` + `lib/supabase/server.ts`
7. **Create API routes** — Implement `app/api/ai/generate/route.ts` (critical for security)
8. **Migrate contexts to store** — Refactor `contexts/` into `store/`
9. **Create app/providers.tsx** — Wrap all providers in a single client component
10. **Migrate views to pages** — Convert each `views/*.tsx` to `app/.../page.tsx`
11. **Reorganize components into features/** — Group by domain, not by type
12. **Update all imports** — Fix all import paths (use `@/` path alias throughout)
13. **Configure Tailwind** — Remove CDN, install locally, configure paths
14. **Test each route** — Verify each page loads correctly
15. **Verify AI calls go through API routes** — No direct Gemini calls from client

---

## PATH ALIAS

Always use the `@/` alias for absolute imports. Configure in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

Usage: `import { Project } from '@/types'` — never use `../../..` relative paths.

---

## CHECKLIST BEFORE DECLARING MIGRATION COMPLETE

- [ ] No `react-router-dom` imports anywhere
- [ ] No `import.meta.env.VITE_*` references anywhere
- [ ] No AI API keys in client-side code
- [ ] Tailwind loaded via PostCSS, not CDN
- [ ] All pages exist as `app/.../page.tsx` files
- [ ] All components use `'use client'` only where necessary
- [ ] `app/providers.tsx` wraps all context providers
- [ ] All imports use `@/` alias
- [ ] `app/layout.tsx` has proper Metadata export
- [ ] `next.config.ts` handles webpack canvas alias for PDF.js
