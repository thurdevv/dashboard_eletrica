/**
 * Fallback de armazenamento local (localStorage) para uso sem Supabase.
 * Mesma interface da API do Supabase para que a troca seja transparente.
 */

import type { ExecutionRecord, ExecutionFormData, IFCElement, FilterState, DailyEntry, ExecutionChecklist } from '@/types'
import { appendHistory } from './extras'
import { EXEC_PREFIX, DAILY_PREFIX, HISTORY_PREFIX } from './constants'

// Faz merge entre checklist antigo e novo do form. Marca photoAttached
// automaticamente quando há foto vinculada ao registro (foto explícita
// no form ou photo_url já salva).
function mergeChecklist(
  existing: ExecutionChecklist | undefined,
  fromForm: ExecutionChecklist | undefined,
  hasPhoto: string | undefined,
): ExecutionChecklist | undefined {
  const next: ExecutionChecklist = { ...(existing ?? {}), ...(fromForm ?? {}) }
  if (hasPhoto) next.photoAttached = true
  return Object.keys(next).length > 0 ? next : undefined
}

function key(projectId: string, globalId: string) {
  return `${EXEC_PREFIX}_${projectId}_${globalId}`
}

function allKeys(projectId: string): string[] {
  if (typeof window === 'undefined') return []
  return Object.keys(localStorage).filter((k) => k.startsWith(`${EXEC_PREFIX}_${projectId}_`))
}

export function localGet(projectId: string, globalId: string): ExecutionRecord | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(key(projectId, globalId))
  return raw ? JSON.parse(raw) : null
}

export function localGetAll(projectId: string, filters?: Partial<FilterState>): ExecutionRecord[] {
  if (typeof window === 'undefined') return []
  const records: ExecutionRecord[] = allKeys(projectId)
    .map((k) => JSON.parse(localStorage.getItem(k)!))
    .filter(Boolean)

  return records.filter((r) => {
    if (filters?.status && filters.status !== 'ALL' && r.status !== filters.status) return false
    if (filters?.level && r.level !== filters.level) return false
    if (filters?.elementType && r.element_type !== filters.elementType) return false
    return true
  })
}

export function localUpsert(
  projectId: string,
  element: IFCElement,
  form: ExecutionFormData,
  photoUrl?: string,
  changedBy: string = 'local',
): ExecutionRecord {
  const existing = localGet(projectId, element.globalId)
  const denom    = form.team_size * form.worked_hours
  const now      = new Date().toISOString()
  const record: ExecutionRecord = {
    id:                existing?.id ?? crypto.randomUUID(),
    project_id:        projectId,
    ifc_global_id:     element.globalId,
    element_name:      element.name,
    element_type:      element.type,
    level:             element.level,
    status:            form.status,
    executed_quantity: form.executed_quantity,
    team_size:         form.team_size,
    worked_hours:      form.worked_hours,
    productivity:      denom > 0 ? form.executed_quantity / denom : 0,
    notes:              form.notes,
    photo_url:          photoUrl ?? existing?.photo_url,
    element_screenshot: element.screenshot ?? existing?.element_screenshot,
    element_length:     element.length ?? existing?.element_length,
    planned_start:      form.planned_start ?? existing?.planned_start,
    planned_end:        form.planned_end ?? existing?.planned_end,
    planned_quantity:   form.planned_quantity ?? existing?.planned_quantity,
    checklist:          mergeChecklist(existing?.checklist, form.checklist, photoUrl ?? existing?.photo_url),
    daily_log:          existing?.daily_log,   // preserved; managed separately
    created_at:         existing?.created_at ?? now,
    updated_at:         now,
    updated_by:         changedBy,
  }
  localStorage.setItem(key(projectId, element.globalId), JSON.stringify(record))
  // Audit log — só grava se algo relevante mudou (a função decide)
  try { appendHistory(projectId, element.globalId, changedBy, record, existing) }
  catch { /* não falha o upsert se o log falhar */ }
  return record
}

// ─── Daily progress log ───────────────────────────────────────
function dailyKey(projectId: string, globalId: string) {
  return `${DAILY_PREFIX}_${projectId}_${globalId}`
}

export function localGetDailyLog(projectId: string, globalId: string): DailyEntry[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(dailyKey(projectId, globalId))
  return raw ? JSON.parse(raw) : []
}

export function localAddDailyEntry(
  projectId: string,
  globalId:  string,
  meters:    number,
  date:      string,
  notes:     string,
): DailyEntry[] {
  const log = localGetDailyLog(projectId, globalId)
  const entry: DailyEntry = {
    id:      crypto.randomUUID(),
    date,
    meters,
    notes,
    savedAt: new Date().toISOString(),
  }
  const updated = [...log, entry].sort((a, b) => a.date.localeCompare(b.date))
  localStorage.setItem(dailyKey(projectId, globalId), JSON.stringify(updated))
  return updated
}

