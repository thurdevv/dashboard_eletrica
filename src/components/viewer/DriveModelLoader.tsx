'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Cloud, Loader2, FolderOpen, Folder, File, Download,
  AlertCircle, RefreshCw, ChevronRight, Layers, Settings,
} from 'lucide-react'
import { unzipSync } from 'fflate'
import {
  requestDriveToken, listDriveItems, downloadDriveFile,
  googleClientId, FOLDER_MIME, getDriveMeta, saveDriveMeta,
  type DriveItem, type DriveMeta,
} from '@/lib/storage/driveSync'
import { saveModelCache } from '@/lib/storage/modelCache'
import { importProgressBundle } from '@/lib/api/execution'
import type { LoadedModel } from '@/types'

interface DriveModelLoaderProps {
  projectId:   string
  onModelLoad: (model: LoadedModel) => void
}

interface Crumb { id: string; name: string }
type Step = 'init' | 'auto' | 'listing' | 'list' | 'downloading' | 'error' | 'no_client_id'

function isModelFile(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith('.bim') || lower.endsWith('.ifc') || lower.endsWith('.xkt')
}

function formatSize(bytes?: string): string {
  if (!bytes) return ''
  const n = parseInt(bytes)
  if (isNaN(n)) return ''
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function DriveModelLoader({ projectId, onModelLoad }: DriveModelLoaderProps) {
  const [step,     setStep]     = useState<Step>('init')
  const [items,    setItems]    = useState<DriveItem[]>([])
  const [crumbs,   setCrumbs]   = useState<Crumb[]>([{ id: 'root', name: 'Meu Drive' }])
  const [error,    setError]    = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [token,    setToken]    = useState<string | null>(null)
  const [meta,     setMeta]     = useState<DriveMeta | null>(null)

  const downloadAndLoad = useCallback(async (
    tok: string, file: { id: string; name: string }, folderId?: string,
  ) => {
    setStep('downloading')
    setProgress('Baixando do Drive…')
    try {
      const lower = file.name.toLowerCase()

      if (lower.endsWith('.bim')) {
        const buf = await downloadDriveFile(tok, file.id)
        setProgress('Descompactando…')
        const entries = unzipSync(new Uint8Array(buf))

        const ifcEntry      = Object.entries(entries).find(([n]) => n.toLowerCase().endsWith('.ifc'))
        const xktEntry      = Object.entries(entries).find(([n]) => n.toLowerCase().endsWith('.xkt'))
        const progressEntry = Object.entries(entries).find(([n]) => n.toLowerCase() === 'progresso.json')
        const jsonEntry     = Object.entries(entries).find(([n]) => {
          const l = n.toLowerCase()
          return l.endsWith('.json') && l !== 'progresso.json'
        })

        const modelEntry = ifcEntry ?? xktEntry
        if (!modelEntry) throw new Error('Nenhum modelo .ifc/.xkt encontrado dentro do .bim')

        const modelType = ifcEntry ? ('ifc' as const) : ('xkt' as const)
        const modelName = modelEntry[0].split('/').pop()!
        const data      = modelEntry[1].buffer as ArrayBuffer
        const metaData  = jsonEntry ? (jsonEntry[1].buffer as ArrayBuffer) : undefined
        const metaUrl   = metaData
          ? URL.createObjectURL(new Blob([metaData], { type: 'application/json' }))
          : undefined
        const progressData = progressEntry
          ? new TextDecoder().decode(progressEntry[1])
          : undefined

        const model: LoadedModel = { type: modelType, url: '', name: modelName, data, metaData, metaUrl, progressData }
        await saveModelCache(projectId, model)
        if (progressData) importProgressBundle(projectId, progressData)
        saveDriveMeta(projectId, { fileId: file.id, fileName: file.name, lastSync: new Date().toISOString() })
        onModelLoad(model)
        return
      }

      // .ifc / .xkt direto: tenta achar metadata + progresso na mesma pasta
      const isIfc     = lower.endsWith('.ifc')
      const modelType = isIfc ? ('ifc' as const) : ('xkt' as const)
      let metaData: ArrayBuffer | undefined
      let metaUrl: string | undefined
      let progressData: string | undefined

      if (folderId) {
        try {
          const siblings = await listDriveItems(tok, folderId)
          const progressFile = siblings.find(s => s.name.toLowerCase() === 'progresso.json')
          const jsonFile     = siblings.find(s => {
            const l = s.name.toLowerCase()
            return l.endsWith('.json') && l !== 'progresso.json'
          })
          if (!isIfc && jsonFile) {
            setProgress('Baixando metadata…')
            const mb = await downloadDriveFile(tok, jsonFile.id)
            metaData = mb
            metaUrl  = URL.createObjectURL(new Blob([mb], { type: 'application/json' }))
          }
          if (progressFile) {
            setProgress('Baixando progresso…')
            const pb = await downloadDriveFile(tok, progressFile.id)
            progressData = new TextDecoder().decode(new Uint8Array(pb))
          }
        } catch { /* siblings opcionais — segue sem eles */ }
      }

      setProgress('Baixando modelo…')
      const data = await downloadDriveFile(tok, file.id)
      const model: LoadedModel = { type: modelType, url: '', name: file.name, data, metaData, metaUrl, progressData }
      await saveModelCache(projectId, model)
      if (progressData) importProgressBundle(projectId, progressData)
      saveDriveMeta(projectId, { fileId: file.id, fileName: file.name, lastSync: new Date().toISOString() })
      onModelLoad(model)
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao baixar do Drive')
      setStep('error')
    } finally {
      setProgress(null)
    }
  }, [projectId, onModelLoad])

  // Mount: decide entre auto-load (se já vinculado) ou abrir o navegador de pastas
  useEffect(() => {
    if (!googleClientId()) { setStep('no_client_id'); return }

    const linked = getDriveMeta(projectId)
    setMeta(linked)

    let cancelled = false
    ;(async () => {
      try {
        const t = await requestDriveToken()
        if (cancelled) return
        setToken(t)

        if (linked) {
          // Já vinculado a um arquivo do Drive — baixa e carrega direto
          setStep('auto')
          await downloadAndLoad(t, { id: linked.fileId, name: linked.fileName })
        } else {
          // Não vinculado — abre navegador de pastas
          await loadFolder('root', t)
        }
      } catch (err: any) {
        if (cancelled) return
        setError(err?.message ?? 'Erro ao acessar Google Drive')
        setStep('error')
      }
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  async function loadFolder(folderId: string, tok: string) {
    setStep('listing')
    setError(null)
    try {
      const list = await listDriveItems(tok, folderId)
      setItems(list.filter(i => i.mimeType === FOLDER_MIME || isModelFile(i.name)))
      setStep('list')
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao listar pasta')
      setStep('error')
    }
  }

  async function handleNavigate(item: DriveItem) {
    setCrumbs(prev => [...prev, { id: item.id, name: item.name }])
    await loadFolder(item.id, token!)
  }

  async function handleBreadcrumb(idx: number) {
    const crumb = crumbs[idx]
    setCrumbs(prev => prev.slice(0, idx + 1))
    await loadFolder(crumb.id, token!)
  }

  async function handlePick(item: DriveItem) {
    const folderId = crumbs[crumbs.length - 1]?.id
    await downloadAndLoad(token!, item, folderId)
  }

  async function handleRetry() {
    setError(null)
    setStep('init')
    try {
      const t = await requestDriveToken(true)
      setToken(t)
      const linked = getDriveMeta(projectId)
      if (linked) {
        setStep('auto')
        await downloadAndLoad(t, { id: linked.fileId, name: linked.fileName })
      } else {
        setCrumbs([{ id: 'root', name: 'Meu Drive' }])
        await loadFolder('root', t)
      }
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao acessar Google Drive')
      setStep('error')
    }
  }

  // ── States visuais ──────────────────────────────────────────

  if (step === 'no_client_id') {
    return (
      <div className="flex-1 flex items-center justify-center bg-black p-6">
        <div className="w-full max-w-lg bg-neutral-900 border border-neutral-700 rounded-2xl p-6 text-sm">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="w-5 h-5 text-amber-400" />
            <p className="text-white font-semibold">Google Drive não configurado</p>
          </div>
          <p className="text-neutral-400 mb-3">
            Defina <code className="text-green-400">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> nas variáveis
            de ambiente do Vercel para carregar modelos automaticamente do Drive.
          </p>
          <ol className="list-decimal list-inside space-y-1.5 text-neutral-400">
            <li>Acesse <span className="text-blue-400">console.cloud.google.com</span></li>
            <li>Ative <strong className="text-white">Google Drive API</strong></li>
            <li>Credenciais → <strong className="text-white">OAuth 2.0</strong> (App da Web)</li>
            <li>Adicione a URL do app em "Origens autorizadas"</li>
            <li>Cole o ID do cliente em <code className="text-green-400">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> no Vercel</li>
          </ol>
        </div>
      </div>
    )
  }

  if (step === 'init' || step === 'auto' || step === 'downloading') {
    return (
      <div className="flex-1 flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-3 text-neutral-400">
          <Loader2 className="w-10 h-10 animate-spin text-blue-400" />
          <p className="text-sm">{progress ?? (meta ? `Carregando ${meta.fileName} do Drive…` : 'Conectando ao Google Drive…')}</p>
        </div>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="flex-1 flex items-center justify-center bg-black p-6">
        <div className="w-full max-w-lg bg-neutral-900 border border-red-900/60 rounded-2xl p-6 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-red-300 font-semibold mb-2">Erro ao acessar o Drive</p>
          <p className="text-neutral-400 text-sm mb-4">{error}</p>
          <button onClick={handleRetry}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  // step === 'listing' | 'list'  → navegador de pastas
  const folders = items.filter(i => i.mimeType === FOLDER_MIME)
  const files   = items.filter(i => i.mimeType !== FOLDER_MIME)
  const currentFolder = crumbs[crumbs.length - 1]

  return (
    <div className="flex-1 flex items-center justify-center bg-black p-6">
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-700 rounded-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Selecione o modelo no Drive</p>
              <p className="text-neutral-500 text-xs">.bim, .ifc ou .xkt — fica vinculado a este projeto</p>
            </div>
          </div>
          <button onClick={() => loadFolder(currentFolder.id, token!)} title="Atualizar"
            className="p-1.5 rounded hover:bg-neutral-700 text-neutral-400">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-neutral-800 overflow-x-auto flex-shrink-0">
          {crumbs.map((crumb, idx) => (
            <div key={crumb.id} className="flex items-center gap-1 flex-shrink-0">
              {idx > 0 && <ChevronRight className="w-3 h-3 text-neutral-600" />}
              <button onClick={() => handleBreadcrumb(idx)}
                className={`text-xs px-1.5 py-0.5 rounded transition-colors
                  ${idx === crumbs.length - 1
                    ? 'text-white font-semibold'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-700'}`}>
                {crumb.name}
              </button>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto max-h-[420px]">
          {step === 'listing' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-neutral-400">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
              <p className="text-sm">Carregando…</p>
            </div>
          )}

          {step === 'list' && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-neutral-500">
              <FolderOpen className="w-10 h-10 opacity-30" />
              <p className="text-sm">Pasta vazia.</p>
              <p className="text-xs">Sem subpastas ou arquivos de modelo aqui.</p>
            </div>
          )}

          {step === 'list' && items.length > 0 && (
            <div className="divide-y divide-neutral-800">
              {folders.map(item => (
                <button key={item.id} onClick={() => handleNavigate(item)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-neutral-800 transition-colors text-left group">
                  <Folder className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{item.name}</p>
                    <p className="text-neutral-500 text-xs">{formatDate(item.modifiedTime)}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-neutral-300 flex-shrink-0" />
                </button>
              ))}
              {files.map(item => (
                <button key={item.id} onClick={() => handlePick(item)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-neutral-800 transition-colors text-left group">
                  <div className="w-9 h-9 bg-blue-600/20 border border-blue-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <File className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">
                      {item.name.replace(/\.(bim|ifc|xkt)$/i, '')}
                    </p>
                    <p className="text-neutral-500 text-xs">
                      {formatDate(item.modifiedTime)}
                      {item.size ? ` · ${formatSize(item.size)}` : ''}
                    </p>
                  </div>
                  <Download className="w-4 h-4 text-neutral-500 group-hover:text-blue-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-800 bg-neutral-950/50">
          <p className="text-neutral-600 text-xs flex items-center gap-2">
            <Cloud className="w-3.5 h-3.5 text-blue-400" />
            Após selecionar, o arquivo fica vinculado ao projeto e é recarregado automaticamente nas próximas visitas.
          </p>
        </div>
      </div>
    </div>
  )
}
