-- ============================================================
-- BIM Electrical Progress Tracking — Supabase Schema
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── Projects ────────────────────────────────────────────────
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  owner_id    uuid references auth.users(id) on delete cascade,
  model_path  text,                      -- path to XKT file in Supabase Storage
  created_at  timestamptz default now()
);

-- ─── Execution Records ───────────────────────────────────────
create table if not exists execution_records (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references projects(id) on delete cascade,
  ifc_global_id      text not null,
  element_name       text,
  element_type       text,
  level              text,
  status             text not null default 'NOT_STARTED'
                       check (status in ('NOT_STARTED','IN_PROGRESS','COMPLETED','ISSUE')),
  executed_quantity  numeric default 0,
  team_size          integer default 1,
  worked_hours       numeric default 0,
  productivity       numeric generated always as (
                       case when (team_size * worked_hours) > 0
                         then executed_quantity / (team_size * worked_hours)
                         else 0
                       end
                     ) stored,
  notes              text,
  photo_url          text,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now(),

  -- one record per element per project (upsert-friendly)
  unique (project_id, ifc_global_id)
);

-- ─── Indexes ─────────────────────────────────────────────────
create index if not exists idx_exec_project       on execution_records(project_id);
create index if not exists idx_exec_ifc_global_id on execution_records(project_id, ifc_global_id);
create index if not exists idx_exec_status        on execution_records(project_id, status);
create index if not exists idx_exec_level         on execution_records(project_id, level);
create index if not exists idx_exec_type          on execution_records(project_id, element_type);

-- ─── Auto-update updated_at ──────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_exec_updated_at
  before update on execution_records
  for each row execute function update_updated_at();

-- ─── Row Level Security ──────────────────────────────────────
alter table projects          enable row level security;
alter table execution_records enable row level security;

-- Users can manage their own projects
create policy "owner_all_projects" on projects
  for all using (auth.uid() = owner_id);

-- Users can manage execution records of their own projects
create policy "owner_all_exec_records" on execution_records
  for all using (
    project_id in (select id from projects where owner_id = auth.uid())
  );

-- ─── Storage bucket for execution photos ─────────────────────
-- Run in Supabase dashboard: Storage → New Bucket → "execution-photos" (public)
-- Or via SQL edge function if using service role key.

-- ─── Useful view: project summary ────────────────────────────
create or replace view project_summary as
select
  p.id                               as project_id,
  p.name                             as project_name,
  count(e.id)                        as total_elements,
  count(*) filter (where e.status = 'NOT_STARTED')  as not_started,
  count(*) filter (where e.status = 'IN_PROGRESS')  as in_progress,
  count(*) filter (where e.status = 'COMPLETED')    as completed,
  count(*) filter (where e.status = 'ISSUE')        as issues,
  round(
    100.0 * count(*) filter (where e.status = 'COMPLETED') / nullif(count(e.id), 0), 1
  )                                  as completion_pct
from projects p
left join execution_records e on e.project_id = p.id
group by p.id, p.name;