export function localDeleteDailyEntry(
  projectId: string,
  globalId:  string,
  entryId:   string,
): DailyEntry[] {
  const log     = localGetDailyLog(projectId, globalId)
  const updated = log.filter((e) => e.id !== entryId)
  localStorage.setItem(dailyKey(projectId, globalId), JSON.stringify(updated))
  return updated
}

export function localGetLevels(projectId: string): string[] {
  const all = localGetAll(projectId)
  return [...new Set(all.map((r) => r.level).filter(Boolean))].sort()
}

export function localGetElementTypes(projectId: string): string[] {
  const all = localGetAll(projectId)
  return [...new Set(all.map((r) => r.element_type).filter(Boolean))].sort()
}

export function localExport(projectId: string): string {
  const records = localGetAll(projectId)
  return JSON.stringify({ projectId, exportedAt: new Date().toISOString(), records }, null, 2)
}

export function localImport(projectId: string, json: string): number {
  const parsed = JSON.parse(json)
  const records: ExecutionRecord[] = parsed.records ?? parsed
  for (const r of records) {
    if (!r.ifc_global_id) continue
    localStorage.setItem(key(projectId, r.ifc_global_id), JSON.stringify({ ...r, project_id: projectId }))
  }
  return records.length
}

export function localClear(projectId: string): void {
  allKeys(projectId).forEach((k) => localStorage.removeItem(k))
}

// ─── Export/import completo (modelo + progresso) ──────────────
export function localGetAllDailyLogs(projectId: string): Record<string, DailyEntry[]> {
  if (typeof window === 'undefined') return {}
  const prefix = `${DAILY_PREFIX}_${projectId}_`
  const result: Record<string, DailyEntry[]> = {}
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith(prefix)) {
      const globalId = k.slice(prefix.length)
      const raw = localStorage.getItem(k)
      if (raw) result[globalId] = JSON.parse(raw)
    }
  }
  return result
}

export function localImportDailyLogs(projectId: string, logs: Record<string, DailyEntry[]>): void {
  for (const [globalId, entries] of Object.entries(logs)) {
    localStorage.setItem(dailyKey(projectId, globalId), JSON.stringify(entries))
  }
}

export interface ProgressBundle {
  version:     number
  exportedAt:  string
  records:     ExecutionRecord[]
  dailyLogs:   Record<string, DailyEntry[]>
  history?:    Record<string, unknown[]>   // histórico por globalId — preservado entre exports
}

function localGetAllHistory(projectId: string): Record<string, unknown[]> {
  if (typeof window === 'undefined') return {}
  const prefix = `${HISTORY_PREFIX}_${projectId}_`
  const out: Record<string, unknown[]> = {}
  for (const k of Object.keys(localStorage)) {
    if (!k.startsWith(prefix)) continue
    const globalId = k.slice(prefix.length)
    try {
      const arr = JSON.parse(localStorage.getItem(k) ?? '[]')
      if (Array.isArray(arr) && arr.length > 0) out[globalId] = arr
    } catch { /* ignore */ }
  }
  return out
}

function localImportHistory(projectId: string, history: Record<string, unknown[]>) {
  for (const [globalId, entries] of Object.entries(history)) {
    if (!Array.isArray(entries) || entries.length === 0) continue
    const k = `${HISTORY_PREFIX}_${projectId}_${globalId}`
    // Não sobrescreve histórico existente — faz merge por id pra evitar duplicatas
    let existing: any[] = []
    try { existing = JSON.parse(localStorage.getItem(k) ?? '[]') } catch { /* ignore */ }
    const seen = new Set(existing.map((e) => e?.id).filter(Boolean))
    const merged = [...existing, ...entries.filter((e: any) => e?.id && !seen.has(e.id))]
    localStorage.setItem(k, JSON.stringify(merged))
  }
}

export function localBuildBundle(projectId: string): ProgressBundle {
  return {
    version:    2,
    exportedAt: new Date().toISOString(),
    records:    localGetAll(projectId),
    dailyLogs:  localGetAllDailyLogs(projectId),
    history:    localGetAllHistory(projectId),
  }
}

export function localRestoreBundle(projectId: string, bundle: ProgressBundle): number {
  for (const r of bundle.records) {
    if (!r.ifc_global_id) continue
    localStorage.setItem(key(projectId, r.ifc_global_id), JSON.stringify({ ...r, project_id: projectId }))
  }
  if (bundle.dailyLogs) {
    localImportDailyLogs(projectId, bundle.dailyLogs)
  }
  if (bundle.history) {
    localImportHistory(projectId, bundle.history)
  }
  return bundle.records.length
}
