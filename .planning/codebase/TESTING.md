# Testing

**Analysis Date:** 2026-05-07

---

## Current State

**No test files exist in the project.** Despite testing libraries being listed in `devDependencies`, there are zero `.test.ts`, `.test.tsx`, `.spec.ts`, or `.spec.tsx` files anywhere in the codebase.

The intended testing framework is **Vitest**, documented in `.claude/commands/test.md`, but Vitest itself is not installed.

---

## Installed Testing Libraries (devDependencies)

| Package | Version | Purpose |
|---------|---------|---------|
| `@testing-library/react` | — | React component testing utilities |
| `@testing-library/jest-dom` | — | Custom jest/vitest matchers for DOM assertions |
| `@testing-library/user-event` | — | Simulates real user interactions |

**Missing (required to run tests):**
- `vitest` — test runner
- `@vitejs/plugin-react` — React support for Vitest
- `jsdom` or `happy-dom` — browser environment simulation

---

## Intended Framework: Vitest

Based on `.claude/commands/test.md`, the project intends to use **Vitest** as the test runner with `@testing-library/react` for component tests.

### Setup Steps

1. **Install missing dependencies:**
   ```
   npm install -D vitest @vitejs/plugin-react jsdom
   ```

2. **Create `vitest.config.ts`:**
   ```ts
   import { defineConfig } from 'vitest/config'
   import react from '@vitejs/plugin-react'
   import path from 'path'

   export default defineConfig({
     plugins: [react()],
     test: {
       environment: 'jsdom',
       setupFiles: ['./vitest.setup.ts'],
       globals: true,
     },
     resolve: {
       alias: {
         '@': path.resolve(__dirname, '.'),
       },
     },
   })
   ```

3. **Create `vitest.setup.ts`:**
   ```ts
   import '@testing-library/jest-dom'
   ```

4. **Add npm scripts to `package.json`:**
   ```json
   "test": "vitest",
   "test:run": "vitest run",
   "test:coverage": "vitest run --coverage"
   ```

---

## Test File Conventions (Intended)

### File Naming
- Unit tests: co-located with source — e.g., `services/pricingService.test.ts` alongside `services/pricingService.ts`
- Component tests: co-located — e.g., `components/Header.test.tsx`
- Integration tests (if added): `__tests__/` directory at the relevant scope

### Test Structure
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('ModuleName', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does the expected thing', () => {
    // arrange
    // act
    // assert
    expect(result).toBe(expected)
  })
})
```

### Mocking
- Module mocks: `vi.mock('../path/to/module')`
- Function mocks: `vi.fn()`, `vi.spyOn()`
- Supabase client: mock `lib/supabase/client.ts` to avoid real DB calls in unit tests

---

## Recommended Test Priority

Given the current zero-coverage state, prioritize in this order:

### 1. Pure utility functions (easiest, highest ROI)
- `utils/csvParser.ts`
- `utils/xlsxParser.ts`
- `utils/doorValidation.ts`
- `utils/hardwareTransformers.ts`

### 2. Service functions with pure logic
- `services/pricingService.ts` (calculation logic)
- `services/mergeService.ts` (merge algorithm)
- `services/geminiService.ts` (JSON parsing / repair logic)

### 3. Custom hooks
- `hooks/useRBAC.ts`
- `hooks/useKeyboardShortcuts.ts`

### 4. Component rendering tests
- `components/ui/*` (primitive components)
- `components/Header.tsx`
- `components/ErrorBoundary.tsx`

### 5. API route handlers (integration tests)
- Requires a test database or Supabase local emulator
- `app/api/auth/login/route.ts`
- `app/api/projects/route.ts`

---

## CI/CD Testing Pipeline

**Current state:** No CI/CD test pipeline is configured. There is no `.github/workflows/` directory or equivalent.

**Recommended:** Add a GitHub Actions workflow that runs `npm run test:run` on every push and pull request.

---

## Coverage Goals

| Area | Target |
|------|--------|
| Pure utilities (`utils/`) | 80%+ |
| Service logic (`services/`) | 60%+ |
| API handlers (`app/api/`) | 40%+ |
| React components | 30%+ |

Start with utilities — they have no external dependencies and will establish the testing infrastructure quickly.

---

*Testing analysis: 2026-05-07*
