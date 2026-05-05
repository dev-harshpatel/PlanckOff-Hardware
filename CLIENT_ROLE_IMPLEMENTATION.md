# Client Role — Implementation Plan & Effort Estimation

**Prepared:** 2026-05-05  
**Scope:** Add a new `Client` role with invite-based onboarding, scoped project access, and limited navigation.

---

## What the Client Role Does

| Capability | Client | Estimator | Team Lead | Administrator |
|---|---|---|---|---|
| Create projects | Yes (own only) | No | Yes | Yes |
| View projects | Yes (own only) | Yes (all) | Yes (all) | Yes (all) |
| Edit projects | Yes (own only) | Yes | Yes | Yes |
| Delete projects | Yes (own only) | No | No | Yes |
| View hardware database | No | Yes | Yes | Yes |
| Access team management | No | No | Yes | Yes |
| Invite other users | No | No | Estimators only | All roles |
| View reports (own projects) | Yes | Yes | Yes | Yes |

**Key rule:** A Client sees and touches ONLY the projects they created (or are explicitly assigned to). Everything else is invisible AND blocked at the API level.

---

## Where We Stand Today (Current Gaps)

| Area | Status | Gap |
|---|---|---|
| Roles defined in `types/auth.ts` | Defined | `Client` not in `RoleName` union type |
| Role levels in `constants/roles.ts` | Defined | No level assigned for Client |
| Invite flow (`/api/team/invite`) | Fully built | Client not in the invitable roles list |
| Project API (`/api/projects`) | Partial | Returns ALL projects — no client-scoped filtering |
| Project scoping at DB level | Missing | `assigned_to` field exists but is never enforced in any query |
| RBAC route permissions (`lib/auth/rbac.ts`) | Partial | No Client-specific rules; Client would fall through to default |
| Navigation hiding (`Header.tsx`) | Partial | Only hides Team nav; no Client-aware logic |
| `canCreateProject` check in API | Missing | Only Admin/Team Lead can create projects — Client is currently blocked |
| Client-specific invite email | Missing | Only one template exists, framed as a team member invite |

---

## Changes Required — Grouped by Area

---

### 1. Type & Constants Layer
**Effort: 1–2 hours | Risk: Low**

**Files:**
- `types/auth.ts`
- `constants/roles.ts`

**Changes:**
- Add `'Client'` to the `RoleName` union type
- Add `Client: 4` to `ROLE_LEVELS` (lowest privilege, below Estimator)
- Update `canInviteRole()` — Administrator and Team Lead can invite Client
- Update `getInvitableRoles()` to return `['Client']` as an option for Team Lead, and include Client in Administrator's list

```typescript
// types/auth.ts
export type RoleName = 'Administrator' | 'Team Lead' | 'Estimator' | 'Client';

// constants/roles.ts
export const ROLE_LEVELS: Record<RoleName, number> = {
  Administrator: 1,
  'Team Lead': 2,
  Estimator: 3,
  Client: 4,
};
```

---

### 2. Database Migration
**Effort: 2–3 hours | Risk: Medium**

**New file:** `supabase/migrations/018_add_client_role.sql`

**a) Seed the Client role in the `roles` table:**
```sql
INSERT INTO roles (id, name, permissions, level, description)
VALUES (
  gen_random_uuid(),
  'Client',
  '{
    "canManageTeam": false,
    "canInviteUsers": false,
    "canDeleteProjects": false,
    "canViewAllProjects": false,
    "canCreateProjects": true,
    "isClient": true
  }',
  4,
  'External client with access limited to their own projects'
);
```

**b) Add `client_owner_id` to the `projects` table:**
```sql
-- NULL for internally-created projects.
-- Set automatically when a Client creates a project.
ALTER TABLE projects
  ADD COLUMN client_owner_id uuid REFERENCES team_members(id);

CREATE INDEX idx_projects_client_owner ON projects(client_owner_id);
```

Why a new column and not reusing `assigned_to`? The `assigned_to` field is an audit/assignment field and is never enforced in any query. `client_owner_id` is explicit, nullable for internal projects, and is the single source of truth for client-scoped access.

