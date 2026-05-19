# Codebase Concerns

**Analysis Date:** 2026-05-07

Severity: **HIGH** | **MEDIUM** | **LOW**

---

## Security

### HIGH — No brute-force protection on login endpoint
- **Location:** `app/api/auth/login/route.ts`
- **Issue:** `POST /api/auth/login` has no rate limiting, account lockout, or CAPTCHA. An attacker can attempt unlimited password guesses.
- **Fix:** Add rate limiting (e.g., `next-rate-limit` or Upstash Redis) per IP and per account.

### HIGH — Gemini API key exposed in browser
- **Location:** `services/geminiService.ts`
- **Issue:** The Gemini API key is read from `localStorage` and used directly in browser-executed code, bypassing the server-side AI route (`app/api/ai/generate/`). This exposes the key to any user who opens DevTools.
- **Fix:** Remove client-side key usage entirely; route all AI calls through the server-side API endpoint.

### HIGH — Legacy `VITE_GEMINI_API_KEY` env var reference in browser code
- **Location:** `services/geminiService.ts:265`
- **Issue:** References a Vite-era env variable in Next.js browser code. This variable is never defined in the Next.js env system, so it silently falls back to `undefined` or a localStorage value.
- **Fix:** Remove this reference; use only the server-side API route for AI calls.

### MEDIUM — No per-tenant scoping on `getAllProjects()`
- **Location:** `lib/db/projects.ts`
- **Issue:** `getAllProjects()` returns all projects regardless of company/tenant. Any authenticated user (including from another company, if multi-tenant) can see all projects.
- **Fix:** Add a `company_id` (or equivalent tenant) filter to all project queries, enforced server-side.

### MEDIUM — Missing `credentials: 'include'` on several fetch calls
- **Location:** `app/project/[id]/reports/door-schedule/page.tsx` (3 fetch calls)
- **Issue:** These fetches omit `credentials: 'include'`, so session cookies are not sent. Requests may succeed in same-origin dev but will silently fail in cross-origin or cookie-strict environments.
- **Fix:** Add `credentials: 'include'` to all authenticated fetch calls.

### MEDIUM — No CSRF protection on mutation routes
- **Location:** All `POST`/`PUT`/`DELETE` route handlers in `app/api/`
- **Issue:** Cookie is `SameSite: lax` but no CSRF tokens are validated on state-mutating routes. `SameSite: lax` blocks cross-site form POSTs but not same-site JavaScript requests from XSS payloads.
- **Fix:** Either use `SameSite: strict` for the session cookie or add a CSRF double-submit token pattern.

---

## Technical Debt

### HIGH — TypeScript strict mode disabled
- **Location:** `tsconfig.json`, `next.config.ts`
- **Issue:** `strict: false` in tsconfig and `ignoreBuildErrors: true` in Next config mean type errors are silently ignored at build time. This masks real bugs and makes refactoring risky.
- **Fix:** Enable `strict: true` incrementally; fix resulting errors; remove `ignoreBuildErrors`.

### HIGH — God component: `views/ProjectView.tsx` (2104 lines)
- **Location:** `views/ProjectView.tsx`
- **Issue:** A single 2100-line component handles all project state, UI, and interactions. It is effectively untestable and expensive to modify.
- **Fix:** Extract into domain-specific sub-components and custom hooks. Prioritize the most-changed sections first.

### HIGH — Zero test files despite testing libraries installed
- **Location:** `package.json` (`devDependencies`)
- **Issue:** `@testing-library/react`, `@testing-library/jest-dom` are listed as devDependencies but no test files exist anywhere in the project. The intended framework is Vitest (documented in `.claude/commands/test.md`) but it is not installed.
- **Fix:** See TESTING.md for setup steps. Start with unit tests for pure utilities and service functions.

