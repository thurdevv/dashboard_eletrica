'use client'

import { useEffect, useState } from 'react'
import { Clock, ArrowRight } from 'lucide-react'
import { getHistory } from '@/lib/storage/extras'
import { STATUS_LABELS } from '@/types'
import type { ExecutionHistoryEntry } from '@/types'

interface HistoryTabProps {
  projectId: string
  globalId:  string
}

const FIELD_LABELS: Record<string, string> = {
  status:            'Status',
  executed_quantity: 'Qtd. Executada',
  team_size:         'Equipe',
  worked_hours:      'Horas',
  notes:             'Observações',
}

function formatValue(field: string, value: unknown): string {
  if (value == null || value === '') return '—'
  if (field === 'status') return STATUS_LABELS[value as keyof typeof STATUS_LABELS] ?? String(value)
  return String(value)
}

export default function HistoryTab({ projectId, globalId }: HistoryTabProps) {
  const [entries, setEntries] = useState<ExecutionHistoryEntry[]>([])

  useEffect(() => {
    setEntries(getHistory(projectId, globalId).filter((e) => e.id))
  }, [projectId, globalId])

  if (entries.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-gray-400 italic">
        Nenhuma alteração registrada para este elemento ainda.
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      {entries.map((e) => {
        const changeKeys = e.changes ? Object.keys(e.changes) : []
        return (
          <div key={e.id} className="border-l-2 border-blue-300 pl-3 pb-2">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              <span>{new Date(e.changedAt).toLocaleString('pt-BR')}</span>
              <span className="font-semibold text-gray-700">· {e.changedBy}</span>
            </div>
            {changeKeys.length === 0 ? (
              <p className="text-xs text-gray-500 italic mt-0.5">Registro inicial.</p>
            ) : (
              <ul className="mt-1 space-y-0.5">
                {changeKeys.map((k) => (
                  <li key={k} className="text-xs text-gray-700 flex items-center gap-1.5">
                    <span className="font-medium text-gray-500">{FIELD_LABELS[k] ?? k}:</span>
                    <span className="text-gray-400 line-through">{formatValue(k, e.changes![k].from)}</span>
                    <ArrowRight className="w-3 h-3 text-gray-400" />
                    <span className="font-semibold text-gray-900">{formatValue(k, e.changes![k].to)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
