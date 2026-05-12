// Parser leve de CSV de planejamento. Aceita o formato:
//   ifc_global_id,element_name,element_type,level,planned_start,planned_end,planned_quantity,notes
// (cabeçalho obrigatório; colunas extras são ignoradas, ordem livre).
//
// Para cada linha, faz upsert local com status NOT_STARTED se o registro não
// existir. Se já existe, atualiza só os campos planned_*. Útil pra alimentar a
// curva S a partir de uma planilha em massa.

import type { ExecutionRecord, ExecutionStatus } from '@/types'

interface CsvRow {
  ifc_global_id?:    string
  element_name?:     string
  element_type?:     string
  level?:            string
  planned_start?:    string
  planned_end?:      string
  planned_quantity?: string
  notes?:            string
  status?:           string
}

function parseLine(line: string): string[] {
  // CSV simples com suporte a aspas duplas
  const out: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') { inQuote = false }
      else { cur += ch }
    } else {
      if (ch === '"') { inQuote = true }
      else if (ch === ',') { out.push(cur); cur = '' }
      else { cur += ch }
    }
  }
  out.push(cur)
  return out
}

export interface CsvImportResult {
  imported: number
  skipped:  number
  errors:   string[]
}

const VALID_STATUS: ExecutionStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ISSUE']

const PREFIX = 'bim_exec'

function key(projectId: string, globalId: string) {
  return `${PREFIX}_${projectId}_${globalId}`
}

export function importPlanningCsv(projectId: string, csv: string): CsvImportResult {
  if (typeof window === 'undefined') return { imported: 0, skipped: 0, errors: ['SSR'] }

  const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length < 2) {
    return { imported: 0, skipped: 0, errors: ['CSV vazio ou só com cabeçalho'] }
  }

  const header = parseLine(lines[0]).map(h => h.trim().toLowerCase())
  // Aceita variações comuns
  const colIndex: Record<keyof CsvRow, number> = {
    ifc_global_id:    header.findIndex(h => ['ifc_global_id', 'globalid', 'global_id', 'guid'].includes(h)),
    element_name:     header.findIndex(h => ['element_name', 'nome', 'name'].includes(h)),
    element_type:     header.findIndex(h => ['element_type', 'tipo', 'type'].includes(h)),
    level:            header.findIndex(h => ['level', 'pavimento', 'andar'].includes(h)),
    planned_start:    header.findIndex(h => ['planned_start', 'inicio', 'inicio_planejado', 'start'].includes(h)),
    planned_end:      header.findIndex(h => ['planned_end', 'fim', 'fim_planejado', 'end'].includes(h)),
    planned_quantity: header.findIndex(h => ['planned_quantity', 'qtd_planejada', 'qtd', 'quantity'].includes(h)),
    notes:            header.findIndex(h => ['notes', 'obs', 'observacoes'].includes(h)),
    status:           header.findIndex(h => ['status'].includes(h)),
  }

  if (colIndex.ifc_global_id < 0) {
    return { imported: 0, skipped: 0, errors: ['Coluna ifc_global_id (ou GlobalId) é obrigatória'] }
  }

  const errors: string[] = []
  let imported = 0
  let skipped  = 0

  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i])
    const globalId = (cells[colIndex.ifc_global_id] ?? '').trim()
    if (!globalId) { skipped++; continue }

    const k = key(projectId, globalId)
    const existing: ExecutionRecord | null = (() => {
      try {
        const raw = localStorage.getItem(k)
        return raw ? JSON.parse(raw) : null
      } catch { return null }
    })()

    const get = (col: number): string | undefined => {
      if (col < 0) return undefined
      const v = cells[col]?.trim()
      return v ? v : undefined
    }

    const rawStatus = get(colIndex.status)?.toUpperCase()
    const status: ExecutionStatus = (rawStatus && (VALID_STATUS as string[]).includes(rawStatus))
      ? rawStatus as ExecutionStatus
      : (existing?.status ?? 'NOT_STARTED')

    const qty = get(colIndex.planned_quantity)
    const plannedQty = qty ? parseFloat(qty.replace(',', '.')) : undefined

    const merged: ExecutionRecord = {
      id:                existing?.id ?? crypto.randomUUID(),
      project_id:        projectId,
      ifc_global_id:     globalId,
      element_name:      get(colIndex.element_name) ?? existing?.element_name ?? '',
      element_type:      get(colIndex.element_type) ?? existing?.element_type ?? '',
      level:             get(colIndex.level)        ?? existing?.level        ?? '',
      status,
      executed_quantity: existing?.executed_quantity ?? 0,
      team_size:         existing?.team_size         ?? 1,
      worked_hours:      existing?.worked_hours      ?? 0,
      productivity:      existing?.productivity      ?? 0,
      notes:             get(colIndex.notes)         ?? existing?.notes        ?? '',
      photo_url:          existing?.photo_url,
      element_screenshot: existing?.element_screenshot,
      element_length:     existing?.element_length,
      checklist:          existing?.checklist,
      daily_log:          existing?.daily_log,
      planned_start:      get(colIndex.planned_start)   ?? existing?.planned_start,
      planned_end:        get(colIndex.planned_end)     ?? existing?.planned_end,
      planned_quantity:   plannedQty ?? existing?.planned_quantity,
      created_at:         existing?.created_at ?? new Date().toISOString(),
      updated_at:         new Date().toISOString(),
      updated_by:         existing?.updated_by ?? 'csv-import',
    }

    try {
      localStorage.setItem(k, JSON.stringify(merged))
      imported++
    } catch (err: any) {
      errors.push(`Linha ${i + 1}: ${err?.message ?? 'falha ao salvar'}`)
      skipped++
    }
  }

  return { imported, skipped, errors }
}

// Gera template CSV pronto para o usuário preencher.
export function buildPlanningCsvTemplate(): string {
  return [
    'ifc_global_id,element_name,element_type,level,planned_start,planned_end,planned_quantity,notes,status',
    '3a4b5c-globalid-do-ifc,Eletroduto-A1,IfcCableCarrierSegment,Pav1,2026-05-15,2026-05-20,12.5,Trecho corredor norte,NOT_STARTED',
    '',
  ].join('\n')
}
