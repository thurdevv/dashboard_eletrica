'use client'

import { useState } from 'react'
import { Search, Layers, Eye, Home, FolderOpen, Download, Loader2, Archive } from 'lucide-react'
import type { LoadedModel } from '@/types'

interface ViewerControlsProps {
  modelName:           string
  model:               LoadedModel
  levels:              string[]
  onSearch:            (q: string) => void
  onIsolateLevel:      (level: string | null) => void
  onResetCamera?:      () => void
  onChangeModel?:      () => void
  onExportWithProgress?: () => Promise<void>
}

export default function ViewerControls({
  modelName,
  model,
  levels,
  onSearch,
  onIsolateLevel,
  onResetCamera,
  onChangeModel,
  onExportWithProgress,
}: ViewerControlsProps) {
  const [searchValue,    setSearchValue]    = useState('')
  const [selectedLevel,  setSelectedLevel]  = useState<string>('')
  const [converting,     setConverting]     = useState(false)
  const [convertError,   setConvertError]   = useState<string | null>(null)
  const [exporting,      setExporting]      = useState(false)

  async function handleConvert() {
    setConverting(true)
    setConvertError(null)
    try {
      // Build the IFC blob to send
      let blob: Blob
      if (model.data) {
        blob = new Blob([model.data], { type: 'application/octet-stream' })
      } else {
        const res = await fetch(model.url)
        blob = await res.blob()
      }

      const form = new FormData()
      form.append('file', blob, modelName.endsWith('.ifc') ? modelName : `${modelName}.ifc`)

      const res = await fetch('/api/convert', { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Falha na conversão' }))
        throw new Error(err.error)
      }

      const xktBlob  = await res.blob()
      const url      = URL.createObjectURL(xktBlob)
      const a        = document.createElement('a')
      a.href         = url
      a.download     = modelName.replace(/\.ifc$/i, '.xkt')
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setConvertError(err?.message ?? 'Erro ao converter')
    } finally {
      setConverting(false)
    }
  }

  return (
    <div className="flex flex-col bg-neutral-800 border-b border-neutral-700">
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Model name */}
        <span className="text-xs text-neutral-400 truncate max-w-[140px]" title={modelName}>
          {modelName}
        </span>

        <div className="w-px h-4 bg-neutral-600 mx-1" />

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            value={searchValue}
            onChange={(e) => { setSearchValue(e.target.value); onSearch(e.target.value) }}
            placeholder="Buscar elemento…"
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-neutral-700 text-white rounded-md border border-neutral-600 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Level isolator */}
        <div className="flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-neutral-400" />
          <select
            value={selectedLevel}
            onChange={(e) => { setSelectedLevel(e.target.value); onIsolateLevel(e.target.value || null) }}
            className="text-sm bg-neutral-700 text-white rounded-md border border-neutral-600 px-2 py-1.5 focus:outline-none focus:border-blue-500"
          >
            <option value="">Todos os Pavimentos</option>
            {levels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        {/* Show all */}
        <button
          onClick={() => { setSelectedLevel(''); onIsolateLevel(null) }}
          title="Mostrar tudo"
          className="p-1.5 rounded bg-neutral-700 hover:bg-neutral-600 text-neutral-300"
        >
          <Eye className="w-4 h-4" />
        </button>

        {/* Reset camera */}
        {onResetCamera && (
          <button
            onClick={onResetCamera}
            title="Resetar câmera"
            className="p-1.5 rounded bg-neutral-700 hover:bg-neutral-600 text-neutral-300"
          >
            <Home className="w-4 h-4" />
          </button>
        )}

        {/* Convert IFC → XKT */}
        {model.type === 'ifc' && (
          <button
            onClick={handleConvert}
            disabled={converting}
            title="Converter para XKT (carregamento mais rápido)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-semibold"
          >
            {converting
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Convertendo…</>
              : <><Download className="w-3.5 h-3.5" /> Salvar XKT</>}
          </button>
        )}

        {/* Download local do modelo atual */}
        <button
          onClick={() => {
            if (!model.data) return
            const ext  = model.type === 'ifc' ? 'ifc' : 'xkt'
            const name = model.name.endsWith(`.${ext}`) ? model.name : `${model.name}.${ext}`
            const blob = new Blob([model.data], { type: 'application/octet-stream' })
            const url  = URL.createObjectURL(blob)
            const a    = document.createElement('a')
            a.href = url; a.download = name; a.click()
            URL.revokeObjectURL(url)
          }}
          title="Baixar arquivo do modelo"
          disabled={!model.data}
          className="p-1.5 rounded bg-neutral-700 hover:bg-neutral-600 disabled:opacity-30 text-neutral-300"
        >
          <Download className="w-4 h-4" />
        </button>

        {/* Exportar modelo com progresso embutido */}
        {onExportWithProgress && (
          <button
            onClick={async () => { setExporting(true); await onExportWithProgress(); setExporting(false) }}
            disabled={exporting}
            title="Exportar modelo com progresso (ZIP)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white text-xs font-semibold"
          >
            {exporting
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Exportando…</>
              : <><Archive className="w-3.5 h-3.5" /> Salvar com Progresso</>}
          </button>
        )}

        {/* Change model */}
        {onChangeModel && (
          <button
            onClick={onChangeModel}
            title="Trocar modelo"
            className="p-1.5 rounded bg-neutral-700 hover:bg-neutral-600 text-neutral-300 ml-auto"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Conversion error */}
      {convertError && (
        <div className="px-3 pb-2 text-xs text-red-400">
          ⚠ {convertError}
        </div>
      )}
    </div>
  )
}
