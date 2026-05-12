'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { X, ListFilter, ChevronRight, AlertCircle, Clock, CheckSquare, Square, Loader2 } from 'lucide-react'
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
  onBulkStatus?: (globalIds: string[], status: ExecutionStatus) => Promise<number>
  saving?:      boolean
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
  onBulkStatus, saving,
}: ElementListPanelProps) {
  const [quick, setQuick] = useState<QuickFilter>('all')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [focusIdx, setFocusIdx] = useState<number>(-1)   // índice do elemento focado por teclado
  const itemsRef = useRef<HTMLLIElement[]>([])

  // "Pendente" = não está concluído (NOT_STARTED, IN_PROGRESS ou ISSUE).
  // O quick filter "pending" filtra localmente; os outros usam o status base.
  const visible = useMemo(() => {
    if (quick === 'pending') {
      return records.filter((r) => r.status !== 'COMPLETED')
    }
    return records
  }, [records, quick])

  // Reset seleção quando troca de filtro (evita aplicar bulk em itens fora do contexto)
  useEffect(() => { setSelected(new Set()) }, [records, quick])

  // Atalhos ←/→ navegam pelo elemento focado; Enter dá zoom; Space alterna seleção.
  // Só ativa quando NÃO há input focado (mesma regra do BIMViewer).
  useEffect(() => {
    function isTyping(target: EventTarget | null): boolean {
      const el = target as HTMLElement | null
      if (!el) return false
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
    }
    function handler(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (isTyping(e.target)) return
      if (visible.length === 0) return
      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowRight': {
          e.preventDefault()
          setFocusIdx((i) => {
            const next = Math.min(visible.length - 1, i < 0 ? 0 : i + 1)
            itemsRef.current[next]?.scrollIntoView({ block: 'nearest' })
            const id = visible[next]?.ifc_global_id
            if (id) onZoomTo(id)
            return next
          })
          break
        }
        case 'ArrowUp':
        case 'ArrowLeft': {
          e.preventDefault()
          setFocusIdx((i) => {
            const next = Math.max(0, i < 0 ? 0 : i - 1)
            itemsRef.current[next]?.scrollIntoView({ block: 'nearest' })
            const id = visible[next]?.ifc_global_id
            if (id) onZoomTo(id)
            return next
          })
          break
        }
        case ' ': {
          if (!selectMode || focusIdx < 0) return
          e.preventDefault()
          const id = visible[focusIdx]?.ifc_global_id
          if (id) toggleOne(id)
          break
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [visible, focusIdx, selectMode, onZoomTo]) // eslint-disable-line react-hooks/exhaustive-deps

  function applyQuick(q: QuickFilter) {
    setQuick(q)
    onFiltersChange({ ...filters, status: quickToStatus(q) })
  }

  function nextPending() {
    const candidates = (visible.length > 0 ? visible : allRecords)
      .filter((r) => r.status !== 'COMPLETED')
    const target = candidates[0]
    if (target?.ifc_global_id) onZoomTo(target.ifc_global_id)
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === visible.length) setSelected(new Set())
    else setSelected(new Set(visible.map((r) => r.ifc_global_id)))
  }

  async function handleBulkApply(status: ExecutionStatus) {
    if (!onBulkStatus || selected.size === 0) return
    if (!confirm(`Aplicar status "${STATUS_LABELS[status]}" em ${selected.size} elemento(s)?`)) return
    const n = await onBulkStatus(Array.from(selected), status)
    setSelected(new Set())
    alert(`✓ ${n} elemento(s) atualizado(s).`)
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
        <div className="flex items-center gap-1">
          {onBulkStatus && (
            <button onClick={() => { setSelectMode((v) => !v); setSelected(new Set()) }}
              aria-pressed={selectMode}
              className={`text-[11px] font-semibold px-2 py-1 rounded transition-colors
                ${selectMode ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
              {selectMode ? 'Cancelar' : 'Selecionar'}
            </button>
          )}
          <button onClick={onClose} aria-label="Fechar lista de elementos"
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>
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

      {/* Barra de ações em massa */}
      {selectMode && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border-b border-blue-200">
          <button onClick={toggleAll}
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1">
            {selected.size === visible.length && visible.length > 0
              ? <><CheckSquare className="w-3.5 h-3.5" /> Limpar</>
              : <><Square className="w-3.5 h-3.5" /> Todos</>}
          </button>
          <span className="text-xs text-blue-700 flex-shrink-0">
            {selected.size} selecionado(s)
          </span>
          <div className="flex-1" />
          {(['NOT_STARTED','IN_PROGRESS','COMPLETED','ISSUE'] as const).map((s) => (
            <button key={s} onClick={() => handleBulkApply(s)}
              disabled={selected.size === 0 || saving}
              title={`Marcar selecionados como ${STATUS_LABELS[s]}`}
              className={`text-[10px] font-semibold px-2 py-1 rounded border disabled:opacity-40 ${STATUS_BADGE_CLASS[s]}`}>
              {STATUS_LABELS[s]}
            </button>
          ))}
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />}
        </div>
      )}

      {/* Atalho: próximo pendente */}
      {!selectMode && (
        <button onClick={nextPending}
          className="flex items-center justify-between gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-sm font-semibold border-b border-amber-100 transition-colors">
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4" /> Próximo pendente
          </span>
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-400 italic">
            Nenhum elemento corresponde aos filtros atuais.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {visible.map((r, i) => {
              const isSelected = selected.has(r.ifc_global_id)
              const isFocused  = focusIdx === i
              return (
                <li
                  key={r.ifc_global_id}
                  ref={(el) => { if (el) itemsRef.current[i] = el }}
                  className={isFocused ? 'bg-blue-50/50' : ''}
                >
                  <div className="w-full flex items-center gap-2 px-2 py-2.5 hover:bg-gray-50">
                    {selectMode && (
                      <button
                        onClick={() => toggleOne(r.ifc_global_id)}
                        aria-pressed={isSelected}
                        aria-label={isSelected ? 'Desmarcar' : 'Selecionar'}
                        className="p-1 flex-shrink-0"
                      >
                        {isSelected
                          ? <CheckSquare className="w-4 h-4 text-blue-600" />
                          : <Square className="w-4 h-4 text-gray-300" />}
                      </button>
                    )}
                    <button
                      onClick={() => { setFocusIdx(i); r.ifc_global_id && onZoomTo(r.ifc_global_id) }}
                      className="flex-1 min-w-0 text-left"
                    >
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
                    </button>
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Rodapé de atalhos */}
      {!selectMode && visible.length > 0 && (
        <div className="border-t border-gray-100 px-3 py-1.5 text-[10px] text-gray-400 flex flex-wrap gap-x-3 gap-y-0.5">
          <span><kbd className="font-mono">↑↓←→</kbd> navegar</span>
          <span><kbd className="font-mono">Esc</kbd> fechar painel</span>
        </div>
      )}
    </div>
  )
}