**c) Optional (v2): `project_client_access` junction table:**
```sql
-- Allows explicitly sharing an internal project with a specific Client.
-- Not required for v1 but enables "share this project with client X" later.
CREATE TABLE project_client_access (
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  client_id  uuid REFERENCES team_members(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES team_members(id),
  granted_at timestamptz DEFAULT now(),
  PRIMARY KEY (project_id, client_id)
);
```

---

### 3. Project API — Scoped Filtering (Security-Critical)
**Effort: 3–4 hours | Risk: Medium-High**

This is the most important change. Every project-related API route must enforce client scoping at the database level — UI hiding alone is not a security control.

**Files:**
- `lib/db/projects.ts`
- `app/api/projects/route.ts`
- `app/api/projects/[id]/route.ts`

**a) New scoped fetch function in `lib/db/projects.ts`:**
```typescript
export async function getProjectsByClient(clientId: string) {
  return supabaseAdmin
    .from('projects')
    .select('*')
    .eq('client_owner_id', clientId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
}
```

**b) `GET /api/projects` — branch on role:**
```typescript
export const GET = withAuth(async (_req, { user }) => {
  if (user.role === 'Client') {
    const { data, error } = await getProjectsByClient(user.id);
    // return scoped list
  } else {
    const { data, error } = await getAllProjects();
    // return full list
  }
});
```

**c) `POST /api/projects` — allow Client to create, auto-set `client_owner_id`:**
```typescript
// Change from: withRoleAuth(['Administrator', 'Team Lead'])
// Change to:   withAuth(), then inject client_owner_id when role is Client

if (user.role === 'Client') {
  projectData.client_owner_id = user.id;
}
```

**d) `GET/PUT/DELETE /api/projects/[id]` — ownership check for Client:**
```typescript
async function assertClientProjectAccess(projectId: string, user: AuthUser) {
  if (user.role !== 'Client') return; // internal users pass through
  const project = await getProjectById(projectId);
  if (project.client_owner_id !== user.id) {
    throw new ForbiddenError('Access denied');
  }
}
```

This function must be called at the top of every single-project route handler.

---

### 4. RBAC Route Permissions
**Effort: 1 hour | Risk: Low**

**File:** `lib/auth/rbac.ts`

```typescript
export const ROUTE_PERMISSIONS: RoutePermission[] = [
  { path: '/login',            public: true },
  { path: '/set-password',     public: true },
  { path: '/',                 minRole: 'Client' },     // Client can see dashboard
  { path: '/project',          minRole: 'Client' },     // Client can open own projects
  { path: '/database',         minRole: 'Estimator' },  // Client CANNOT access
  { path: '/team',             allowedRoles: ['Administrator', 'Team Lead'] },
  { path: '/settings',         minRole: 'Client' },     // Client can manage own profile
  // API routes
  { path: '/api/team/members', allowedRoles: ['Administrator', 'Team Lead'] },
  { path: '/api/team/invite',  allowedRoles: ['Administrator', 'Team Lead'] },
];
```

Since `ROLE_LEVELS` uses numeric levels, `minRole: 'Client'` (level 4) means all roles pass. `minRole: 'Estimator'` (level 3) blocks Client automatically.

---

### 5. Invite Flow — Add Client as Invitable Role
**Effort: 1–2 hours | Risk: Low**

**Files:**
- `components/InviteUserPanel.tsx`
- `app/api/team/invite/route.ts`

The invite flow is already complete for team members. Only two small changes:

1. Update `canInviteRole()` in `constants/roles.ts` — once Client is added, the role dropdown in `InviteUserPanel` will include it automatically (it is already driven by `getInvitableRoles(userRole)`).
2. Optional: Add a UI note in `InviteUserPanel` when "Client" is selected — e.g. "Client accounts can only see projects they create."

No structural changes to the invite API route are needed.

---

### 6. Client-Specific Invite Email
**Effort: 1–2 hours | Risk: Low**

**New file:** `supabase/email-templates/invite-client.html`  
**File to update:** `services/emailService.ts`

Copy `invite-user.html` and adjust the copy:
- Header badge: "Team invitation" → "Client portal invitation"
- Body: "You've been invited to review and manage your projects on PlanckOff."
- Keep the same token-based link format — the accept flow is identical.

