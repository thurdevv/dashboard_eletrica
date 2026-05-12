'use client'

import { useMemo } from 'react'
import type { ScheduledTask, ExecutionStatus } from '@/types'

interface GanttChartProps {
  tasks: ScheduledTask[]
}

const STATUS_COLOR: Record<ExecutionStatus, string> = {
  NOT_STARTED: '#facc15',
  IN_PROGRESS: '#fb923c',
  COMPLETED:   '#22c55e',
  ISSUE:       '#ef4444',
}

function parseDate(s: string): Date {
  // YYYY-MM-DD interpretado como local (evita off-by-one por timezone)
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (24 * 3600 * 1000))
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function GanttChart({ tasks }: GanttChartProps) {
  const data = useMemo(() => {
    const valid = tasks.filter((t) => t.plannedStart && t.plannedEnd)
    if (valid.length === 0) return null

    const starts = valid.map((t) => parseDate(t.plannedStart))
    const ends   = valid.map((t) => parseDate(t.plannedEnd))
    const min = new Date(Math.min(...starts.map(d => d.getTime())))
    const max = new Date(Math.max(...ends.map(d => d.getTime())))
    const totalDays = Math.max(1, daysBetween(min, max) + 1)

    return {
      tasks: valid.map((t) => {
        const start = parseDate(t.plannedStart)
        const end   = parseDate(t.plannedEnd)
        return {
          task:   t,
          offset: daysBetween(min, start),
          length: Math.max(1, daysBetween(start, end) + 1),
        }
      }),
      min, max, totalDays,
    }
  }, [tasks])

  if (!data) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
        <p className="text-sm text-gray-400">
          Sem tarefas com datas planejadas para exibir no Gantt.
        </p>
      </div>
    )
  }

  // Grid de semanas (cada coluna = 1 dia). Cabeçalho mostra dia em intervalos.
  const dayWidth = data.totalDays <= 21 ? 32 : data.totalDays <= 60 ? 18 : 8
  const totalWidth = data.totalDays * dayWidth
  const labelWidth = 220
  const rowHeight  = 36

  // Marca os domingos pra dar referência visual de semana
  const weekendCols: number[] = []
  for (let i = 0; i < data.totalDays; i++) {
    const d = new Date(data.min); d.setDate(d.getDate() + i)
    if (d.getDay() === 0 || d.getDay() === 6) weekendCols.push(i)
  }

  // Marca de "hoje" se cair dentro do range
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayOffset = today >= data.min && today <= data.max
    ? daysBetween(data.min, today)
    : null

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ width: labelWidth + totalWidth, minWidth: '100%' }}>

          {/* Header de datas */}
          <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
            <div style={{ width: labelWidth }} className="flex-shrink-0 px-3 py-2 text-xs font-semibold text-gray-500">
              Tarefa
            </div>
            <div className="relative" style={{ width: totalWidth, height: 32 }}>
              {/* Tick a cada 7 dias para legibilidade */}
              {Array.from({ length: Math.ceil(data.totalDays / 7) }).map((_, i) => {
                const offset = i * 7
                if (offset >= data.totalDays) return null
                const d = new Date(data.min); d.setDate(d.getDate() + offset)
                return (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 text-[10px] text-gray-500 border-l border-gray-200 pl-1"
                    style={{ left: offset * dayWidth, width: 7 * dayWidth }}
                  >
                    {formatDate(d)}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Linhas */}
          {data.tasks.map(({ task, offset, length }, i) => (
            <div key={task.id} className={`flex items-center ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
              <div
                style={{ width: labelWidth, height: rowHeight }}
                className="flex-shrink-0 px-3 py-1.5 flex flex-col justify-center border-r border-gray-200"
              >
                <p className="text-xs font-semibold text-gray-800 truncate" title={task.title}>
                  {task.title}
                </p>
                {(task.level || task.elementType) && (
                  <p className="text-[10px] text-gray-400 truncate">
                    {[task.level, task.elementType].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <div className="relative" style={{ width: totalWidth, height: rowHeight }}>
                {/* Faixas de fim de semana */}
                {weekendCols.map((c) => (
                  <div key={c} className="absolute top-0 bottom-0 bg-gray-100"
                    style={{ left: c * dayWidth, width: dayWidth }} />
                ))}
                {/* Linha do hoje */}
                {todayOffset !== null && (
                  <div className="absolute top-0 bottom-0 border-l-2 border-red-500/60"
                    style={{ left: todayOffset * dayWidth }} />
                )}
                {/* Barra da tarefa */}
                <div
                  className="absolute rounded shadow-sm text-[10px] font-semibold text-white flex items-center justify-center px-2 truncate"
                  style={{
                    left:   offset * dayWidth,
                    width:  length * dayWidth,
                    top:    8,
                    height: rowHeight - 16,
                    background: STATUS_COLOR[task.status],
                  }}
                  title={`${task.title}\n${task.plannedStart} → ${task.plannedEnd}`}
                >
                  {length * dayWidth > 40 ? `${length}d` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-4 px-3 py-2 border-t border-gray-100 bg-gray-50 text-[11px] text-gray-500">
        {(Object.keys(STATUS_COLOR) as ExecutionStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: STATUS_COLOR[s] }} />
            {s.replace('_', ' ').toLowerCase()}
          </span>
        ))}
        {todayOffset !== null && (
          <span className="flex items-center gap-1.5 ml-auto">
            <span className="w-0.5 h-3 bg-red-500/80" /> hoje
          </span>
        )}
      </div>
    </div>
  )
}
