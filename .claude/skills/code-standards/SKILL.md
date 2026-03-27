---
description: Enforces senior-level coding standards — TypeScript, React, naming, imports, error handling, formatting
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Code Standards Skill

You are executing the `/code-standards` skill. Apply these rules to every file you write or modify in this project. These are non-negotiable professional standards — enforce them strictly.

---

## CONTEXT

This is a TypeScript + React + Next.js hardware estimating application. The codebase must be maintainable, readable, and scalable. Every file you produce must reflect senior-level engineering judgment.

---

## 1. FILE & FOLDER NAMING

| Artifact | Convention | Example |
|---|---|---|
| React components | PascalCase `.tsx` | `DoorScheduleManager.tsx` |
| Hooks | camelCase, `use` prefix, `.ts` | `useKeyboardShortcuts.ts` |
| Services | camelCase, `Service` suffix, `.ts` | `pricingService.ts` |
| Utilities | camelCase, `.ts` | `doorValidation.ts` |
| Types | camelCase, `.ts` | `domain.ts` |
| Constants | camelCase, `.ts` | `hardware.ts` |
| Test files | same name + `.test.ts(x)` | `pricingService.test.ts` |
| Folders | camelCase or kebab-case | `features/`, `door-schedule/` |
| API routes | `route.ts` inside folder | `app/api/ai/generate/route.ts` |

**Rule:** Never name files `index.tsx` for components. `index.ts` is for barrel exports only.

---

## 2. TYPESCRIPT RULES

### Strictness
- ALWAYS use explicit types on function parameters and return values
- NEVER use `any` — use `unknown` and narrow with type guards instead
- NEVER use non-null assertion `!` — use optional chaining `?.` or explicit checks
- Use `as` type assertions only as a last resort with a comment explaining why
- Enable `"strict": true` in tsconfig — this project requires it

### Type Definitions
```typescript
// WRONG — inline type clutter
const processProject = (proj: { id: string; name: string; status: 'active' | 'inactive' }) => { ... }

// RIGHT — named types from types/
import type { Project } from '@/types'
const processProject = (project: Project): ProcessedProject => { ... }
```

### Import type keyword
- Use `import type` for type-only imports — prevents bundling types at runtime:
```typescript
import type { Project, HardwareItem } from '@/types'
import { createProject } from '@/services/projects'
```

### Enums
- Prefer `const` objects over TypeScript `enum` for tree-shaking:
```typescript
// PREFERRED
export const ROLE = {
  ADMINISTRATOR: 'Administrator',
  SENIOR_ESTIMATOR: 'SeniorEstimator',
  ESTIMATOR: 'Estimator',
  VIEWER: 'Viewer',
} as const
export type Role = typeof ROLE[keyof typeof ROLE]

// AVOID
enum Role { Administrator = 'Administrator', ... }
```

---

## 3. REACT COMPONENT RULES

### Component Structure — Always in This Order
```typescript
'use client' // 1. Directive (if needed)

// 2. React imports
import { useState, useEffect, useCallback, useMemo } from 'react'

// 3. Next.js imports
import Link from 'next/link'

// 4. Third-party imports (alphabetical by package)
import { format } from 'date-fns'

// 5. Internal imports — absolute paths only
import type { Project } from '@/types'
import { Button } from '@/components/ui'
import { useToast } from '@/hooks/useToast'
import { ROUTES } from '@/constants/routes'

// 6. Types local to this file
interface Props {
  project: Project
  onSave: (project: Project) => void
  isLoading?: boolean
}

// 7. Component (named export, no default export for components)
export function ProjectCard({ project, onSave, isLoading = false }: Props) {
  // 7a. Hooks first (no logic between hooks)
  const { showToast } = useToast()
  const [isEditing, setIsEditing] = useState(false)

  // 7b. Derived state / memoized values
  const displayName = useMemo(() => project.name.trim(), [project.name])

  // 7c. Callbacks
  const handleSave = useCallback(() => {
    onSave(project)
    showToast({ type: 'success', message: 'Project saved' })
  }, [project, onSave, showToast])

  // 7d. Effects last
  useEffect(() => {
    // Effect logic
  }, [project.id])

  // 7e. Early returns for loading/error states
  if (isLoading) return <SkeletonLoader />

  // 7f. Render
  return (
    <div>
      {displayName}
    </div>
  )
}
```

