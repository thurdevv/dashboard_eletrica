-- ============================================================
-- Migration 002 — adiciona coluna checklist (jsonb)
-- Aplicar APENAS se você já rodou o init.sql original sem essa coluna.
-- Idempotente: usa IF NOT EXISTS.
-- ============================================================

alter table execution_records
  add column if not exists checklist jsonb;
