'use client'

import { useState } from 'react'
import { Cloud, Loader2, FolderOpen, Folder, File, Download, AlertCircle, X, RefreshCw, ChevronRight } from 'lucide-react'
import {
  requestDriveToken, listDriveItems, downloadDriveFile,
  googleClientId, FOLDER_MIME, type DriveItem,
} from '@/lib/storage/driveSync'
import { importProgressBundle } from '@/lib/api/execution'
import { saveModelCache } from '@/lib/storage/modelCache'
import { createProject } from '@/lib/projects'
import { unzipSync } from 'fflate'

interface DriveProjectPickerProps {
  onProjectRestored: (projectId: string) => void
}

interface Crumb { id: string; name: string }

type Step = 'idle' | 'listing' | 'list' | 'downloading' | 'error'

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

function isModelFile(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith('.bim') || lower.endsWith('.ifc') || lower.endsWith('.xkt')
}

export default function DriveProjectPicker({ onProjectRestored }: DriveProjectPickerProps) {
  const [open,       setOpen]       = useState(false)
  const [step,       setStep]       = useState<Step>('idle')
  const [items,      setItems]      = useState<DriveItem[]>([])
  const [crumbs,     setCrumbs]     = useState<Crumb[]>([{ id: 'root', name: 'Meu Drive' }])
  const [error,      setError]      = useState<string | null>(null)
  const [progress,   setProgress]   = useState<string | null>(null)
  const [token,      setToken]      = useState<string | null>(null)

  if (!googleClientId()) return null

  const currentFolder = crumbs[crumbs.length - 1]

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

  async function handleOpen() {
    setOpen(true)
    setCrumbs([{ id: 'root', name: 'Meu Drive' }])
    setError(null)
    try {
      const t = await requestDriveToken()
      setToken(t)
      await loadFolder('root', t)
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao acessar Google Drive')
      setStep('error')
    }
  }

  async function handleNavigate(item: DriveItem) {
    const t = token!
    setCrumbs(prev => [...prev, { id: item.id, name: item.name }])
    await loadFolder(item.id, t)
  }

  async function handleBreadcrumb(idx: number) {
    const crumb = crumbs[idx]
    setCrumbs(prev => prev.slice(0, idx + 1))
    await loadFolder(crumb.id, token!)
  }

  async function handleRestore(file: DriveItem) {
    setStep('downloading')
    setProgress('Baixando arquivo…')
    try {
      const t = token ?? await requestDriveToken()

      if (file.name.toLowerCase().endsWith('.bim')) {
        const buf = await downloadDriveFile(t, file.id)

        setProgress('Descompactando…')
        const entries = unzipSync(new Uint8Array(buf))

        const ifcEntry      = Object.entries(entries).find(([n]) => n.toLowerCase().endsWith('.ifc'))
        const xktEntry      = Object.entries(entries).find(([n]) => n.toLowerCase().endsWith('.xkt'))
        const progressEntry = Object.entries(entries).find(([n]) => n.toLowerCase() === 'progresso.json')
        const jsonEntry     = Object.entries(entries).find(([n]) => {
          const lower = n.toLowerCase()
          return lower.endsWith('.json') && lower !== 'progresso.json'
        })

        const modelEntry = ifcEntry ?? xktEntry
        if (!modelEntry) throw new Error('Nenhum modelo encontrado no arquivo.')

        const projectName = file.name.replace(/\.bim$/i, '') || 'Projeto restaurado'
        setProgress('Criando projeto…')
        const project = createProject(projectName, `Restaurado do Google Drive em ${new Date().toLocaleDateString('pt-BR')}`)

        setProgress('Salvando modelo…')
        const modelType = ifcEntry ? 'ifc' : 'xkt'
        const modelName = modelEntry[0].split('/').pop()!
        const modelData = modelEntry[1].buffer as ArrayBuffer
        const metaData  = jsonEntry ? (jsonEntry[1].buffer as ArrayBuffer) : undefined
        const metaUrl   = metaData ? URL.createObjectURL(new Blob([metaData], { type: 'application/json' })) : undefined

        await saveModelCache(project.id, { type: modelType, url: '', name: modelName, data: modelData, metaData, metaUrl })

        if (progressEntry) {
          setProgress('Restaurando progresso…')
          importProgressBundle(project.id, new TextDecoder().decode(progressEntry[1]))
        }

        onProjectRestored(project.id)
      } else {
        // IFC ou XKT direto na pasta — busca progresso.json na mesma pasta
        const siblings     = await listDriveItems(t, currentFolder.id)
        const progressFile = siblings.find(f => f.name.toLowerCase() === 'progresso.json')
        const jsonFile     = siblings.find(f => {
          const lower = f.name.toLowerCase()
          return lower.endsWith('.json') && lower !== 'progresso.json'
        })

        const modelBuf    = await downloadDriveFile(t, file.id)
        const isIfc       = file.name.toLowerCase().endsWith('.ifc')
        const modelType   = isIfc ? 'ifc' : 'xkt'
        const projectName = file.name.replace(/\.(ifc|xkt)$/i, '') || 'Projeto restaurado'

        setProgress('Criando projeto…')
        const project = createProject(projectName, `Restaurado do Google Drive em ${new Date().toLocaleDateString('pt-BR')}`)

        let metaData: ArrayBuffer | undefined
        let metaUrl: string | undefined
        if (!isIfc && jsonFile) {
          setProgress('Baixando metadata…')
          const mb = await downloadDriveFile(t, jsonFile.id)
          metaData = mb
          metaUrl  = URL.createObjectURL(new Blob([mb], { type: 'application/json' }))
        }

        setProgress('Salvando modelo…')
        await saveModelCache(project.id, { type: modelType, url: '', name: file.name, data: modelBuf, metaData, metaUrl })

        if (progressFile) {
          setProgress('Restaurando progresso…')
          const pb = await downloadDriveFile(t, progressFile.id)
          importProgressBundle(project.id, new TextDecoder().decode(new Uint8Array(pb)))
        }

        onProjectRestored(project.id)
      }

      setOpen(false)
      setStep('idle')
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao restaurar projeto')
      setStep('error')
    } finally {
      setProgress(null)
    }
  }

  const folders = items.filter(i => i.mimeType === FOLDER_MIME)
  const files   = items.filter(i => i.mimeType !== FOLDER_MIME)

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
      >
        <Cloud className="w-4 h-4 text-blue-400" />
        Restaurar do Drive
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-lg flex flex-col overflow-hidden shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-blue-400" />
                <h3 className="text-white font-bold">Google Drive</h3>
              </div>
              <div className="flex items-center gap-2">
                {step === 'list' && (
                  <button onClick={() => loadFolder(currentFolder.id, token!)} title="Atualizar"
                    className="p-1.5 rounded hover:bg-neutral-700 text-neutral-400">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => { setOpen(false); setStep('idle') }}
                  className="p-1.5 rounded hover:bg-neutral-700 text-neutral-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Breadcrumb */}
            {step === 'list' && (
              <div className="flex items-center gap-1 px-4 py-2 border-b border-neutral-800 overflow-x-auto flex-shrink-0">
                {crumbs.map((crumb, idx) => (
                  <div key={crumb.id} className="flex items-center gap-1 flex-shrink-0">
                    {idx > 0 && <ChevronRight className="w-3 h-3 text-neutral-600" />}
                    <button
                      onClick={() => handleBreadcrumb(idx)}
                      className={`text-xs px-1.5 py-0.5 rounded transition-colors
                        ${idx === crumbs.length - 1
                          ? 'text-white font-semibold'
                          : 'text-neutral-400 hover:text-white hover:bg-neutral-700'}`}
                    >
                      {crumb.name}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto max-h-96">

              {step === 'listing' && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-neutral-400">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                  <p className="text-sm">Carregando…</p>
                </div>
              )}

              {step === 'downloading' && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-neutral-400">
                  <Loader2 className="w-8 h-8 animate-spin text-green-400" />
                  <p className="text-sm">{progress ?? 'Processando…'}</p>
                </div>
              )}

              {step === 'error' && (
                <div className="p-6 flex flex-col items-center gap-3 text-center">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                  <p className="text-red-400 text-sm">{error}</p>
                  <button onClick={handleOpen}
                    className="bg-neutral-700 hover:bg-neutral-600 text-white text-sm px-4 py-2 rounded-lg">
                    Tentar novamente
                  </button>
                </div>
              )}

              {step === 'list' && items.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-neutral-500">
                  <FolderOpen className="w-10 h-10 opacity-30" />
                  <p className="text-sm">Pasta vazia.</p>
                  <p className="text-xs">Sem pastas ou arquivos de modelo aqui.</p>
                </div>
              )}

              {step === 'list' && items.length > 0 && (
                <div className="divide-y divide-neutral-800">

                  {/* Pastas */}
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

                  {/* Arquivos de modelo */}
                  {files.map(item => (
                    <button key={item.id} onClick={() => handleRestore(item)}
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
              <p className="text-neutral-600 text-xs">
                Navegue pelas pastas e clique no arquivo <code>.bim</code>, <code>.ifc</code> ou <code>.xkt</code> para restaurar.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
