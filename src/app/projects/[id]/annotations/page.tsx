'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, MapPin, CheckCircle2, AlertCircle, Eye } from 'lucide-react'
import { getAnnotations, addAnnotation, deleteAnnotation, updateAnnotation } from '@/lib/storage/extras'
import { getCurrentSession } from '@/lib/auth'
import { getProject } from '@/lib/projects'
import type { Annotation3D } from '@/types'

const STATUS_LABEL: Record<Annotation3D['status'], string> = {
  OPEN:       'Aberto',
  IN_REVIEW:  'Em revisão',
  RESOLVED:   'Resolvido',
}

const STATUS_BADGE: Record<Annotation3D['status'], string> = {
  OPEN:      'bg-red-100 text-red-700',
  IN_REVIEW: 'bg-yellow-100 text-yellow-800',
  RESOLVED:  'bg-green-100 text-green-700',
}

export default function AnnotationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const [items, setItems] = useState<Annotation3D[]>([])
  const [projectName, setProjectName] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<'ALL' | Annotation3D['status']>('ALL')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [x, setX] = useState(0)
  const [y, setY] = useState(0)
  const [z, setZ] = useState(0)

  useEffect(() => {
    const p = getProject(projectId)
    if (p) setProjectName(p.name)
    setItems(getAnnotations(projectId))
  }, [projectId])

  function refresh() { setItems(getAnnotations(projectId)) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    addAnnotation(projectId, {
      title:       title.trim(),
      description: description.trim(),
      x, y, z,
      createdBy:   getCurrentSession()?.username ?? 'anônimo',
    })
    setTitle(''); setDescription(''); setX(0); setY(0); setZ(0)
    setShowForm(false)
    refresh()
  }

  function cycleStatus(a: Annotation3D) {
    const next: Annotation3D['status'] =
      a.status === 'OPEN'      ? 'IN_REVIEW'
      : a.status === 'IN_REVIEW' ? 'RESOLVED'
      : 'OPEN'
    updateAnnotation(projectId, a.id, { status: next })
    refresh()
  }

  function handleDelete(id: string) {
    if (!confirm('Apagar esta anotação?')) return
    deleteAnnotation(projectId, id)
    refresh()
  }

  const filtered = filter === 'ALL' ? items : items.filter((a) => a.status === filter)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link href={`/projects/${projectId}`} aria-label="Voltar"
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-bold text-gray-900 text-lg flex-1">
          Anotações 3D — <span className="text-blue-600">{projectName}</span>
        </h1>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-1.5 rounded-lg">
          <Plus className="w-4 h-4" /> Nova
        </button>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-3">
        <div className="flex gap-1.5">
          {(['ALL', 'OPEN', 'IN_REVIEW', 'RESOLVED'] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border
                ${filter === s ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'}`}>
              {s === 'ALL' ? 'Todas' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Título</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Descrição</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <NumInput label="X" value={x} onChange={setX} />
              <NumInput label="Y" value={y} onChange={setY} />
              <NumInput label="Z" value={z} onChange={setZ} />
            </div>
            <p className="text-xs text-gray-400 italic">
              Para fixar no modelo 3D, ainda é manual — informe XYZ. Em breve clicar no modelo preencherá automaticamente.
            </p>
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

        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <MapPin className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">Nenhuma anotação {filter !== 'ALL' && `com status "${STATUS_LABEL[filter as Annotation3D['status']]}"`}.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((a) => (
              <li key={a.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 text-sm truncate">{a.title}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${STATUS_BADGE[a.status]}`}>
                        {STATUS_LABEL[a.status]}
                      </span>
                    </div>
                    {a.description && <p className="text-sm text-gray-600 mb-2">{a.description}</p>}
                    <p className="text-xs text-gray-400 font-mono">
                      📍 ({a.x.toFixed(2)}, {a.y.toFixed(2)}, {a.z.toFixed(2)})
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      por {a.createdBy} · {new Date(a.createdAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => cycleStatus(a)}
                      title="Alterar status"
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                      {a.status === 'OPEN' ? <AlertCircle className="w-4 h-4" />
                        : a.status === 'IN_REVIEW' ? <Eye className="w-4 h-4" />
                        : <CheckCircle2 className="w-4 h-4 text-green-600" />}
                    </button>
                    <button onClick={() => handleDelete(a.id)}
                      aria-label="Apagar anotação"
                      className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function NumInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-xs text-gray-500 block mb-0.5">{label}</label>
      <input type="number" step="0.01" value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
    </div>
  )
}
