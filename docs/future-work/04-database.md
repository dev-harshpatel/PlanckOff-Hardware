# Database — Transactions, Audit Logging, Indexes, RLS

## Current State

The database layer uses Supabase's JavaScript client (`@supabase/supabase-js`) with the service role key for all server-side operations. The schema is solid (21 migrations, well-structured tables, foreign keys, RLS enabled). But several operational patterns are missing that will cause problems at scale or under failure conditions.

---

## 1. No Database Transactions

The most critical gap. Several operations that should be atomic are not:

### Example 1 — Process route writes

`/api/projects/[id]/process/route.ts` does this sequence after merging:

```typescript
await upsertDoorScheduleImport(projectId, scheduleData);
await upsertHardwarePdfExtraction(projectId, hardwareData);
await queueItemsForApproval(candidates, ...);     // non-blocking, OK
await upsertProjectHardwareFinal(projectId, mergedData);
```

If the server crashes between steps 2 and 4, the project has a door schedule and hardware extraction stored, but no `project_hardware_finals` row. The UI will show stale or empty data. The user will re-upload and create a second round of approval candidates.

**What should happen:** All four writes succeed together or none do.

### Example 2 — Team invite creation

```typescript
await createTeamMember({ email, roleId, inviteToken, ... });
// If server crashes here, invite token exists but no email was sent
await sendInviteEmail(email, inviteToken);
```

The invite record is in the database but the email never went out. The user doesn't know they have an invite.

### Example 3 — Pricing variant creation

```typescript
await createPricingVariant(projectId, variantName, baseData);
await updateProjectMetadata(projectId, { variantCount: n + 1 });
```

Count can get out of sync if the second write fails.

---

### How to Fix: Supabase RPC (Stored Procedures) for Atomic Operations

The Supabase JS client doesn't support multi-statement transactions directly. Use PostgreSQL functions called via `supabase.rpc()`:

```sql
-- supabase/migrations/023_atomic_process_upsert.sql

CREATE OR REPLACE FUNCTION upsert_project_processing_results(
  p_project_id uuid,
  p_schedule_data jsonb,
  p_schedule_file_name text,
  p_hardware_data jsonb,
  p_hardware_file_name text,
  p_final_data jsonb,
  p_uploaded_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- All or nothing
  INSERT INTO door_schedule_imports (project_id, schedule_json, file_name, uploaded_by, updated_at)
  VALUES (p_project_id, p_schedule_data, p_schedule_file_name, p_uploaded_by, now())
  ON CONFLICT (project_id)
  DO UPDATE SET
    schedule_json = EXCLUDED.schedule_json,
    file_name = EXCLUDED.file_name,
    uploaded_by = EXCLUDED.uploaded_by,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO hardware_pdf_extractions (project_id, extracted_json, file_name, uploaded_by, updated_at)
  VALUES (p_project_id, p_hardware_data, p_hardware_file_name, p_uploaded_by, now())
  ON CONFLICT (project_id)
  DO UPDATE SET
    extracted_json = EXCLUDED.extracted_json,
    file_name = EXCLUDED.file_name,
    uploaded_by = EXCLUDED.uploaded_by,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO project_hardware_finals (project_id, final_json, generated_by, updated_at)
  VALUES (p_project_id, p_final_data, p_uploaded_by, now())
  ON CONFLICT (project_id)
  DO UPDATE SET
    final_json = EXCLUDED.final_json,
    generated_by = EXCLUDED.generated_by,
    updated_at = EXCLUDED.updated_at;
END;
$$;
```

Call from TypeScript:
```typescript
const { error } = await supabaseAdmin.rpc('upsert_project_processing_results', {
  p_project_id: projectId,
  p_schedule_data: scheduleData,
  // ...
});
```

This runs all three upserts in a single PostgreSQL transaction.

---

## 2. No Audit Logging

The database tracks `created_at`, `updated_at`, and `created_by` / `uploaded_by` on most tables. But there is no record of:

