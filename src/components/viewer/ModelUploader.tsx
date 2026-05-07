'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Upload, Layers, Loader, FolderOpen, RefreshCw, Cloud, HardDrive, Link } from 'lucide-react'
import { unzipSync } from 'fflate'
import { saveModelCache, loadModelCache } from '@/lib/storage/modelCache'
import type { LoadedModel } from '@/types'

interface ModelUploaderProps {
  projectId?:  string
  onModelLoad: (model: LoadedModel) => void
}

type Tab = 'local' | 'cloud'

export default function ModelUploader({ projectId, onModelLoad }: ModelUploaderProps) {
  const [tab,        setTab]        = useState<Tab>('local')
  const [dragging,   setDragging]   = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [checking,   setChecking]   = useState(true)
  const [savedModel, setSavedModel] = useState<LoadedModel | null>(null)
  const [cloudUrl,   setCloudUrl]   = useState('')
  const [progress,   setProgress]   = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!projectId) { setChecking(false); return }
    loadModelCache(projectId).then((cached) => { setSavedModel(cached); setChecking(false) })
  }, [projectId])

  const loadAndCache = useCallback(async (model: LoadedModel) => {
    if (projectId) await saveModelCache(projectId, model)
    onModelLoad(model)
  }, [projectId, onModelLoad])

  const processFiles = useCallback(async (files: FileList | File[]) => {
    setError(null)
    const arr  = Array.from(files)
    const zip  = arr.find((f) => f.name.toLowerCase().endsWith('.zip'))
    const ifc  = arr.find((f) => f.name.toLowerCase().endsWith('.ifc'))
    const xkt  = arr.find((f) => f.name.toLowerCase().endsWith('.xkt'))
    const json = arr.find((f) => f.name.toLowerCase().endsWith('.json'))

    if (zip) {
      setLoading(true)
      try {
        const zipData = new Uint8Array(await zip.arrayBuffer())
        const entries = unzipSync(zipData)
        const ifcEntry  = Object.entries(entries).find(([n]) => n.toLowerCase().endsWith('.ifc'))
        const xktEntry  = Object.entries(entries).find(([n]) => n.toLowerCase().endsWith('.xkt'))
        // progresso.json deve ser ignorado ao procurar metadados do XKT
        const progressEntry = Object.entries(entries).find(([n]) => n.toLowerCase() === 'progresso.json')
        const jsonEntry = Object.entries(entries).find(([n]) => {
          const lower = n.toLowerCase()
          return lower.endsWith('.json') && lower !== 'progresso.json'
        })
        const progressData = progressEntry
          ? new TextDecoder().decode(progressEntry[1])
          : undefined
        if (ifcEntry) {
          await loadAndCache({ type: 'ifc', url: '', name: ifcEntry[0].split('/').pop()!, data: ifcEntry[1].buffer as ArrayBuffer, progressData })
          return
        }
        if (xktEntry) {
          const data     = xktEntry[1].buffer as ArrayBuffer
          const metaData = jsonEntry ? (jsonEntry[1].buffer as ArrayBuffer) : undefined
          const metaUrl  = metaData ? URL.createObjectURL(new Blob([metaData], { type: 'application/json' })) : undefined
          await loadAndCache({ type: 'xkt', url: '', name: xktEntry[0].split('/').pop()!, data, metaData, metaUrl, progressData })
          return
        }
        setError('Nenhum arquivo .ifc ou .xkt encontrado dentro do ZIP.')
      } catch { setError('Erro ao descompactar o arquivo ZIP.') }
      finally  { setLoading(false) }
      return
    }
    if (ifc) { await loadAndCache({ type: 'ifc', url: '', name: ifc.name, data: await ifc.arrayBuffer() }); return }
    if (xkt) {
      const data     = await xkt.arrayBuffer()
      const metaData = json ? await json.arrayBuffer() : undefined
      const metaUrl  = metaData ? URL.createObjectURL(new Blob([metaData], { type: 'application/json' })) : undefined
      await loadAndCache({ type: 'xkt', url: '', name: xkt.name, data, metaData, metaUrl })
      return
    }
    setError('Arquivo não reconhecido. Use .ifc, .xkt ou .zip')
  }, [loadAndCache])

  async function handleCloudFetch() {
    if (!cloudUrl.trim()) { setError('Cole uma URL válida.'); return }
    setError(null)
    setLoading(true)
    setProgress('Conectando ao serviço de nuvem…')
    try {
      const res = await fetch('/api/proxy-model', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url: cloudUrl.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro ao buscar arquivo' }))
        throw new Error(err.error)
      }
      setProgress('Baixando arquivo…')
      const data     = await res.arrayBuffer()
      const filename = decodeURIComponent(res.headers.get('X-Filename') ?? 'model')
      const ext      = filename.split('.').pop()?.toLowerCase()

      if (ext === 'ifc') {
        await loadAndCache({ type: 'ifc', url: '', name: filename, data })
      } else if (ext === 'xkt') {
        await loadAndCache({ type: 'xkt', url: '', name: filename, data })
      } else if (ext === 'zip') {
        setProgress('Descompactando…')
        const entries  = unzipSync(new Uint8Array(data))
        const ifcEntry = Object.entries(entries).find(([n]) => n.toLowerCase().endsWith('.ifc'))
        const xktEntry = Object.entries(entries).find(([n]) => n.toLowerCase().endsWith('.xkt'))
        const progressEntry = Object.entries(entries).find(([n]) => n.toLowerCase() === 'progresso.json')
        const jsonEntry = Object.entries(entries).find(([n]) => {
          const lower = n.toLowerCase()
          return lower.endsWith('.json') && lower !== 'progresso.json'
        })
        const progressData = progressEntry
          ? new TextDecoder().decode(progressEntry[1])
          : undefined
        if (ifcEntry) {
          await loadAndCache({ type: 'ifc', url: '', name: ifcEntry[0].split('/').pop()!, data: ifcEntry[1].buffer as ArrayBuffer, progressData })
        } else if (xktEntry) {
          const md = jsonEntry ? (jsonEntry[1].buffer as ArrayBuffer) : undefined
          const mu = md ? URL.createObjectURL(new Blob([md], { type: 'application/json' })) : undefined
          await loadAndCache({ type: 'xkt', url: '', name: xktEntry[0].split('/').pop()!, data: xktEntry[1].buffer as ArrayBuffer, metaData: md, metaUrl: mu, progressData })
        } else {
          throw new Error('Nenhum arquivo .ifc ou .xkt encontrado no ZIP.')
        }
      } else {
        // Tenta detectar pelo conteúdo (IFC começa com "ISO-10303")
        const preview = new TextDecoder().decode(data.slice(0, 20))
        if (preview.includes('ISO-10303') || preview.includes('FILE_DESCRIPTION')) {
          await loadAndCache({ type: 'ifc', url: '', name: filename || 'model.ifc', data })
        } else {
          throw new Error(`Formato não reconhecido (.${ext}). Use .ifc, .xkt ou .zip`)
        }
      }
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao buscar arquivo da nuvem.')
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    void processFiles(e.dataTransfer.files)
  }, [processFiles])

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) void processFiles(e.target.files)
    e.target.value = ''
  }, [processFiles])

  if (checking) {
    return (
      <div className="flex-1 flex items-center justify-center bg-neutral-950">
        <Loader className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-neutral-950 p-6">
      <div className="w-full max-w-lg flex flex-col items-center gap-6">

        {/* Logo */}
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Layers className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">BIM Elétrico</h1>
          <p className="text-neutral-400 mt-1 text-sm">Acompanhamento de Instalações Elétricas</p>
        </div>

        {/* Modelo salvo */}
        {savedModel && (
          <div className="w-full bg-blue-950/40 border border-blue-700/50 rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm">Modelo salvo</p>
                <p className="text-blue-300 text-xs truncate">{savedModel.name}</p>
              </div>
            </div>
            <button onClick={() => onModelLoad(savedModel)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
              Abrir modelo anterior
            </button>
            <button onClick={() => setSavedModel(null)}
              className="w-full flex items-center justify-center gap-2 bg-neutral-700 hover:bg-neutral-600 text-neutral-300 text-xs font-medium py-2 rounded-xl transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Carregar outro arquivo
            </button>
          </div>
        )}

        {/* Tabs Local / Nuvem */}
        {!savedModel && (
          <>
            <div className="flex w-full bg-neutral-800 rounded-xl p-1 gap-1">
              {([
                { key: 'local', icon: <HardDrive className="w-4 h-4" />, label: 'Dispositivo' },
                { key: 'cloud', icon: <Cloud className="w-4 h-4" />,     label: 'Nuvem'       },
              ] as const).map(({ key, icon, label }) => (
                <button key={key} onClick={() => { setTab(key); setError(null) }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all
                    ${tab === key
                      ? 'bg-neutral-700 text-white shadow'
                      : 'text-neutral-400 hover:text-white'}`}>
                  {icon}{label}
                </button>
              ))}
            </div>

            {/* Tab Local */}
            {tab === 'local' && (
              <>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={`w-full border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-4 transition-all
                    ${dragging ? 'border-blue-400 bg-blue-950/40' : 'border-neutral-600 bg-neutral-900'}`}
                >
                  {loading
                    ? <><Loader className="w-12 h-12 text-blue-400 animate-spin" /><p className="text-neutral-400 text-sm">{progress ?? 'Processando…'}</p></>
                    : <Upload className={`w-12 h-12 ${dragging ? 'text-blue-400' : 'text-neutral-500'}`} />
                  }
                  {!loading && (
                    <>
                      <div className="text-center">
                        <p className="text-white font-semibold text-lg">Arraste o modelo aqui</p>
                        <p className="text-neutral-400 text-sm mt-1">ou use o botão abaixo</p>
                      </div>
                      <button type="button" onClick={() => inputRef.current?.click()}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl text-sm">
                        Selecionar arquivo
                      </button>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3 w-full">
                  <FormatCard icon="IFC" title="IFC" description="Carregamento direto. Até ~50 MB." color="bg-green-900/40 border-green-700" />
                  <FormatCard icon="XKT" title="XKT" description="Alta performance. Arraste .xkt + .json." color="bg-blue-900/40 border-blue-700" />
                  <FormatCard icon="ZIP" title="ZIP" description="ZIP com .ifc ou .xkt dentro." color="bg-purple-900/40 border-purple-700" />
                </div>
              </>
            )}

            {/* Tab Nuvem */}
            {tab === 'cloud' && (
              <div className="w-full flex flex-col gap-4">
                <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-5 flex flex-col gap-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Link className="w-4 h-4 text-neutral-400" />
                    <p className="text-white font-semibold text-sm">Cole o link de compartilhamento</p>
                  </div>
                  <input
                    type="url"
                    value={cloudUrl}
                    onChange={(e) => setCloudUrl(e.target.value)}
                    placeholder="https://drive.google.com/file/d/…"
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500 placeholder-neutral-600"
                  />
                  <button
                    onClick={handleCloudFetch}
                    disabled={loading || !cloudUrl.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
                  >
                    {loading
                      ? <><Loader className="w-4 h-4 animate-spin" />{progress ?? 'Baixando…'}</>
                      : <><Cloud className="w-4 h-4" />Buscar arquivo</>}
                  </button>
                </div>

                {/* Guias de uso */}
                <div className="flex flex-col gap-2">
                  {[
                    {
                      icon: '🟦',
                      name: 'Google Drive',
                      tip: 'Clique com botão direito no arquivo → "Compartilhar" → "Qualquer pessoa com o link" → copie o link',
                    },
                    {
                      icon: '📦',
                      name: 'Dropbox',
                      tip: 'Clique em "Compartilhar" no arquivo → "Copiar link" (funciona com links públicos)',
                    },
                    {
                      icon: '☁️',
                      name: 'OneDrive',
                      tip: 'Clique em "Compartilhar" → "Qualquer pessoa com link" → copie',
                    },
                    {
                      icon: '🔗',
                      name: 'URL direta',
                      tip: 'Qualquer link HTTP público que aponte diretamente para um .ifc, .xkt ou .zip',
                    },
                  ].map(({ icon, name, tip }) => (
                    <div key={name} className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-3 flex gap-3">
                      <span className="text-lg flex-shrink-0">{icon}</span>
                      <div>
                        <p className="text-white text-xs font-semibold">{name}</p>
                        <p className="text-neutral-500 text-xs mt-0.5">{tip}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-4 py-2 w-full text-center">
                {error}
              </p>
            )}

            <p className="text-neutral-600 text-xs text-center">
              O modelo é processado localmente após o download — não é armazenado em servidores externos.
            </p>
          </>
        )}

        <input ref={inputRef} type="file" multiple className="hidden" onChange={onFileInput} />
      </div>
    </div>
  )
}

function FormatCard({ icon, title, description, color }: { icon: string; title: string; description: string; color: string }) {
  return (
    <div className={`border rounded-xl p-3 ${color}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-bold text-white bg-white/10 px-2 py-0.5 rounded">{icon}</span>
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      <p className="text-xs text-neutral-400">{description}</p>
    </div>
  )
}
