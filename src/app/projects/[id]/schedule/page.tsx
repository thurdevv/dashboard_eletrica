'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, CalendarDays } from 'lucide-react'
import { getScheduledTasks, addScheduledTask, deleteScheduledTask, updateScheduledTask } from '@/lib/storage/extras'
import { getProject } from '@/lib/projects'
import { STATUS_LABELS, STATUS_BADGE_CLASS } from '@/types'
import type { ScheduledTask, ExecutionStatus } from '@/types'

export default function SchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const [tasks,       setTasks]       = useState<ScheduledTask[]>([])
  const [projectName, setProjectName] = useState('')
  const [showForm,    setShowForm]    = useState(false)

  const [title,        setTitle]        = useState('')
  const [description,  setDescription]  = useState('')
  const [level,        setLevel]        = useState('')
  const [elementType,  setElementType]  = useState('')
  const [plannedStart, setPlannedStart] = useState('')
  const [plannedEnd,   setPlannedEnd]   = useState('')

  useEffect(() => {
    const p = getProject(projectId)
    if (p) setProjectName(p.name)
    setTasks(getScheduledTasks(projectId))
  }, [projectId])

  function refresh() { setTasks(getScheduledTasks(projectId)) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !plannedStart || !plannedEnd) return
    addScheduledTask(projectId, {
      title:       title.trim(),
      description: description.trim(),
      level:       level || undefined,
      elementType: elementType || undefined,
      plannedStart, plannedEnd,
    })
    setTitle(''); setDescription(''); setLevel(''); setElementType('')
    setPlannedStart(''); setPlannedEnd('')
    setShowForm(false)
    refresh()
  }

  function handleStatusChange(t: ScheduledTask, status: ExecutionStatus) {
    updateScheduledTask(projectId, t.id, { status })
    refresh()
  }

  function handleDelete(id: string) {
    if (!confirm('Apagar esta tarefa?')) return
    deleteScheduledTask(projectId, id)
    refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link href={`/projects/${projectId}`} aria-label="Voltar"
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-bold text-gray-900 text-lg flex-1">
          Cronograma — <span className="text-blue-600">{projectName}</span>
        </h1>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-1.5 rounded-lg">
          <Plus className="w-4 h-4" /> Nova tarefa
        </button>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-3">
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Título</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Descrição</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 block mb-0.5">Pavimento (opcional)</label>
                <input value={level} onChange={(e) => setLevel(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-0.5">Tipo IFC (opcional)</label>
                <input value={elementType} onChange={(e) => setElementType(e.target.value)}
                  placeholder="ex: IfcCableCarrierSegment"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-0.5">Início Plan.</label>
                <input type="date" value={plannedStart} onChange={(e) => setPlannedStart(e.target.value)} required
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-0.5">Fim Plan.</label>
                <input type="date" value={plannedEnd} onChange={(e) => setPlannedEnd(e.target.value)} required
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 rounded">
                Salvar
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold py-2 rounded">
                Cancelar
              </button>
            </div>
          </form>
        )}

        {tasks.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <CalendarDays className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">Nenhuma tarefa programada ainda.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Tarefa</th>
                  <th className="text-left px-3 py-2 hidden md:table-cell">Filtro</th>
                  <th className="text-left px-3 py-2">Início</th>
                  <th className="text-left px-3 py-2">Fim</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      <p className="font-semibold text-gray-900 text-sm">{t.title}</p>
                      {t.description && <p className="text-xs text-gray-500">{t.description}</p>}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 hidden md:table-cell">
                      {[t.level, t.elementType].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-3 py-2 text-xs">{t.plannedStart}</td>
                    <td className="px-3 py-2 text-xs">{t.plannedEnd}</td>
                    <td className="px-3 py-2">
                      <select value={t.status} onChange={(e) => handleStatusChange(t, e.target.value as ExecutionStatus)}
                        className={`text-xs font-semibold px-2 py-1 rounded border-0 ${STATUS_BADGE_CLASS[t.status]}`}>
                        {(['NOT_STARTED','IN_PROGRESS','COMPLETED','ISSUE'] as const).map((s) =>
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        )}
                      </select>
                    </td>
                    <td className="px-2">
                      <button onClick={() => handleDelete(t.id)}
                        aria-label="Apagar tarefa"
                        className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
