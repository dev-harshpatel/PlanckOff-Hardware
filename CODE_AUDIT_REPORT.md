# Code Audit Report — Hardware Estimating Platform
**Prepared by:** Harsh
**Date:** February 2026
**Codebase Size:** ~24,651 lines across 94 TypeScript/React files
**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Supabase, Google Gemini AI, OpenAI, Tailwind CSS

---

## Executive Summary

A thorough review of the codebase has identified **80+ issues** spanning security vulnerabilities, architectural problems, performance bottlenecks, and code quality concerns. The application is currently not production-ready. This document outlines every issue found, its real-world impact, and the concrete steps that will be taken to resolve it.

---

## Section 1 — Critical Security Issues

These issues pose immediate risk and must be addressed before any production deployment.

---

### 1.1 Authentication Is Mocked — Anyone Can Log In

**File:** `contexts/AuthContext.tsx`

**The Problem:**
The authentication system is not real. The `logout` function sets the user as *authenticated* instead of *unauthenticated*. The `login` function always succeeds regardless of credentials. Any user with browser dev tools can manipulate `localStorage` to gain full access.

```typescript
// Current broken code
const logout = async () => {
  setIsAuthenticated(true); // BUG: should be false
};
const login = async () => {
  return { error: null }; // Always succeeds — no credential check
};
```

**Impact:** The entire access control model is non-functional. All project data is exposed to anyone who opens the app.

**Fix:** Implement real authentication using Supabase Auth with email/password or OAuth. Sessions should be managed via secure HTTP-only cookies, not localStorage.

---

### 1.2 AI API Keys Exposed in the Browser

**Files:** `vite.config.ts`, `services/aiProviderService.ts`

**The Problem:**
Both the Google Gemini and OpenAI API keys are bundled directly into the frontend JavaScript. Anyone can open Chrome DevTools → Network tab and extract them. The OpenAI client is even configured with `dangerouslyAllowBrowser: true`, which is an explicit acknowledgment of this risk.

```typescript
// vite.config.ts — keys baked into the client bundle
define: {
  'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY),
}

// aiProviderService.ts — browser-side OpenAI client
const openai = new OpenAI({ dangerouslyAllowBrowser: true });
```

**Impact:** Exposed API keys can be stolen and abused, resulting in significant unexpected billing charges on the account.

**Fix:** Move all AI API calls to a backend proxy (Supabase Edge Functions or a lightweight Node server). The frontend sends the document; the backend makes the AI call and returns the result. Keys never leave the server.

---

### 1.3 No Real Database — All Data Lives in localStorage

**File:** `lib/supabase.ts`, `contexts/ProjectContext.tsx`

**The Problem:**
Despite Supabase being installed as a dependency, it is not actually used for data storage. All projects, doors, hardware schedules, and settings are stored in the browser's `localStorage` with 33+ separate read/write operations scattered across the codebase.

**Impact:**
- Data is lost if the user clears their browser, switches browsers, or uses a different device
- Multiple users cannot collaborate on the same project
- There is a hard 5MB storage limit in localStorage
- No data backup or recovery mechanism exists

**Fix:** Migrate all data persistence to Supabase tables. Define proper schemas for Projects, Doors, HardwareSets, and Settings. Use Supabase's real-time subscriptions for future collaboration support.

---

### 1.4 No File Upload Validation

**Files:** `services/fileUploadService.ts`, `utils/csvParser.ts`, `utils/xlsxParser.ts`, `utils/pdfParser.ts`

**The Problem:**
The application accepts file uploads (CSV, XLSX, PDF) with no checks on file type, file size, or content structure. There are no upload size limits enforced.

**Impact:** Malicious or oversized files can crash the browser tab, cause unhandled errors, or in worst cases exploit parsing library vulnerabilities.

**Fix:** Add explicit MIME type validation, a file size limit (e.g., 10MB max), and row count limits before processing begins.

---

## Section 2 — Performance Issues

---

### 2.1 No Pagination or Virtualization on Large Data Tables

**Files:** `views/DatabaseView.tsx`, `components/DoorScheduleManager.tsx`

**The Problem:**
All hardware inventory items and all door schedule rows are rendered to the DOM simultaneously. For a project with 500+ doors or 1,000+ hardware line items, the browser must create and paint every single row, causing severe lag.

**Impact:** The app becomes noticeably slow and unresponsive as project size grows. This is not a hypothetical problem — it will happen on any real commercial project.

**Fix:** Implement virtual scrolling (rendering only visible rows) using a library like `@tanstack/react-virtual`, or add traditional pagination with configurable page sizes.

---

### 2.2 Missing Component Memoization

**Files:** `views/Dashboard.tsx`, `components/DoorScheduleManager.tsx`, `components/Header.tsx`

