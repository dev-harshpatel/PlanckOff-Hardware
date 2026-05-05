# Technology Stack

**Analysis Date:** 2026-05-06

## Languages

**Primary:**
- TypeScript 5.8 - Entire codebase (components, services, API routes, utilities)
- TSX/JSX - React components in pages and UI layer

**Secondary:**
- JavaScript - Configuration files, seed scripts

## Runtime

**Environment:**
- Node.js - Server runtime for API routes and Next.js
- Browser - Client-side React execution

**Package Manager:**
- npm - Dependency management
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 15 - Full-stack framework with App Router
- React 19 - UI rendering engine
- Tailwind CSS 3.4 - Utility-first styling (local install, no longer CDN)

**UI Components:**
- Radix UI - Headless, accessible component primitives:
  - Alert Dialog, Dropdown Menu, Dialog, Label, Progress, Select, Separator, Slot, Tabs, Tooltip
  - Versions: ^1.1.x to ^2.2.x (mixed)
- Lucide React 1.8.0 - Icon library
- Sonner 2.0.7 - Toast notifications

**Rich Text Editing:**
- TipTap 3.22.4 - Headless WYSIWYG editor
  - Extensions: starter-kit, placeholder
  - React integration: @tiptap/react

**File/Document Handling:**
- pdfjs-dist 5.4.530 - PDF text extraction and rendering
- xlsx 0.18.5 - Excel spreadsheet parsing
- jszip 3.10.1 - ZIP archive handling
- mammoth 1.9.0 - DOCX document parsing
- jsPDF 4.0.0 + jspdf-autotable 5.0.7 - PDF generation
- file-saver 2.0.5 - Client-side file download
- papaparse 5.5.3 - CSV parsing

**Authentication & Security:**
- bcryptjs 2.4.3 - Password hashing
- @supabase/ssr 0.6.1 - Server-side rendering auth helpers
- @supabase/supabase-js 2.93.1 - Supabase client SDK

**Theming & UI Utilities:**
- next-themes 0.4.6 - Dark mode support
- class-variance-authority 0.7.1 - CSS class composition
- clsx 2.1.1 - Conditional CSS class construction
- tailwind-merge 3.5.0 - Merge Tailwind classes without conflicts
- react-to-print 3.2.0 - Print component functionality

**AI/LLM SDKs:**
- @google/genai 1.29.1 - Google Gemini API client (server-side)
- OpenAI 6.19.0 - OpenRouter compatibility (OpenAI-compatible API)

**Testing (Dev):**
- @testing-library/react 16.3.2 - React component testing utilities
- @testing-library/jest-dom 6.9.1 - Custom matchers for DOM assertions

**Build & Development:**
- TypeScript 5.8 - Type checking
- Autoprefixer 10.4.21 - CSS vendor prefixes
- PostCSS 8.5.3 - CSS processing
- dotenv 17.4.1 - Environment variable loading
- tsx 4.21.0 - TypeScript execution for scripts

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.93.1 - Real-time database, auth, storage backend
- pdfjs-dist 5.4.530 - PDF processing pipeline bottleneck (concurrency=1, Phase 2 target)
- @google/genai 1.29.1 - AI data extraction (Gemini API, v2.0-flash-exp)
- OpenAI 6.19.0 - OpenRouter fallback AI provider (google/gemini-2.0-flash-001)

**Infrastructure:**
- Next.js 15 - Server-side API routes, middleware, SSR
- @supabase/ssr 0.6.1 - Session management, cookie-based auth
- bcryptjs 2.4.3 - Admin login password hashing (in-database verification)

**File Processing:**
- pdfjs-dist - Text extraction from PDFs (legacy: used with VITE bundler, now Next.js)
- xlsx + jszip - Excel and compressed file support
- mammoth - DOCX support
- jsPDF + jspdf-autotable - Report generation

## Configuration

**Environment:**

- Loaded via `next.config.ts` with webpack and transpilation aliases
- Public keys (prefixed `NEXT_PUBLIC_`): Safe for browser exposure
  - `NEXT_PUBLIC_SUPABASE_URL`: Supabase project endpoint
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Client-side auth key
  - `NEXT_PUBLIC_APP_URL`: Invite redirect URL
- Server-only keys (NO `NEXT_PUBLIC_` prefix): Never sent to client
  - `SUPABASE_SERVICE_ROLE_KEY`: Admin operations, RLS bypass
  - `GEMINI_API_KEY`: Server-side Gemini calls only
  - `OPENROUTER_API_KEY`: Server-side OpenRouter fallback

**Build:**
- `tsconfig.json` - TypeScript configuration
  - Strict mode: disabled during migration (Phase 3 target)
  - Module resolution: bundler (Next.js compatible)
  - Path alias: `@/*` maps to root directory
  - Excludes: `App.tsx`, `index.tsx`, legacy Vite entry points
- `next.config.ts` - Next.js configuration
  - `serverExternalPackages`: jspdf, xlsx, file-saver, pdfjs-dist (browser-only)
  - `transpilePackages`: jszip (CommonJS to ESM)
  - Webpack aliases: canvas, pdfjs worker resolution
  - `ignoreBuildErrors: true` - Pre-existing type errors (temporary)
- `.env.example` - Template for environment variables

## Platform Requirements

**Development:**
- Node.js (version not specified, assumed 18+)
- npm (latest)
- TypeScript 5.8
- Git (for version control)
- Next.js 15 dev server (`npm run dev` → port 3000 with Turbopack)

**Production:**
- Node.js server runtime
- Environment variables configured (see Configuration section)
- Supabase project provisioned and running
- AI API keys active (Gemini and/or OpenRouter)
- HTTPS for secure cookie transmission (auth tokens)

---

*Stack analysis: 2026-05-06*
