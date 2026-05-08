'use client'

import { useEffect, useState } from 'react'
import { X, ZoomIn, Tag, Layers, Box, Hash, Ruler, CheckSquare, Square, CloudOff } from 'lucide-react'
import ProgressForm from './ProgressForm'
import CommentsTab from './CommentsTab'
import HistoryTab from './HistoryTab'
import type { IFCElement, ExecutionRecord, ExecutionFormData } from '@/types'
import { STATUS_LABELS, STATUS_BADGE_CLASS, CHECKLIST_LABELS, CHECKLIST_KEYS } from '@/types'

type Tab = 'info' | 'form' | 'comments' | 'history'

interface ElementPanelProps {
  element:      IFCElement | null
  record:       ExecutionRecord | null
  saving:       boolean
  pendingSync?: boolean   // true quando há alteração local não enviada ao Drive
  onClose:      () => void
  onZoomTo:     (globalId: string) => void
  onSave:       (form: ExecutionFormData) => Promise<void>
  projectId?:   string
}

export default function ElementPanel({ element, record, saving, pendingSync, onClose, onZoomTo, onSave, projectId }: ElementPanelProps) {
  const [tab, setTab] = useState<Tab>('info')

  useEffect(() => {
    setTab(record ? 'info' : 'form')
  }, [element?.globalId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!element) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-400 p-6 text-center">
        <Box className="w-12 h-12 opacity-40" />
        <p className="text-sm">Clique em um elemento no modelo para ver detalhes e registrar o progresso.</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-gray-200">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Elemento Selecionado</p>
            {/* Badge de estado de sync — Salvo localmente / Pendente de sincronizar */}
            {record && (
              pendingSync ? (
                <span title="Há alterações que ainda não foram enviadas ao Drive"
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                  <CloudOff className="w-3 h-3" /> Pendente sync
                </span>
              ) : (
                <span title="Salvo localmente (e sincronizado com Drive, se configurado)"
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                  ✓ Salvo
                </span>
              )
            )}
          </div>
          <h2 className="font-bold text-gray-900 text-base leading-tight truncate" title={element.name}>
            {element.name}
          </h2>
        </div>
        <div className="flex items-center gap-1 ml-2 mt-0.5">
          <button onClick={() => onZoomTo(element.globalId)} title="Zoom no elemento"
            aria-label="Dar zoom no elemento selecionado"
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={onClose} title="Fechar painel"
            aria-label="Fechar painel do elemento"
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {([
          { id: 'info',     label: 'Info'      },
          { id: 'form',     label: 'Registrar' },
          { id: 'comments', label: 'Coment.'   },
          { id: 'history',  label: 'Histórico' },
        ] as const).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 min-w-[80px] py-2.5 text-sm font-medium transition-colors
              ${tab === t.id ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'comments' && projectId ? (
          <CommentsTab projectId={projectId} globalId={element.globalId} />
        ) : tab === 'history' && projectId ? (
          <HistoryTab projectId={projectId} globalId={element.globalId} />
        ) : tab === 'info' ? (
          <div className="p-4 flex flex-col gap-3">
            {[
              { icon: <Hash className="w-3.5 h-3.5" />,   label: 'GlobalId',   value: element.globalId },
              { icon: <Tag className="w-3.5 h-3.5" />,    label: 'Tipo',       value: element.type     },
              { icon: <Layers className="w-3.5 h-3.5" />, label: 'Pavimento',  value: element.level    },
            ].map(({ icon, label, value }) => (
              <div key={label} className="flex items-start gap-2">
                <span className="mt-0.5 text-gray-400">{icon}</span>
                <div>
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="text-sm font-mono text-gray-800 break-all">{value}</p>
                </div>
              </div>
            ))}

            {/* Comprimento IFC */}
            {element.length !== undefined && element.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-amber-500"><Ruler className="w-3.5 h-3.5" /></span>
                <div>
                  <p className="text-xs text-gray-400">Comprimento IFC</p>
                  <p className="text-sm font-mono font-semibold text-amber-700">{element.length.toFixed(3)} m</p>
                </div>
              </div>
            )}

            {/* Propriedades IFC extras */}
            {element.properties && Object.keys(element.properties).length > 0 && (
              <details className="mt-1">
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                  Ver propriedades IFC ({Object.keys(element.properties).length})
                </summary>
                <div className="mt-2 max-h-40 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
                  {Object.entries(element.properties).map(([k, v]) => (
                    <div key={k} className="flex gap-2 px-2 py-1">
                      <span className="text-xs text-gray-400 flex-shrink-0 w-32 truncate">{k}</span>
                      <span className="text-xs text-gray-700 font-mono">{v}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {record ? (
              <div className="mt-2 border-t border-gray-100 pt-3 flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Registro de Execução
                </p>
                <span className={`inline-flex self-start px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE_CLASS[record.status]}`}>
                  {STATUS_LABELS[record.status]}
                </span>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Stat label="Executado (m)" value={record.executed_quantity} />
                  <Stat label="Equipe"        value={record.team_size}         />
                  <Stat label="Horas"         value={record.worked_hours}      />
                  <Stat label="m/Hh"          value={record.productivity?.toFixed(3) ?? '—'} />
                </div>
                {record.checklist && Object.values(record.checklist).some(Boolean) && (
                  <div className="mt-1">
                    <p className="text-xs font-semibold text-gray-400 mb-1">Checklist</p>
                    <div className="grid grid-cols-2 gap-1">
                      {CHECKLIST_KEYS.map((k) => {
                        const checked = !!record.checklist?.[k]
                        return (
                          <div key={k} className={`flex items-center gap-1.5 text-xs ${checked ? 'text-green-700' : 'text-gray-400'}`}>
                            {checked
                              ? <CheckSquare className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                              : <Square className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />}
                            <span>{CHECKLIST_LABELS[k]}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {record.daily_log && record.daily_log.length > 0 && (
                  <div className="mt-1">
                    <p className="text-xs font-semibold text-gray-400 mb-1">Progresso diário</p>
                    <div className="space-y-0.5">
                      {record.daily_log.map((e) => (
                        <div key={e.id} className="text-xs text-gray-600 flex justify-between">
                          <span>{e.date}</span>
                          <span className="font-semibold text-yellow-700">{e.meters.toFixed(2)} m</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {record.notes && (
                  <p className="text-xs text-gray-600 bg-gray-50 rounded p-2 italic">{record.notes}</p>
                )}
                {record.photo_url && (
                  <img src={record.photo_url} alt="foto da execução"
                    className="rounded-lg w-full object-cover max-h-48" />
                )}
                <button onClick={() => setTab('form')}
                  className="mt-1 text-sm text-blue-600 hover:underline self-start">
                  Editar →
                </button>
              </div>
            ) : (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-500 text-center">
                Nenhum registro ainda.{' '}
                <button onClick={() => setTab('form')} className="text-blue-600 hover:underline">
                  Adicionar
                </button>
              </div>
            )}
          </div>
        ) : (
          <ProgressForm
            initial={record}
            onSave={onSave}
            saving={saving}
            projectId={projectId}
            globalId={element.globalId}
            elementLength={element.length}
          />
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-semibold text-gray-800">{value}</p>
    </div>
  )
}
