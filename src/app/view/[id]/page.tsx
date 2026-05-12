'use client'

// Página kiosk pública: read-only, sem login, sem edição. Compartilhe a URL
// (com o UUID do projeto — funciona como token "guess-resistant") com cliente,
// fiscal ou stakeholder externo que só precisa acompanhar.
//
// Limitação local-first: o projeto + modelCache só existem no IndexedDB do
// dispositivo que o criou. Em multi-tenant real isso viraria leitura do Neon
// por token (ver task 12). Aqui o uso típico é "abre no mesmo dispositivo onde
// criei o projeto, mas em um perfil/aba sem login".

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Eye, AlertCircle } from 'lucide-react'
import ProgressSummary from '@/components/ui/ProgressSummary'
import { useExecution } from '@/hooks/useExecution'
import { getProject } from '@/lib/projects'
import { loadModelCache } from '@/lib/storage/modelCache'
import type { LoadedModel } from '@/types'
import type { useXeokit } from '@/hooks/useXeokit'

const BIMViewer = dynamic(() => import('@/components/viewer/BIMViewer'), { ssr: false })

export default function KioskViewPage() {
  const params       = useParams()
  const projectId    = params.id as string

  const [loadedModel, setLoadedModel] = useState<LoadedModel | null>(null)
  const [projectName, setProjectName] = useState('')
  const [notFound,    setNotFound]    = useState(false)
  const [elementCount, setElementCount] = useState(0)
  const viewerControlsRef = useRef<ReturnType<typeof useXeokit> | null>(null)

  const { allRecords, loadAllRecords } = useExecution(projectId)

  useEffect(() => {
    const project = getProject(projectId)
    if (!project) { setNotFound(true); return }
    setProjectName(project.name)
    loadAllRecords()
    loadModelCache(projectId).then((cached) => {
      if (!cached) setNotFound(true)
      else setLoadedModel(cached)
    })
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Em kiosk não fazemos nada quando um elemento é clicado (no-op)
  const noop = useCallback(() => {}, [])

  if (notFound) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="text-center text-neutral-400 max-w-md">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
          <h1 className="text-white font-bold text-lg mb-2">Projeto não disponível</h1>
          <p className="text-sm">
            Este link aponta para um projeto que não está carregado neste dispositivo.
            Peça ao responsável para enviar o arquivo .bim ou abrir o link no dispositivo correto.
          </p>
        </div>
      </div>
    )
  }

  if (!loadedModel) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-neutral-400">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Carregando…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2 bg-neutral-900 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Eye className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-sm leading-none">{projectName}</h1>
            <p className="text-neutral-400 text-xs mt-0.5">Visualização (somente leitura)</p>
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-wider font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded">
          KIOSK
        </span>
      </header>

      <div className="flex-shrink-0">
        <ProgressSummary records={allRecords} totalElements={elementCount} />
      </div>

      <div className="flex-1 overflow-hidden">
        <BIMViewer
          model={loadedModel}
          records={allRecords}
          filterStatus={'ALL'}
          onSelect={noop}
          onReady={(controls) => { viewerControlsRef.current = controls }}
          onElementCount={setElementCount}
        />
      </div>

      <footer className="flex-shrink-0 px-4 py-2 bg-neutral-800 text-xs text-neutral-400 border-t border-neutral-700 text-center">
        Modo somente leitura — interação limitada à navegação 3D.
      </footer>
    </div>
  )
}
