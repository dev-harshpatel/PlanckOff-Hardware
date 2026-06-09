# Code Quality — TypeScript, Validation, Error Handling

## Current State

The codebase ships working features but has several quality gaps that compound over time. None of these are catastrophic today, but each one is a hidden landmine that gets harder to defuse the longer it's left.

---

## 1. TypeScript Strict Mode Is Disabled

**File:** `tsconfig.json`
```json
{
  "strict": false
}
```

This disables the most useful checks TypeScript provides:

| Check | What it catches | Currently active? |
|-------|----------------|-------------------|
| `strictNullChecks` | Accessing `.name` on a value that could be `null` | No |
| `noImplicitAny` | Parameters and variables with inferred `any` type | No |
| `strictFunctionTypes` | Contravariant callback parameter types | No |
| `strictPropertyInitialization` | Class properties not initialized in constructor | No |

**What this means in practice:** You can write `user.role.toUpperCase()` and TypeScript won't warn you even if `user` could be `null`. These bugs are invisible until runtime.

**How to fix it:**

Step 1 — Enable one check at a time, not all at once:
```json
{
  "strictNullChecks": true   // Start here — most impactful, most common bugs
}
```

Step 2 — Fix all the errors that surface (there will be many). Most fixes are trivial (`?.` optional chaining or `!` non-null assertion where you know it's safe).

Step 3 — Add `noImplicitAny`:
```json
{
  "strictNullChecks": true,
  "noImplicitAny": true
}
```

Step 4 — Set `"strict": true` to get the full suite.

**Estimate:** 2–3 days of mechanical fixes, mostly in components and hooks. Worth doing before the codebase grows further.

---

## 2. No Input Validation on API Routes

Most API routes accept a JSON body and immediately destructure it with no validation. Examples:

```typescript
// app/api/projects/route.ts — no validation
const { name, client, location } = await req.json();
await createProject({ name, client, location });
```

If `name` is `null`, `undefined`, a 10,000-character string, or an object, it goes straight to the database query. Some of these will throw a database error (caught by the `try/catch`), but the error message leaks internal details and the behavior is unpredictable.

**Specific gaps found:**

| Route | Field | Problem |
|-------|-------|---------|
| `POST /api/projects` | `name` | No max length, no empty check |
| `PUT /api/projects/[id]/pricing` | `unitPrice` | No min (0), no max, accepts negative |
| `POST /api/master-hardware` | `name, manufacturer` | No max length, no XSS check |
| `POST /api/team/members` | `email` | No email format validation |
| `POST /api/projects/[id]/process` | file upload | Type checked, size checked, but content not validated |
| `PUT /api/settings/company` | `taxRate` | No range check (could be 9999%) |

**What to use:** Zod. It's already common in the Next.js ecosystem and integrates cleanly with TypeScript:

```typescript
import { z } from 'zod';

const CreateProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  client: z.string().max(200).optional(),
  location: z.string().max(500).optional(),
});

// In route handler:
const body = await req.json();
const parsed = CreateProjectSchema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json(
    { error: 'Invalid request', details: parsed.error.flatten() },
    { status: 400 }
  );
}
const { name, client, location } = parsed.data;
```

**Estimate:** 3–4 days to add Zod schemas for all API routes. Add them one route at a time, starting with the most user-facing ones.

---

## 3. Inconsistent Error Response Shape

API routes return errors in at least three different shapes:

```typescript
// Shape A — most routes
{ error: "Something went wrong" }

// Shape B — some routes
{ error: "Something went wrong", message: "Detailed message" }

// Shape C — some routes
{ data: null, error: "Something went wrong" }

// Shape D — some routes (exception case leaks)
{ error: e.message }  // could be "column x does not exist" from Postgres
```

The frontend has to handle all of these differently. `useProjectData`, `useFetchMutation`, and every hook has its own ad-hoc error parsing.

**The fix:** Define one error response shape and use it everywhere.

```typescript
// lib/api/response.ts

export interface ApiError {
  error: string;           // human-readable, safe to show user
  code?: string;           // machine-readable, e.g. "VALIDATION_ERROR"
  details?: unknown;       // structured details (Zod errors, field-level)
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

export function errorResponse(
  message: string,
  status: number,
  code?: string,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    { error: { error: message, code, details } } satisfies ApiResponse<never>,
    { status }
  );
}

export function successResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(
    { data } satisfies ApiResponse<T>,
    { status }
  );
}
```

Then update all routes:
```typescript
// Before
return NextResponse.json({ error: 'Project not found' }, { status: 404 });

// After
return errorResponse('Project not found', 404, 'NOT_FOUND');
```

And the frontend error handling becomes one shared utility.

---

## 4. Magic Numbers and Hardcoded Constants

Scattered throughout the codebase:

```typescript
// services/hardwarePdfServiceV2.ts
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;  // 50 MB — hardcoded
const TIER1_SIZE_LIMIT = 20 * 1024 * 1024;      // 20 MB — hardcoded
const TIER2_BATCH_SIZE = 10;                      // pages per AI call — hardcoded
const TIER2_MAX_CONCURRENT = 4;                   // parallel AI calls — hardcoded

// lib/auth/session.ts
const SESSION_DURATION_DAYS = 7;                  // OK — in constants/auth.ts
const SESSION_RENEWAL_WINDOW_HOURS = 24;          // Not in constants

// services/pricingService.ts
defaultLaborRate: 75,           // $/hour — hardcoded, should be configurable per org
defaultMaterialMarkup: 35,      // % — hardcoded
defaultTaxRate: 8,              // % — hardcoded (varies by state/country)

// hooks/useProjectData.ts
setInterval(pollForUpdates, 3000);  // 3s polling — hardcoded
```

**The fix:** Collect all tunable values into `constants/config.ts`:

```typescript
// constants/config.ts
export const PDF_PROCESSING = {
  MAX_FILE_SIZE_MB: 50,
  TIER1_MAX_SIZE_MB: 20,
  TIER2_BATCH_SIZE: 10,
  TIER2_MAX_CONCURRENT: 4,
} as const;

export const AUTH = {
  SESSION_DURATION_DAYS: 7,
  SESSION_RENEWAL_WINDOW_HOURS: 24,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 15,
} as const;

export const PRICING_DEFAULTS = {
  LABOR_RATE_USD: 75,
  MATERIAL_MARKUP_PERCENT: 35,
  LABOR_MARKUP_PERCENT: 25,
  TAX_RATE_PERCENT: 8,
} as const;

export const POLLING = {
  PROJECT_DATA_INTERVAL_MS: 3000,
} as const;
```

Ideally, some of these (labor rate, markup, tax rate) should be per-organization settings stored in the database, not constants.

---

## 5. `any` Type Usage

Without strict mode, `any` is used implicitly in many places. Explicit `any` also appears:

```typescript
// hooks/useHardwareSetsManager.ts
const handleSave = (data: any) => { ... }

// services/pricingService.ts
function lookupDoorPrice(door: any, priceBook: any): number { ... }

// components/pricing/PricingHierarchyView.tsx
const [selectedItem, setSelectedItem] = useState<any>(null);
```

Each `any` is a hole in the type system. The fix is to use the specific types from `types.ts` that already exist.

**Quick wins** — these already have correct types defined:
```typescript
// Replace
const handleSave = (data: any) => { ... }
// With
const handleSave = (data: HardwareSet) => { ... }

// Replace
function lookupDoorPrice(door: any, priceBook: any): number
// With
function lookupDoorPrice(door: Door, priceBook: PriceBook): number
```

---

## 6. Missing Error Boundaries Around Async Operations

The global `ErrorBoundary` catches React render errors, but async operations (fetch calls in hooks) are not covered. If `useProjectData` throws during data loading, it surfaces as an unhandled promise rejection — not a graceful error state.

**Current pattern:**
```typescript
// hooks/useProjectData.ts
useEffect(() => {
  fetchProjectData().catch(console.error);  // silently logs, no UI feedback
}, []);
```

**Better pattern:**
```typescript
const [error, setError] = useState<Error | null>(null);

useEffect(() => {
  fetchProjectData().catch((err) => {
    setError(err);
    toast.error('Failed to load project data. Please refresh.');
  });
}, []);

if (error) return <ErrorState error={error} onRetry={() => setError(null)} />;
```

Every data-fetching hook should have an explicit error state and surface it to the user.

---

## 7. No Linting Rules Enforced for Quality

The project has `eslint` configured but the rules are not strict. Key rules missing:

```json
// .eslintrc or eslint.config.js additions needed

"rules": {
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/no-non-null-assertion": "warn",
  "@typescript-eslint/no-unused-vars": "error",
  "no-console": ["warn", { "allow": ["warn", "error"] }],
  "react-hooks/exhaustive-deps": "error",   // currently disabled
  "import/no-cycle": "error"                // detect circular imports
}
```

`react-hooks/exhaustive-deps` is particularly important — missing dependencies in `useEffect` cause stale closure bugs that are very hard to debug.

---

## 8. Missing JSDoc on Public Service APIs

The service functions have no documentation. When you look at `mergeHardwareData(sets, doors, projectId)` for the first time, you have to read the entire implementation to understand:
- What "sets" format is expected
- What "matching" means (exact vs prefix vs token)
- What the return value shape is
- What happens when a door has no matching set

Each public service function should have a minimal JSDoc comment covering input contracts and return value:

```typescript
/**
 * Matches PDF-extracted hardware sets to door schedule rows using
 * a cascading strategy: exact → comma-normalized → prefix → token.
 *
 * Doors with no match are included in result with `doors: []`.
 * Sets with no matching doors are included with warnings.
 *
 * @returns MergedHardwareSet[] — one entry per hardware set from the PDF
 */
export function mergeHardwareData(
  extractedSets: ExtractedHardwareSet[],
  doorRows: DoorScheduleRow[],
  projectId: string
): MergeResult { ... }
```

This is especially important for the PDF services, merge service, and pricing service — these are the most complex and least self-documenting.

---

## Priority Order

1. Zod validation on all API routes (prevents data corruption, improves error messages)
2. Consistent error response shape (unblocks frontend error handling improvements)
3. TypeScript strict null checks (catches most common class of runtime errors)
4. Extract magic numbers to constants (configuration becomes explicit)
5. ESLint rule enforcement (prevents regressions)
6. Full strict mode (long-term payoff, short-term pain)
