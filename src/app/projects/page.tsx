'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Layers, FolderOpen, LogOut, ChevronRight, Plus, Trash2, X, Copy, CloudOff, CheckCircle2, UploadCloud,
} from 'lucide-react'
import { getCurrentSession, logout } from '@/lib/auth'
import { getProjects, createProject, deleteProject, duplicateProject } from '@/lib/projects'
import { deleteModelCache, listCachedProjectIds, copyModelCache, saveModelCache } from '@/lib/storage/modelCache'
import { unzipSync } from 'fflate'
import { importProgressBundle } from '@/lib/api/execution'
import CloudMigrationBanner from '@/components/ui/CloudMigrationBanner'
import LocaleSwitcher from '@/components/LocaleSwitcher'
import ConnectionIndicator from '@/components/ConnectionIndicator'
import type { Project, LoadedModel } from '@/types'

export default function ProjectsPage() {
  const router = useRouter()
  const [projects,    setProjects]    = useState<Project[]>([])
  const [session,     setSession]     = useState<{ username: string } | null>(null)
  const [showCreate,  setShowCreate]  = useState(false)
  const [newName,     setNewName]     = useState('')
  const [newDesc,     setNewDesc]     = useState('')
  const [cachedIds,   setCachedIds]   = useState<Set<string>>(new Set())
  const [batchStatus, setBatchStatus] = useState<string | null>(null)
  const batchInputRef = useRef<HTMLInputElement>(null)

  async function refreshCachedIds() {
    setCachedIds(await listCachedProjectIds())
  }

  useEffect(() => {
    const s = getCurrentSession()
    if (!s) { router.replace('/login'); return }
    setSession(s)
    setProjects(getProjects())
    refreshCachedIds()
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
    refreshCachedIds()
  }

  async function handleDuplicate(p: Project) {
    const newName = prompt('Nome do novo projeto:', `${p.name} (cópia)`)
    if (newName === null) return
    const copy = duplicateProject(p.id, newName || undefined)
    if (!copy) return
    await copyModelCache(p.id, copy.id)
    setProjects(getProjects())
    refreshCachedIds()
  }

  async function processBatchFile(file: File): Promise<{ name: string; ok: boolean; err?: string }> {
    const lower = file.name.toLowerCase()
    if (!/\.(ifc|xkt|bim|zip)$/.test(lower)) {
      return { name: file.name, ok: false, err: 'Extensão não suportada' }
    }
    try {
      const buf = await file.arrayBuffer()
      let model: LoadedModel
      let progressData: string | undefined
      if (lower.endsWith('.bim') || lower.endsWith('.zip')) {
        const entries = unzipSync(new Uint8Array(buf))
        const ifcEntry      = Object.entries(entries).find(([n]) => n.toLowerCase().endsWith('.ifc'))
        const xktEntry      = Object.entries(entries).find(([n]) => n.toLowerCase().endsWith('.xkt'))
        const progressEntry = Object.entries(entries).find(([n]) => n.toLowerCase() === 'progresso.json')
        const jsonEntry     = Object.entries(entries).find(([n]) => {
          const l = n.toLowerCase()
          return l.endsWith('.json') && l !== 'progresso.json'
        })
        const modelEntry = xktEntry ?? ifcEntry
        if (!modelEntry) return { name: file.name, ok: false, err: 'ZIP sem modelo .ifc/.xkt' }
        const modelType = modelEntry === xktEntry ? 'xkt' : 'ifc'
        model = {
          type: modelType,
          url:  '',
          name: modelEntry[0].split('/').pop()!,
          data: modelEntry[1].buffer as ArrayBuffer,
          metaData: jsonEntry ? (jsonEntry[1].buffer as ArrayBuffer) : undefined,
        }
        progressData = progressEntry ? new TextDecoder().decode(progressEntry[1]) : undefined
      } else {
        model = { type: lower.endsWith('.ifc') ? 'ifc' : 'xkt', url: '', name: file.name, data: buf }
      }
      const base    = file.name.replace(/\.(ifc|xkt|bim|zip)$/i, '')
      const project = createProject({ name: base, description: `Importado em lote em ${new Date().toLocaleDateString('pt-BR')}` })
      await saveModelCache(project.id, model)
      if (progressData) importProgressBundle(project.id, progressData)
      return { name: file.name, ok: true }
    } catch (err: any) {
      return { name: file.name, ok: false, err: err?.message ?? 'Erro desconhecido' }
    }
  }

  async function handleBatchUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setBatchStatus(`Processando 0 / ${files.length}…`)
    const results: { name: string; ok: boolean; err?: string }[] = []
    for (let i = 0; i < files.length; i++) {
      setBatchStatus(`Processando ${i + 1} / ${files.length} — ${files[i].name}`)
      results.push(await processBatchFile(files[i]))
    }
    const okCount = results.filter(r => r.ok).length
    const errors  = results.filter(r => !r.ok)
    setBatchStatus(null)
    setProjects(getProjects())
    refreshCachedIds()
    const summary = `${okCount} projeto(s) criado(s).` + (errors.length > 0
      ? `\n\nFalhas:\n${errors.map(e => `• ${e.name}: ${e.err}`).join('\n')}`
      : '')
    alert(summary)
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
        <div className="flex items-center gap-3">
          <ConnectionIndicator />
          <LocaleSwitcher />
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 text-neutral-400 hover:text-white text-xs transition-colors">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-5">

        <CloudMigrationBanner />

        {/* Título + ações */}
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <h2 className="text-white font-bold text-xl">Projetos</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={batchInputRef}
              type="file"
              multiple
              accept=".ifc,.xkt,.bim,.zip"
              className="hidden"
              onChange={handleBatchUpload}
            />
            <button
              onClick={() => batchInputRef.current?.click()}
              title="Importar múltiplos arquivos como projetos"
              className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-semibold px-3 py-2 rounded-lg transition-colors border border-neutral-700"
            >
              <UploadCloud className="w-4 h-4" /> Upload em lote
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo projeto
            </button>
          </div>
        </div>

        {batchStatus && (
          <div className="mb-4 bg-blue-900/40 border border-blue-700 text-blue-200 text-xs rounded-lg px-3 py-2">
            {batchStatus}
          </div>
        )}

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
                    <div className="flex items-center gap-2">
                      <p className="text-white font-semibold text-sm truncate">{p.name}</p>
                      {cachedIds.has(p.id) ? (
                        <span title="Modelo carregado no dispositivo"
                          className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3" /> carregado
                        </span>
                      ) : (
                        <span title="Nenhum modelo BIM carregado neste dispositivo"
                          className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 bg-neutral-700/40 border border-neutral-600 px-1.5 py-0.5 rounded">
                          <CloudOff className="w-3 h-3" /> vazio
                        </span>
                      )}
                    </div>
                    {p.description && (
                      <p className="text-neutral-500 text-xs truncate mt-0.5">{p.description}</p>
                    )}
                    <p className="text-neutral-600 text-xs mt-1">Criado em {formatDate(p.createdAt)}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-500 group-hover:text-blue-400 flex-shrink-0" />
                </button>
                <button
                  onClick={() => handleDuplicate(p)}
                  title="Duplicar projeto"
                  aria-label={`Duplicar projeto ${p.name}`}
                  className="p-2 rounded-lg text-neutral-500 hover:text-blue-400 hover:bg-blue-900/20 transition-colors flex-shrink-0"
                >
                  <Copy className="w-4 h-4" />
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
