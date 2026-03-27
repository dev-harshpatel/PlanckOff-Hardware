# /feature — New Feature Scaffold

You are executing the `/feature` command for: **$ARGUMENTS**

Your job is to scaffold and implement a new feature end-to-end, following the project's architecture strictly.

---

## Step 1: Understand the Feature

Before writing a single line, answer these questions out loud:

1. **What domain does this belong to?** (doors / hardware / pricing / exports / auth / projects / uploads)
2. **What data does it need?** (new table? existing table? no DB?)
3. **Does it need an AI call?** (if yes → API route required)
4. **Does it need file I/O?** (if yes → Web Worker for heavy processing)
5. **Who can use it?** (which roles: Administrator / SeniorEstimator / Estimator / Viewer)
6. **What's the user-facing flow?** (describe the happy path in plain English)

Do not proceed until you've answered all 6.

---

## Step 2: Define Types First

All types go in `types/domain.ts` (or `types/api.ts` for request/response shapes).

```typescript
// types/domain.ts — add to existing types

export interface NewFeatureData {
  id: string
  projectId: string
  // ... fields
  createdAt: string
}

// types/api.ts — if feature has API endpoints
export interface NewFeatureRequest {
  projectId: string
  // ... required fields
}

export interface NewFeatureResponse {
  data: NewFeatureData
}
```

Rules:
- Use `string` for IDs (UUIDs), not `number`
- Use `string` for dates (ISO format)
- Use `| null` for optional fields, not `?` (be explicit)
- Export every type — no inline type definitions in components

---

## Step 3: Define Constants

If the feature has any fixed values (status values, categories, limits):

```typescript
// constants/featureName.ts
export const FEATURE_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETE: 'complete',
} as const
export type FeatureStatus = typeof FEATURE_STATUS[keyof typeof FEATURE_STATUS]
```

---

## Step 4: Database Schema (if needed)

Write the SQL migration:

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_feature_name.sql

CREATE TABLE feature_table (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- ... columns
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feature_project ON feature_table(project_id);

ALTER TABLE feature_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_feature_select" ON feature_table
  FOR SELECT USING (
    project_id IN (SELECT id FROM projects WHERE organization_id = get_user_organization_id())
  );
```

---

## Step 5: API Route (if AI call or server-side operation needed)

```typescript
// app/api/[feature]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const RequestSchema = z.object({
  projectId: z.string().uuid(),
  // ... other fields
})

export async function POST(request: NextRequest) {
  // 1. Auth check — always first
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Input validation
  const body = await request.json()
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  // 3. Business logic
  // ...

  // 4. Return typed response
  return NextResponse.json({ data: result }, { status: 200 })
}
```

---

## Step 6: Service Function

```typescript
// services/[domain]/[feature]Service.ts
import type { NewFeatureData } from '@/types'

/**
 * [JSDoc describing what this service does]
 */
export async function createFeatureItem(
  input: CreateFeatureInput,
): Promise<NewFeatureData> {
  // Pure business logic — no React, no Next.js imports
  // Calls fetch('/api/[feature]') or Supabase client
}
```

Rules:
- No React imports in service files
- Return typed Promises — never `Promise<any>`
- Throw meaningful errors — never return `null` to signal failure
- One exported function per clear responsibility

---

## Step 7: Custom Hook

```typescript
// features/[domain]/hooks/useFeatureName.ts
'use client'

import { useState, useCallback } from 'react'
import type { NewFeatureData } from '@/types'
import { createFeatureItem } from '@/services/[domain]/[feature]Service'
import { useToast } from '@/hooks/useToast'

interface UseFeatureNameReturn {
  items: NewFeatureData[]
  isLoading: boolean
  error: string | null
  create: (input: CreateInput) => Promise<void>
  refresh: () => Promise<void>
}

export function useFeatureName(projectId: string): UseFeatureNameReturn {
  const [items, setItems] = useState<NewFeatureData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()

  const create = useCallback(async (input: CreateInput) => {
    setIsLoading(true)
    try {
      const item = await createFeatureItem(input)
      setItems(prev => [...prev, item])
      showToast({ type: 'success', message: 'Created successfully' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create'
      setError(message)
      showToast({ type: 'error', message })
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  return { items, isLoading, error, create, refresh: load }
}
```

---

## Step 8: Component

```typescript
// features/[domain]/components/FeatureComponent.tsx
'use client'

import { useCallback } from 'react'
import type { NewFeatureData } from '@/types'
import { useFeatureName } from '../hooks/useFeatureName'
import { Button } from '@/components/ui'

interface Props {
  projectId: string
}

export function FeatureComponent({ projectId }: Props) {
  const { items, isLoading, create } = useFeatureName(projectId)

  const handleCreate = useCallback(() => {
    create({ projectId, /* ... */ })
  }, [projectId, create])

  if (isLoading) return <SkeletonLoader />

  return (
    <div>
      {items.map(item => (
        <div key={item.id}>{/* render */}</div>
      ))}
      <Button onClick={handleCreate}>Create New</Button>
    </div>
  )
}
```

---

## Step 9: Barrel Exports

```typescript
// features/[domain]/index.ts
export { FeatureComponent } from './components/FeatureComponent'
export type { NewFeatureData } from '@/types'
```

---

## Step 10: Verification Checklist

Before declaring the feature complete:

- [ ] Types defined in `types/` — no inline types
- [ ] Constants in `constants/` — no magic strings in components
- [ ] API route validates auth before any logic
- [ ] API route validates input with Zod
- [ ] Service function is pure TypeScript — no React/Next.js imports
- [ ] Hook manages loading/error/data state explicitly
- [ ] Component under 300 lines — split if needed
- [ ] Component uses named export (no `export default`)
- [ ] Event handlers prefixed `handle*`
- [ ] Keys in lists use `item.id` — not array index
- [ ] Errors thrown in service, caught and shown in component via toast
- [ ] RLS policies written for any new DB tables
- [ ] Barrel export updated in `features/[domain]/index.ts`
