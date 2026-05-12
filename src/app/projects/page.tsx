'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Layers, FolderOpen, LogOut, ChevronRight, Plus, Trash2, X,
} from 'lucide-react'
import { getCurrentSession, logout } from '@/lib/auth'
import { getProjects, createProject, deleteProject } from '@/lib/projects'
import { deleteModelCache } from '@/lib/storage/modelCache'
import CloudMigrationBanner from '@/components/ui/CloudMigrationBanner'
import type { Project } from '@/types'

export default function ProjectsPage() {
  const router = useRouter()
  const [projects,    setProjects]    = useState<Project[]>([])
  const [session,     setSession]     = useState<{ username: string } | null>(null)
  const [showCreate,  setShowCreate]  = useState(false)
  const [newName,     setNewName]     = useState('')
  const [newDesc,     setNewDesc]     = useState('')

  useEffect(() => {
    const s = getCurrentSession()
    if (!s) { router.replace('/login'); return }
    setSession(s)
    setProjects(getProjects())
  }, [router])

  function handleLogout() {
    logout()
    router.replace('/login')
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    const p = createProject({ name: newName, description: newDesc })
    setProjects(getProjects())
    setShowCreate(false)
    setNewName(''); setNewDesc('')
    router.push(`/projects/${p.id}`)
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este projeto e todos os seus dados locais?')) return
    deleteProject(id)
    await deleteModelCache(id)
    setProjects(getProjects())
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-black">

      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 bg-black border-b border-neutral-800">
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

        <CloudMigrationBanner />

        {/* Título + ações */}
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <h2 className="text-white font-bold text-xl">Projetos</h2>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo projeto
          </button>
        </div>

        {/* Lista */}
        {projects.length === 0 ? (
          <div className="text-center py-16 text-neutral-500">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum projeto criado.</p>
            <p className="text-xs mt-1">Clique em <span className="text-neutral-300">Novo projeto</span> para começar.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {projects.map((p) => (
              <div
                key={p.id}
                className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center gap-4 hover:border-neutral-600 transition-colors group"
              >
                <button
                  onClick={() => router.push(`/projects/${p.id}`)}
                  className="flex items-center gap-4 flex-1 min-w-0 text-left"
                >
                  <div className="w-10 h-10 bg-blue-600/20 border border-blue-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Layers className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{p.name}</p>
                    {p.description && (
                      <p className="text-neutral-500 text-xs truncate mt-0.5">{p.description}</p>
                    )}
                    <p className="text-neutral-600 text-xs mt-1">Criado em {formatDate(p.createdAt)}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-500 group-hover:text-blue-400 flex-shrink-0" />
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  title="Excluir projeto"
                  aria-label={`Excluir projeto ${p.name}`}
                  className="p-2 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-900/30 transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal — criar projeto */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setShowCreate(false)}
        >
          <form
            onSubmit={handleCreate}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-base">Novo projeto</h3>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                aria-label="Fechar"
                className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-xs text-neutral-400">
                Nome
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Obra Centro 2024"
                  className="mt-1 w-full bg-neutral-800 text-white text-sm rounded-lg px-3 py-2 border border-neutral-700 focus:outline-none focus:border-blue-500"
                />
              </label>
              <label className="text-xs text-neutral-400">
                Descrição (opcional)
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Detalhes do projeto…"
                  rows={3}
                  className="mt-1 w-full bg-neutral-800 text-white text-sm rounded-lg px-3 py-2 border border-neutral-700 focus:outline-none focus:border-blue-500 resize-none"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-sm text-neutral-300 hover:text-white px-3 py-2"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!newName.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg"
              >
                Criar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
