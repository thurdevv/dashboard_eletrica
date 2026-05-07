import type { ExecutionRecord } from '@/types'

interface ProgressSummaryProps {
  records:       ExecutionRecord[]
  totalElements: number
}

export default function ProgressSummary({ records, totalElements }: ProgressSummaryProps) {
  const registered   = records.length
  // Use model element count when available, otherwise fall back to registered count
  const total        = totalElements > 0 ? totalElements : registered
  const notStarted   = records.filter((r) => r.status === 'NOT_STARTED').length
  const inProgress   = records.filter((r) => r.status === 'IN_PROGRESS').length
  const completed    = records.filter((r) => r.status === 'COMPLETED').length
  const issues       = records.filter((r) => r.status === 'ISSUE').length
  // Elements not yet touched = total model elements minus any registered record
  const untouched    = Math.max(0, total - registered)

  const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0

  const bars = [
    { label: 'Concluído',      count: completed,  color: 'bg-green-500',  pct: total ? (completed  / total) * 100 : 0 },
    { label: 'Em Execução',    count: inProgress, color: 'bg-orange-500', pct: total ? (inProgress / total) * 100 : 0 },
    { label: 'Problema',       count: issues,     color: 'bg-red-500',    pct: total ? (issues     / total) * 100 : 0 },
    { label: 'Não Iniciado',   count: notStarted, color: 'bg-yellow-400', pct: total ? (notStarted / total) * 100 : 0 },
    { label: 'Sem Registro',   count: untouched,  color: 'bg-gray-100',   pct: total ? (untouched  / total) * 100 : 0 },
  ]

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center gap-4">
        <div className="text-center min-w-[4rem]">
          <p className="text-2xl font-bold text-green-600">{completionPct}%</p>
          <p className="text-xs text-gray-400">Concluído</p>
        </div>
        <div className="flex-1">
          <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
            {bars.map(({ label, color, pct }) => (
              <div key={label} title={`${label}: ${Math.round(pct)}%`}
                className={`${color} transition-all`} style={{ width: `${pct}%` }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
            {bars.filter(b => b.count > 0).map(({ label, count, color }) => (
              <div key={label} className="flex items-center gap-1 text-xs text-gray-500">
                <span className={`w-2 h-2 rounded-full ${color}`} />
                {label}: <strong>{count}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="text-right text-xs text-gray-400 ml-2 shrink-0">
          <p><strong className="text-gray-700">{registered}</strong> registrados</p>
          {totalElements > 0 && <p>de <strong className="text-gray-700">{total}</strong> elementos</p>}
        </div>
      </div>
    </div>
  )
}