- Who changed a project's status from Active to Complete
- Who deleted a hardware set
- Who approved a master hardware item and when
- What the previous value was before an edit (for rollback)

For a business application handling estimating data, audit trails are expected by enterprise clients. They're also invaluable for debugging ("why did set AD01 disappear on Tuesday?").

### Audit Table Design

```sql
-- supabase/migrations/024_audit_log.sql

CREATE TABLE audit_log (
  id            bigserial PRIMARY KEY,
  table_name    text NOT NULL,
  record_id     text NOT NULL,         -- the PK of the affected row (as text for flexibility)
  action        text NOT NULL          -- INSERT | UPDATE | DELETE
                CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data      jsonb,                 -- previous row state (null for INSERT)
  new_data      jsonb,                 -- new row state (null for DELETE)
  changed_by    uuid,                  -- auth_sessions user (null for system operations)
  changed_at    timestamptz NOT NULL DEFAULT now()
);

-- Index for querying by record
CREATE INDEX idx_audit_log_record ON audit_log (table_name, record_id, changed_at DESC);

-- Don't enable RLS — this is admin-only visibility
-- The service role key can always read it; regular clients cannot
```

### Trigger-Based Logging (For Critical Tables)

```sql
-- Generic audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO audit_log (table_name, record_id, action, old_data, new_data)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    TG_OP,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach to important tables
CREATE TRIGGER audit_projects
  AFTER INSERT OR UPDATE OR DELETE ON projects
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_project_hardware_finals
  AFTER INSERT OR UPDATE OR DELETE ON project_hardware_finals
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_master_hardware
  AFTER INSERT OR UPDATE OR DELETE ON master_hardware
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
```

### Application-Level Logging (For User Actions)

Some audit events can't be captured by DB triggers (e.g., "user downloaded a PDF report"). Add an application-level event log:

```typescript
// lib/db/auditLog.ts
async function logUserAction(
  userId: string,
  action: string,       // e.g., 'project.pdf_downloaded', 'hardware.set_deleted'
  resourceType: string, // 'project', 'hardware_set', 'report'
  resourceId: string,
  metadata?: Record<string, unknown>
): Promise<void>
```

---

## 3. Missing Indexes on Frequently Queried Columns

JSONB fields are stored in `hardware_pdf_extractions.extracted_json`, `project_hardware_finals.final_json`, and `door_schedule_imports.schedule_json`. These are large blobs queried as a whole — no partial query optimization needed there. But relational columns have gaps:

```sql
-- Currently missing, should add:

-- master_hardware: search by name/manufacturer (used in approval queue + lookup)
CREATE INDEX idx_master_hardware_name_lower ON master_hardware (LOWER(name));
CREATE INDEX idx_master_hardware_status ON master_hardware (status);
CREATE INDEX idx_master_hardware_manufacturer_lower ON master_hardware (LOWER(manufacturer));

-- projects: filter by deleted_at (trash queries)
CREATE INDEX idx_projects_deleted_at ON projects (deleted_at) WHERE deleted_at IS NOT NULL;

-- auth_sessions: look up by token (every request)
-- This likely already exists as the PRIMARY KEY or unique constraint — verify
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions (token);

-- door_schedule_imports: look up by project_id (one per project, but queried on every load)
-- Should already have an index from the FK — verify it exists

-- client_project_assignments: look up client's assigned projects
CREATE INDEX idx_client_project_assignments_client_id ON client_project_assignments (client_id);
```

