# Coding Conventions

**Analysis Date:** 2026-05-07

---

## 1. File and Folder Naming

| Artifact | Convention | Example |
|---|---|---|
| React components | PascalCase `.tsx` | `DoorScheduleManager.tsx` |
| Hooks | camelCase, `use` prefix, `.ts` | `useKeyboardShortcuts.ts` |
| Services | camelCase, `Service` suffix, `.ts` | `pricingService.ts` |
| Utilities | camelCase, `.ts` | `doorValidation.ts` |
| Types | camelCase, `.ts` | `auth.ts`, `team.ts` |
| Constants | camelCase, `.ts` | `auth.ts`, `roles.ts` |
| API routes | `route.ts` inside folder | `app/api/projects/[id]/route.ts` |
| Folders | camelCase or kebab-case | `lib/auth/`, `components/ui/` |

**Rule:** `index.ts` is for barrel exports only. Never name a component file `index.tsx`.

**Observed deviations:** Older components in `components/` (pre-migration) use `export default` and 4-space indentation. New code under `lib/`, `app/api/`, and `contexts/` follows the canonical style.

---

## 2. TypeScript Usage

### Strictness

`tsconfig.json` has `"strict": false` currently — disabled during a Next.js migration. The code-standards skill mandates `strict: true` as the target state. `next.config.ts` also sets `ignoreBuildErrors: true` as a temporary measure.

```jsonc
// tsconfig.json — current state (migration in progress)
// "strict": true — re-enable in code-quality phase
"strict": false
```

### Type Import Keyword

Use `import type` for type-only imports — prevents runtime bundling of types:

```typescript
// Correct
import type { Project, HardwareItem } from '@/types';
import type { AuthUser, RoleName } from '@/types/auth';
import { createProject } from '@/lib/db/projects';

// Wrong
import { Project } from '@/types'; // bundles type at runtime
```

### Named Types Over Inline

```typescript
// Wrong — inline type clutter
const process = (proj: { id: string; name: string }) => { ... }

// Correct — named types from types/ or types.ts
import type { Project } from '@/types';
const process = (project: Project): ProcessedProject => { ... }
```

### Enums

The codebase uses TypeScript `enum` in `types.ts` (legacy). Preferred going forward is `as const` objects for tree-shaking:

```typescript
// Legacy (types.ts)
export enum Role { Administrator = 'Administrator', ... }

// Preferred (new code)
export const ROLE = { ADMINISTRATOR: 'Administrator' } as const;
export type Role = typeof ROLE[keyof typeof ROLE];
```

### `any` Usage

`any` is used in some DB transformer functions with `// eslint-disable-next-line @typescript-eslint/no-explicit-any` suppression comments (e.g., `lib/db/hardware.ts`, `lib/db/masterHardware.ts`). New code must use `unknown` with explicit type narrowing.

### Return Types

DB functions use a consistent `DbResult<T>` pattern:

```typescript
type DbResult<T> = { data: T | null; error: { message: string } | null };

export async function getAllProjects(): Promise<DbResult<Project[]>> { ... }
```

---

## 3. React Component Structure

Components must follow this ordering (enforced by code-standards skill):

```typescript
'use client' // 1. Directive (if needed)

// 2. React imports
import { useState, useEffect, useCallback, useMemo } from 'react'

// 3. Next.js imports
import Link from 'next/link'

// 4. Third-party packages (alphabetical)
import { format } from 'date-fns'

// 5. Internal — types (import type)
import type { Project } from '@/types'

// 6. Internal — constants, services, utils, hooks
import { AUTH_CONFIG } from '@/constants/auth'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

// 7. Internal — components
import { Button } from '@/components/ui/button'

// 8. Local interfaces
interface Props { ... }

// 9. Component body (named export)
export function ComponentName({ prop }: Props) {
  // 9a. Hooks first
  // 9b. Derived/memoized state
  // 9c. Callbacks
  // 9d. Effects
  // 9e. Early returns (loading/error)
  // 9f. Render
}
```

### Naming Rules

- Components: named exports preferred (`export function DashboardSkeleton`). Older components in `components/` use `export default` — this is being migrated away.
- Props interface: `Props` (file-local) or `ComponentNameProps` (if exported, e.g., `ButtonProps`)
- Event handlers: `handle*` prefix — `handleSave`, `handleDelete`, `handleInputChange`
- Boolean props: `is*`, `has*`, `can*` — `isLoading`, `hasError`, `canEdit`

### Forbidden Patterns

```typescript
// FORBIDDEN — default export for new components
export default function MyComponent() { ... }

// FORBIDDEN — index as key
items.map((item, i) => <Item key={i} />)   // use key={item.id}

// FORBIDDEN — logic inside JSX
{items.filter(i => i.active).map(i => (...))}  // extract to useMemo

// FORBIDDEN — inline object/function creation in JSX
<Comp style={{ margin: 10 }} onClick={() => fn()} />
```

---

## 4. Import Organization

All imports in this mandatory order, separated by blank lines:

```typescript
// 1. React
import { useState, useEffect } from 'react'

// 2. Next.js
import { useRouter } from 'next/navigation'

// 3. Third-party packages (alphabetical by package name)
import { cva } from 'class-variance-authority'
import { twMerge } from 'tailwind-merge'

// 4. Internal — types (import type)
import type { Project, HardwareItem } from '@/types'
import type { AuthUser } from '@/types/auth'

// 5. Internal — constants
import { AUTH_CONFIG } from '@/constants/auth'

// 6. Internal — lib / services / utils
import { cn } from '@/lib/utils'
import { withAuth } from '@/lib/auth/api-helpers'

// 7. Internal — hooks
import { useAuth } from '@/contexts/AuthContext'

// 8. Internal — components
import { Button } from '@/components/ui/button'
```

