import * as XLSX from 'xlsx'
import type { ExecutionRecord, ExecutionHistoryEntry } from '@/types'
import { STATUS_LABELS } from '@/types'

interface ExportInput {
  projectName:   string
  records:       ExecutionRecord[]
  history?:      ExecutionHistoryEntry[]
  totalElements: number
}

export function exportProjectToXlsx({ projectName, records, history, totalElements }: ExportInput) {
  const wb = XLSX.utils.book_new()

  // ─── Aba Resumo ────────────────────────────────────────────
  const completed  = records.filter((r) => r.status === 'COMPLETED').length
  const inProgress = records.filter((r) => r.status === 'IN_PROGRESS').length
  const issues     = records.filter((r) => r.status === 'ISSUE').length
  const notStarted = records.filter((r) => r.status === 'NOT_STARTED').length
  const total      = totalElements > 0 ? totalElements : records.length
  const pct        = total > 0 ? Math.round((completed / total) * 100) : 0

  const summary = [
    { Métrica: 'Projeto',                 Valor: projectName },
    { Métrica: 'Emitido em',              Valor: new Date().toLocaleString('pt-BR') },
    { Métrica: 'Total de elementos',      Valor: total },
    { Métrica: 'Registrados',             Valor: records.length },
    { Métrica: 'Concluídos',              Valor: completed },
    { Métrica: 'Em execução',             Valor: inProgress },
    { Métrica: 'Problemas',               Valor: issues },
    { Métrica: 'Não iniciados',           Valor: notStarted },
    { Métrica: 'Conclusão (%)',           Valor: pct },
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Resumo')

  // ─── Aba Registros ─────────────────────────────────────────
  const rows = records.map((r) => ({
    GlobalId:        r.ifc_global_id,
    Elemento:        r.element_name,
    Tipo:            r.element_type,
    Pavimento:       r.level,
    Status:          STATUS_LABELS[r.status] ?? r.status,
    'Qtd Executada': r.executed_quantity,
    'Qtd Planejada': r.planned_quantity ?? '',
    Equipe:          r.team_size,
    Horas:           r.worked_hours,
    Produtividade:   Number(r.productivity?.toFixed(3) ?? 0),
    'Início Plan.':  r.planned_start ?? '',
    'Fim Plan.':     r.planned_end ?? '',
    Observações:     r.notes ?? '',
    'Atualizado em': r.updated_at ?? r.created_at ?? '',
    'Atualizado por': r.updated_by ?? '',
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Registros')

  // ─── Aba Por Pavimento ─────────────────────────────────────
  const byLevel: Record<string, { total: number; completed: number; inProgress: number; issues: number }> = {}
  for (const r of records) {
    const lv = r.level || 'Sem Pavimento'
    byLevel[lv] ??= { total: 0, completed: 0, inProgress: 0, issues: 0 }
    byLevel[lv].total++
    if (r.status === 'COMPLETED')   byLevel[lv].completed++
    if (r.status === 'IN_PROGRESS') byLevel[lv].inProgress++
    if (r.status === 'ISSUE')       byLevel[lv].issues++
  }
  const levelRows = Object.entries(byLevel).map(([Pavimento, s]) => ({
    Pavimento,
    Total:        s.total,
    Concluídos:   s.completed,
    'Em Execução': s.inProgress,
    Problemas:    s.issues,
    'Conclusão (%)': s.total > 0 ? Math.round(100 * s.completed / s.total) : 0,
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(levelRows), 'Por Pavimento')

  // ─── Aba Histórico ─────────────────────────────────────────
  if (history && history.length > 0) {
    const histRows = history.map((h) => ({
      Data:        new Date(h.changedAt).toLocaleString('pt-BR'),
      'Por':       h.changedBy,
      GlobalId:    h.globalId,
      Status:      STATUS_LABELS[h.status] ?? h.status,
      'Qtd Exec.': h.executed_quantity,
      Equipe:      h.team_size,
      Horas:       h.worked_hours,
      Mudanças:    h.changes && Object.keys(h.changes).length > 0
                     ? Object.entries(h.changes).map(([k, v]) => `${k}: ${v.from}→${v.to}`).join('; ')
                     : '—',
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(histRows), 'Histórico')
  }

  const safeName = projectName.replace(/[^a-z0-9_-]/gi, '_').slice(0, 60) || 'projeto'
  const stamp    = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `relatorio_${safeName}_${stamp}.xlsx`)
}

export function exportProjectToCsv(records: ExecutionRecord[], projectName: string) {
  const rows = records.map((r) => ({
    GlobalId:        r.ifc_global_id,
    Elemento:        r.element_name,
    Tipo:            r.element_type,
    Pavimento:       r.level,
    Status:          STATUS_LABELS[r.status] ?? r.status,
    'Qtd Executada': r.executed_quantity,
    Equipe:          r.team_size,
    Horas:           r.worked_hours,
    Produtividade:   Number(r.productivity?.toFixed(3) ?? 0),
    Observações:     r.notes ?? '',
  }))
  const ws  = XLSX.utils.json_to_sheet(rows)
  const csv = XLSX.utils.sheet_to_csv(ws, { FS: ';' })
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  const safeName = projectName.replace(/[^a-z0-9_-]/gi, '_').slice(0, 60) || 'projeto'
  const stamp    = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `registros_${safeName}_${stamp}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
