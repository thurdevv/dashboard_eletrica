'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Layers, Plus, Trash2, FolderOpen, LogOut, ChevronRight } from 'lucide-react'
import { getCurrentSession, logout } from '@/lib/auth'
import { getProjects, createProject, deleteProject } from '@/lib/projects'
import DriveProjectPicker from '@/components/ui/DriveProjectPicker'
import type { Project } from '@/types'

export default function ProjectsPage() {
  const router = useRouter()
  const [projects,    setProjects]    = useState<Project[]>([])
  const [session,     setSession]     = useState<{ username: string } | null>(null)
  const [showNew,     setShowNew]     = useState(false)
  const [newName,     setNewName]     = useState('')
  const [newDesc,     setNewDesc]     = useState('')
  const [confirmDel,  setConfirmDel]  = useState<string | null>(null)
  const [error,       setError]       = useState<string | null>(null)

  useEffect(() => {
    const s = getCurrentSession()
    if (!s) { router.replace('/login'); return }
    setSession(s)
    setProjects(getProjects())
  }, [router])

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) { setError('Nome obrigatório.'); return }
    const p = createProject(newName, newDesc)
    setProjects(getProjects())
    setShowNew(false)
    setNewName('')
    setNewDesc('')
    setError(null)
    router.push(`/projects/${p.id}`)
  }

  function handleDelete(id: string) {
    deleteProject(id)
    setProjects(getProjects())
    setConfirmDel(null)
  }

  function handleLogout() {
    logout()
    router.replace('/login')
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR')
  }

  return (
    <div className="min-h-screen bg-neutral-950">

      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 bg-neutral-900 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-sm leading-none">BIM Elétrico</h1>
            <p className="text-neutral-400 text-xs mt-0.5">Olá, {session?.username}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-1.5 text-neutral-400 hover:text-white text-xs transition-colors">
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </header>

      <main className="max-w-2xl mx-auto p-5">

        {/* Título + botões */}
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <h2 className="text-white font-bold text-xl">Meus Projetos</h2>
          <div className="flex items-center gap-2">
            <DriveProjectPicker
              onProjectRestored={(id) => {
                setProjects(getProjects())
                router.push(`/projects/${id}`)
              }}
            />
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" /> Novo Projeto
            </button>
          </div>
        </div>

        {/* Modal novo projeto */}
        {showNew && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-md">
              <h3 className="text-white font-bold text-lg mb-4">Novo Projeto</h3>
              <form onSubmit={handleCreate} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs text-neutral-400 font-medium block mb-1">Nome do projeto *</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ex: Obra Rua das Flores — Bloco A"
                    autoFocus
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 font-medium block mb-1">Descrição</label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    rows={2}
                    placeholder="Informações adicionais…"
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <div className="flex gap-3 mt-1">
                  <button type="button" onClick={() => { setShowNew(false); setError(null) }}
                    className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                    Cancelar
                  </button>
                  <button type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                    Criar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Lista de projetos */}
        {projects.length === 0 ? (
          <div className="text-center py-16 text-neutral-500">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum projeto ainda.</p>
            <p className="text-xs mt-1">Clique em "Novo Projeto" para começar.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {projects.map((p) => (
              <div key={p.id}
                className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center gap-4 hover:border-neutral-600 transition-colors group">

                <div className="w-10 h-10 bg-blue-600/20 border border-blue-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Layers className="w-5 h-5 text-blue-400" />
                </div>

                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => router.push(`/projects/${p.id}`)}>
                  <p className="text-white font-semibold text-sm truncate">{p.name}</p>
                  {p.description && (
                    <p className="text-neutral-500 text-xs truncate mt-0.5">{p.description}</p>
                  )}
                  <p className="text-neutral-600 text-xs mt-1">Criado em {formatDate(p.createdAt)}</p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => router.push(`/projects/${p.id}`)}
                    className="p-2 rounded-lg hover:bg-blue-600/20 text-neutral-400 hover:text-blue-400 transition-colors"
                    title="Abrir projeto"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setConfirmDel(p.id)}
                    className="p-2 rounded-lg hover:bg-red-600/20 text-neutral-600 hover:text-red-400 transition-colors"
                    title="Excluir projeto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Confirm delete */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-sm text-center">
            <p className="text-white font-semibold mb-2">Excluir projeto?</p>
            <p className="text-neutral-400 text-sm mb-5">
              Todos os registros de progresso serão apagados. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(null)}
                className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                Cancelar
              </button>
              <button onClick={() => handleDelete(confirmDel)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
