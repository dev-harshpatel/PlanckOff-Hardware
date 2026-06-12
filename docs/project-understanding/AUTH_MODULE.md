# AUTH Module — Deep Dive Onboarding Guide

> **Target reader:** Developer with ~1.5 years of Next.js + Supabase + TypeScript experience.  
> **Goal:** After reading this, you should be able to trace any auth-related bug, add a new role, modify permissions, or extend the invite flow — without needing to ask anyone.

---

## Table of Contents

1. [Big Picture — What Is This Auth System?](#1-big-picture)
2. [Database Schema — The Foundation](#2-database-schema)
3. [Session System — How Login Actually Works](#3-session-system)
4. [RBAC — Roles, Permissions, Hierarchy](#4-rbac)
5. [Middleware — The First Gatekeeper](#5-middleware)
6. [API Route Protection — The Second Gatekeeper](#6-api-route-protection)
7. [The Full Login Flow (Step by Step)](#7-full-login-flow)
8. [The Full Invite Flow (Step by Step)](#8-full-invite-flow)
9. [Client-Side Auth (React Context)](#9-client-side-auth)
10. [Project-Level Access Control](#10-project-level-access-control)
11. [Rate Limiting](#11-rate-limiting)
12. [File Reference Map](#12-file-reference-map)
13. [Common Gotchas](#13-common-gotchas)

---

## 1. Big Picture

**First thing to know:** This project does NOT use Supabase Auth (the built-in `supabase.auth.signIn()` system). It also does not use NextAuth.js or Clerk.

Instead, it has a **fully custom, session-based authentication system** built on top of plain Supabase PostgreSQL. Think of it as "we use Supabase as a database, not as an auth provider."

### Why custom?

The app has a very specific RBAC model with invite-only onboarding (no public sign-up). The team likely found Supabase Auth too opinionated for that workflow. So everything — sessions, password hashing, invite tokens — is implemented manually.

### The big moving parts at a glance:

```
Browser
  │
  ├── auth_session cookie (HTTP-only, UUID token)
  │
  ▼
middleware.ts  ──── validates token ──── blocks/allows request
  │
  ▼
API Route Handler
  ├── withAuth()           → just checks "is user logged in?"
  ├── withRoleAuth([...])  → checks "is user's role in allowed list?"
  └── withProjectAuth()    → checks "is user allowed on this project?"
  │
  ▼
lib/auth/sessionResolver.ts  ──── token → full user+role object
  │
  ▼
Supabase (admin client, bypasses RLS)
  └── auth_sessions table ──── join ──── admins/team_members/roles tables
```

### The two user tables

This is the most important design quirk to understand up front:

| Table | Who | Notes |
|-------|-----|-------|
| `admins` | The original superusers (legacy) | Always Administrator role |
| `team_members` | Everyone else invited via the app | Can be any role |

Both can log in the same way. The session record stores either `admin_id` OR `team_member_id` (never both — there's a DB constraint). The app resolves them into a single `AuthUser` shape so the rest of the code doesn't care which table a user came from.

---

## 2. Database Schema

**Migration files location:** `supabase/migrations/`

### `roles` table

```sql
-- 001_auth_tables.sql
CREATE TABLE roles (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text    UNIQUE NOT NULL,  -- 'Administrator' | 'Team Lead' | 'Estimator' | 'Client'
  permissions jsonb,                    -- flexible, but RBAC is enforced in code, not here
  level       integer,                  -- 1=Admin, 2=TL, 3=Estimator, 4=Client
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

The `level` column is critical — **lower number = higher privilege**. The code uses it for hierarchical checks like "does this user have at least Team Lead access?" (`level <= 2`).

### `admins` table

```sql
CREATE TABLE admins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,   -- bcryptjs, 12 rounds
  name          text NOT NULL,
  role          text NOT NULL DEFAULT 'Administrator',
  initials      text,
  updated_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

Legacy table. Admins always have the Administrator role and are seeded directly into the DB (no invite flow for them).

### `team_members` table

```sql
CREATE TABLE team_members (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text UNIQUE NOT NULL,
  password_hash     text,               -- NULL until invite is accepted
  name              text NOT NULL,
  role_id           uuid REFERENCES roles(id),
  status            text NOT NULL DEFAULT 'Invited',  -- 'Invited' | 'Active' | 'Inactive'
  initials          text,
  invited_by        uuid REFERENCES team_members(id),
  invite_token      text UNIQUE,        -- UUID, cleared after set-password
  invite_expires_at timestamptz,        -- 7 days from invite
  reports_to        uuid REFERENCES team_members(id),
  updated_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
```

Key lifecycle states:
- **Just created:** `status='Invited'`, `password_hash=NULL`, `invite_token=<UUID>`
- **Activated:** `status='Active'`, `password_hash=<bcrypt>`, `invite_token=NULL`
- **Deactivated:** `status='Inactive'` (cannot log in)

### `auth_sessions` table

```sql
CREATE TABLE auth_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token          text UNIQUE NOT NULL,       -- random UUID, stored in cookie
  admin_id       uuid REFERENCES admins(id) ON DELETE CASCADE,
  team_member_id uuid REFERENCES team_members(id) ON DELETE CASCADE,
  expires_at     timestamptz NOT NULL,
  ip_address     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_owner_check CHECK (
    (admin_id IS NOT NULL AND team_member_id IS NULL) OR
    (admin_id IS NULL AND team_member_id IS NOT NULL)
  )
);
```

This is your session store. The cookie holds the `token` value. On every authenticated request, this table is queried to resolve who the user is.

### `client_project_assignments` table

```sql
-- 021_client_project_assignments.sql
CREATE TABLE client_project_assignments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid        NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  project_id  uuid        NOT NULL REFERENCES projects(id)     ON DELETE CASCADE,
  assigned_by uuid        REFERENCES team_members(id)          ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, project_id)
);
```

This is the authorization table for the Client role. A Client can only see projects that have a row in this table for their `client_id`. More on this in [Section 10](#10-project-level-access-control).

---

## 3. Session System

### How sessions are created (login)

`app/api/auth/login/route.ts`

1. Receive `{ email, password }` in POST body
2. Look up user in `team_members` first, then `admins` as fallback
3. Check `status === 'Active'` (team_members only — `Invited` or `Inactive` = 401/403)
4. Verify password against `password_hash` using `bcrypt.compare()`
5. Generate a random UUID: `crypto.randomUUID()` — this is the session token
6. Insert into `auth_sessions` with `expires_at = now() + 7 days`
7. Set an **HTTP-only cookie** named `auth_session` with that token
8. Return the `AuthUser` object

### How sessions are resolved (every request)

`lib/auth/sessionResolver.ts` — `resolveSessionFromToken(token, options)`

This is the core function that turns a raw token string into a full user object. It:

1. Queries `auth_sessions JOIN admins/team_members JOIN roles` in one go
2. Checks `expires_at > now()` — expired → returns null
3. Checks `team_member.status !== 'Inactive'` — deactivated user → returns null
4. Optionally renews the session: if `expires_at` is within 24 hours, bumps it to `now() + 7 days`
5. Returns an `AuthUser` + raw `teamMember` record

```
resolveSessionFromToken(token, {
  renewIfExpiring: true,   // pass true in API handlers
  cleanupExpired: true,    // deletes expired session rows
})
```

### Session renewal

Sessions auto-renew within the last 24 hours of their 7-day life. This means: a user who logs in and uses the app daily will never be logged out. A user who is inactive for 7+ days gets logged out silently.

The renewal updates `expires_at` in `auth_sessions` and refreshes the cookie's `max-age` in the response.

### Session config

`constants/auth.ts`

```typescript
export const AUTH_CONFIG = {
  SESSION_DURATION_DAYS: 7,
  SESSION_RENEWAL_WINDOW_HOURS: 24,
  SESSION_COOKIE_NAME: 'auth_session',
  BCRYPT_SALT_ROUNDS: 12,
} as const;

export const COOKIE_CONFIG = {
  httpOnly: true,             // JS can't read this cookie
  secure: process.env.NODE_ENV === 'production',  // HTTPS only in prod
  sameSite: 'lax' as const,   // CSRF protection
  path: '/',
};
```

The cookie is **HTTP-only** — the browser's JavaScript cannot read it. This is intentional to prevent XSS from stealing session tokens. The client-side code doesn't directly hold the token; it only calls `/api/auth/me` to get user info.

### Logout

`app/api/auth/logout/route.ts`

1. Read `auth_session` cookie
2. Delete the row from `auth_sessions` table
3. Clear the cookie (set `max-age=0`)

That's it. No JWT invalidation complexity needed — because we store tokens in DB, deletion = immediate invalidation everywhere (even if the cookie somehow persists).

---

## 4. RBAC

### The four roles

`constants/roles.ts` and the `roles` DB table

| Role | Level | Can Invite | Project Visibility | Write Access |
|------|-------|-----------|-------------------|--------------|
| Administrator | 1 | Any role | All projects | Full |
| Team Lead | 2 | Estimator, Client | All projects | Most (no delete) |
| Estimator | 3 | Nobody | Assigned projects only | Own projects |
| Client | 4 | Nobody | Assigned projects only | Read-only |

### Role enforcement — `lib/auth/rbac.ts`

Three key functions you'll use everywhere:

```typescript
// Exact role match — "is user one of these roles?"
hasRoleAccess(userRole: RoleName, allowedRoles: RoleName[]): boolean

// Hierarchical check — "is user at least this powerful?"
meetsMinRoleRequirement(userRole: RoleName, minRole: RoleName): boolean
// Example: meetsMinRoleRequirement('Team Lead', 'Client') → true  (level 2 ≤ level 4)
// Example: meetsMinRoleRequirement('Estimator', 'Team Lead') → false (level 3 > level 2)

// Route-level check used by middleware
canAccessRoute(userRole: RoleName, path: string, isApi: boolean): boolean
```

### Route permission table

`lib/auth/rbac.ts` — `ROUTE_PERMISSIONS` array

Each entry looks like:

```typescript
{
  pattern: '/team',             // string or RegExp
  allowedRoles: ['Administrator', 'Team Lead'],   // exact match
  // OR
  minRole: 'Client',            // hierarchical (everyone above Client included)
  isApi: false,
}
```

Some important rules:
- `/database` (hardware catalog) — Administrator + Team Lead only
- `/team` — Administrator + Team Lead only
- `/` (dashboard) — all authenticated users (minRole: 'Client')
- `/api/projects/trash` — Administrator + Team Lead
- `/api/master-hardware/*` — Administrator + Team Lead
- `/api/auth/*` and `/api/team/invite/*` — **public, no auth required**

If no pattern matches, the default is to allow access (after confirming the user is authenticated).

### Who can invite whom?

`constants/roles.ts` — `canInviteRole(inviterRole, targetRole): boolean`

```
Administrator → can invite: Administrator, Team Lead, Estimator, Client
Team Lead     → can invite: Estimator, Client
Estimator     → cannot invite anyone
Client        → cannot invite anyone
```

This is checked both in the invite API handler and in the `InviteTeamMemberModal` component (to hide roles the current user can't invite).

---

## 5. Middleware

**File: `middleware.ts`**

This is the Next.js middleware — it runs on **every request** before your page or API handler runs. Think of it as a bouncer at the door.

### What it does

```
Incoming Request
    │
    ├── Is this a public path? (login, set-password, /api/auth/*, static)
    │     └── YES → let through immediately
    │
    ├── Read auth_session cookie
    │     └── no cookie? → redirect to /login (page) or 401 (API)
    │
    ├── resolveSessionFromToken(token, { renewIfExpiring: false })
    │     └── invalid/expired? → redirect to /login or 401
    │
    └── canAccessRoute(user.role, request.nextUrl.pathname)
          ├── allowed? → let through (with user data in headers)
          └── denied?
                ├── API route → return 403 JSON
                └── Page route → redirect to / with ?error=forbidden
```

### Performance note

Notice `renewIfExpiring: false` in the middleware. Session renewal is deliberately disabled here. The middleware runs on **every single request** — doing a DB write every request would be slow. Renewal happens only inside API route handlers (which call `validateSession()` with renewal enabled).

### User data forwarding

After validating, the middleware injects the user ID and role into request headers:

```typescript
requestHeaders.set('x-user-id', session.user.id);
requestHeaders.set('x-user-role', session.user.role);
```

This means API handlers can quickly read role from headers without re-querying the DB — though most still call `withAuth()` which does a full resolve for safety.

---

## 6. API Route Protection

**File: `lib/auth/api-helpers.ts`**

Every API route that needs auth is wrapped in one of these three higher-order functions:

### `withAuth(handler)`

Ensures the user is logged in. Passes `{ user, teamMember }` to your handler.

```typescript
// Usage
export const GET = withAuth(async (req, context, { user, teamMember }) => {
  // user.role, user.id, user.email are all available here
  return NextResponse.json({ data: 'hello' });
});
```

### `withRoleAuth(allowedRoles, handler)`

Same as `withAuth` but also checks the user's role against an allowed list.

```typescript
export const POST = withRoleAuth(
  ['Administrator', 'Team Lead'],
  async (req, context, { user }) => {
    // Only Admins and Team Leads reach here
  }
);
```

### `withProjectAuth(handler)`

The most complex wrapper — used for any route that touches a specific project. It handles Client scoping automatically. See [Section 10](#10-project-level-access-control) for details.

### How the validation works inside these wrappers

```
withAuth(handler) called
  │
  ├── Read auth_session cookie from request
  ├── Call validateSession(token)          ← lib/auth/session.ts
  │     └── calls resolveSessionFromToken with renewIfExpiring: true
  │           └── queries auth_sessions + joins admins/team_members/roles
  │
  ├── Session invalid? → return 401
  ├── Role not allowed? → return 403
  │
  └── Call your handler(req, context, { user, teamMember })
```

---

## 7. Full Login Flow

Here is the complete step-by-step of what happens when a user types their email/password and clicks Login.

```
User submits form at /login
    │
    ▼
AuthContext.login(email, password)         ← contexts/AuthContext.tsx
    │  POST /api/auth/login { email, password }
    ▼
app/api/auth/login/route.ts
    ├── Rate limit check (10 req / 10 min per IP)
    ├── Query team_members WHERE email = ?
    │     ├── Found:
    │     │     ├── status = 'Invited'  → 403 "Account not yet activated"
    │     │     ├── status = 'Inactive' → 401 "Account deactivated"
    │     │     ├── password_hash = NULL → 401 "No password set"
    │     │     └── bcrypt.compare(password, hash) fails → 401
    │     └── Not found → fallback to admins table
    │           └── Not found there either → 401 "Invalid credentials"
    │
    ├── crypto.randomUUID() → session token
    ├── INSERT INTO auth_sessions (token, [admin_id | team_member_id], expires_at)
    ├── Set-Cookie: auth_session=<token>; HttpOnly; SameSite=Lax; Path=/
    └── Return AuthUser { id, email, name, role, initials, isAdmin }
    │
    ▼
AuthContext receives user, sets state
    │
    ▼
Browser redirects to original URL (or / if no redirectTo param)
    │
    ▼
Every subsequent request includes auth_session cookie automatically
```

---

## 8. Full Invite Flow

This is how a new team member gets added to the system. Note: **there is no public sign-up**. Everyone must be invited.

```
Admin/Team Lead opens InviteTeamMemberModal
    │  Fills: name, email, role, projects (if Estimator or Client)
    ▼
POST /api/team/invite                       ← app/api/team/invite/route.ts
    │  Protected by withRoleAuth(['Administrator', 'Team Lead'])
    │
    ├── canInviteRole(inviter.role, targetRole)? → 403 if not allowed
    │
    ├── Does email already exist in team_members?
    │     ├── YES (status='Invited') → refresh token + resend email (idempotent)
    │     └── NO  → INSERT INTO team_members (status='Invited', invite_token=UUID)
    │
    ├── If role is Client or Estimator:
    │     └── Assign projects (client_project_assignments or project.assigned_to)
    │
    ├── sendInvitationEmail(email, name, inviteToken)
    │     └── Resend API → HTML email with button linking to:
    │           /set-password?token=<inviteToken>
    │
    └── Return { success: true, inviteLink: '...' }
    │
    ▼
Invited user receives email, clicks link
    │
    ▼
/set-password?token=<inviteToken>           ← app/set-password/page.tsx
    │
    ├── On mount: GET /api/team/invite/<token>
    │     ├── Token not found → 404 → show "Invalid link"
    │     ├── Token expired   → 410 → show "Link expired"
    │     └── Valid           → 200 → show { name, email, role } in UI banner
    │
    ├── User types password + confirm password
    ├── Client-side validation (≥8 chars, uppercase, lowercase, digit)
    │
    ▼
POST /api/team/set-password                 ← app/api/team/set-password/route.ts
    │  (public route, no auth required)
    │
    ├── Rate limit check
    ├── Validate password strength
    ├── Find team_member WHERE invite_token = ? AND invite_expires_at > now()
    ├── bcrypt.hash(password, 12) → password_hash
    ├── UPDATE team_members SET
    │     password_hash = ?,
    │     status = 'Active',
    │     invite_token = NULL,
    │     invite_expires_at = NULL
    └── Return { success: true }
    │
    ▼
Page redirects to /login after 2-second delay
    │
    ▼
User logs in normally (see Section 7)
```

---

## 9. Client-Side Auth

**File: `contexts/AuthContext.tsx`**

This is the React context that makes the current user available everywhere in the UI.

### What it provides

```typescript
interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;                           // true during initial hydration
  login: (email, password) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
}
```

### How to use it in a component

```typescript
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <Spinner />;
  if (!isAuthenticated) return null;  // middleware handles redirect, but just in case

  return <div>Welcome, {user.name} ({user.role})</div>;
}
```

### Initial hydration

When the app first loads, `AuthContext` doesn't know if the user is logged in (because the cookie is HTTP-only — JavaScript can't read it). So it calls `GET /api/auth/me` on mount:

```
App mounts → AuthContext mounts
    │
    ├── isLoading = true
    ├── GET /api/auth/me (cookie sent automatically by browser)
    │     ├── Valid session → returns AuthUser → set user state
    │     └── No/invalid session → returns 401 → user = null
    └── isLoading = false
```

This is why you'll see a loading state briefly on first load.

### Role-based UI rendering

Use `user.role` directly in JSX to conditionally show/hide UI:

```typescript
const { user } = useAuth();

// Show admin-only button
{user?.role === 'Administrator' && <DeleteButton />}

// Show for admin and team lead
{['Administrator', 'Team Lead'].includes(user?.role ?? '') && <InviteButton />}
```

For navigation items, there are also helper constants in `constants/roles.ts`.

### `useCurrentUser()` hook

There's a legacy hook `useCurrentUser()` in `contexts/AuthContext.tsx`. It's a thin shim over `useAuth()`. Prefer `useAuth()` for new code.

---

## 10. Project-Level Access Control

This goes beyond role-based access — it's about which specific projects a user can see.

### The rule

| Role | Which projects can they see? |
|------|------------------------------|
| Administrator | All projects |
| Team Lead | All projects |
| Estimator | Projects where `projects.assigned_to = their ID` |
| Client | Projects in `client_project_assignments` for their `client_id` |

### How it's enforced — `withProjectAuth()`

`lib/auth/api-helpers.ts`

```typescript
export const GET = withProjectAuth(async (req, context, { user, teamMember }) => {
  const projectId = context.params.id;
  // By the time your handler runs, access has already been validated
  // ...
});
```

Inside `withProjectAuth`:

1. Extract `projectId` from route params
2. If user is Administrator or Team Lead → pass through immediately
3. If user is Client:
   - `isClientAssignedToProject(user.id, projectId)` → queries `client_project_assignments`
   - Not assigned → **return 404** (not 403!) — this is intentional to avoid leaking whether the project exists
   - Assigned but trying to write → **return 403**
4. If user is Estimator:
   - Check `projects.assigned_to = user.id`
   - Not assigned → 404

### Why 404 instead of 403 for Clients?

This is a security pattern called "security through obscurity at the authorization layer." If you return 403, you're confirming the project exists but the user can't see it. An attacker could enumerate project IDs. Returning 404 makes it indistinguishable from "project doesn't exist."

---

## 11. Rate Limiting

**File: `lib/rateLimit.ts`**

Applied to: `POST /api/auth/login` and `POST /api/team/set-password`

```
Max 10 requests per 10-minute window, per IP address
```

Implementation details:
- In-memory store (a `Map` in the module scope)
- **This means rate limits reset on server restart** (acceptable trade-off for simplicity)
- IP extracted from `x-forwarded-for` header (set by Vercel/load balancer) or `x-real-ip`
- Returns HTTP `429 Too Many Requests` with `Retry-After` header when exceeded

This prevents brute-force attacks on login and invite token acceptance.

---

## 12. File Reference Map

Use this as a quick navigation guide when you need to find something.

### When you need to...

| Task | File(s) to look at |
|------|-------------------|
| Understand the session token lifecycle | `lib/auth/sessionResolver.ts` |
| Add a new protected API route | `lib/auth/api-helpers.ts` (use `withAuth`, `withRoleAuth`, or `withProjectAuth`) |
| Add a new page and restrict it by role | `lib/auth/rbac.ts` → add to `ROUTE_PERMISSIONS` |
| Change session duration or cookie settings | `constants/auth.ts` |
| Understand the role hierarchy | `constants/roles.ts` |
| Change who can invite whom | `constants/roles.ts` → `canInviteRole()` |
| Trace a login bug | `app/api/auth/login/route.ts` → `lib/auth/sessionResolver.ts` |
| Trace an invite bug | `app/api/team/invite/route.ts` → `app/api/team/set-password/route.ts` |
| Understand middleware auth logic | `middleware.ts` |
| Understand client-side auth state | `contexts/AuthContext.tsx` |
| Look at DB queries for sessions | `lib/db/auth.ts` |
| Look at DB queries for team members | `lib/db/team.ts` |
| Check email sending for invites | `services/emailService.ts` |
| Understand project access for clients | `lib/auth/api-helpers.ts` → `withProjectAuth()` |
| See all type definitions | `types/auth.ts`, `types/team.ts` |
| Look at DB schema | `supabase/migrations/001_auth_tables.sql`, `021_client_project_assignments.sql` |

### Key file descriptions

```
middleware.ts                         → First auth checkpoint on every request
lib/auth/
  sessionResolver.ts                  → Token string → AuthUser object (core function)
  session.ts                          → validateSession() wrapper (calls resolver + renewal)
  rbac.ts                             → Role checks, route permission table
  api-helpers.ts                      → withAuth / withRoleAuth / withProjectAuth HOCs
constants/
  auth.ts                             → Session duration, cookie config, bcrypt rounds
  roles.ts                            → Role hierarchy, canInviteRole, route restrictions
contexts/
  AuthContext.tsx                     → React context, useAuth() hook, login/logout
app/api/auth/
  login/route.ts                      → POST /api/auth/login
  logout/route.ts                     → POST /api/auth/logout
  me/route.ts                         → GET /api/auth/me (hydration endpoint)
app/api/team/
  invite/route.ts                     → POST /api/team/invite (create + email)
  invite/[token]/route.ts             → GET /api/team/invite/:token (validate token)
  set-password/route.ts               → POST /api/team/set-password (activate account)
  members/route.ts                    → GET + POST /api/team/members
app/(auth)/login/page.tsx             → Login page UI
app/set-password/page.tsx             → Accept invite + set password page UI
lib/db/
  auth.ts                             → Raw DB functions for sessions
  team.ts                             → Raw DB functions for team members
lib/supabase/
  server.ts                           → SSR Supabase client (cookie-based)
  admin.ts                            → Service role client (bypasses RLS, server only)
  client.ts                           → Browser Supabase client
services/
  emailService.ts                     → Resend API integration for invite emails
lib/rateLimit.ts                      → In-memory rate limiter
types/
  auth.ts                             → AuthUser, RoleName types
  team.ts                             → TeamMember, TeamMemberWithRole types
supabase/migrations/
  001_auth_tables.sql                 → admins, team_members, auth_sessions, roles tables
  021_client_project_assignments.sql  → client ↔ project junction table
```

---

## 13. Common Gotchas

### "Why is my API route not protecting correctly?"

Check that you're using one of the HOC wrappers (`withAuth`, `withRoleAuth`, `withProjectAuth`) and not just reading from headers. The middleware injects headers, but those headers can be spoofed in local dev if you're not using the wrappers.

### "Why does the Client get a 404 instead of 403?"

Intentional — see [Section 10](#10-project-level-access-control). Don't change this to 403 without understanding the security implication.

### "Why are there two user tables?"

`admins` is legacy. New users (even with Administrator role) should be created as `team_members` when possible. The `isAdmin: boolean` field on `AuthUser` tells you which table the user came from — most code doesn't need to care about this distinction.

### "Rate limits don't reset between test runs in local dev"

Because the rate limiter is in-memory, it persists as long as the Next.js dev server process is running. Restart the dev server to reset rate limits during testing.

### "Invite email failed but the invite was created anyway"

By design. The invite record is created in the DB first, and email sending is best-effort. Check the server logs for the Resend API error. The response from `/api/team/invite` will still include an `inviteLink` field which you can manually share as a fallback.

### "Session renewal not happening in middleware"

Also by design. Middleware only validates, never renews. Renewal happens only in API route handlers that call `validateSession()`. If a user only browses pages without hitting API routes near the end of their 7-day session, they may get logged out unexpectedly. This is an accepted limitation.

### "No RLS policies in Supabase"

The app uses the admin client (service role key) for all DB operations, which bypasses Row Level Security entirely. Authorization is enforced at the application layer by the `withAuth/withRoleAuth/withProjectAuth` wrappers. Don't try to add RLS policies without understanding that the service role key ignores them anyway.

### "Where does Supabase Auth fit in?"

It doesn't — this project doesn't use `supabase.auth.*` at all. Supabase here is purely a hosted PostgreSQL database. Don't look in the Supabase dashboard's Authentication section for user management; look in the `team_members` and `admins` tables directly.

---

*Next module doc: Projects — creation flow, project page, estimator/client assignment.*
