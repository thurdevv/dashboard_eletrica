'use client'

import { useEffect, useState } from 'react'
import { Cloud, X, Loader2, Check, AlertCircle } from 'lucide-react'
import {
  hasLocalRecordsToMigrate, collectLocalRecords, migrateLocalToCloud, markMigrated,
} from '@/lib/api/migrate'

type Status = 'idle' | 'migrating' | 'success' | 'error'

export default function CloudMigrationBanner() {
  const [visible,   setVisible]   = useState(false)
  const [recordCount, setCount]   = useState(0)
  const [status,    setStatus]    = useState<Status>('idle')
  const [errorMsg,  setErrorMsg]  = useState('')
  const [migrated,  setMigrated]  = useState(0)

  useEffect(() => {
    let cancelled = false
    async function check() {
      if (!hasLocalRecordsToMigrate()) return
      try {
        const res  = await fetch('/api/db-status')
        const json = await res.json()
        if (cancelled) return
        if (json.ready) {
          setCount(collectLocalRecords().length)
          setVisible(true)
        }
      } catch { /* sem rede ou rota — não exibe */ }
    }
    check()
    return () => { cancelled = true }
  }, [])

  if (!visible) return null

  async function handleMigrate() {
    setStatus('migrating')
    setErrorMsg('')
    try {
      const count = await migrateLocalToCloud()
      setMigrated(count)
      setStatus('success')
      setTimeout(() => setVisible(false), 3500)
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Falha desconhecida')
      setStatus('error')
    }
  }

  function handleDismiss() {
    markMigrated()
    setVisible(false)
  }

  return (
    <div className="bg-blue-950/40 border border-blue-800 text-blue-100 rounded-xl p-4 mb-4 flex items-start gap-3">
      <Cloud className="w-5 h-5 mt-0.5 shrink-0" />

      <div className="flex-1 text-sm">
        {status === 'idle' && (
          <>
            <p className="font-medium">Encontramos {recordCount} registro{recordCount > 1 ? 's' : ''} salvo{recordCount > 1 ? 's' : ''} neste navegador.</p>
            <p className="text-blue-200/80 text-xs mt-1">Migrar para a nuvem permite acessar os dados de qualquer dispositivo.</p>
            <div className="flex gap-2 mt-3">
              <button onClick={handleMigrate}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-3 py-1.5 rounded-lg">
                Migrar agora
              </button>
              <button onClick={handleDismiss}
                className="text-blue-300 hover:text-blue-100 text-xs px-3 py-1.5">
                Dispensar
              </button>
            </div>
          </>
        )}

        {status === 'migrating' && (
          <p className="flex items-center gap-2 font-medium">
            <Loader2 className="w-4 h-4 animate-spin" /> Migrando {recordCount} registros…
          </p>
        )}

        {status === 'success' && (
          <p className="flex items-center gap-2 font-medium text-green-300">
            <Check className="w-4 h-4" /> {migrated} registros migrados com sucesso.
          </p>
        )}

        {status === 'error' && (
          <>
            <p className="flex items-center gap-2 font-medium text-red-300">
              <AlertCircle className="w-4 h-4" /> Erro ao migrar
            </p>
            <p className="text-red-200/80 text-xs mt-1">{errorMsg}</p>
            <button onClick={handleMigrate}
              className="bg-red-600 hover:bg-red-700 text-white font-medium text-xs px-3 py-1.5 rounded-lg mt-2">
              Tentar novamente
            </button>
          </>
        )}
      </div>

      {status !== 'migrating' && (
        <button onClick={handleDismiss}
          className="text-blue-300 hover:text-blue-100 shrink-0"
          aria-label="Fechar">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
