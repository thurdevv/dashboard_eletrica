'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Cloud, CloudUpload, CloudOff, CheckCircle, AlertCircle, Loader2,
  RefreshCw, Settings, ChevronDown, Download, Unlink, ExternalLink,
} from 'lucide-react'
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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR')
}

export default function DriveSync({ projectId, fileName, getZipBlob, pendingSync, onSynced }: DriveSyncProps) {
  const [meta,     setMeta]     = useState<DriveMeta | null>(null)
  const [state,    setState]    = useState<State>('idle')
  const [errMsg,   setErrMsg]   = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(false)
  const [open,     setOpen]     = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMeta(getDriveMeta(projectId))
    if (!googleClientId()) setState('no_client_id')
  }, [projectId])

  // Fecha o popover ao clicar fora
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!popoverRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  async function handleSync() {
    setState('syncing')
    setErrMsg(null)
    try {
      const token = await requestDriveToken()
      const blob  = await getZipBlob()

      const result = await uploadZipToDrive(token, blob, fileName, meta?.fileId)
      saveDriveMeta(projectId, result)
      setMeta(result)

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

  async function handleDownloadLocal() {
    try {
      const blob = await getZipBlob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = fileName; a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setErrMsg(err?.message ?? 'Erro ao gerar backup local')
      setState('error')
    }
  }

  function handleDisconnect() {
    if (!confirm('Desvincular este projeto do arquivo no Drive?\n\nO arquivo no Drive não será apagado, mas as próximas sincronizações criarão um novo arquivo.')) return
    clearDriveMeta(projectId)
    setMeta(null)
    setState('idle')
    setOpen(false)
    _resetToken()
  }

  function openInDrive() {
    if (!meta) return
    window.open(`https://drive.google.com/file/d/${meta.fileId}/view`, '_blank')
  }

  // ─── Sem client_id configurado: aviso compacto ──────────────
  if (state === 'no_client_id') {
    return (
      <div className="relative">
        <button onClick={() => setShowInfo(!showInfo)} title="Drive não configurado"
          className="flex items-center gap-1.5 bg-neutral-700 hover:bg-neutral-600 text-neutral-400 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors">
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
              <li>Adicione o domínio em "Origens autorizadas"</li>
              <li>No Vercel → env var <code className="text-green-400">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code></li>
              <li>Redeploy</li>
            </ol>
            <button onClick={() => setShowInfo(false)} className="mt-3 text-neutral-500 hover:text-white">Fechar</button>
          </div>
        )}
      </div>
    )
  }

  // ─── Botão principal e popover detalhado ────────────────────
  const buttonClass = `flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors`

  return (
    <div className="relative" ref={popoverRef}>
      {/* Botão principal — altera a aparência conforme estado */}
      {state === 'syncing' ? (
        <button disabled className={`${buttonClass} bg-blue-700 opacity-80 text-white`}>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span className="hidden md:inline">Enviando…</span>
        </button>
      ) : state === 'success' ? (
        <button disabled className={`${buttonClass} bg-green-700 text-white`}>
          <CheckCircle className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Sincronizado!</span>
        </button>
      ) : state === 'error' ? (
        <button onClick={() => setOpen(!open)}
          title={errMsg ?? 'Erro — clique para detalhes'}
          className={`${buttonClass} bg-red-700 hover:bg-red-600 text-white`}>
          <AlertCircle className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Erro</span>
          <ChevronDown className="w-3 h-3 opacity-70" />
        </button>
      ) : (
        <button onClick={() => setOpen(!open)}
          title={meta ? `Última sync: ${timeAgo(meta.lastSync)}` : 'Configurar sincronização Drive'}
          className={`${buttonClass}
            ${pendingSync && meta
              ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
              : meta
                ? 'bg-neutral-700 hover:bg-neutral-600 text-neutral-300'
                : 'bg-neutral-700 hover:bg-neutral-600 text-neutral-300'}`}>
          {meta ? (
            pendingSync
              ? <><RefreshCw className="w-3.5 h-3.5" /><span className="hidden md:inline">Sincronizar</span></>
              : <><Cloud className="w-3.5 h-3.5 text-green-400" /><span className="hidden md:inline">Drive ✓</span></>
          ) : (
            <><CloudUpload className="w-3.5 h-3.5" /><span className="hidden md:inline">Salvar no Drive</span></>
          )}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      )}

      {/* Popover detalhado */}
      {open && state !== 'syncing' && state !== 'success' && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-2xl p-4 z-50 text-xs text-gray-700">

          {/* Status atual */}
          <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
            {meta ? (
              pendingSync
                ? <CloudOff className="w-4 h-4 text-amber-500" />
                : <Cloud className="w-4 h-4 text-green-500" />
            ) : (
              <CloudUpload className="w-4 h-4 text-gray-400" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800">
                {meta
                  ? (pendingSync ? 'Há alterações pendentes' : 'Sincronizado com Drive')
                  : 'Drive não vinculado'}
              </p>
              {meta && (
                <p className="text-gray-500 truncate" title={meta.fileName}>
                  {meta.fileName}
                </p>
              )}
            </div>
          </div>

          {/* Último sync */}
          {meta && (
            <div className="py-3 border-b border-gray-100 space-y-1">
              <p className="text-gray-400 uppercase tracking-wider text-[10px]">Último backup</p>
              <p className="text-gray-700 font-medium">{formatDateTime(meta.lastSync)}</p>
              <p className="text-gray-400">{timeAgo(meta.lastSync)}</p>
            </div>
          )}

          {/* Erro */}
          {state === 'error' && errMsg && (
            <div className="py-3 border-b border-gray-100">
              <p className="text-red-600 font-semibold">Erro:</p>
              <p className="text-red-500 mt-0.5">{errMsg}</p>
            </div>
          )}

          {/* Ações */}
          <div className="pt-3 flex flex-col gap-1.5">
            <button onClick={() => { setOpen(false); handleSync() }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold">
              <RefreshCw className="w-3.5 h-3.5" />
              {meta ? 'Sincronizar agora' : 'Salvar no Drive'}
            </button>
            <button onClick={handleDownloadLocal}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium">
              <Download className="w-3.5 h-3.5" />
              Baixar backup local (.bim)
            </button>
            {meta && (
              <>
                <button onClick={openInDrive}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir no Drive
                </button>
                <button onClick={handleDisconnect}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-50 text-red-600 font-medium">
                  <Unlink className="w-3.5 h-3.5" />
                  Desvincular do Drive
                </button>
              </>
            )}
          </div>

          {/* Dica de restauração */}
          {meta && (
            <p className="mt-3 pt-3 border-t border-gray-100 text-gray-400 text-[11px] leading-relaxed">
              Para <strong>restaurar</strong> uma versão anterior, abra a tela inicial → "Carregar do Drive" e escolha o arquivo
              versionado (com timestamp no nome) gravado em cada sync.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function _resetToken() {
  try { (window as any).google?.accounts?.oauth2?.revoke?.() } catch {}
}