### Naming Rules for Components
- ALWAYS use named exports — never `export default` for components
- Props interface named `Props` (local) or `ComponentNameProps` (if exported)
- Event handlers prefixed `handle*` — `handleSave`, `handleDelete`, `handleInputChange`
- Boolean props prefixed `is*`, `has*`, `can*` — `isLoading`, `hasError`, `canEdit`

### Forbidden Patterns
```typescript
// FORBIDDEN — default export for components
export default function MyComponent() { ... }

// FORBIDDEN — inline object/function creation in JSX
<Component style={{ margin: 10 }} onClick={() => doSomething()} />

// FORBIDDEN — using index as key
items.map((item, index) => <Item key={index} />)

// FORBIDDEN — nested ternaries
{a ? b ? 'x' : 'y' : 'z'}

// FORBIDDEN — logic inside JSX
{items.filter(i => i.active).map(i => (...))}
```

```typescript
// CORRECT — stable keys from data
items.map((item) => <Item key={item.id} />)

// CORRECT — extract logic before return
const activeItems = useMemo(() => items.filter(i => i.active), [items])
return activeItems.map(...)

// CORRECT — explicit conditional
{isEditing ? <EditForm /> : <DisplayView />}
```

---

## 4. HOOKS RULES

```typescript
// hooks/useProjectData.ts
'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Project } from '@/types'
import { fetchProject } from '@/services/projects'

interface UseProjectDataReturn {
  project: Project | null
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useProjectData(projectId: string): UseProjectDataReturn {
  const [project, setProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchProject(projectId)
      setProject(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project')
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  return { project, isLoading, error, refetch: load }
}
```

