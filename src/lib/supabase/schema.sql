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
  planned_start      date,
  planned_end        date,
  planned_quantity   numeric,
  updated_by         text,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now(),

  -- one record per element per project (upsert-friendly)
  unique (project_id, ifc_global_id)
);

-- ─── Execution History (audit log) ───────────────────────────
create table if not exists execution_history (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references projects(id) on delete cascade,
  ifc_global_id      text not null,
  changed_at         timestamptz default now(),
  changed_by         text,
  status             text,
  executed_quantity  numeric,
  team_size          integer,
  worked_hours       numeric,
  notes              text,
  changes            jsonb
);
create index if not exists idx_history_project on execution_history(project_id, ifc_global_id, changed_at desc);

-- ─── Element Comments ────────────────────────────────────────
create table if not exists element_comments (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  ifc_global_id text not null,
  author        text,
  text          text not null,
  created_at    timestamptz default now()
);
create index if not exists idx_comments_element on element_comments(project_id, ifc_global_id, created_at desc);

-- ─── 3D Annotations (BCF-like) ───────────────────────────────
create table if not exists annotations_3d (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  title         text not null,
  description   text,
  x             numeric not null,
  y             numeric not null,
  z             numeric not null,
  ifc_global_id text,
  photo_url     text,
  status        text default 'OPEN' check (status in ('OPEN','IN_REVIEW','RESOLVED')),
  created_by    text,
  created_at    timestamptz default now()
);
create index if not exists idx_annotations_project on annotations_3d(project_id, status);

-- ─── Scheduled Tasks (cronograma) ────────────────────────────
create table if not exists scheduled_tasks (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  title         text not null,
  description   text,
  level         text,
  element_type  text,
  global_ids    text[],
  planned_start date not null,
  planned_end   date not null,
  status        text default 'NOT_STARTED'
                  check (status in ('NOT_STARTED','IN_PROGRESS','COMPLETED','ISSUE')),
  created_at    timestamptz default now()
);
create index if not exists idx_schedule_project on scheduled_tasks(project_id, planned_start);

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
alter table projects           enable row level security;
alter table execution_records  enable row level security;
alter table execution_history  enable row level security;
alter table element_comments   enable row level security;
alter table annotations_3d     enable row level security;
alter table scheduled_tasks    enable row level security;

create policy "owner_all_projects" on projects
  for all using (auth.uid() = owner_id);

create policy "owner_all_exec_records" on execution_records
  for all using (
    project_id in (select id from projects where owner_id = auth.uid())
  );

create policy "owner_all_history" on execution_history
  for all using (
    project_id in (select id from projects where owner_id = auth.uid())
  );

create policy "owner_all_comments" on element_comments
  for all using (
    project_id in (select id from projects where owner_id = auth.uid())
  );

create policy "owner_all_annotations" on annotations_3d
  for all using (
    project_id in (select id from projects where owner_id = auth.uid())
  );

create policy "owner_all_schedule" on scheduled_tasks
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
