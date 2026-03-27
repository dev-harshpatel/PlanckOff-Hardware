# /test — Write Tests

You are executing the `/test` command for: **$ARGUMENTS**

Write comprehensive tests for the specified file, module, or feature.

---

## Test Setup for This Project

**Framework:** Vitest (compatible with Vite + Next.js)
**Libraries:**
- `@testing-library/react` for component tests
- `@testing-library/user-event` for interaction simulation
- `msw` (Mock Service Worker) for API mocking
- `vitest` as the test runner

**Test file location:** Same directory as source file, with `.test.ts` or `.test.tsx` suffix.

---

## What Kind of Test to Write

### Service Functions → Unit Tests

Service functions are pure or nearly pure — easiest to test.

```typescript
// services/pricing/pricingService.test.ts
import { describe, it, expect } from 'vitest'
import { calculateExtendedCost } from './pricingService'

describe('calculateExtendedCost', () => {
  it('calculates total with default labor and markup', () => {
    const item = { unitPrice: 100, quantity: 2, name: 'Hinge' }
    const result = calculateExtendedCost(item)
    // 100 * 2 = 200 material + labor + 15% markup
    expect(result.materialCost).toBe(200)
    expect(result.total).toBeGreaterThan(200)
  })

  it('returns zero for zero quantity', () => {
    const item = { unitPrice: 100, quantity: 0, name: 'Hinge' }
    const result = calculateExtendedCost(item)
    expect(result.total).toBe(0)
  })

  it('applies custom labor rate', () => {
    const item = { unitPrice: 0, quantity: 1, name: 'Hinge' }
    const result = calculateExtendedCost(item, 1, 100) // $100/hr labor
    expect(result.laborCost).toBe(100)
  })
})
```

### Parser Functions → Unit Tests with Fixtures

```typescript
// utils/parsers/csvParser.test.ts
import { describe, it, expect } from 'vitest'
import { parseDoorScheduleCSV } from './csvParser'

const SAMPLE_CSV = `Door Tag,Location,Width,Height,Type
101,Room 101,36,84,Single
102A,Corridor,72,84,Pair`

describe('parseDoorScheduleCSV', () => {
  it('parses a valid door schedule CSV', async () => {
    const doors = await parseDoorScheduleCSV(SAMPLE_CSV)
    expect(doors).toHaveLength(2)
    expect(doors[0].doorTag).toBe('101')
    expect(doors[0].width).toBe(36)
  })

  it('handles BOM character in CSV', async () => {
    const csvWithBOM = '\uFEFF' + SAMPLE_CSV
    const doors = await parseDoorScheduleCSV(csvWithBOM)
    expect(doors[0].doorTag).toBe('101') // Not '\uFEFF101'
  })

  it('returns empty array for empty CSV', async () => {
    const doors = await parseDoorScheduleCSV('')
    expect(doors).toHaveLength(0)
  })

  it('handles missing optional columns gracefully', async () => {
    const minimalCSV = `Door Tag\n101`
    const doors = await parseDoorScheduleCSV(minimalCSV)
    expect(doors[0].doorTag).toBe('101')
    expect(doors[0].width).toBe(0) // default
  })
})
```

### Validation Logic → Unit Tests (Edge Cases)

```typescript
// utils/validation/doorValidation.test.ts
import { describe, it, expect } from 'vitest'
import { validateDoors } from './doorValidation'

describe('validateDoors', () => {
  it('rejects doors with missing doorTag', () => {
    const result = validateDoors([{ doorTag: '', width: 36, height: 84 }])
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].field).toBe('doorTag')
  })

  it('rejects duplicate door tags', () => {
    const result = validateDoors([
      { doorTag: '101', width: 36, height: 84 },
      { doorTag: '101', width: 36, height: 84 }, // duplicate
    ])
    expect(result.errors.some(e => e.issue.includes('Duplicate'))).toBe(true)
    expect(result.data).toHaveLength(1) // only first kept
  })

  it('warns on missing dimensions but does not reject', () => {
    const result = validateDoors([{ doorTag: '101', width: 0, height: 0 }])
    expect(result.warnings).toHaveLength(1)
    expect(result.data).toHaveLength(1) // still included
  })

  it('converts feet to inches when width < 10', () => {
    const result = validateDoors([{ doorTag: '101', width: 3, height: 7 }])
    expect(result.data[0].width).toBe(36) // 3 * 12
    expect(result.data[0].height).toBe(84) // 7 * 12
  })
})
```

### Hooks → React Testing Library

```typescript
// features/doors/hooks/useDoorSchedule.test.ts
import { renderHook, act } from '@testing-library/react'
import { useDoorSchedule } from './useDoorSchedule'

describe('useDoorSchedule', () => {
  it('starts with empty doors and loading state', () => {
    const { result } = renderHook(() => useDoorSchedule('project-123'))
    expect(result.current.doors).toEqual([])
    expect(result.current.isLoading).toBe(true)
  })

  it('adds a door via addDoor', async () => {
    const { result } = renderHook(() => useDoorSchedule('project-123'))
    await act(async () => {
      result.current.addDoor({ doorTag: '101', width: 36, height: 84 })
    })
    expect(result.current.doors).toHaveLength(1)
    expect(result.current.doors[0].doorTag).toBe('101')
  })
})
```

### API Routes → Integration Tests with MSW

```typescript
// app/api/ai/generate/route.test.ts
import { describe, it, expect, vi } from 'vitest'
import { POST } from './route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
  }),
}))

describe('POST /api/ai/generate', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })

    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test', schema: {} }),
    })
    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('returns 400 for invalid input', async () => {
    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({}), // missing required fields
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })
})
```

---

## PDF Pipeline Tests

The PDF pipeline is complex — test each layer independently:

```typescript
// utils/pdfTriage.test.ts
describe('classifyPage', () => {
  it('identifies door schedule pages', () => {
    const text = 'Door Tag  Location  Width  Height  Type\n101  Room 101  36  84  Single'
    expect(classifyPage(text)).toBe('door-schedule')
  })

  it('identifies hardware set pages', () => {
    const text = 'HW-1\nHinges - 3 per door\nLockset - Schlage ND Series\nDoor Closer - LCN 4040'
    expect(classifyPage(text)).toBe('hardware-set')
  })

  it('marks cover pages as irrelevant', () => {
    const text = 'PROJECT SPECIFICATIONS\nGeneral Contractor: ABC Corp\nProject Number: 2026-001'
    expect(classifyPage(text)).toBe('irrelevant')
  })
})
```

---

## Test Writing Rules

1. **Test behavior, not implementation** — test what a function DOES, not how it does it
2. **One assertion per test** (roughly) — each test has one clear failure reason
3. **Descriptive test names** — `it('rejects doors with missing doorTag')` not `it('works')`
4. **Always test edge cases:** empty input, null/undefined, boundary values, duplicates
5. **No network calls in unit tests** — mock external dependencies
6. **Test files mirror source structure** — `services/pricing/pricingService.test.ts`

---

## Running Tests

```bash
npx vitest run              # Run all tests once
npx vitest                  # Watch mode
npx vitest run --coverage   # With coverage report
npx vitest run services/    # Run only service tests
```