Rules:
- Hooks return a typed object, not a plain tuple (unless it's a simple 2-value like `[value, setter]`)
- Define return type interface explicitly
- Use `useCallback` for all functions returned from hooks
- Handle loading, error, and data states explicitly

---

## 5. SERVICE RULES

Services are plain TypeScript modules — no React, no Next.js, no hooks.

```typescript
// services/pricing/pricingService.ts

import type { HardwareItem, PricingBreakdown } from '@/types'
import { PRICING_DEFAULTS } from '@/constants/pricing'

/**
 * Calculates the total extended cost for a hardware item
 * including labor and markup.
 */
export function calculateExtendedCost(
  item: HardwareItem,
  quantity: number,
  laborRate: number = PRICING_DEFAULTS.LABOR_RATE,
): PricingBreakdown {
  const materialCost = item.unitPrice * quantity
  const laborCost = laborRate * quantity
  const subtotal = materialCost + laborCost
  const markup = subtotal * PRICING_DEFAULTS.MARKUP_RATE

  return {
    materialCost,
    laborCost,
    subtotal,
    markup,
    total: subtotal + markup,
  }
}
```

Rules:
- Every exported function has a JSDoc comment explaining what it does
- Pure functions where possible — same input always produces same output
- No side effects in utility functions
- Async functions return typed Promises: `Promise<Project>`, not `Promise<any>`
- Error propagation: throw typed errors, don't swallow them

---

## 6. CONSTANTS RULES

```typescript
// constants/pricing.ts

/** Default pricing configuration for hardware estimation */
export const PRICING_DEFAULTS = {
  LABOR_RATE: 85,           // USD per hour
  MARKUP_RATE: 0.15,        // 15% markup on subtotal
  TAX_RATE: 0.0875,         // Default tax rate (8.75%)
  MIN_ORDER_QTY: 1,
} as const

/** Hardware category codes per CSI MasterFormat Division 08 */
export const HARDWARE_CATEGORIES = {
  HINGES: '08710',
  CLOSERS: '08712',
  LOCKS: '08714',
  EXITS: '08715',
} as const
```

Rules:
- ALL magic numbers/strings must live in `constants/`
- Group by domain — one file per domain (pricing, doors, hardware, roles, routes)
- Mark all constant objects `as const` for literal type inference
- Add a JSDoc comment to every constant explaining units or context
- NEVER define a constant inside a component or service file unless it's a local-only implementation detail

---

## 7. ERROR HANDLING

### In Services
```typescript
// CORRECT — throw specific, typed errors
export class ProjectNotFoundError extends Error {
  constructor(projectId: string) {
    super(`Project with ID "${projectId}" was not found`)
    this.name = 'ProjectNotFoundError'
  }
}

export async function fetchProject(id: string): Promise<Project> {
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).single()
  if (error) throw new ProjectNotFoundError(id)
  return data
}
```

### In Components
```typescript
// CORRECT — catch at the component boundary, show user-facing message
const handleSave = useCallback(async () => {
  try {
    await saveProject(project)
    showToast({ type: 'success', message: 'Project saved successfully' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save project'
    showToast({ type: 'error', message })
  }
}, [project, showToast])
```

Rules:
- Services throw errors — components catch and handle them
- Never `console.error` without also taking action (showing error to user or rethrowing)
- Never silence errors with empty catch blocks
- User-facing error messages are human-readable, not stack traces

---

## 8. IMPORTS — MANDATORY ORDER

All imports in this order, separated by blank lines:

```typescript
// 1. React (always first if used)
import { useState, useEffect } from 'react'

// 2. Next.js
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// 3. Third-party packages (alphabetical)
import { format } from 'date-fns'
import { z } from 'zod'

// 4. Internal — types (import type)
import type { Project, HardwareItem } from '@/types'

// 5. Internal — constants
import { ROUTES, PRICING_DEFAULTS } from '@/constants'

// 6. Internal — services/utils
import { calculateExtendedCost } from '@/services/pricing'
import { formatCurrency } from '@/utils'

// 7. Internal — hooks
import { useToast } from '@/hooks/useToast'

// 8. Internal — components (most specific to least)
import { Button, Modal } from '@/components/ui'
import { DoorCard } from '@/features/doors/components'
```

---

## 9. COMMENTS & DOCUMENTATION

```typescript
// WRONG — comment explains WHAT the code does (already obvious)
// Loop through items and filter active ones
const activeItems = items.filter(i => i.active)

// RIGHT — comment explains WHY (non-obvious)
// Supabase returns deleted rows with deletedAt set; exclude them client-side
// because soft-delete filter isn't applied at DB query level yet
const activeItems = items.filter(i => !i.deletedAt)
```

- JSDoc on ALL exported functions and types
- Inline comments only for non-obvious logic — explain why, not what
- No commented-out dead code — use git history instead
- No `TODO` comments unless paired with a ticket/issue reference: `// TODO(#42): ...`

---

## 10. FORMATTING (non-negotiable)

- 2-space indentation (enforced by Prettier)
- Single quotes for strings
- Trailing commas in multiline objects/arrays
- Semicolons: YES
- Max line length: 100 characters
- Arrow functions for callbacks, named functions for exported functions

Configure `.prettierrc`:
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

---

## BEFORE SUBMITTING ANY CODE — MENTAL CHECKLIST

- [ ] No `any` types
- [ ] No magic numbers/strings (all in `constants/`)
- [ ] All exported functions have JSDoc
- [ ] Named exports only for components
- [ ] Event handlers prefixed `handle*`
- [ ] Keys in lists are stable IDs, not indexes
- [ ] Errors are thrown from services, caught in components
- [ ] No logic inside JSX — extract to variables/callbacks
- [ ] Import order follows the 8-category order above
- [ ] `import type` used for type-only imports
