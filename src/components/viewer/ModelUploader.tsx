'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload, FileBox, Loader2 } from 'lucide-react'
import { unzipSync } from 'fflate'
import { saveModelCache } from '@/lib/storage/modelCache'
import { importProgressBundle } from '@/lib/api/execution'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { AppError, toAppError } from '@/lib/errors'
import type { LoadedModel } from '@/types'

interface ModelUploaderProps {
  projectId:   string
  onModelLoad: (model: LoadedModel) => void
}

type Step = 'idle' | 'reading' | 'error'

const ACCEPTED_EXT = ['.ifc', '.xkt', '.bim', '.zip']

function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(new AppError('UPLOAD_READ_FAILED',
      reader.error?.message ?? 'FileReader error'))
    reader.readAsArrayBuffer(file)
  })
}

export default function ModelUploader({ projectId, onModelLoad }: ModelUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [step,     setStep]     = useState<Step>('idle')
  const [error,    setError]    = useState<AppError | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const processFile = useCallback(async (file: File) => {
    setStep('reading')
    setError(null)
    setProgress(`Lendo ${file.name}…`)
    try {
      const lower = file.name.toLowerCase()
      if (!ACCEPTED_EXT.some(ext => lower.endsWith(ext))) {
        throw new AppError('UPLOAD_UNSUPPORTED_FORMAT', file.name)
      }

      const buf = await readAsArrayBuffer(file)

      let model: LoadedModel
      let progressData: string | undefined

      if (lower.endsWith('.bim') || lower.endsWith('.zip')) {
        setProgress('Descompactando…')
        const entries = unzipSync(new Uint8Array(buf))
        const ifcEntry      = Object.entries(entries).find(([n]) => n.toLowerCase().endsWith('.ifc'))
        const xktEntry      = Object.entries(entries).find(([n]) => n.toLowerCase().endsWith('.xkt'))
        const progressEntry = Object.entries(entries).find(([n]) => n.toLowerCase() === 'progresso.json')
        const jsonEntry     = Object.entries(entries).find(([n]) => {
          const l = n.toLowerCase()
          return l.endsWith('.json') && l !== 'progresso.json'
        })
        const modelEntry = xktEntry ?? ifcEntry
        if (!modelEntry) throw new AppError('UPLOAD_NO_MODEL_IN_ZIP', file.name)

        const modelType = modelEntry === xktEntry ? ('xkt' as const) : ('ifc' as const)
        const modelName = modelEntry[0].split('/').pop()!
        const data      = modelEntry[1].buffer as ArrayBuffer
        const metaData  = jsonEntry ? (jsonEntry[1].buffer as ArrayBuffer) : undefined
        const metaUrl   = metaData
          ? URL.createObjectURL(new Blob([metaData], { type: 'application/json' }))
          : undefined
        progressData = progressEntry ? new TextDecoder().decode(progressEntry[1]) : undefined
        model = { type: modelType, url: '', name: modelName, data, metaData, metaUrl, progressData }
      } else {
        const isIfc     = lower.endsWith('.ifc')
        const modelType = isIfc ? ('ifc' as const) : ('xkt' as const)
        model = { type: modelType, url: '', name: file.name, data: buf }
      }

      setProgress('Salvando em cache…')
      await saveModelCache(projectId, model)
      if (progressData) importProgressBundle(projectId, progressData)

      setStep('idle')
      setProgress(null)
      onModelLoad(model)
    } catch (err: unknown) {
      setError(toAppError(err, 'UPLOAD_PROCESS_FAILED'))
      setStep('error')
      setProgress(null)
    }
  }, [projectId, onModelLoad])

  // Em iOS Safari, o atributo accept não filtra por extensão consistentemente —
  // ele pode permitir qualquer arquivo (especialmente vindo dos Files app).
  // Validar em JS aqui evita erro confuso lá embaixo no processFile.
  function isAcceptedFile(file: File): boolean {
    const lower = file.name.toLowerCase()
    return ACCEPTED_EXT.some(ext => lower.endsWith(ext))
  }

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!isAcceptedFile(file)) {
      setStep('error')
      setError(new AppError('UPLOAD_UNSUPPORTED_FORMAT', file.name))
      return
    }
    void processFile(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    if (!isAcceptedFile(file)) {
      setStep('error')
      setError(new AppError('UPLOAD_UNSUPPORTED_FORMAT', file.name))
      return
    }
    void processFile(file)
  }

  if (step === 'reading') {
    return (
      <div className="flex-1 flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-3 text-neutral-400">
          <Loader2 className="w-10 h-10 animate-spin text-blue-400" />
          <p className="text-sm">{progress ?? 'Processando arquivo…'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-black p-6">
      <div className="w-full max-w-lg">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer bg-neutral-900 border-2 border-dashed rounded-2xl p-8 text-center transition-colors
            ${dragging ? 'border-blue-500 bg-blue-950/30' : 'border-neutral-700 hover:border-neutral-500'}`}
        >
          <div className="w-14 h-14 mx-auto mb-4 bg-blue-600/20 border border-blue-600/30 rounded-2xl flex items-center justify-center">
            <Upload className="w-7 h-7 text-blue-400" />
          </div>
          <p className="text-white font-semibold text-base">Selecionar modelo BIM</p>
          <p className="text-neutral-400 text-sm mt-1">
            Arraste e solte ou clique para escolher
          </p>
          <p className="text-neutral-500 text-xs mt-3 flex items-center justify-center gap-1.5">
            <FileBox className="w-3.5 h-3.5" />
            .ifc · .xkt · .bim · .zip
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".ifc,.xkt,.bim,.zip,application/zip,application/octet-stream"
          onChange={handleSelect}
        />

        {step === 'error' && error && (
          <div className="mt-4">
            <ErrorMessage error={error} />
          </div>
        )}
      </div>
    </div>
  )
}
