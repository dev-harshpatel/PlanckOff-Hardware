# /supabase — Database Migration (localStorage → Supabase)

You are executing the `/supabase` command. This is the focused context for Phase 1.3 — migrating all application data from browser localStorage to Supabase.

---

## Current State

All data lives in localStorage under these keys:
- `tve_projects` — array of Project objects
- `tve_master_inventory` — master hardware catalog
- `tve_app_settings` — user settings (AI keys, preferences)
- `tve_learned_examples` — ML training examples
- `mock_user` — fake user object

**Data model lives in:** `contexts/ProjectContext.tsx` (1000+ lines, all state + logic mixed)

**Problems:**
- Data is lost if user clears browser storage
- No multi-user collaboration possible
- Max 5MB storage limit
- No backup, no audit trail
- Data is siloed to one browser

---

## Target Database Schema

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations (multi-tenancy root)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  client TEXT,
  project_number TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'complete')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Doors
CREATE TABLE doors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  door_tag TEXT NOT NULL,
  location TEXT,
  interior_exterior TEXT DEFAULT 'N/A',
  quantity INTEGER DEFAULT 1,
  type TEXT DEFAULT 'Single',
  width_inches DECIMAL(6,2) DEFAULT 0,
  height_inches DECIMAL(6,2) DEFAULT 0,
  thickness_inches DECIMAL(4,2) DEFAULT 0,
  door_material TEXT,
  frame_material TEXT,
  fire_rating TEXT,
  hardware_prep TEXT,
  provided_hardware_set TEXT,
  assigned_hardware_set_id UUID REFERENCES hardware_sets(id),
  status TEXT DEFAULT 'pending',
  schedule TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hardware Sets
CREATE TABLE hardware_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  division TEXT DEFAULT 'Division 08',
  door_tags TEXT, -- comma-separated list of assigned door tags
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hardware Items (line items in a hardware set)
CREATE TABLE hardware_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hardware_set_id UUID NOT NULL REFERENCES hardware_sets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  quantity INTEGER DEFAULT 1,
  manufacturer TEXT,
  finish TEXT,
  unit_price DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Master Inventory (organization-level hardware catalog)
CREATE TABLE master_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  manufacturer TEXT,
  unit_price DECIMAL(10,2) DEFAULT 0,
  finish TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  email TEXT NOT NULL,
  role TEXT DEFAULT 'Estimator',
  ai_provider TEXT DEFAULT 'gemini',
  -- NOTE: Do NOT store API keys here. Keys stored in Supabase Vault.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_doors_project ON doors(project_id);
CREATE INDEX idx_hardware_sets_project ON hardware_sets(project_id);
CREATE INDEX idx_hardware_items_set ON hardware_items(hardware_set_id);
CREATE INDEX idx_projects_org ON projects(organization_id);
```

---

## Row Level Security (RLS) Policies

```sql
-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE doors ENABLE ROW LEVEL SECURITY;
ALTER TABLE hardware_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE hardware_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_inventory ENABLE ROW LEVEL SECURITY;

-- Helper function: get user's organization
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS UUID AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Projects: users see only their org's projects
CREATE POLICY "org_projects_select" ON projects
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "org_projects_insert" ON projects
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "org_projects_update" ON projects
  FOR UPDATE USING (organization_id = get_user_organization_id());

-- Doors: users see doors in their org's projects
CREATE POLICY "org_doors_select" ON doors
  FOR SELECT USING (
    project_id IN (SELECT id FROM projects WHERE organization_id = get_user_organization_id())
  );

-- (Similar policies for hardware_sets, hardware_items, master_inventory)
```

---

## Migration Strategy

### Phase A: Parallel Write (Zero Downtime)
During transition, write to BOTH localStorage AND Supabase. Read from Supabase with localStorage fallback.

```typescript
// services/projectService.ts (transitional)
export async function saveProject(project: Project): Promise<void> {
  // Write to Supabase
  const { error } = await supabase.from('projects').upsert({
    id: project.id,
    name: project.name,
    // ... map to DB columns
  })
  if (error) console.warn('Supabase write failed, data in localStorage only:', error)

  // Also write to localStorage as fallback
  const projects = getProjectsFromStorage()
  saveProjectsToStorage([...projects.filter(p => p.id !== project.id), project])
}
```

### Phase B: One-Time Data Migration
Provide a migration utility for existing users to transfer localStorage data to Supabase:

```typescript
// utils/migrations/localStorageToSupabase.ts
export async function migrateLocalStorageToSupabase(userId: string): Promise<void> {
  const raw = localStorage.getItem('tve_projects')
  if (!raw) return

  const projects: Project[] = JSON.parse(raw)
  for (const project of projects) {
    // Insert project + all its doors + hardware sets
    await supabase.from('projects').insert({ ...mapProjectToDb(project), id: project.id })
    // ... insert doors, hardware sets, items
  }

  // Mark migration as complete
  localStorage.setItem('tve_migration_complete', 'true')
}
```

### Phase C: Remove localStorage Reads
Once all users have migrated, remove localStorage reads. Keep writes for offline fallback only. Eventually remove all localStorage.

---

## Key Files to Touch

| File | What Changes |
|---|---|
| `contexts/ProjectContext.tsx` | Replace localStorage reads with `supabase.from().select()` |
| `lib/supabase.ts` | Split into `lib/supabase/client.ts` + `lib/supabase/server.ts` |
| `services/fileUploadService.ts` | After extraction, write to Supabase instead of context |
| `services/mlOpsService.ts` | Move learned examples to Supabase |
| `utils/migrations/localStorageToSupabase.ts` | NEW — migration utility |

---

## What NOT to Do

- Do NOT read/write Supabase directly from React components — go through services
- Do NOT use the service role key client-side — only in API routes / server functions
- Do NOT store AI API keys in the `profiles` table — use Supabase Vault
- Do NOT remove localStorage fallback until migration is confirmed complete for all users
