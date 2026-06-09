# Testing Strategy

## Current State

There are zero test files in the repository. Every release relies on manual testing and the developer's memory of what might break. This is survivable with one developer working on familiar code. It becomes dangerous when:

- A second developer joins and doesn't know the implicit contracts
- A refactor touches shared utilities used in 15 places
- The merge service matching logic changes and 3 of 12 matching strategies silently break
- An AI prompt update causes extraction to miss a column type that only appears in a specific PDF format

The goal is not 100% coverage on day one. The goal is a testing foundation that catches regressions in the most critical, most complex parts of the system.

---

## What to Test First (Prioritized)

### Priority 1 — Service Layer (Pure Functions)

These are the most valuable tests because:
- Services are pure-ish functions: input → output, no browser, no HTTP
- They contain the most complex business logic
- A regression here silently corrupts data
- They're the easiest to test (no mocking needed)

| Service | What to test |
|---------|-------------|
| `mergeService.ts` | All 4 matching strategies (exact, comma-normalized, prefix, token); unmatched doors; sets with no doors; multi-value hwSet codes |
| `doorScheduleService.ts` | Header detection for 10+ real column name variations; section vs flat format detection; dimension parsing (fractions, mm, parentheses) |
| `pricingService.ts` | Quantity discount tiers; partial price book match; fallback pricing; negative unit price guard |
| `hardwarePdfServiceV2.ts` | Tier selection logic (size thresholds); batch construction for Tier 2; response normalization (set name trimming, empty item filtering) |
| `hardwarePrepService.ts` | Recognized function label matching; batch vs single-set variants; empty set handling |

### Priority 2 — API Route Integration Tests

Test the actual HTTP behavior of routes with a real (test) database or mocked DB layer:

| Route | What to test |
|-------|-------------|
| `POST /api/auth/login` | Valid credentials, wrong password, non-existent user, SQL injection attempt |
| `GET /api/projects` | Admin sees all projects, Client sees only assigned, Viewer sees all, deleted projects excluded |
| `POST /api/projects` | Estimator can't create, Admin can create, name validation |
| `POST /api/projects/[id]/process` | Lock acquired + released, 409 if lock held, 499 on cancelled |
| `GET /api/master-hardware` | Pagination (page, pageSize), search filter, sort directions |
| `PUT /api/master-hardware/pending/review` | Approve changes status, reject adds reason, non-Admin can't review |

### Priority 3 — End-to-End (Playwright)

These are expensive to write and maintain, so cover only the critical user paths:

1. **Login → view dashboard → open project** — baseline navigation
2. **Upload Excel + PDF → see processing widget → see matched hardware** — the core value flow
3. **Export to PDF** — regression guard for report generation
4. **Invite team member → accept invite → login as new member** — auth flow

---

## Recommended Stack

### Unit + Integration Tests: Vitest

Vitest is the modern replacement for Jest — faster, better TypeScript support, compatible with the Vite ecosystem. Works well with Next.js 15.

```bash
npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/user-event
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',          // for service tests
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

### E2E Tests: Playwright

```bash
npm install -D @playwright/test
```

### API Integration: Supertest or Hono Test Client

For testing Next.js API routes, use `node-fetch` + a local server, or extract route handlers to test them directly.

---

## Test File Structure

```
tests/
├── unit/
│   ├── services/
│   │   ├── mergeService.test.ts
│   │   ├── doorScheduleService.test.ts
│   │   ├── pricingService.test.ts
│   │   └── hardwarePdfServiceV2.test.ts
│   ├── lib/
│   │   ├── auth/rbac.test.ts
│   │   └── auth/session.test.ts
│   └── utils/
│       ├── hardwareTransformers.test.ts
│       └── descriptionResolver.test.ts
├── integration/
│   ├── api/
│   │   ├── auth.test.ts
│   │   ├── projects.test.ts
│   │   ├── process.test.ts
│   │   └── masterHardware.test.ts
│   └── db/
│       ├── hardware.test.ts         -- test upsert, get, delete patterns
│       └── team.test.ts
└── e2e/
    ├── auth.spec.ts                 -- login, logout, invite flow
    ├── project-upload.spec.ts       -- upload + processing pipeline
    └── export.spec.ts              -- PDF/Excel export
```

---

## Example Tests

### Merge Service (Unit)

```typescript
// tests/unit/services/mergeService.test.ts
import { describe, it, expect } from 'vitest';
import { mergeHardwareData } from '@/services/mergeService';

const makeSets = (names: string[]) =>
  names.map(setName => ({
    setName,
    hardwareItems: [{ qty: 1, item: 'Hinge', manufacturer: 'Hager', description: '1279', finish: '652' }],
  }));

const makeDoors = (doors: Array<{ doorTag: string; hwSet: string }>) =>
  doors.map(d => ({ ...d, doorWidth: "3'-0\"", doorHeight: "7'-0\"" }));