### MEDIUM — Role enum divergence
- **Location:** `types.ts` vs `lib/auth/rbac.ts` and `constants/roles.ts`
- **Issue:** The legacy `types.ts` defines `SeniorEstimator` and `Viewer` roles that do not exist in the auth system. The active roles are `Administrator`, `Team Lead`, and `Estimator`. This divergence can cause silent type mismatches.
- **Fix:** Remove or update the legacy type definitions in `types.ts` to match the authoritative list in `constants/roles.ts`.

### MEDIUM — `cleanupExpiredSessions()` defined but never called
- **Location:** `lib/auth/session.ts`
- **Issue:** Expired sessions accumulate in the database indefinitely. This is both a storage concern and a mild security concern (sessions that should be invalid are not cleaned up).
- **Fix:** Call it from a cron job or Supabase scheduled function, or trigger it probabilistically on each login.

### LOW — `xlsx` package is effectively unmaintained
- **Location:** `package.json` — `xlsx@0.18.5`
- **Issue:** The `xlsx` (SheetJS Community Edition) package has had no meaningful updates since 2023 and has known security issues. `exceljs` is already installed in the project.
- **Fix:** Migrate XLSX generation/parsing to `exceljs` and remove the `xlsx` dependency.

---

## Performance

### MEDIUM — No data caching (no SWR or React Query)
- **Location:** All `fetch()` calls in view components
- **Issue:** Every navigation or component remount triggers full data refetches. There is no stale-while-revalidate, deduplication, or background refresh. This causes visible loading states on every interaction.
- **Fix:** Wrap data fetching in SWR or TanStack Query. The existing custom hooks are a good insertion point.

### MEDIUM — 100-iteration JSON repair loop in AI service
- **Location:** `services/geminiService.ts`
- **Issue:** A `while` loop retries JSON parsing up to 100 times, potentially blocking the main thread for a significant duration if the AI returns malformed JSON repeatedly.
- **Fix:** Cap retries to 3–5, add exponential backoff, and move this work into the server-side API route or a Web Worker.

### LOW — No image optimization configuration
- **Location:** `next.config.ts`, `public/`
- **Issue:** Static images in `public/` are served as-is with no sizing, compression, or format negotiation. Next.js `<Image>` component is available but may not be used consistently.
- **Fix:** Audit image usage and replace `<img>` tags with Next.js `<Image>` where appropriate.

---

## Observability

### MEDIUM — 172+ unguarded `console.*` calls in production
- **Location:** Throughout `services/`, `views/`, `lib/`
- **Issue:** Console statements leak internal state, data shapes, and error details to the browser console in production. This is a minor security concern and adds noise.
- **Fix:** Replace with a structured logger that is silenced in production (e.g., conditional on `process.env.NODE_ENV`), or strip with a build-time transform.

---

## Missing Features / Incomplete Implementation

### MEDIUM — No email delivery for team invitations
- **Location:** `app/api/team/invite/route.ts`, `supabase/email-templates/`
- **Issue:** Email templates exist but it is unclear if transactional email sending is wired up end-to-end. Invites may be generated without the email being delivered.
- **Fix:** Verify the email service integration (Resend, SendGrid, or Supabase SMTP) is configured and tested in staging.

### LOW — `scripts/` contains one-off utility scripts with no documentation
- **Location:** `scripts/`
- **Issue:** Scripts lack README or inline comments explaining when and how to run them. This creates operational risk if run in the wrong environment.
- **Fix:** Add a brief header comment to each script explaining its purpose, required env vars, and expected side effects.

---

## Dependency Risks

| Package | Version | Risk |
|---------|---------|------|
| `xlsx` | 0.18.5 | Unmaintained; known CVEs; replace with `exceljs` |
| `@anthropic-ai/sdk` | — | Verify pinned to a stable version; breaking changes between minor versions |
| `puppeteer` (if present) | — | Large binary dependency; verify it is only in devDependencies or removed if unused |

---

*Concerns analysis: 2026-05-07*