**Path Aliases:** `@/` maps to project root (configured in `tsconfig.json`). All internal imports use `@/` — no relative paths except for same-directory imports in some older files.

---

## 5. Error Handling

### In DB Layer (`lib/db/`)

Functions return `DbResult<T>` — never throw:

```typescript
type DbResult<T> = { data: T | null; error: { message: string } | null };

export async function getAllProjects(): Promise<DbResult<Project[]>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db.from('projects').select(...);
    if (error) return { data: null, error: { message: error.message } };
    return { data: data.map(toProject), error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}
```

### In API Routes (`app/api/`)

Routes call DB functions, check the `error` field, and return `NextResponse.json`:

```typescript
export const GET = withAuth(async (_req, { user }) => {
  const { data, error } = await getAllProjects();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
});
```

### In Context / Client Code

Errors from `fetch` calls are caught, then user-visible toasts are shown. Empty `catch` blocks appear in places where failure is intentional and non-critical (e.g., logout best-effort):

```typescript
try {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
} catch {
  // Best-effort — no action needed
}
```

Error state is surfaced via the `useToast` / `ToastContext` pattern, not inline UI.

---

## 6. Logging

No structured logger — `console.log/error/warn` is used directly.

**Pattern in DB functions:** Prefixed with `[module:action]` for traceability:

```typescript
console.log(`[master-hw:queue] Called — candidates=${items.length}`);
console.error('[master-hw:queue] INSERT ERROR:', error.message);
```

**Client-side:** `console.error` used in context hydration failures:

```typescript
console.error('Failed to fetch projects:', err);
```

**Rule (from code-standards skill):** Never `console.error` without also taking visible action (toast or rethrow). No logging of raw stack traces to users.

---

## 7. Constants

All magic numbers/strings must live in `constants/`. Pattern:

```typescript
// constants/auth.ts
export const AUTH_CONFIG = {
  SESSION_DURATION_DAYS: 7,
  SESSION_COOKIE_NAME: 'auth_session',
} as const;
```

- All constant objects marked `as const` for literal type inference
- Grouped by domain — one file per domain (`auth.ts`, `roles.ts`, `inventory.ts`)
- JSDoc comments explain units or business context

---

## 8. Comments and Documentation

**JSDoc:** Required on all exported functions. Format:

```typescript
/**
 * Wraps a handler requiring any authenticated user.
 */
export function withAuth(handler: AuthenticatedHandler) { ... }

/**
 * Reads the current app settings from localStorage.
 * Used to determine the preferred AI provider and model.
 */
export const getAppSettings = (...) => { ... }
```

**Inline comments:** Explain WHY, not WHAT. Used for non-obvious decisions:

```typescript
// Supabase returns deleted rows with deleted_at set; filter client-side
// because soft-delete filter is applied at DB query level
```

**Section dividers:** Horizontal rule comments (`// ---`) group related code in longer files:

```typescript
// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------
```

**No TODO comments** unless paired with a ticket reference: `// TODO(#42): fix this`.

---

## 9. CSS and Styling

- **Tailwind CSS** is the primary styling system
- **CSS custom properties** (CSS variables) for theme tokens: `var(--bg)`, `var(--text)`, `var(--border)`, `var(--primary-action)`
- **`cn()` utility** from `lib/utils.ts` merges Tailwind classes: `cn(buttonVariants({ variant }), className)`
- **CVA (class-variance-authority)** for component variants (see `components/ui/button.tsx`)
- **Dark mode** via `darkMode: 'class'` — ThemeProvider from `next-themes` toggles `dark` class
- Custom color tokens defined in `tailwind.config.ts`: `surface.*`, `border.*`, `content.*`, `primary.*`

```typescript
// lib/utils.ts
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## 10. Formatting (Target Standard)

Defined in `.claude/skills/code-standards/SKILL.md`. No `.prettierrc` file exists yet — these are the intended settings:

- **Indentation:** 2 spaces
- **Quotes:** Single quotes for strings
- **Semicolons:** Yes
- **Trailing commas:** Yes (multiline objects/arrays)
- **Max line length:** 100 characters
- **Arrow functions** for callbacks; named functions for exports

**Observed variance:** Older component files (e.g., `components/DoorScheduleManager.tsx`, `views/Dashboard.tsx`) use 4-space indentation. New files under `lib/`, `app/api/`, `contexts/`, and `components/ui/` use 2-space indentation consistently.

---

## 11. Higher-Order Function Patterns

Route handlers are wrapped with auth HOFs from `lib/auth/api-helpers.ts`:

```typescript
// Any authenticated user
export const GET = withAuth(async (req, { user }) => { ... });

// Specific roles only
export const POST = withRoleAuth(['Administrator', 'Team Lead'], async (req, { user }) => { ... });
```

Context providers follow the `createContext / Provider / useHook` triplet pattern consistently across all `contexts/` files:

```typescript
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export function AuthProvider({ children }: { children: ReactNode }) { ... }
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
```

---

## 12. DB Row Transformer Pattern

Each DB module defines a private raw row interface and a `toModel` transformer:

```typescript
// Private — never exported
interface ProjectRow { id: string; project_number: string | null; ... }

// Maps snake_case DB columns to camelCase domain types
function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    projectNumber: row.project_number ?? '',
    ...
  };
}
```

Column names in DB are `snake_case`; domain types use `camelCase`. The transformer is the single point of conversion.

---

*Convention analysis: 2026-05-07*