**The Problem:**
Project cards in the dashboard, door rows, and the header component are not wrapped in `React.memo`. They re-render on every parent state change, including unrelated updates. Expensive computed values inside components are recalculated every render cycle.

**Impact:** Sluggish UI, especially with 20+ projects on the dashboard or complex door schedules.

**Fix:** Apply `React.memo` to pure list-item components. Use `useMemo` for filtered/sorted datasets. Use `useCallback` for event handlers passed as props.

---

### 2.3 AI JSON Repair Runs Up to 100 Iterations

**File:** `services/geminiService.ts`

**The Problem:**
When the AI returns malformed JSON, the application runs a repair loop that can iterate up to 100 times, blocking the main thread while trying to fix the response.

**Impact:** The UI freezes for multiple seconds during AI processing failures.

**Fix:** Move JSON repair logic into the existing Web Worker. Add a strict iteration cap of 10 with early exit. Add structured output constraints to AI prompts to reduce malformed responses.

---

### 2.4 localStorage Read on Every AI Request

**File:** `services/mlOpsService.ts`

**The Problem:**
`getLearnedExamples()` reads and parses all learned examples from localStorage on every single AI invocation. This is a synchronous disk read that happens in the critical path of every AI request.

**Impact:** Increasing latency as the learned examples dataset grows.

**Fix:** Load learned examples once at startup, cache in memory, and invalidate the cache only when examples are added or modified.

---

## Section 3 — TypeScript & Code Quality Issues

---

### 3.1 114+ Uses of the `any` Type

**Files:** `types.ts`, `contexts/BackgroundUploadContext.tsx`, `utils/reportGenerator.ts`, `utils/xlsxParser.ts`, `services/geminiService.ts`, and many more

**The Problem:**
The `any` type completely bypasses TypeScript's type checker. This means the compiler cannot catch bugs where the wrong data shape is passed between functions.

```typescript
// Examples found in codebase
partialData?: any[];
result?: any;
finishSystem?: any; // Placeholder for FinishSystem type if missing
```

**Impact:** Runtime errors that TypeScript would have caught at compile time. Harder to refactor safely.

**Fix:** Replace `any` with proper typed interfaces. Define missing types like `FinishSystem`. Use `unknown` with type guards where the shape is truly dynamic.

---

### 3.2 Inconsistent ID Generation

**Files:** Multiple contexts and services

**The Problem:**
IDs are generated using three different methods throughout the codebase — `crypto.randomUUID()`, `Date.now() + Math.random()`, and `Date.now()` alone. `Date.now()` is particularly problematic as two events in the same millisecond will produce the same ID.

```typescript
// Three different patterns used inconsistently
crypto.randomUUID()                        // ProjectContext
Date.now() + Math.random()                 // BackgroundUploadContext, mlOpsService
Date.now()                                 // ToastContext — collision risk
```

**Fix:** Standardize on `crypto.randomUUID()` across the entire codebase.

---

### 3.3 Dimension Unit Conversion Makes Assumptions

**File:** `services/fileUploadService.ts`

**The Problem:**
The parser silently converts door dimensions from feet to inches if the value is less than 10, assuming the user must have entered feet. A 3'0" × 7'0" door becomes 36 × 84 with no warning shown to the user.

```typescript
if (d.width > 0 && d.width < 10) d.width = Math.round(d.width * 12);
```

**Impact:** Silent data corruption. A door entered as 8 inches wide would be converted to 96 inches (8 feet) with no way to detect the error.

**Fix:** Detect the unit from column headers or file metadata. If ambiguous, prompt the user to confirm the unit before processing.

---

### 3.4 Debug `console.log` Statements in Production Code

**Files:** `services/aiProviderService.ts`, `contexts/BackgroundUploadContext.tsx`, `services/libraryLoader.ts`, `components/ReportGenerationCenter.tsx`

**The Problem:**
Numerous `console.log` and `console.debug` statements are scattered throughout production code. These expose internal application logic to any user who opens the browser console.

**Fix:** Remove all debug logs. For intentional logging, implement a proper logger utility that is disabled in production builds via an environment flag.

---

### 3.5 No Email Validation on Invite

**File:** `components/InviteUserPanel.tsx`

**The Problem:**
The user invite form has no format validation on the email field. Malformed email addresses can be submitted and will silently fail.

**Fix:** Add RFC-compliant email validation with a clear error message before submission.

---

## Section 4 — Architectural Issues

---

### 4.1 Business Logic Mixed Into React Components

**Files:** `views/ProjectView.tsx`, `components/DoorScheduleManager.tsx`, `components/HardwareSetsManager.tsx`

**The Problem:**
Components directly contain complex business logic (pricing calculations, data transformation, schedule validation) that should live in services or custom hooks. This makes the components difficult to test and impossible to reuse.

**Fix:** Extract all business logic into dedicated service functions or custom hooks. Components should only be responsible for rendering and user interaction.

