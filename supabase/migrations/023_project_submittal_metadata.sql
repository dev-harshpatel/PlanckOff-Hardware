-- Stores per-project submittal package metadata (From, To, GC Name, Project Address, Project Name, Company Name)
create table if not exists project_submittal_metadata (
  project_id      uuid        primary key references projects(id) on delete cascade,
  from_name       text        not null default '',
  to_name         text        not null default '',
  gc_name         text        not null default '',
  project_address text        not null default '',
  project_name    text        not null default '',
  company_name    text        not null default '',
  updated_at      timestamptz not null default now()
);

drop trigger if exists project_submittal_metadata_set_updated_at on project_submittal_metadata;
create trigger project_submittal_metadata_set_updated_at
  before update on project_submittal_metadata
  for each row execute function set_updated_at();

-- Auth is enforced at the API route layer (withAuth).
-- RLS is open like project_notes — service-role key used server-side bypasses anyway.
alter table project_submittal_metadata enable row level security;

drop policy if exists "project_submittal_metadata_all" on project_submittal_metadata;
create policy "project_submittal_metadata_all"
  on project_submittal_metadata for all
  using (true)
  with check (true);