describe('mergeHardwareData - exact match', () => {
  it('matches doors to sets by exact set name (case-insensitive)', () => {
    const result = mergeHardwareData(
      makeSets(['CA01', 'CA02']),
      makeDoors([{ doorTag: '101', hwSet: 'ca01' }]),
      'test-project-id'
    );
    expect(result.sets[0].setName).toBe('CA01');
    expect(result.sets[0].doors).toHaveLength(1);
    expect(result.sets[0].doors[0].doorTag).toBe('101');
    expect(result.sets[1].doors).toHaveLength(0);
  });
});

describe('mergeHardwareData - prefix match', () => {
  it('matches AD05e door to AD05e set (not stripped to AD05)', () => {
    const result = mergeHardwareData(
      makeSets(['AD05', 'AD05e']),
      makeDoors([{ doorTag: '102', hwSet: 'AD05e' }]),
      'test-project-id'
    );
    const ad05e = result.sets.find(s => s.setName === 'AD05e');
    expect(ad05e?.doors).toHaveLength(1);
    const ad05 = result.sets.find(s => s.setName === 'AD05');
    expect(ad05?.doors).toHaveLength(0);
  });
});

describe('mergeHardwareData - unmatched doors', () => {
  it('tracks doors with no matching set', () => {
    const result = mergeHardwareData(
      makeSets(['CA01']),
      makeDoors([{ doorTag: '103', hwSet: 'UNKNOWN' }]),
      'test-project-id'
    );
    expect(result.diagnostics.unmatchedDoorCount).toBe(1);
    expect(result.diagnostics.unmatchedDoorCodes).toContain('UNKNOWN');
  });
});
```

### RBAC (Unit)

```typescript
// tests/unit/lib/auth/rbac.test.ts
import { describe, it, expect } from 'vitest';
import { hasRoleAccess, canInviteRole } from '@/lib/auth/rbac';

describe('hasRoleAccess', () => {
  it('Administrator can access any role-protected route', () => {
    expect(hasRoleAccess('Administrator', ['Administrator', 'SeniorEstimator'])).toBe(true);
  });

  it('Estimator cannot access admin-only routes', () => {
    expect(hasRoleAccess('Estimator', ['Administrator'])).toBe(false);
  });

  it('Client cannot access estimator routes', () => {
    expect(hasRoleAccess('Client', ['Estimator', 'SeniorEstimator', 'Viewer'])).toBe(false);
  });
});

describe('canInviteRole', () => {
  it('Admin can invite any role', () => {
    expect(canInviteRole('Administrator', 'Client')).toBe(true);
    expect(canInviteRole('Administrator', 'Administrator')).toBe(true);
  });

  it('Estimator cannot invite Team Lead', () => {
    expect(canInviteRole('Estimator', 'SeniorEstimator')).toBe(false);
  });
});
```

### API Integration (Projects)

```typescript
// tests/integration/api/projects.test.ts
// Uses a test database (Supabase project or local pg via docker-compose)

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('GET /api/projects', () => {
  it('returns 401 without auth cookie', async () => {
    const res = await fetch('/api/projects');
    expect(res.status).toBe(401);
  });

  it('admin sees all projects', async () => {
    const res = await fetch('/api/projects', {
      headers: { Cookie: `session=${ADMIN_SESSION_TOKEN}` },
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('client sees only assigned projects', async () => {
    const res = await fetch('/api/projects', {
      headers: { Cookie: `session=${CLIENT_SESSION_TOKEN}` },
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.every((p: { id: string }) => ASSIGNED_PROJECT_IDS.includes(p.id))).toBe(true);
  });
});
```

---

## Test Database Strategy

**Option A — Supabase local development (supabase CLI)**

```bash
supabase start  # starts local postgres + studio
supabase db reset  # applies all migrations fresh
```

Tests run against this local instance. Fast, no network, mirrors production schema exactly.

**Option B — Separate Supabase project for testing**

Create a `planckoff-test` Supabase project. Tests connect to it. Slower, costs $0 (free tier), but accessible from CI.

**Recommendation:** Option A for local development, Option B for CI.

---

## CI Integration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Start local Supabase
        uses: supabase/setup-cli@v1
      - run: supabase start
      - run: supabase db reset
      - run: npm run test:unit
      - run: npm run test:integration
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## What to Skip (For Now)

- **Component rendering tests** — Testing React components with Testing Library is valuable but time-consuming to write and maintain. Focus on service and API tests first.
- **100% coverage target** — Target coverage on the critical paths: services, API auth, merge logic. Don't chase lines in UI components.
- **Snapshot tests** — Too brittle for a UI under active development.
- **Performance tests** — Important eventually, but not in the first testing pass.
