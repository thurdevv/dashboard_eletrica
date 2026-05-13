'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowLeft, LogOut, BarChart3, MapPin, Camera } from 'lucide-react'
import ModelUploader from '@/components/viewer/ModelUploader'
import ViewerControls from '@/components/viewer/ViewerControls'
import ElementPanel from '@/components/panel/ElementPanel'
import ElementListPanel from '@/components/panel/ElementListPanel'
import FilterBar from '@/components/filters/FilterBar'
import ProgressSummary from '@/components/ui/ProgressSummary'
import ReportModal from '@/components/ui/ReportModal'
import SnapshotsModal from '@/components/ui/SnapshotsModal'
import NotificationBell from '@/components/ui/NotificationBell'
import { showNotification, broadcast, onBroadcast } from '@/lib/notifications'
import { useExecution } from '@/hooks/useExecution'
import { getProjectLevels, getProjectElementTypes, exportProjectData, importProjectData, exportModelWithProgress, importProgressBundle } from '@/lib/api/execution'
import { getCurrentSession, logout } from '@/lib/auth'
import { getProject } from '@/lib/projects'
import { deleteModelCache, loadModelCache } from '@/lib/storage/modelCache'
import { getErrorContent } from '@/lib/errors'
import type { IFCElement, ExecutionFormData, FilterState, LoadedModel } from '@/types'
import type { useXeokit } from '@/hooks/useXeokit'

const BIMViewer = dynamic(() => import('@/components/viewer/BIMViewer'), { ssr: false })

