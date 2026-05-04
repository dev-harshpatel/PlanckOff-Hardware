# Roles & Permissions Audit — PlanckOff

**Date:** 2026-05-04  
**Verdict: Rework Required — partial enforcement, 5 critical gaps**

---

## Roles Defined

| Role | Level | Description |
|---|---|---|
| Administrator | 1 (highest) | Full system access and team management |
| Team Lead | 2 | Manage estimators and oversee projects |
| Estimator | 3 (lowest) | Create and manage estimates |

Defined in `types/auth.ts`, `constants/roles.ts`, and DB migration `001_auth_tables.sql`.

---

## What Each Role Can Do (Current State)

### Administrator
Everything — no restrictions.

### Team Lead

| Action | Enforced? | Where |
|---|---|---|
| Create / update / delete projects | ✅ Yes | API: `withRoleAuth(['Administrator', 'Team Lead'])` |
| Invite Estimators (only) | ✅ Yes | API + `canInviteRole()` check in `constants/roles.ts` |
| Access `/team` page | ✅ Yes | Middleware blocks Estimators |
| Manage team members (PUT/DELETE) | ✅ Yes | API: `withRoleAuth` |
| Read/write **any** project's data (doors, hardware, pricing, notes) | ⚠️ No ownership check | All project data APIs use `withAuth` only |
| Approve/reject hardware items | ⚠️ Not restricted | API uses `withAuth` — should be Admin/TL only |
| Modify company settings | ⚠️ Not restricted | API uses `withAuth` — no role check |

**Conflict:** DB seed says Team Lead `canDeleteProjects: false`, but the DELETE `/api/projects/[id]` route allows it. Code wins over DB seed — Team Lead **can** delete projects right now.

### Estimator

| Action | Enforced? | Where |
|---|---|---|
| Create projects | ✅ Blocked | API: `withRoleAuth(['Administrator', 'Team Lead'])` |
| Invite users | ✅ Blocked | API: `withRoleAuth` |
| Access `/team` page | ✅ Blocked | Middleware redirects to `/` |
| Read/write **any** project's data (doors, hardware, pricing, notes) | ⚠️ No ownership check | All project data APIs use `withAuth` only |
| Approve/reject hardware items | ❌ **Not blocked** | API uses `withAuth` — **security issue** |
| Modify company settings | ❌ **Not blocked** | API uses `withAuth` — **security issue** |

---

## The 5 Critical Gaps

### Gap 1 — No Project Ownership Check (HIGH)
Every `/api/projects/[id]/*` route (15+ endpoints) uses `withAuth`. Any authenticated user — including an Estimator from a different team — can read and write **any** project's doors, hardware sets, pricing, proposals, and notes by guessing or knowing a project UUID.

**Affected routes:**
- `/api/projects/[id]/door-schedule`
- `/api/projects/[id]/hardware-pdf`
- `/api/projects/[id]/hardware-merge`
- `/api/projects/[id]/hardware-set-prep`
- `/api/projects/[id]/notes`
- `/api/projects/[id]/pricing`
- `/api/projects/[id]/pricing-proposal`
- `/api/projects/[id]/pricing-variants`
- `/api/projects/[id]/proposal-expenses`
- `/api/projects/[id]/proposal-tax-rows`
- `/api/projects/[id]/process`
- `/api/projects/[id]/hardware-final`
- `/api/projects/[id]/door-elevation-types`

**Fix needed:** Add a project membership/ownership check inside each route, or centralize it in a `withProjectAccess` middleware wrapper.

---

### Gap 2 — Hardware Approval is Open to Everyone (HIGH)
`POST /api/master-hardware/pending/review` uses `withAuth`. Any Estimator can approve or reject pending hardware items — an action that should be restricted to Administrator or Team Lead.

**File:** `app/api/master-hardware/pending/review/route.ts`

**Fix needed:**
```typescript
export const POST = withRoleAuth(
  ['Administrator', 'Team Lead'],
  async (req, ctx) => { /* ... */ },
);
```

---

### Gap 3 — Company Settings Unprotected (HIGH)
`GET` and `PUT /api/settings/company` and the logo upload endpoint all use `withAuth`. Any Estimator can read and overwrite company name, logo, tax settings, and billing configuration.

**File:** `app/api/settings/company/route.ts`

**Fix needed:** Change to `withRoleAuth(['Administrator'])` or `withRoleAuth(['Administrator', 'Team Lead'])` depending on intent.

---

### Gap 4 — No Database Row-Level Security (MEDIUM)
All API routes use `createSupabaseAdminClient()` which bypasses Supabase RLS entirely. There are zero RLS policies on the projects, team_members, or roles tables. If the API layer were ever bypassed (leaked service key, future SDK misuse), all data is exposed.

**Fix needed:** Enable RLS on core tables and add policies:
```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_access ON projects
  USING (created_by = auth.uid());
```

---

### Gap 5 — DB Permission JSONB is Dead Code (LOW)
The `roles` table has a `permissions` JSONB column seeded with values like `canDeleteProjects`, `canManageTeam`, etc. This column is **never read** in the application. All permission logic is hardcoded in TypeScript (`constants/roles.ts`, `lib/auth/rbac.ts`). Changing permissions requires a code deployment, not a DB update.

**Fix needed (optional):** Either remove the `permissions` column to avoid confusion, or wire RBAC to read from it so permissions can be updated without deploys.

---

## What Currently Works Correctly

- Role definition, hierarchy, and invite rules (`canInviteRole()`) — ✅
- Project CREATE/UPDATE/DELETE restricted to Admin + Team Lead — ✅
- Team invite restricted to Admin + Team Lead — ✅
- Team management page (`/team`) blocked from Estimators via middleware — ✅
- Frontend UI hides Team nav link from Estimators (`Header.tsx`, `useRBAC.ts`) — ✅
- Session loading correctly pulls role from DB via join — ✅
- Team Lead can only invite Estimators (cannot escalate privileges) — ✅

---

## Rework Priority

| Priority | Gap | Effort |
|---|---|---|
| P0 | Hardware approval open to Estimators (Gap 2) | ~30 min — change 1 line |
| P0 | Company settings open to Estimators (Gap 3) | ~30 min — change 1–2 lines |
| P1 | Project ownership check missing (Gap 1) | 2–4 hrs — 15+ routes |
| P2 | No database RLS (Gap 4) | 2–3 hrs — new migration |
| P3 | Dead DB permission JSONB (Gap 5) | 1 hr — either remove or wire up |

---

## Files to Change for Rework

| File | Change Needed |
|---|---|
| `app/api/master-hardware/pending/review/route.ts` | `withAuth` → `withRoleAuth(['Administrator', 'Team Lead'])` |
| `app/api/settings/company/route.ts` | `withAuth` → `withRoleAuth(['Administrator'])` or `['Administrator', 'Team Lead']` |
| `app/api/settings/company/logo/route.ts` | Same as above |
| All `app/api/projects/[id]/*/route.ts` (15+ files) | Add project ownership check after auth |
| `lib/auth/api-helpers.ts` | Create `withProjectAccess` helper to centralize ownership check |
| `supabase/migrations/013_enable_rls.sql` | New migration: enable RLS + add policies |
| `supabase/migrations/001_auth_tables.sql` | Decide: wire or remove `permissions` JSONB |
| `constants/roles.ts` or `app/api/projects/[id]/route.ts` | Clarify Team Lead delete permission (DB seed vs. code conflict) |
