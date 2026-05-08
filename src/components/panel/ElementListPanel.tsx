'use client'

import { useMemo, useState } from 'react'
import { X, ListFilter, ChevronRight, AlertCircle, Clock } from 'lucide-react'
import type { ExecutionRecord, FilterState, ExecutionStatus } from '@/types'
import { STATUS_BADGE_CLASS, STATUS_LABELS } from '@/types'

type QuickFilter = 'all' | 'pending' | 'issues' | 'in_progress' | 'completed'

interface ElementListPanelProps {
  records:      ExecutionRecord[]   // já filtrados por filters do projeto
  allRecords:   ExecutionRecord[]   // sem filtro — usado pra "próximo pendente"
  levels:       string[]
  elementTypes: string[]
  filters:      FilterState
  onFiltersChange: (f: FilterState) => void
  onZoomTo:     (globalId: string) => void
  onClose:      () => void
}

// Tradução do quick filter pra status do FilterState (compatibilidade)
function quickToStatus(q: QuickFilter): ExecutionStatus | 'ALL' {
  switch (q) {
    case 'issues':       return 'ISSUE'
    case 'in_progress':  return 'IN_PROGRESS'
    case 'completed':    return 'COMPLETED'
    case 'pending':
    case 'all':
    default:             return 'ALL'
  }
}

export default function ElementListPanel({
  records, allRecords, levels, elementTypes, filters, onFiltersChange, onZoomTo, onClose,
}: ElementListPanelProps) {
  const [quick, setQuick] = useState<QuickFilter>('all')

  // "Pendente" = não está concluído (NOT_STARTED, IN_PROGRESS ou ISSUE).
  // O quick filter "pending" filtra localmente; os outros usam o status base.
  const visible = useMemo(() => {
    if (quick === 'pending') {
      return records.filter((r) => r.status !== 'COMPLETED')
    }
    return records
  }, [records, quick])

  function applyQuick(q: QuickFilter) {
    setQuick(q)
    onFiltersChange({ ...filters, status: quickToStatus(q) })
  }

  function nextPending() {
    // Procura primeiro o próximo da lista visível, senão pega o primeiro
    // pendente em allRecords. Pendente = status diferente de COMPLETED.
    const candidates = (visible.length > 0 ? visible : allRecords)
      .filter((r) => r.status !== 'COMPLETED')
    const target = candidates[0]
    if (target?.ifc_global_id) onZoomTo(target.ifc_global_id)
  }

  return (
    <div className="h-full flex flex-col bg-white">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <ListFilter className="w-4 h-4 text-gray-500" />
          <h2 className="font-bold text-gray-900 text-sm">Elementos filtrados</h2>
          <span className="text-xs text-gray-400">({visible.length})</span>
        </div>
        <button onClick={onClose} aria-label="Fechar lista de elementos"
          className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick filters */}
      <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-gray-100 bg-gray-50">
        {([
          { id: 'all',         label: 'Todos'        },
          { id: 'pending',     label: 'Pendentes'    },
          { id: 'in_progress', label: 'Em execução'  },
          { id: 'issues',      label: 'Problemas'    },
          { id: 'completed',   label: 'Concluídos'   },
        ] as const).map((q) => (
          <button key={q.id} onClick={() => applyQuick(q.id)}
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors
              ${quick === q.id
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>
            {q.label}
          </button>
        ))}
      </div>

      {/* Filtros secundários (level / type) */}
      {(levels.length > 0 || elementTypes.length > 0) && (
        <div className="flex flex-wrap gap-2 px-3 py-2 border-b border-gray-100 bg-white text-xs">
          {levels.length > 0 && (
            <select value={filters.level}
              onChange={(e) => onFiltersChange({ ...filters, level: e.target.value })}
              className="border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="">Pavimento: todos</option>
              {levels.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          )}
          {elementTypes.length > 0 && (
            <select value={filters.elementType}
              onChange={(e) => onFiltersChange({ ...filters, elementType: e.target.value })}
              className="border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="">Tipo: todos</option>
              {elementTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>
      )}

      {/* Atalho: próximo pendente */}
      <button onClick={nextPending}
        className="flex items-center justify-between gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-sm font-semibold border-b border-amber-100 transition-colors">
        <span className="flex items-center gap-2">
          <Clock className="w-4 h-4" /> Próximo pendente
        </span>
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-400 italic">
            Nenhum elemento corresponde aos filtros atuais.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {visible.map((r) => (
              <li key={r.ifc_global_id}>
                <button onClick={() => r.ifc_global_id && onZoomTo(r.ifc_global_id)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {r.element_name || '(sem nome)'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_BADGE_CLASS[r.status]}`}>
                        {STATUS_LABELS[r.status]}
                      </span>
                      {r.level && <span className="text-[11px] text-gray-400">· {r.level}</span>}
                      {r.element_type && <span className="text-[11px] text-gray-400 truncate">· {r.element_type}</span>}
                      {r.status === 'ISSUE' && <AlertCircle className="w-3 h-3 text-red-500" />}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