To check what indexes currently exist:
```sql
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

---

## 4. Row-Level Security (RLS) Is Too Thin

RLS is enabled on all tables, but most tables have no actual policies — they rely on the service role key bypassing RLS entirely. This means the database doesn't enforce access control; the application layer does.

**Current state:**
```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
-- No policies defined — service role key bypasses RLS completely
```

**The risk:** If any query accidentally uses the `anon` key or a user-scoped key instead of the service role key, it returns nothing (denied by default) — but this fails silently and looks like "no data" instead of an error.

**The bigger risk:** If the service role key is ever compromised or misconfigured, there's no database-level guard.

**Better approach for client-facing rows:**

```sql
-- Projects: clients can only see projects assigned to them
CREATE POLICY client_can_see_assigned_projects ON projects
  FOR SELECT
  USING (
    auth.role() = 'service_role'  -- service role bypasses
    OR
    EXISTS (
      SELECT 1 FROM client_project_assignments cpa
      WHERE cpa.project_id = projects.id
        AND cpa.client_id = auth.uid()  -- if using Supabase Auth
    )
  );
```

Note: This would require switching to Supabase Auth (or a JWT with user ID claims) for the RLS `auth.uid()` function to work. With custom sessions (current), RLS can't reference the logged-in user. This is a larger change — document it as a long-term migration target.

---

## 5. Soft Deletes Accumulate Forever

Projects are soft-deleted (set `deleted_at = now()`). Hardware sets are soft-deleted. The trash table grows indefinitely. There is no auto-purge.

**What should happen:**
- Soft-deleted projects older than 90 days → automatically hard-deleted (with audit log entry)
- Hardware set trash items older than 30 days → automatically purged
- Expired auth sessions → purged (this one especially, as the table grows with every login)

**Implementation:** A scheduled database function or a cron job:

```sql
-- Scheduled via Supabase pg_cron extension (or external cron)
SELECT cron.schedule(
  'purge-old-trash',
  '0 2 * * *',  -- 2 AM daily
  $$
    DELETE FROM projects WHERE deleted_at < now() - INTERVAL '90 days';
    DELETE FROM auth_sessions WHERE expires_at < now();
  $$
);
```

Or implement as an API route called by an external cron (Vercel Cron, GitHub Actions, etc.):

```typescript
// app/api/internal/purge-expired/route.ts
// Protected by a secret header (not authenticated via session)
export async function POST(req: Request) {
  const secret = req.headers.get('x-internal-secret');
  if (secret !== process.env.INTERNAL_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  await purgeExpiredSessions();
  await purgeOldSoftDeletes();
  
  return NextResponse.json({ ok: true });
}
```

---

## 6. JSONB Storage Lacks Structure Validation

`project_hardware_finals.final_json` stores the merged result. `hardware_pdf_extractions.extracted_json` stores the AI extraction. These are untyped JSON blobs — the database has no idea what shape they should be.

If a bug causes a malformed JSON to be saved, there is no database-level check — it's accepted and stored. The next read will try to parse it and fail in a confusing way.

**Option A — JSON Schema validation in a trigger:**
```sql
CREATE OR REPLACE FUNCTION validate_hardware_final_json()
RETURNS trigger AS $$
BEGIN
  IF NEW.final_json IS NULL THEN
    RAISE EXCEPTION 'final_json cannot be null';
  END IF;
  IF jsonb_typeof(NEW.final_json -> 'sets') != 'array' THEN
    RAISE EXCEPTION 'final_json must have a sets array';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Option B — Validate in application before writing (simpler):**
```typescript
// lib/db/hardware.ts
function validateFinalJson(data: unknown): asserts data is ProjectHardwareFinal {
  const parsed = ProjectHardwareFinalSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Invalid final JSON structure: ${parsed.error.message}`);
  }
}
```

Option B (Zod validation before write) is simpler and catches bugs earlier, before they reach the database.

---

## Summary of Changes Needed

| Issue | Priority | Effort | Migration Number |
|-------|----------|--------|-----------------|
| Atomic writes via stored procedure | High | Medium | 023 |
| Audit log table + triggers | High | Medium | 024 |
| Missing indexes | Medium | Low | 025 |
| Auto-purge cron for soft deletes and sessions | Medium | Low | 026 |
| JSONB validation before writes | Medium | Low | (app-level, no migration) |
| RLS policies tied to real user identity | Low | High | (requires auth migration) |