---

### 4.2 Single Web Worker for All Processing

**File:** `contexts/BackgroundUploadContext.tsx`

**The Problem:**
A single Web Worker handles all background file processing. If one large file is being processed, all other uploads queue behind it — there is no parallelism.

**Fix:** Implement a worker pool with 2–3 workers, allowing concurrent processing of multiple files.

---

### 4.3 No Test Coverage

**Files:** Only `App.test.tsx` exists

**The Problem:**
There are zero tests for any services, utility functions, contexts, or components. The parsing, pricing, and AI integration logic — the most critical parts of the application — are completely untested.

**Impact:** Any refactoring or bug fix risks breaking existing functionality with no automated way to detect regressions.

**Fix:** Implement unit tests for all service functions (pricing, parsing, AI response handling) and integration tests for critical user flows (file upload, project creation, export).

---

### 4.4 No Real-time Sync or Collaboration

**The Problem:**
Since all data is in localStorage, two users cannot work on the same project simultaneously. There is no mechanism to detect or resolve conflicts if data is modified in multiple browser tabs.

**Fix:** Migrating to Supabase (from Section 1.3) unlocks real-time subscriptions out of the box, enabling collaborative editing with minimal additional work.

---

## Section 5 — UX/Reliability Issues

---

### 5.1 SkeletonLoader Component Exists But Is Not Used

**File:** `components/SkeletonLoader.tsx`

**The Problem:**
A skeleton loading component was built but never integrated into the `DatabaseView` or `DoorScheduleManager` — the two heaviest data views. These views show blank space while data loads.

**Fix:** Integrate `SkeletonLoader` into all data-heavy views for a professional loading experience.

---

### 5.2 No Progress Indicator During AI Processing

**Files:** `components/NewProjectModal.tsx`, `views/DatabaseView.tsx`

**The Problem:**
When a file is uploaded and sent to the AI for processing, there is no visible progress shown to the user beyond a generic spinner. For large files that take 10–30 seconds, users have no way to know if the app is working or frozen.

**Fix:** Show step-by-step progress ("Parsing file...", "Analyzing with AI...", "Building schedule...") during the upload and processing pipeline.

---

### 5.3 Export Failures Are Silent

**Files:** `services/pdfExportService.ts`, `services/excelExportService.ts`

**The Problem:**
If a PDF or Excel export fails (e.g., due to a corrupted image or malformed data), the error is caught internally but not surfaced to the user. The export button simply stops responding.

**Fix:** Add user-facing error messages for failed exports, with enough detail to help the user understand what went wrong.

---

### 5.4 No IndexedDB Fallback for Private Browsing

**File:** `utils/uploadPersistence.ts`

**The Problem:**
Upload persistence uses IndexedDB, which is disabled in private/incognito browsing mode on some browsers. The app has no fallback, causing silent failures for users in private mode.

**Fix:** Wrap IndexedDB usage in a try-catch and fall back to in-memory storage with a notification to the user.

---

## Summary of All Issues

| Category | Issues Found | Severity |
|---|---|---|
| Security | 4 | Critical |
| Performance | 4 | High |
| TypeScript / Code Quality | 5 | Medium |
| Architecture | 4 | High |
| UX / Reliability | 4 | Medium |
| **Total** | **21 primary issues** | |

---

## Proposed Resolution Plan

### Phase 1 — Security & Data Foundation (Highest Priority)
1. Implement real Supabase Auth — replace mock authentication
2. Migrate all data from localStorage to Supabase database tables
3. Move AI API calls to Supabase Edge Functions — remove browser-exposed keys
4. Add file upload validation (type, size, row count)

### Phase 2 — Performance & Reliability
5. Add virtual scrolling / pagination to all large data tables
6. Add `React.memo` and `useMemo` to heavy render paths
7. Move JSON repair to Web Worker; add structured output to AI prompts
8. Cache learned examples in memory; invalidate on write

### Phase 3 — Code Quality & Correctness
9. Replace all `any` types with proper TypeScript interfaces
10. Standardize ID generation to `crypto.randomUUID()`
11. Fix silent dimension unit conversion — prompt user for confirmation
12. Remove all debug console logs; add environment-gated logger
13. Add email validation on invite form

### Phase 4 — Architecture & Testing
14. Extract business logic from components into services/hooks
15. Implement Web Worker pool for parallel file processing
16. Write unit tests for all service and utility functions
17. Write integration tests for critical user flows

### Phase 5 — UX Polish
18. Integrate SkeletonLoader into DatabaseView and DoorScheduleManager
19. Add step-by-step progress during AI file processing
20. Add user-facing error messages for failed exports
21. Add IndexedDB fallback for private browsing mode

---

*This document was produced from a manual code review of the full source tree. All file paths and line references are based on the current state of the codebase.*
