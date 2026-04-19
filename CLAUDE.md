# PlanckOff — Hardware Estimating Platform
## Claude Code Project Guide

This file is loaded into every Claude Code session. Read it fully before starting any work.

---

## What This Project Is

**PlanckOff** is a SaaS platform for construction professionals — specifically hardware estimators and door hardware suppliers — to manage door schedules, hardware specifications, pricing, and AI-powered data extraction from construction PDFs.

**Tech Stack:**
- Current: React 19 + Vite + TypeScript 5.8 + Tailwind (CDN) + Supabase + Gemini AI + OpenRouter
- Target: Next.js 15 (App Router) + TypeScript + Tailwind (local) + Supabase + Gemini AI

---

## Critical Active Constraints

**These are non-negotiable for every task you touch:**

1. **API keys are NOT safe in the current code** — `VITE_GEMINI_API_KEY` is in the client bundle. Never make this worse. Every AI call you implement must go through a server-side proxy.

2. **Auth is a stub** — `logout()` sets `isAuthenticated = true` (literal bug). `login()` always succeeds. Do not build on top of this. Fix it or note it.

3. **All data is in localStorage** — This is temporary. Target is Supabase. Don't add new localStorage keys; always route new data through Supabase.

4. **The PDF pipeline exists but breaks at 200+ pages** — The basic flow (`pdfParser.ts` → `geminiService.ts` → `fileUploadService.ts`) is built. The architecture is sequential (CONCURRENCY=1) and fails for large files. Major architectural work in Phase 2 targets this.

---

## Current Project Phase

Check `WORKING_HOURS_ESTIMATION.md` for the full breakdown. Short version:

| Priority | Phase | Status |
|---|---|---|
| P0 | Phase 1 — Security & Auth (Supabase real auth, API key proxy, DB migration) | Not started |
| P1 | Phase 2 — PDF Pipeline Architecture Overhaul | Partial foundation exists |
| P2 | Phase 3-4 — Performance + Code Quality | Identified, not started |
| P3 | Phase 5-6 — Testing + UX | Not started |

**Before starting any task:** check which phase it belongs to. Don't jump to P2 work if P0 is incomplete.

---

## Project Folder Map (Current State)

```
/ (root)
├── components/         UI components (mixed — has domain logic, should be in features/)
├── views/              Page-level components (maps to Next.js app/ pages)
├── contexts/           React Context providers (maps to Next.js store/)
├── services/           Business logic (AI extraction, export, pricing, file upload)
├── utils/              Parsers and pure utilities (pdf, csv, xlsx, docx parsers)
├── hooks/              Custom React hooks
├── lib/                Third-party client init (supabase.ts)
├── workers/            Web Workers (upload.worker.ts)
├── types.ts            All domain types (monolithic — needs splitting)
├── constants.ts        All constants (monolithic — needs splitting)
├── App.tsx             Router + global state assembly
└── .claude/
    ├── commands/       Slash commands (architecture, code-standards, nextjs-migration, modularize, + more)
    ├── AGENTS.md       Multi-agent orchestration guide
    ├── CONTEXT.md      Context window management guide
    └── settings.local.json   Hooks config
```

---

## Key Files to Know

| File | What It Does | Notes |
|---|---|---|
| `services/geminiService.ts` | AI extraction for doors + hardware sets | CONCURRENCY=1, needs parallel queue |
| `services/fileUploadService.ts` | Routes uploaded files → parsers → AI | Has chunked PDF flow, 10MB limit |
| `services/aiProviderService.ts` | Gemini + OpenRouter abstraction | API keys exposed client-side |
| `utils/pdfParser.ts` | PDF text extraction with page batching | `extractTextGenerator` already yields batches |
| `workers/upload.worker.ts` | Offloads file processing to worker | Single worker — no pool |
| `contexts/ProjectContext.tsx` | Global project/door/hardware state | Uses localStorage, 1000+ lines |
| `contexts/AuthContext.tsx` | Auth state | Mock only — logout bug exists |
| `components/ImageAnalysisModal.tsx` | AI vision (image → text analysis) | Uses `analyzeImageWithAI` |

---

## Architecture Rules (Non-Negotiable)

These are documented fully in `/architecture`. Short version:

1. **Layered architecture** — Presentation → Application → Domain/Service → Infrastructure. No upward imports.
2. **No business logic in components** — Extract to services or hooks.
3. **No direct AI API calls from client** — Must go through `/api/ai/generate` API route.
4. **No `any` TypeScript** — Use `unknown` + type guards.
5. **Named exports only** — No `export default` for components.
6. **Event handlers prefixed `handle*`** — `handleSave`, not `onSave` (except prop names).
7. **Every constant in `constants/`** — No magic strings or numbers in components/services.
8. **Dark mode is mandatory for ALL UI work** — Never use hardcoded Tailwind color classes (`bg-white`, `bg-gray-*`, `text-gray-*`, `border-gray-*`, `bg-red-50`, `bg-green-50`, etc.). Always use CSS custom property tokens: `bg-[var(--bg)]`, `bg-[var(--bg-muted)]`, `bg-[var(--bg-subtle)]`, `text-[var(--text)]`, `text-[var(--text-secondary)]`, `text-[var(--text-muted)]`, `border-[var(--border)]`. For semantic colors (success/warning/error) use Tailwind with explicit dark variants: e.g. `text-amber-600 dark:text-amber-400`. Violations must be fixed before completing any UI task.

---

## Available Slash Commands

| Command | When to Use |
|---|---|
| `/architecture` | Designing new features or evaluating where to add code |
| `/code-standards` | Enforcing style and TypeScript standards |
| `/modularize` | Extracting duplicated logic, splitting large files |
| `/nextjs-migration` | Working on the React → Next.js migration |
| `/pdf-pipeline` | Working on the PDF extraction architecture (Phase 2) |
| `/auth` | Implementing Supabase auth (Phase 1.1) |
| `/supabase` | DB migration from localStorage (Phase 1.3) |
| `/feature [name]` | Scaffolding a new feature end-to-end |
| `/security` | Security audit for any file or feature |
| `/test [target]` | Writing unit or integration tests |
| `/sprint` | Planning and executing a sprint of tasks |
| `/checkpoint` | Manually saving current context to memory |

---

## Session Start Checklist

When starting a new session, do this before any work:

1. Read this file (done automatically)
2. Read `WORKING_HOURS_ESTIMATION.md` if working on a phased task
3. Check `.claude/memory/MEMORY.md` for notes from previous sessions
4. Ask the user: "Where did we leave off / what's the focus today?"

---

## Session End Behavior

When stopping work (or when asked to checkpoint):
- Save current progress, decisions made, and files modified to memory
- Note any blockers or decisions that need follow-up
- Use `/checkpoint` to trigger a formal save

---

## What NOT To Do

- Do not add new `localStorage` reads/writes — route through Supabase
- Do not add direct Gemini/OpenRouter API calls from client code
- Do not use `any` TypeScript even for "quick" fixes
- Do not create new React Contexts — use the existing ones or add to the store
- Do not write a component over 300 lines without splitting it
- Do not skip the architecture layer (no UI components calling Supabase directly)
- Do not amend existing git commits
- Do not run `git push --force`
