'use client'

import { useRef } from 'react'
import { X, Printer, FileText } from 'lucide-react'
import type { ExecutionRecord } from '@/types'
import { STATUS_LABELS, STATUS_BADGE_CLASS } from '@/types'

interface ReportModalProps {
  records:       ExecutionRecord[]
  projectName:   string
  totalElements: number
  onClose:       () => void
}

export default function ReportModal({ records, projectName, totalElements, onClose }: ReportModalProps) {
  const printRef = useRef<HTMLDivElement>(null)

  const registered  = records.length
  const total       = totalElements > 0 ? totalElements : registered
  const completed   = records.filter((r) => r.status === 'COMPLETED').length
  const inProgress  = records.filter((r) => r.status === 'IN_PROGRESS').length
  const issues      = records.filter((r) => r.status === 'ISSUE').length
  const notStarted  = records.filter((r) => r.status === 'NOT_STARTED').length
  const untouched   = Math.max(0, total - registered)
  const pct         = total > 0 ? Math.round((completed / total) * 100) : 0

  const byLevel = records.reduce<Record<string, ExecutionRecord[]>>((acc, r) => {
    const lv = r.level || 'Sem Pavimento'
    ;(acc[lv] ??= []).push(r)
    return acc
  }, {})

  function handlePrint() {
    const content = printRef.current?.innerHTML
    if (!content) return
    const win = window.open('', '_blank')!
    win.document.write(`
      <html><head>
        <title>Relatório BIM — ${projectName}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #111; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          .meta { color: #666; font-size: 11px; margin-bottom: 16px; }
          .summary { display: flex; gap: 16px; margin-bottom: 20px; }
          .stat { background: #f5f5f5; border-radius: 6px; padding: 10px 16px; text-align: center; }
          .stat .val { font-size: 22px; font-weight: bold; }
          .stat .lbl { font-size: 10px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th { background: #1e293b; color: white; text-align: left; padding: 6px 8px; font-size: 11px; }
          td { border-bottom: 1px solid #e5e7eb; padding: 5px 8px; font-size: 11px; }
          tr:nth-child(even) td { background: #f9fafb; }
          .badge { display:inline-block; padding: 2px 6px; border-radius: 9px; font-size: 10px; font-weight: 600; }
          .NOT_STARTED { background:#fef08a; color:#854d0e; }
          .IN_PROGRESS  { background:#fed7aa; color:#9a3412; }
          .COMPLETED    { background:#d1fae5; color:#065f46; }
          .ISSUE        { background:#fee2e2; color:#991b1b; }
          .level-title  { font-weight: bold; font-size: 13px; margin: 16px 0 4px; border-bottom: 2px solid #1e293b; }
          .img-row td   { padding: 4px 8px 8px; background: #f9fafb; }
          .img-row .img-label { font-size: 10px; color: #9ca3af; margin-bottom: 2px; }
          .img-row img  { height: 100px; border-radius: 4px; border: 1px solid #e5e7eb; object-fit: cover; }
          .img-group    { display: inline-flex; flex-direction: column; margin-right: 12px; }
          @media print { body { margin: 0; } }
        </style>
      </head><body>${content}</body></html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 300)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-gray-900 text-lg">Relatório de Progresso</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
            >
              <Printer className="w-4 h-4" /> Imprimir / PDF
            </button>
            <button onClick={onClose} className="p-2 rounded hover:bg-gray-100 text-gray-500">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          <div ref={printRef}>

            {/* Cabeçalho do relatório */}
            <h1 className="text-xl font-bold text-gray-900">
              Acompanhamento de Instalações Elétricas
            </h1>
            <p className="text-xs text-gray-500 mb-4">
              Emitido em {new Date().toLocaleString('pt-BR')} · {registered} registrados de {total} elementos
            </p>

            {/* Resumo */}
            <div className="grid grid-cols-6 gap-3 mb-6">
              {[
                { val: `${pct}%`,    lbl: 'Concluído',       cls: 'text-green-600'  },
                { val: completed,    lbl: 'Concluídos',       cls: 'text-green-600'  },
                { val: inProgress,   lbl: 'Em Execução',      cls: 'text-yellow-600' },
                { val: issues,       lbl: 'Problemas',        cls: 'text-red-600'    },
                { val: notStarted,   lbl: 'Não Iniciados',    cls: 'text-gray-600'   },
                { val: untouched,    lbl: 'Sem Registro',     cls: 'text-gray-400'   },
              ].map(({ val, lbl, cls }) => (
                <div key={lbl} className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                  <p className={`text-2xl font-bold ${cls}`}>{val}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{lbl}</p>
                </div>
              ))}
            </div>

            {/* Barra de progresso */}
            <div className="flex h-4 rounded-full overflow-hidden bg-gray-100 mb-6">
              {[
                { pct: total ? (completed  / total) * 100 : 0, color: 'bg-green-500'  },
                { pct: total ? (inProgress / total) * 100 : 0, color: 'bg-yellow-400' },
                { pct: total ? (issues     / total) * 100 : 0, color: 'bg-red-500'    },
                { pct: total ? (notStarted / total) * 100 : 0, color: 'bg-gray-300'   },
                { pct: total ? (untouched  / total) * 100 : 0, color: 'bg-gray-100'   },
              ].map(({ pct: p, color }) => (
                <div key={color} className={`${color} h-full`} style={{ width: `${p}%` }} />
              ))}
            </div>

            {/* Tabela por pavimento */}
            {Object.entries(byLevel).sort(([a], [b]) => a.localeCompare(b)).map(([level, recs]) => (
              <div key={level} className="mb-6">
                <p className="font-bold text-gray-800 text-sm border-b-2 border-gray-900 pb-1 mb-2">
                  {level} ({recs.length} elementos)
                </p>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="text-left p-2">Elemento</th>
                      <th className="text-left p-2">Tipo</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-right p-2">Qtd</th>
                      <th className="text-right p-2">Equipe</th>
                      <th className="text-right p-2">Horas</th>
                      <th className="text-right p-2">Produtividade</th>
                      <th className="text-left p-2">Observações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recs.map((r) => (
                      <>
                        <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="p-2 font-mono text-xs truncate max-w-[120px]" title={r.element_name}>
                            {r.element_name}
                          </td>
                          <td className="p-2">{r.element_type}</td>
                          <td className="p-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE_CLASS[r.status]}`}>
                              {STATUS_LABELS[r.status]}
                            </span>
                          </td>
                          <td className="p-2 text-right">{r.executed_quantity}</td>
                          <td className="p-2 text-right">{r.team_size}</td>
                          <td className="p-2 text-right">{r.worked_hours}h</td>
                          <td className="p-2 text-right">{r.productivity?.toFixed(3) ?? '—'}</td>
                          <td className="p-2 text-gray-500 italic text-xs">{r.notes || '—'}</td>
                        </tr>
                        {(r.element_screenshot || r.photo_url) && (
                          <tr key={`${r.id}-imgs`} className="border-b border-gray-100 bg-gray-50/50">
                            <td colSpan={8} className="p-2">
                              <div className="flex gap-3 flex-wrap">
                                {r.element_screenshot && (
                                  <div className="flex flex-col gap-1">
                                    <p className="text-xs text-gray-400 font-medium">Elemento 3D</p>
                                    <img src={r.element_screenshot} alt="elemento 3D"
                                      className="h-28 rounded border border-gray-200 object-cover" />
                                  </div>
                                )}
                                {r.photo_url && (
                                  <div className="flex flex-col gap-1">
                                    <p className="text-xs text-gray-400 font-medium">Foto do local</p>
                                    <img src={r.photo_url} alt="foto execução"
                                      className="h-28 rounded border border-gray-200 object-cover" />
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            {records.length === 0 && (
              <p className="text-center text-gray-400 py-12 text-sm">
                Nenhum elemento registrado ainda. Selecione elementos no modelo e registre o progresso.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
