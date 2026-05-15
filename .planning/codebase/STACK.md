# Technology Stack

**Analysis Date:** 2026-05-07

## Languages

**Primary:**
- TypeScript ~5.8.2 — all application code (`.ts`, `.tsx`)
- SQL — Supabase migration files in `supabase/migrations/`

**Secondary:**
- JavaScript — `postcss.config.js` and legacy config files

## Runtime

**Environment:**
- Node.js v23.4.0 (detected on dev machine; no `.nvmrc` or `.node-version` pinned)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js ^15.3.0 — full-stack React framework; App Router with `app/` directory
- React ^19.2.0 — UI rendering
- React DOM ^19.2.0 — DOM bindings

**Build/Dev:**
- Turbopack — used in dev via `next dev --turbopack` (configured in `package.json` scripts)
- TypeScript compiler via `tsconfig.json` (target ES2022, module ESNext)
- tsx ^4.21.0 — TypeScript execution for scripts (e.g. `scripts/test-merge.ts`)

**Styling:**
- Tailwind CSS ^3.4.17 — utility-first CSS; config at `tailwind.config.ts`
- PostCSS ^8.5.3 — CSS pipeline; config at `postcss.config.js`
- Autoprefixer ^10.4.21 — vendor prefix injection
- `@tailwindcss/typography` ^0.5.19 — prose styling plugin
- `next-themes` ^0.4.6 — dark/light mode via `ThemeProvider` in `app/providers.tsx`
- Custom CSS variables for semantic tokens (surface, border, content) in `tailwind.config.ts`
- Font: Inter (sans-serif), Menlo/SFMono (mono) via Tailwind font config

**UI Components:**
- Radix UI primitives (all `@radix-ui/react-*`):
  - `react-alert-dialog` ^1.1.15
  - `react-dialog` ^1.1.15
  - `react-dropdown-menu` ^2.1.16
  - `react-label` ^2.1.8
  - `react-progress` ^1.1.8
  - `react-select` ^2.2.6
  - `react-separator` ^1.1.8
  - `react-slot` ^1.2.4
  - `react-tabs` ^1.1.13
  - `react-tooltip` ^1.2.8
- `lucide-react` ^1.8.0 — icon library
- `class-variance-authority` ^0.7.1 — component variant utility (CVA)
- `clsx` ^2.1.1 — conditional classname merging
- `tailwind-merge` ^3.5.0 — Tailwind class conflict resolution
- `sonner` ^2.0.7 — toast notifications (wraps context at `contexts/ToastContext.tsx`)

**Rich Text:**
- Tiptap editor suite:
  - `@tiptap/react` ^3.22.4
  - `@tiptap/starter-kit` ^3.22.4
  - `@tiptap/extension-placeholder` ^3.22.4

**Testing:**
- `@testing-library/react` ^16.3.2 — component testing
- `@testing-library/jest-dom` ^6.9.1 — DOM matchers
- No test runner config file detected (`jest.config.*` or `vitest.config.*` absent)

## Key Dependencies

**AI / ML:**
- `@google/genai` ^1.29.1 — Google Gemini SDK (direct API calls for image analysis in `services/geminiService.ts`)
- `openai` ^6.19.0 — OpenAI-compatible SDK used to call OpenRouter via `baseURL: 'https://openrouter.ai/api/v1'` in `app/api/ai/generate/route.ts`

**Database Client:**
- `@supabase/supabase-js` ^2.93.1 — core Supabase JS client
- `@supabase/ssr` ^0.6.1 — SSR-safe browser/server client factories (`lib/supabase/client.ts`, `lib/supabase/server.ts`)

**Document / File Processing:**
- `pdfjs-dist` ^5.4.530 — PDF parsing in browser (Worker-based; canvas alias set to `false` in `next.config.ts`)
- `mammoth` ^1.9.0 — DOCX to text extraction
- `exceljs` ^4.4.0 — Excel read/write (used in export services)
- `xlsx` ^0.18.5 — Alternative spreadsheet library (server-external in Next.js config)
- `jszip` ^3.10.1 — ZIP archive creation (transpiled via `transpilePackages` in `next.config.ts`)
- `papaparse` ^5.5.3 — CSV parsing
- `@types/jszip` ^3.4.0, `@types/papaparse` ^5.5.2 — type declarations

**Export / Download:**
- `jspdf` ^4.0.0 — PDF generation (server-external)
- `jspdf-autotable` ^5.0.7 — Table rendering plugin for jsPDF (server-external)
- `file-saver` ^2.0.5 — Browser file download trigger (server-external)
- `react-to-print` ^3.2.0 — Print-from-React utility

**Security:**
- `bcryptjs` ^2.4.3 — Password hashing for custom auth (session-based, not Supabase Auth)

**Dev Utilities:**
- `dotenv` ^17.4.1 — `.env` loading for scripts

## TypeScript Configuration

**Key settings** (`tsconfig.json`):
- `target`: ES2022
- `moduleResolution`: `bundler`
- `paths`: `@/*` → `./*` (repo root alias)
- `strict`: `false` (intentionally disabled; comment notes re-enable in code-quality phase)
- `resolveJsonModule`: `true`
- Excluded: `App.tsx`, `index.tsx`, `views/ReportsViewWrapper.tsx` (legacy files)

## Webpack / Build Overrides (`next.config.ts`)

- `serverExternalPackages`: `['jspdf', 'jspdf-autotable', 'xlsx', 'file-saver', 'pdfjs-dist']` — prevents SSR bundling of browser-only packages
- `config.resolve.alias.canvas = false` — required for `pdfjs-dist` in Node context
- `transpilePackages: ['jszip']` — CJS-to-ESM compatibility
- `typescript.ignoreBuildErrors: true` — pre-existing type errors suppressed at build (not ideal; flagged for fix)

## Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies and npm scripts |
| `tsconfig.json` | TypeScript compiler options and path aliases |
| `next.config.ts` | Next.js build and server configuration |
| `tailwind.config.ts` | Tailwind theme, colors, fonts, content paths |
| `postcss.config.js` | CSS processing pipeline |
| `.env.example` | Environment variable template (safe to commit) |
| `.env.local` | Local secrets (never committed) |
| `.vscode/settings.json` | Deno enabled for `supabase/functions/` |

## Supabase Edge Functions

- Deno runtime — VSCode configured via `.vscode/settings.json` with `deno.enablePaths: ["supabase/functions"]`
- Deno unstable APIs enabled: `kv`, `cron`, `ffi`, `fs`, `http`, `net`, `webgpu`, `broadcast-channel`, etc.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 3000 with Turbopack |
| `npm run build` | Production Next.js build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint via `next lint` |

---

*Stack analysis: 2026-05-07*
