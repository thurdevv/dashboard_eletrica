'use client'

import { useEffect, useState } from 'react'
import { Camera, X, RotateCcw, Trash2, Plus } from 'lucide-react'
import { listSnapshots, createSnapshot, deleteSnapshot, restoreSnapshot } from '@/lib/storage/snapshots'

interface SnapshotsModalProps {
  projectId: string
  onClose:   () => void
  onRestored?: () => void
}

interface Item {
  id: string
  name: string
  notes?: string
  createdAt: string
}

export default function SnapshotsModal({ projectId, onClose, onRestored }: SnapshotsModalProps) {
  const [items, setItems] = useState<Item[]>([])
  const [creating, setCreating] = useState(false)
  const [newName,  setNewName]  = useState('')
  const [newNotes, setNewNotes] = useState('')

  function refresh() { setItems(listSnapshots(projectId)) }

  useEffect(() => { refresh() }, [projectId])

  function handleCreate() {
    const defaultName = newName.trim() || `v${items.length + 1} — ${new Date().toLocaleDateString('pt-BR')}`
    createSnapshot(projectId, defaultName, newNotes || undefined)
    setNewName(''); setNewNotes(''); setCreating(false)
    refresh()
  }

  function handleRestore(id: string, name: string) {
    if (!confirm(`Restaurar snapshot "${name}"?\n\nIsso sobrescreve registros e logs atuais (history existente é preservado).`)) return
    const count = restoreSnapshot(projectId, id)
    alert(`✓ ${count} registros restaurados.`)
    onRestored?.()
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Excluir snapshot "${name}"?`)) return
    deleteSnapshot(projectId, id)
    refresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-gray-900 text-base">Snapshots de Progresso</h2>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="p-2 rounded hover:bg-gray-100 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {creating ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex flex-col gap-2">
              <p className="text-sm font-semibold text-blue-900">Novo snapshot</p>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`v${items.length + 1} — ${new Date().toLocaleDateString('pt-BR')}`}
                className="border border-blue-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Observações (opcional) — ex: fim do mês de maio"
                rows={2}
                className="border border-blue-300 rounded px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <div className="flex gap-2 mt-1">
                <button
                  onClick={handleCreate}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-1.5 rounded"
                >
                  Criar
                </button>
                <button
                  onClick={() => { setCreating(false); setNewName(''); setNewNotes('') }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold px-3 py-1.5 rounded"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="w-full mb-4 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg"
            >
              <Plus className="w-4 h-4" /> Criar snapshot do estado atual
            </button>
          )}

          {items.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">
              Nenhum snapshot criado ainda. Use o botão acima para criar o primeiro.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {items.map((s) => (
                <li key={s.id} className="py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{s.name}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(s.createdAt).toLocaleString('pt-BR')}
                    </p>
                    {s.notes && <p className="text-xs text-gray-600 italic mt-1">{s.notes}</p>}
                  </div>
                  <button
                    onClick={() => handleRestore(s.id, s.name)}
                    title="Restaurar este snapshot"
                    className="p-2 rounded text-blue-600 hover:bg-blue-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(s.id, s.name)}
                    title="Excluir snapshot"
                    className="p-2 rounded text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