In `emailService.ts`, branch on role:
```typescript
const templateFile = role === 'Client' ? 'invite-client.html' : 'invite-user.html';
```

---

### 7. Navigation & UI — Client-Aware Header and Dashboard
**Effort: 1–2 hours | Risk: Low**

**Files:**
- `components/Header.tsx`
- `views/Dashboard.tsx`

**Header changes:**
```typescript
const isClient = user.role === 'Client';
const canManageTeam = ['Administrator', 'Team Lead'].includes(user.role);

// Hide for Client:
{!isClient && <NavLink onClick={() => onNavigate('database')}>Database</NavLink>}
{canManageTeam && <NavLink onClick={() => onNavigate('team')}>Team</NavLink>}
```

**Dashboard changes:**
- Show "My Projects" heading instead of "All Projects" for Client users
- Hide any "assign to team member" controls on project cards (not relevant to a client)
- The "New Project" button remains — clients can create their own projects

---

### 8. Settings Page — Client Access Guard
**Effort: 30 min | Risk: Low**

Clients should be able to update their own profile (name, password). Verify the settings page does not expose company-wide or team settings to a Client. If it does, add a role guard to hide those sections — no new pages needed.

---

## Total Effort Estimate

| # | Area | Effort | Risk |
|---|---|---|---|
| 1 | Types & constants | 1–2 hrs | Low |
| 2 | Database migration | 2–3 hrs | Medium |
| 3 | Project API scoping | 3–4 hrs | Medium-High |
| 4 | RBAC route permissions | 1 hr | Low |
| 5 | Invite flow update | 1–2 hrs | Low |
| 6 | Client invite email | 1–2 hrs | Low |
| 7 | Navigation & UI | 1–2 hrs | Low |
| 8 | Settings page guard | 0.5 hr | Low |
| — | Manual QA + end-to-end testing | 2–3 hrs | — |
| **Total** | | **~13–19 hours** | |

---

## Recommended Implementation Order

```
Phase A — Foundation (backend only, no UI risk)
  Step 1: Types & constants
  Step 2: DB migration
  Step 4: RBAC rules

Phase B — Core Security (must be complete before any UI ships)
  Step 3: Project API scoping
    - GET /api/projects      (filter by client_owner_id)
    - GET /api/projects/[id] (ownership check)
    - POST /api/projects     (allow Client + set client_owner_id)
    - PUT/DELETE             (ownership check)

Phase C — User-Facing
  Step 5: Invite flow (add Client as invitable role)
  Step 6: Client email template
  Step 7: Header & Dashboard UI
  Step 8: Settings guard

Phase D — QA
  - Full invite → set password → login → create project → scope check
  - Verify internal team members cannot see client projects via API
  - Verify Client cannot reach /database or /team routes
  - Verify Client cannot access another client's project by URL/UUID
```

---

## Decisions Needed Before Starting

1. **Can a Client be assigned to an existing internal project?**
   - If yes → implement the `project_client_access` junction table in Step 2
   - If no (v1: clients only see what they personally create) → skip junction table

2. **Can a Client delete their own projects?**
   - Based on "can do everything within their scope" — assumed yes
   - Confirm before coding the DELETE route

3. **Should Clients have read access to the hardware database?**
   - If clients review hardware specs directly → allow read-only `/database` access for Client
   - If not → keep the `minRole: 'Estimator'` block on that route

4. **One invite template or two?**
   - A separate client email template gives better messaging
   - Reusing the team invite template is faster but messaging is off ("join the team" framing does not apply to a client)

---

## Risk Notes

- **Project API scoping (Step 3) is the highest-risk item.** If the ownership check is missed on any project endpoint, a Client can access any project by guessing its UUID. This must be enforced at the database query level, not just in the UI.
- **Do not reuse `assigned_to` for client scoping.** That field is never enforced in any query today and carries audit semantics, not ownership semantics. Use the new `client_owner_id` column.
- **Admins and team members live in different tables.** The `admins` table (direct DB users) are not rows in `team_members`. When an admin sends a client invite, the `invited_by` FK on `team_members` must resolve correctly. Verify the invite route handles both cases.
