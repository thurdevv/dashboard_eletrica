'use client'

import { useState, useEffect } from 'react'
import { Cloud, CloudUpload, CheckCircle, AlertCircle, Loader2, RefreshCw, Settings } from 'lucide-react'
import {
  getDriveMeta, saveDriveMeta, clearDriveMeta, requestDriveToken,
  uploadZipToDrive, googleClientId, type DriveMeta,
} from '@/lib/storage/driveSync'

interface DriveSyncProps {
  projectId:   string
  fileName:    string
  getZipBlob:  () => Promise<Blob>
  pendingSync: boolean     // true quando há progresso não sincronizado
  onSynced:    () => void
}

type State = 'idle' | 'syncing' | 'success' | 'error' | 'no_client_id'

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)   return 'agora mesmo'
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`
  return `há ${Math.floor(diff / 86400)} d`
}

export default function DriveSync({ projectId, fileName, getZipBlob, pendingSync, onSynced }: DriveSyncProps) {
  const [meta,     setMeta]     = useState<DriveMeta | null>(null)
  const [state,    setState]    = useState<State>('idle')
  const [errMsg,   setErrMsg]   = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(false)

  useEffect(() => {
    setMeta(getDriveMeta(projectId))
    if (!googleClientId()) setState('no_client_id')
  }, [projectId])

  async function handleSync() {
    setState('syncing')
    setErrMsg(null)
    try {
      const token = await requestDriveToken()
      const blob  = await getZipBlob()

      // 1. Sobrescreve o arquivo principal (ou cria se for a primeira vez)
      const result = await uploadZipToDrive(token, blob, fileName, meta?.fileId)
      saveDriveMeta(projectId, result)
      setMeta(result)

      // 2. Salva uma cópia com data e hora como histórico
      const now = new Date()
      const ts  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}`
      const versionedName = fileName.replace(/\.bim$/i, `_${ts}.bim`)
      await uploadZipToDrive(token, blob, versionedName)

      setState('success')
      onSynced()
      setTimeout(() => setState('idle'), 3000)
    } catch (err: any) {
      setErrMsg(err?.message ?? 'Erro ao sincronizar')
      setState('error')
    }
  }

  function handleDisconnect() {
    clearDriveMeta(projectId)
    setMeta(null)
    setState('idle')
    _resetToken()
  }

  // no_client_id → mostra instruções
  if (state === 'no_client_id') {
    return (
      <div className="relative">
        <button
          onClick={() => setShowInfo(!showInfo)}
          title="Configurar Google Drive"
          className="flex items-center gap-1.5 bg-neutral-700 hover:bg-neutral-600 text-neutral-400 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Drive</span>
        </button>

        {showInfo && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl p-4 z-50 text-xs">
            <p className="text-white font-semibold mb-2">Configurar Google Drive</p>
            <ol className="list-decimal list-inside space-y-1.5 text-neutral-400">
              <li>Acesse <span className="text-blue-400">console.cloud.google.com</span></li>
              <li>Crie um projeto → APIs → Ative <strong className="text-white">Google Drive API</strong></li>
              <li>Credenciais → <strong className="text-white">OAuth 2.0</strong> → Tipo: App da Web</li>
              <li>Em "Origens autorizadas" adicione:<br /><code className="text-green-400">https://bim-electrical-dashboard.vercel.app</code></li>
              <li>Copie o <strong className="text-white">ID do cliente</strong></li>
              <li>No Vercel → Settings → Env Vars:<br /><code className="text-green-400">NEXT_PUBLIC_GOOGLE_CLIENT_ID = &lt;seu ID&gt;</code></li>
              <li>Redeploy o projeto</li>
            </ol>
            <button onClick={() => setShowInfo(false)} className="mt-3 text-neutral-500 hover:text-white">Fechar</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      {/* Status/botão principal */}
      {state === 'syncing' ? (
        <button disabled
          className="flex items-center gap-1.5 bg-blue-700 opacity-80 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span className="hidden md:inline">Enviando…</span>
        </button>
      ) : state === 'success' ? (
        <button disabled
          className="flex items-center gap-1.5 bg-green-700 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg">
          <CheckCircle className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Sincronizado!</span>
        </button>
      ) : state === 'error' ? (
        <button onClick={handleSync}
          title={errMsg ?? 'Erro — clique para tentar novamente'}
          className="flex items-center gap-1.5 bg-red-700 hover:bg-red-600 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Erro · Tentar novamente</span>
        </button>
      ) : (
        <button onClick={handleSync}
          title={meta ? `Última sync: ${timeAgo(meta.lastSync)}` : 'Enviar para Google Drive'}
          className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors
            ${pendingSync && meta
              ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
              : 'bg-neutral-700 hover:bg-neutral-600 text-neutral-300'}`}>
          {meta ? (
            pendingSync
              ? <><RefreshCw className="w-3.5 h-3.5" /><span className="hidden md:inline">Sincronizar Drive</span></>
              : <><Cloud className="w-3.5 h-3.5 text-green-400" /><span className="hidden md:inline">Drive ✓</span></>
          ) : (
            <><CloudUpload className="w-3.5 h-3.5" /><span className="hidden md:inline">Salvar no Drive</span></>
          )}
        </button>
      )}

      {/* Botão de desconectar — visível se já tem arquivo no Drive */}
      {meta && state === 'idle' && (
        <button
          onClick={handleDisconnect}
          title="Desvincular arquivo do Drive"
          className="p-1.5 rounded hover:bg-neutral-700 text-neutral-500 hover:text-neutral-300"
        >
          ×
        </button>
      )}
    </div>
  )
}

// Limpa o token em memória para forçar nova autenticação
function _resetToken() {
  try { (window as any).google?.accounts?.oauth2?.revoke?.() } catch {}
}
