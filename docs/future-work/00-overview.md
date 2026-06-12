# Future Work — Overview & Prioritization

This document is the master index for all planned improvements to PlanckOff Hardware. Each linked file goes deep into one area. Read this first to understand scope and priority.

---

## Why This Exists

The codebase was built fast to ship features. It works. But as we grow toward real multi-tenant scale, several things will become painful or dangerous:

- The **PDF pipeline runs inside the Next.js server** — one heavy upload can block all other users
- **TypeScript strict mode is disabled** — type bugs slip through silently
- **There are zero automated tests** — every release is a manual prayer
- **Errors are logged to console** with no tracing — production incidents are blind
- **Frontend and backend are deployed together** — can't scale the AI-heavy work independently
- **No input validation** on many API routes — malformed data can corrupt project state

These aren't hypothetical. They are the specific gaps that will hurt at 50+ concurrent users or when the first serious bug hits production.

---

## Document Index

| File | Topic | Priority |
|------|-------|----------|
| [01-architecture.md](./01-architecture.md) | Frontend/backend separation, monolith risks | High |
| [02-pdf-pipeline-microservice.md](./02-pdf-pipeline-microservice.md) | PDF processing as a dedicated service | High |
| [03-code-quality.md](./03-code-quality.md) | TypeScript strict mode, input validation, error handling | High |
| [04-database.md](./04-database.md) | Transactions, audit logging, indexes, RLS | High |
| [05-testing.md](./05-testing.md) | Unit, integration, and E2E testing strategy | High |
| [06-observability.md](./06-observability.md) | Structured logging, request tracing, error tracking | Medium |
| [07-scalability.md](./07-scalability.md) | Caching, connection pooling, job queues, realtime | Medium |
| [08-security.md](./08-security.md) | Account lockout, rate limiting, CSP hardening | Medium |
| [09-frontend-state.md](./09-frontend-state.md) | Context sprawl, state management, performance | Low |
| [10-matrix-pdf-hardening.md](./10-matrix-pdf-hardening.md) | Format F matrix/checkbox pipeline: known gaps, fixes per gap, test fixtures | Medium |

---

## Priority Tiers

### Tier 1 — Do Before Next Major User Growth

These are either correctness risks (data corruption, security holes) or things that get exponentially harder to fix as the codebase grows.

1. **Enable TypeScript strict mode** — every `any`, every nullable miss compounds daily
2. **Add input validation to all API routes** — no bounds checks today on numeric fields
3. **Add database transactions** — multi-step writes (upsert + queue) can partially fail
4. **Add structured error handling** — errors are currently mixed shapes (string vs object)
5. **Add automated tests** — at minimum, service-layer unit tests and API integration tests

### Tier 2 — Do Before Scaling Beyond One Server

These are things that work fine for one instance but break or become expensive under load.

6. **Extract PDF pipeline to a microservice** — CPU-bound AI work must not block web traffic
7. **Add structured logging with request IDs** — blind in production today
8. **Implement job queue for async AI work** — polling is not a production pattern
9. **Separate frontend and backend deployments** — enables independent scaling
10. **Audit logging** — track who changed what for compliance and debugging

### Tier 3 — Quality of Life at Scale

These improve developer experience and user experience but don't block growth.

11. **Deduplicate Supabase Realtime subscriptions** — N subscriptions per N components today
12. **Full-text search on hardware/doors** — ILIKE queries don't scale
13. **Webhook events** — external systems can't listen to project changes today
14. **API key / service account auth** — everything is user-session today
15. **CSP hardening** — `unsafe-inline` and `unsafe-eval` are currently allowed

---

## Tech Stack (as-is)

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript 5.8 (strict: false) |
| Database | PostgreSQL via Supabase |
| Storage | Supabase Storage |
| Realtime | Supabase Realtime |
| Auth | Custom session RBAC (not Supabase Auth) |
| AI | Google Gemini 2.5 Flash via OpenRouter |
| PDF in | pdfjs-dist + Gemini |
| PDF out | jsPDF + jsPDF-autotable |
| Excel | ExcelJS, xlsx-js-style |
| Deployment | Vercel (monolith — frontend + backend together) |
| Styling | Tailwind CSS 3.4, Radix UI |
| State | React Context (7 providers) + Supabase Realtime |

---

## Current Scale Markers

- Vercel function memory: 3008 MB for process + hardware-pdf routes
- Vercel max duration: 300s (Next.js API routes)
- AI calls: Tier 1 (raw PDF → Gemini, ≤20 MB), Tier 2 (pdfjs text → batched Gemini, any size)
- Soft deletes: never auto-purged (trash accumulates indefinitely)
- Caching: Next.js `unstable_cache` with 30–60 min TTL, tag-based invalidation
- Sessions: Custom `auth_sessions` table, 7-day duration, 24h renewal window
