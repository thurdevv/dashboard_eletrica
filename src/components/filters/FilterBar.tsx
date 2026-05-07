'use client'

import type { FilterState, ExecutionStatus } from '@/types'
import { STATUS_LABELS } from '@/types'

interface FilterBarProps {
  filters:      FilterState
  levels:       string[]
  elementTypes: string[]
  onChange:     (f: FilterState) => void
}

const STATUSES: Array<ExecutionStatus | 'ALL'> = ['ALL', 'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ISSUE']

const STATUS_DOT: Record<string, string> = {
  ALL:         'bg-gray-400',
  NOT_STARTED: 'bg-yellow-400',
  IN_PROGRESS:  'bg-orange-500',
  COMPLETED:    'bg-green-500',
  ISSUE:        'bg-red-500',
}

const STATUS_LABEL_ALL = 'Todos'

export default function FilterBar({ filters, levels, elementTypes, onChange }: FilterBarProps) {
  function set(patch: Partial<FilterState>) { onChange({ ...filters, ...patch }) }

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-200 text-sm">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-400 mr-1">Status:</span>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => set({ status: s })}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all
              ${filters.status === s
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>
            <span className={`w-2 h-2 rounded-full ${STATUS_DOT[s]}`} />
            {s === 'ALL' ? STATUS_LABEL_ALL : STATUS_LABELS[s as ExecutionStatus]}
          </button>
        ))}
      </div>

      {levels.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">Pavimento:</span>
          <select value={filters.level} onChange={(e) => set({ level: e.target.value })}
            className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="">Todos</option>
            {levels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      )}

      {elementTypes.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">Tipo:</span>
          <select value={filters.elementType} onChange={(e) => set({ elementType: e.target.value })}
            className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="">Todos</option>
            {elementTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      )}

      <button onClick={() => onChange({ status: 'ALL', level: '', elementType: '' })}
        className="ml-auto text-xs text-gray-400 hover:text-gray-700 underline">
        Limpar filtros
      </button>
    </div>
  )
}
