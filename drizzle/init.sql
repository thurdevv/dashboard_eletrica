-- ============================================================
-- BIM Elétrico — Schema inicial (NeonDB / Postgres)
-- ============================================================
-- Como usar:
--   1. Crie um projeto em https://neon.tech
--   2. Abra Dashboard → SQL Editor
--   3. Cole este arquivo inteiro e execute
--   4. Copie a connection string em Connection Details
--   5. Adicione DATABASE_URL no Vercel (Settings → Environment Variables)
-- ============================================================

create extension if not exists "pgcrypto";

-- ─── execution_records ───────────────────────────────────────
create table if not exists execution_records (
  id                  uuid primary key default gen_random_uuid(),
  project_id          text not null,
  ifc_global_id       text not null,
  element_name        text,
  element_type        text,
  level               text,
  status              text not null default 'NOT_STARTED'
                        check (status in ('NOT_STARTED','IN_PROGRESS','COMPLETED','ISSUE')),
  executed_quantity   numeric default 0,
  team_size           integer default 1,
  worked_hours        numeric default 0,
  productivity        numeric,
  notes               text,
  photo_url           text,
  element_screenshot  text,
  element_length      numeric,
  planned_start       date,
  planned_end         date,
  planned_quantity    numeric,
  updated_by          text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  constraint execution_records_project_id_ifc_global_id_key
    unique (project_id, ifc_global_id)
);

-- ─── Índices úteis para filtros do app ───────────────────────
create index if not exists idx_exec_project on execution_records(project_id);
create index if not exists idx_exec_status  on execution_records(project_id, status);
create index if not exists idx_exec_level   on execution_records(project_id, level);
create index if not exists idx_exec_type    on execution_records(project_id, element_type);

-- ─── Auto-update updated_at ──────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_exec_updated_at on execution_records;
create trigger trg_exec_updated_at
  before update on execution_records
  for each row execute function update_updated_at();