export default function ProjectViewerPage() {
  const params       = useParams()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const projectId    = params.id as string
  const deepLinkGlobalId = searchParams.get('element')

  // Filtros são persistidos na query string para que links compartilhados restaurem
  // a visão (ex: ?status=ISSUE&level=Pav1). Mantém status='ALL' como sentinela.
  const initialFilters: FilterState = {
    status:      (searchParams.get('status') as FilterState['status']) || 'ALL',
    level:       searchParams.get('level')       ?? '',
    elementType: searchParams.get('elementType') ?? '',
  }

  const [loadedModel,       setLoadedModel]       = useState<LoadedModel | null>(null)
  const [selectedElement,   setSelectedElement]   = useState<IFCElement | null>(null)
  const [filters,           setFilters]           = useState<FilterState>(initialFilters)
  const [levels,            setLevels]            = useState<string[]>([])
  const [elementTypes,      setElementTypes]      = useState<string[]>([])
  const [showReport,        setShowReport]        = useState(false)
  const [showSnapshots,     setShowSnapshots]     = useState(false)
  const [modelElementCount, setModelElementCount] = useState(0)
  const [sheetOpen,         setSheetOpen]         = useState(false)
  const [projectName,       setProjectName]       = useState('')
  const [username,          setUsername]          = useState('')
  const [elementListOpen,   setElementListOpen]   = useState(false)

  const viewerControlsRef  = useRef<ReturnType<typeof useXeokit> | null>(null)
  const importInputRef     = useRef<HTMLInputElement>(null)
  const loadedModelRef     = useRef<LoadedModel | null>(null)

  const { records, allRecords, current, saving, loadAllRecords, loadElementRecord, saveRecord, setCurrent } =
    useExecution(projectId)

  useEffect(() => {
    const session = getCurrentSession()
    if (!session) { router.replace('/login'); return }
    setUsername(session.username)

    const project = getProject(projectId)
    setProjectName(project?.name ?? 'Projeto')

    loadAllRecords()
    Promise.all([getProjectLevels(projectId), getProjectElementTypes(projectId)])
      .then(([lvls, types]) => { setLevels(lvls); setElementTypes(types) })

    // Restaura modelo do cache local — assim voltar das abas (Dashboard/
    // Anotações/Cronograma) não cai na tela de seleção de novo.
    loadModelCache(projectId).then((cached) => {
      if (cached) {
        loadedModelRef.current = cached
        setLoadedModel(cached)
      }
    })
  }, [projectId, router]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadAllRecords(filters) }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sincroniza filtros → URL (preserva ?element=… do deep link)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams()
    if (filters.status && filters.status !== 'ALL') params.set('status',      filters.status)
    if (filters.level)                              params.set('level',       filters.level)
    if (filters.elementType)                        params.set('elementType', filters.elementType)
    if (deepLinkGlobalId)                           params.set('element',     deepLinkGlobalId)
    const qs = params.toString()
    const next = qs ? `?${qs}` : ''
    if (window.location.search !== next) {
      window.history.replaceState(null, '', `${window.location.pathname}${next}`)
    }
  }, [filters, deepLinkGlobalId])

  useEffect(() => {
    if (selectedElement) setSheetOpen(true)
  }, [selectedElement])

  // Deep-link via QR Code: ?element=<globalId> — espera o modelo carregar
  // (modelElementCount > 0 indica que buildGlobalIdMap rodou) e dispara a
  // seleção. selectByGlobalId já faz zoom + abre o ElementPanel via onSelect.
  useEffect(() => {
    if (!deepLinkGlobalId || modelElementCount === 0) return
    const t = setTimeout(() => {
      const found = viewerControlsRef.current?.selectByGlobalId(deepLinkGlobalId)
      if (!found) {
        // Não acha o elemento — provavelmente o QR é de outro modelo.
        // Limpa a query param sem disparar reload pra evitar loop.
        router.replace(`/projects/${projectId}`)
      }
    }, 300)   // pequeno delay pra dar tempo do colorizer aplicar
    return () => clearTimeout(t)
  }, [deepLinkGlobalId, modelElementCount, projectId, router])

  // Escuta problemas reportados em outras abas (BroadcastChannel) — exibe
  // notificação local e atualiza a lista. Só notifica se o problema é deste
  // projeto e veio de outra aba (a aba que originou já mostra feedback no form).
  useEffect(() => {
    const off = onBroadcast((msg) => {
      if (msg.type !== 'issue-reported' || msg.projectId !== projectId) return
      const r = msg.record
      showNotification({
        title: '⚠ Problema reportado',
        body:  `${r.element_name || 'Elemento'} · ${r.level || ''}\n${r.notes || ''}`.trim(),
        tag:   `issue-${r.ifc_global_id}`,
        url:   `/projects/${projectId}?element=${encodeURIComponent(r.ifc_global_id)}`,
        requireInteraction: true,
      })
      loadAllRecords(filters)
    })
    return off
  }, [projectId, filters]) // eslint-disable-line react-hooks/exhaustive-deps

  // Quando o modelo é carregado com progresso embutido (ZIP com progresso.json), restaura tudo
  const handleModelLoad = useCallback(async (model: LoadedModel) => {
    loadedModelRef.current = model
    if (model.progressData) {
      const count = importProgressBundle(projectId, model.progressData)
      await loadAllRecords(filters)
      Promise.all([getProjectLevels(projectId), getProjectElementTypes(projectId)])
        .then(([lvls, types]) => { setLevels(lvls); setElementTypes(types) })
      if (count > 0) {
        setTimeout(() => alert(`✓ ${count} registros de progresso restaurados do arquivo.`), 500)
      }
    }
    const cached = getProject(projectId)
    if (cached?.name) setProjectName(cached.name)
    setLoadedModel(model)
  }, [projectId, loadAllRecords, filters]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleExportWithProgress = useCallback(async () => {
    const model = loadedModelRef.current ?? loadedModel
    if (!model) return
    const blob     = await exportModelWithProgress(model, projectId)
    const baseName = model.name.replace(/\.(ifc|xkt)$/i, '')
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${baseName}.bim`
    a.click()
    URL.revokeObjectURL(url)
  }, [loadedModel, projectId])

  const handleElementSelect = useCallback(async (element: IFCElement) => {
    setSelectedElement(element)
    await loadElementRecord(element.globalId)
  }, [loadElementRecord])

  const handleSave = useCallback(async (form: ExecutionFormData) => {
    if (!selectedElement) return
    await saveRecord(selectedElement, form)
    await loadAllRecords(filters)
    Promise.all([getProjectLevels(projectId), getProjectElementTypes(projectId)])
      .then(([lvls, types]) => { setLevels(lvls); setElementTypes(types) })

    // Notifica outras abas/devices se um problema foi reportado.
    // Apenas quando o status mudou pra ISSUE (evita spam ao reeditar).
    const wasIssue = current?.status === 'ISSUE'
    if (form.status === 'ISSUE' && !wasIssue) {
      const record = {
        ...current,
        project_id:    projectId,
        ifc_global_id: selectedElement.globalId,
        element_name:  selectedElement.name,
        element_type:  selectedElement.type,
        level:         selectedElement.level,
        status:        form.status,
        executed_quantity: form.executed_quantity,
        team_size:     form.team_size,
        worked_hours:  form.worked_hours,
        notes:         form.notes,
        productivity:  0,
      }
      broadcast({ type: 'issue-reported', projectId, record: record as any })
    }
  }, [selectedElement, saveRecord, loadAllRecords, filters, projectId, current])

  const handleClose = useCallback(() => {
    setSheetOpen(false)
    setTimeout(() => { setSelectedElement(null); setCurrent(null) }, 300)
  }, [setCurrent])

  const handleExport = useCallback(() => {
    const json = exportProjectData(projectId)
    const blob = new Blob([json], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `progresso-bim-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [projectId])

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const count = importProjectData(projectId, ev.target?.result as string)
        loadAllRecords(filters)
        Promise.all([getProjectLevels(projectId), getProjectElementTypes(projectId)])
          .then(([lvls, types]) => { setLevels(lvls); setElementTypes(types) })
        alert(`✓ ${count} registros importados com sucesso!`)
      } catch {
        const c = getErrorContent('IMPORT_INVALID_JSON')
        alert(`${c.title}\n${c.description}`)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [filters, projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!loadedModel) {
    return <ModelUploader projectId={projectId} onModelLoad={handleModelLoad} />
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden font-sans">

      {/* Cabeçalho */}
      <header className="flex items-center justify-between px-3 md:px-5 py-2 md:py-3 bg-neutral-900 shadow z-10 flex-shrink-0">
        <div className="flex items-center gap-2 md:gap-3">
          <button onClick={() => router.push('/projects')} title="Voltar aos projetos"
            className="p-1.5 rounded-lg hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-neutral-700" />
          <div>
            <h1 className="text-white font-bold text-xs md:text-sm leading-none truncate max-w-[140px] md:max-w-xs">
              {projectName}
            </h1>
            <p className="text-neutral-400 text-xs mt-0.5 hidden md:block">Acompanhamento de Instalações</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 md:gap-2">
          <span className="text-xs text-neutral-400 mr-1 hidden md:inline">{records.length} registros</span>

          <input ref={importInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          <button onClick={() => importInputRef.current?.click()}
            className="flex items-center gap-1 bg-neutral-700 hover:bg-neutral-600 text-white text-xs font-semibold px-2 md:px-3 py-1.5 rounded-lg transition-colors">
            <span>📂</span><span className="hidden md:inline">Importar</span>
          </button>
          <button onClick={handleExport}
            className="flex items-center gap-1 bg-neutral-700 hover:bg-neutral-600 text-white text-xs font-semibold px-2 md:px-3 py-1.5 rounded-lg transition-colors">
            <span>💾</span><span className="hidden md:inline">Exportar</span>
          </button>
          <button onClick={() => setShowReport(true)}
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-2 md:px-3 py-1.5 rounded-lg transition-colors">
            <span>📄</span><span className="hidden md:inline">Relatório</span>
          </button>
          <button onClick={() => setShowSnapshots(true)}
            title="Snapshots de progresso"
            aria-label="Gerenciar snapshots de progresso"
            className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-2 md:px-3 py-1.5 rounded-lg transition-colors">
            <Camera className="w-4 h-4" /><span className="hidden md:inline">Snapshots</span>
          </button>
          <Link href={`/projects/${projectId}/dashboard`}
            aria-label="Abrir dashboard analítico"
            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-2 md:px-3 py-1.5 rounded-lg transition-colors">
            <BarChart3 className="w-4 h-4" /><span className="hidden md:inline">Dashboard</span>
          </Link>
          <Link href={`/projects/${projectId}/annotations`}
            aria-label="Abrir anotações"
            className="flex items-center gap-1 bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold px-2 md:px-3 py-1.5 rounded-lg transition-colors hidden md:flex">
            <MapPin className="w-4 h-4" /><span className="hidden md:inline">Anotações</span>
          </Link>

          <NotificationBell />

          <button onClick={() => { logout(); router.replace('/login') }} title={`Sair (${username})`}
            aria-label={`Sair da conta ${username}`}
            className="p-1.5 rounded-lg hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors hidden md:block">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Barra de progresso e filtros — ocultos no mobile */}
      <div className="hidden md:block flex-shrink-0">
        <ProgressSummary records={allRecords} totalElements={modelElementCount} />
      </div>
      <div className="hidden md:block flex-shrink-0">
        <FilterBar filters={filters} levels={levels} elementTypes={elementTypes} onChange={setFilters} />
      </div>

      {/* Layout principal */}
      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex flex-col w-full md:flex-1 overflow-hidden">
          <ViewerControls
            modelName={loadedModel.name}
            model={loadedModel}
            levels={levels}
            onSearch={(q) => viewerControlsRef.current?.searchElement(q)}
            onIsolateLevel={(l) => viewerControlsRef.current?.isolateLevel(l)}
            onResetCamera={() => viewerControlsRef.current?.resetCamera()}
            onChangeModel={async () => {
              await deleteModelCache(projectId)
              loadedModelRef.current = null
              setLoadedModel(null); setSelectedElement(null); setCurrent(null)
            }}
            onExportWithProgress={handleExportWithProgress}
            onToggleElementList={() => setElementListOpen((v) => !v)}
            elementListOpen={elementListOpen}
          />
          <div className="flex-1 overflow-hidden">
            <BIMViewer
              model={loadedModel}
              records={records}
              filterStatus={filters.status}
              onSelect={handleElementSelect}
              onReady={(controls) => { viewerControlsRef.current = controls }}
              onElementCount={setModelElementCount}
              onClosePanel={handleClose}
            />
          </div>
        </div>

        {/* Desktop: painel lateral de lista filtrada (#4) — fica entre viewer e ElementPanel */}
        {elementListOpen && (
          <aside className="hidden md:block w-72 flex-shrink-0 border-l border-gray-200 overflow-hidden">
            <ElementListPanel
              records={records}
              allRecords={allRecords}
              levels={levels}
              elementTypes={elementTypes}
              filters={filters}
              onFiltersChange={setFilters}
              onZoomTo={(id) => viewerControlsRef.current?.zoomTo(id)}
              onClose={() => setElementListOpen(false)}
            />
          </aside>
        )}

        {/* Desktop: painel lateral do elemento */}
        <aside className="hidden md:block w-80 flex-shrink-0 bg-white border-l border-gray-200 overflow-y-auto">
          <ElementPanel
            element={selectedElement}
            record={current}
            saving={saving}
            onClose={handleClose}
            onZoomTo={(id) => viewerControlsRef.current?.zoomTo(id)}
            onSave={handleSave}
            projectId={projectId}
          />
        </aside>
      </div>

      {/* Legenda — oculta no mobile */}
      <footer className="hidden md:flex items-center gap-4 px-4 py-1.5 bg-neutral-800 text-xs text-neutral-400 border-t border-neutral-700 flex-shrink-0">
        <span className="mr-1">Legenda:</span>
        {[
          { color: 'bg-yellow-400', label: 'Não Iniciado' },
          { color: 'bg-orange-500', label: 'Em Execução'  },
          { color: 'bg-green-500',  label: 'Concluído'    },
          { color: 'bg-red-500',    label: 'Problema'     },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-sm ${color}`} />
            {label}
          </span>
        ))}
      </footer>

      {/* Mobile: backdrop */}
      {selectedElement && (
        <div
          className={`md:hidden fixed inset-0 z-40 bg-black/40 transition-opacity duration-300
            ${sheetOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={handleClose}
        />
      )}

      {/* Mobile: bottom sheet */}
      {selectedElement && (
        <div
          className={`md:hidden fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl
            flex flex-col transition-transform duration-300 ease-out
            ${sheetOpen ? 'translate-y-0' : 'translate-y-full'}`}
          style={{ maxHeight: '78vh' }}
        >
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>
          <div className="flex-1 overflow-y-auto">
            <ElementPanel
              element={selectedElement}
              record={current}
              saving={saving}
              onClose={handleClose}
              onZoomTo={(id) => { viewerControlsRef.current?.zoomTo(id); handleClose() }}
              onSave={handleSave}
              projectId={projectId}
            />
          </div>
        </div>
      )}

      {showReport && (
        <ReportModal
          records={records}
          projectName={projectName}
          projectId={projectId}
          totalElements={modelElementCount}
          onClose={() => setShowReport(false)}
        />
      )}

      {showSnapshots && (
        <SnapshotsModal
          projectId={projectId}
          onClose={() => setShowSnapshots(false)}
          onRestored={() => { loadAllRecords(filters); setShowSnapshots(false) }}
        />
      )}
    </div>
  )
}
