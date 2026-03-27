---
description: Audits and refactors code for DRY — extracts duplicate logic, constants, and shared utilities into proper modules
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Modularize Skill

You are executing the `/modularize` skill. Your job is to identify duplication, extract shared logic, enforce DRY (Don't Repeat Yourself), and restructure code into clean, reusable modules. Apply this to whatever file or feature the user specifies, or run a full codebase audit if no target is given.

---

## CONTEXT

This is a TypeScript + React + Next.js hardware estimating application. The codebase contains services, hooks, components, constants, and utilities across domains: projects, doors, hardware sets, pricing, AI extraction, file export.

---

## STEP 1 — AUDIT BEFORE TOUCHING ANYTHING

Before making changes, run this audit:

1. **Find duplicate logic** — Search for functions that do the same thing in different files. Look for:
   - Identical `localStorage.getItem`/`setItem` patterns
   - Identical date formatting patterns
   - Identical API call patterns (fetch + error handling)
   - Repeated price calculation logic
   - Repeated file parsing patterns

2. **Find duplicate constants** — Search for the same string or number appearing more than once:
   - Hardcoded route strings (`'/projects'`, `'/database'`)
   - Hardcoded role strings (`'Administrator'`, `'Viewer'`)
   - Hardcoded rate values (markup %, labor rates)
   - Hardcoded localStorage keys (`'tve_projects'`, `'tve_master_inventory'`)

3. **Find large files** — Any file over 300 lines likely contains logic that belongs elsewhere. Audit:
   - `ProjectContext.tsx` — state + data fetching + business logic mixed together
   - `DoorScheduleManager.tsx` — UI + validation + data transformation mixed
   - `EstimationReport.tsx` — rendering + calculation + formatting mixed

4. **Find inline logic in JSX** — Any `.map()`, `.filter()`, `.reduce()` inside return blocks

5. **Find direct localStorage calls** — Every raw `localStorage.getItem/setItem` should go through a typed utility

---

## STEP 2 — EXTRACTION RULES

### Rule: One Logic, One Location

If the same logic appears in more than one place, it belongs in exactly one file. The rule is simple:

| Type of Logic | Where It Lives |
|---|---|
| Math / calculation | `services/{domain}/{domain}Service.ts` |
| Data transformation | `utils/migrations/` or `utils/` |
| Validation logic | `utils/validation/` |
| API calls | `services/{domain}/` |
| UI state management | `hooks/use{Domain}.ts` |
| Hardcoded values | `constants/{domain}.ts` |
| localStorage access | `hooks/useLocalStorage.ts` |
| Date formatting | `utils/formatters.ts` |
| Currency formatting | `utils/formatters.ts` |

### Rule: Constants First

Before extracting a function, check: is this duplicated logic because of a duplicated constant?

Example — if you see this in multiple files:
```typescript
// In ProjectContext.tsx
localStorage.setItem('tve_projects', JSON.stringify(projects))

// In Dashboard.tsx
const raw = localStorage.getItem('tve_projects')
```

Step 1: Extract the key to a constant:
```typescript
// constants/storage.ts
export const STORAGE_KEYS = {
  PROJECTS: 'tve_projects',
  MASTER_INVENTORY: 'tve_master_inventory',
  APP_SETTINGS: 'tve_app_settings',
  MOCK_USER: 'mock_user',
} as const
```

Step 2: Extract the localStorage pattern to a hook:
```typescript
// hooks/useLocalStorage.ts
'use client'

import { useState, useCallback } from 'react'

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : initialValue
    } catch {
      return initialValue
    }
  })

  const set = useCallback((newValue: T) => {
    try {
      setValue(newValue)
      window.localStorage.setItem(key, JSON.stringify(newValue))
    } catch {
      // localStorage unavailable (SSR, private mode)
    }
  }, [key])

  const remove = useCallback(() => {
    try {
      setValue(initialValue)
      window.localStorage.removeItem(key)
    } catch { /* noop */ }
  }, [key, initialValue])

  return [value, set, remove] as const
}
```

---

## STEP 3 — HOW TO EXTRACT SHARED LOGIC

### Pattern A: Repeated Calculation → Service Function

**Before (duplicated in 3 places):**
```typescript
// In EstimationReport.tsx
const total = item.unitPrice * item.quantity * (1 + 0.15)

// In PricingView.tsx
const cost = item.unitPrice * item.quantity * 1.15

// In ReportGenerationCenter.tsx
const extended = item.qty * item.price * 1.15
```

**After:**
```typescript
// constants/pricing.ts
export const PRICING_DEFAULTS = {
  MARKUP_RATE: 0.15,
} as const

// services/pricing/pricingService.ts
import type { HardwareItem } from '@/types'
import { PRICING_DEFAULTS } from '@/constants/pricing'

/** Calculates extended cost including markup for a single line item. */
export function calculateLineItemCost(item: HardwareItem): number {
  return item.unitPrice * item.quantity * (1 + PRICING_DEFAULTS.MARKUP_RATE)
}

// In EstimationReport.tsx, PricingView.tsx, ReportGenerationCenter.tsx
import { calculateLineItemCost } from '@/services/pricing'
const total = calculateLineItemCost(item)
```

---

### Pattern B: Repeated Data Transformation → Utility Function

**Before (duplicated in 2 places):**
```typescript
// In geminiService.ts
const doorData = rawDoors.map(d => ({
  id: crypto.randomUUID(),
  doorNumber: d.door_number || d.doorNumber || '',
  width: parseFloat(d.width) || 0,
  // ... 20 more fields
}))

// In xlsxParser.ts
const doors = rows.map(row => ({
  id: crypto.randomUUID(),
  doorNumber: row['Door Number'] || row.door_number || '',
  width: parseFloat(row.Width) || 0,
  // ... same 20 fields
}))
```

**After:**
```typescript
// utils/migrations/doorDataMigration.ts
import type { Door } from '@/types'

/** Normalizes a raw door record from any source (AI, Excel, CSV) to the Door domain type. */
export function normalizeDoorRecord(raw: Record<string, unknown>): Door {
  return {
    id: crypto.randomUUID(),
    doorNumber: String(raw.door_number ?? raw.doorNumber ?? raw['Door Number'] ?? ''),
    width: parseFloat(String(raw.width ?? raw.Width ?? 0)) || 0,
    height: parseFloat(String(raw.height ?? raw.Height ?? 0)) || 0,
    // ... all fields in one place
  }
}
```

---

### Pattern C: Repeated API Call Pattern → Service Function

**Before:**
```typescript
// In 4 different components — same fetch + error handling pattern
const response = await fetch('/api/ai/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt, schema }),
})
if (!response.ok) throw new Error('AI generation failed')
const data = await response.json()
```

**After:**
```typescript
// services/ai/aiProviderService.ts
import type { AIGenerationOptions } from '@/types/api'

/** Sends a structured prompt to the AI generation endpoint. */
export async function generateAIContent<T>(
  prompt: string,
  schema: Record<string, unknown>,
  options?: AIGenerationOptions,
): Promise<T> {
  const response = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, schema, options }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`AI generation failed: ${error}`)
  }

  return response.json() as Promise<T>
}
```

---

### Pattern D: Repeated Format Logic → Utility

```typescript
// utils/formatters.ts

/** Formats a number as USD currency string. */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

/** Formats an ISO date string to display format (e.g. "Mar 27, 2026") */
export function formatDisplayDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Truncates a string to maxLength with ellipsis. */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return `${str.slice(0, maxLength - 3)}...`
}
```

---

### Pattern E: Large Component → Feature + Sub-Components

When a component exceeds 300 lines, it's doing too much. Split it:

**Before:** `DoorScheduleManager.tsx` (800+ lines, contains filtering, validation, editing, display)

**After:**
```
features/doors/
├── components/
│   ├── DoorScheduleManager.tsx    # Orchestrator only (~80 lines)
│   ├── DoorTable.tsx              # Table display only
│   ├── DoorFilters.tsx            # Filter UI + filter logic
│   ├── DoorRow.tsx                # Single row display
│   └── index.ts
├── hooks/
│   ├── useDoorFilters.ts          # Filter state + derived filtered list
│   └── useDoorValidation.ts       # Validation logic
```

The orchestrator imports and composes, never implements:
```typescript
// DoorScheduleManager.tsx — orchestrator only
export function DoorScheduleManager({ projectId }: Props) {
  const { doors, isLoading } = useDoorSchedule(projectId)
  const { filters, setFilter, filteredDoors } = useDoorFilters(doors)

  return (
    <div>
      <DoorFilters filters={filters} onFilterChange={setFilter} />
      <DoorTable doors={filteredDoors} isLoading={isLoading} />
    </div>
  )
}
```

---

## STEP 4 — BARREL EXPORTS

Every feature folder needs an `index.ts` that re-exports its public API. This controls what is accessible from outside the feature:

```typescript
// features/doors/index.ts
export { DoorScheduleManager } from './components/DoorScheduleManager'
export { DoorTable } from './components/DoorTable'
export type { DoorFilters } from './hooks/useDoorFilters'
// Do NOT export internal implementation details
```

Consumer imports clean:
```typescript
import { DoorScheduleManager } from '@/features/doors'
// NOT: import { DoorScheduleManager } from '@/features/doors/components/DoorScheduleManager'
```

---

## STEP 5 — CONSTANTS AUDIT

Find and extract every magic value. Run this audit on all files:

### localStorage Keys
All raw string keys → `constants/storage.ts`:
```typescript
export const STORAGE_KEYS = {
  PROJECTS: 'tve_projects',
  MASTER_INVENTORY: 'tve_master_inventory',
  APP_SETTINGS: 'tve_app_settings',
  MOCK_USER: 'mock_user',
} as const
```

### Routes
All route strings → `constants/routes.ts`:
```typescript
export const ROUTES = {
  HOME: '/',
  PROJECTS: '/projects',
  PROJECT: (id: string) => `/projects/${id}`,
  PROJECT_REPORTS: (id: string) => `/projects/${id}/reports`,
  DATABASE: '/database',
  TEAM: '/team',
} as const
```

### Role Values
All role strings → `constants/roles.ts`:
```typescript
export const ROLE = {
  ADMINISTRATOR: 'Administrator',
  SENIOR_ESTIMATOR: 'SeniorEstimator',
  ESTIMATOR: 'Estimator',
  VIEWER: 'Viewer',
} as const
export type Role = typeof ROLE[keyof typeof ROLE]

export const ROLE_PERMISSIONS = {
  [ROLE.ADMINISTRATOR]: ['read', 'write', 'delete', 'invite'],
  [ROLE.SENIOR_ESTIMATOR]: ['read', 'write'],
  [ROLE.ESTIMATOR]: ['read', 'write'],
  [ROLE.VIEWER]: ['read'],
} as const
```

---

## STEP 6 — MODULARIZATION CHECKLIST

Before declaring modularization complete for a file or feature:

- [ ] No function defined in more than one file
- [ ] No magic string/number without a named constant
- [ ] No raw `localStorage.getItem`/`setItem` outside `useLocalStorage` hook
- [ ] No component over 300 lines
- [ ] No inline `.map()/.filter()` in JSX return blocks
- [ ] No calculation logic inside a component (moved to service)
- [ ] No data transformation inside a component (moved to utility)
- [ ] Every feature folder has an `index.ts` barrel export
- [ ] All shared formatters in `utils/formatters.ts`
- [ ] All route strings in `constants/routes.ts`
- [ ] All storage keys in `constants/storage.ts`
