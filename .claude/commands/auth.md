# /auth — Supabase Authentication Implementation

You are executing the `/auth` command. This is the focused context for Phase 1.1 — replacing the mock auth system with real Supabase authentication.

---

## Current State (What's Broken)

**File:** `contexts/AuthContext.tsx`

Critical bugs:
```typescript
// BUG 1 — logout sets isAuthenticated = TRUE (opposite of intended)
logout: () => {
  setIsAuthenticated(true) // ← THIS IS WRONG
}

// BUG 2 — login always succeeds regardless of credentials
login: async (email, password) => {
  setIsAuthenticated(true) // ← No validation at all
  return { success: true }
}
```

There is no real authentication anywhere in the codebase. Everything behind the auth gate is accessible by anyone who manually sets `isAuthenticated` in localStorage.

---

## Target Authentication Architecture

```
User submits login form
    │
    ▼
Supabase Auth (email + password)
    │  supabase.auth.signInWithPassword({ email, password })
    ▼
JWT stored in httpOnly cookie (via @supabase/ssr)
    │
    ▼
Next.js middleware.ts validates JWT on every request
    │
    ▼
Server Components read user from cookie (no client-side auth check needed)
    │
    ▼
Supabase RLS enforces data access at DB level (never trust client role claims)
```

---

## Implementation Steps (In Order)

### Step 1: Install Dependencies

```bash
npm install @supabase/ssr @supabase/supabase-js
```

### Step 2: Create Supabase Clients

**Browser client** (`lib/supabase/client.ts`):
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

**Server client** (`lib/supabase/server.ts`):
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

### Step 3: Auth Actions (Server Actions)

```typescript
// app/(auth)/login/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signIn(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) redirect('/login?error=' + encodeURIComponent(error.message))
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

### Step 4: Middleware (Route Protection)

```typescript
// middleware.ts (project root)
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login')

  if (!user && !isAuthRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
```

### Step 5: Login Page

```typescript
// app/(auth)/login/page.tsx
import { signIn } from './actions'

export default function LoginPage({ searchParams }: {
  searchParams: { error?: string }
}) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <form action={signIn} className="flex flex-col gap-4 w-80">
        <h1 className="text-2xl font-bold">Sign In</h1>
        {searchParams.error && (
          <p className="text-red-600 text-sm">{searchParams.error}</p>
        )}
        <input name="email" type="email" placeholder="Email" required />
        <input name="password" type="password" placeholder="Password" required />
        <button type="submit">Sign In</button>
      </form>
    </div>
  )
}
```

### Step 6: Update Auth Context (Transitional)

Until full migration, update `AuthContext.tsx` to use Supabase:

```typescript
// contexts/AuthContext.tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

const AuthContext = createContext<{ user: User | null; isLoading: boolean } | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={{ user, isLoading }}>{children}</AuthContext.Provider>
}
```

---

## What to Check When Done

- [ ] `logout()` actually signs out (test: after logout, going to `/` redirects to `/login`)
- [ ] `login()` fails with wrong password (test: `wrongpassword@test.com`)
- [ ] Session persists after page refresh (JWT in cookie, not localStorage)
- [ ] Middleware redirects unauthenticated users from all protected routes
- [ ] Authenticated users are redirected away from `/login`
- [ ] `signUp` sends confirmation email (check Supabase dashboard email logs)

---

## Supabase Dashboard Setup Required

1. Go to Authentication → Settings
2. Enable "Email confirmations" if needed for production
3. Set `Site URL` to `http://localhost:3000` for development
4. Set redirect URL to `http://localhost:3000/auth/callback`
5. Create the `profiles` table linked to `auth.users` for role storage

---

## Role Storage Schema

```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Estimator' CHECK (role IN ('Administrator', 'SeniorEstimator', 'Estimator', 'Viewer')),
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on user sign up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email) VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```
