'use client'

import { useEffect, useState } from 'react'
import { Wifi, WifiOff, HardDrive } from 'lucide-react'

// Indicador discreto de status de conexão + camada de dados em uso.
// - Online + Neon: verde, "Sincronizando com nuvem"
// - Online + Local: cinza, "Modo local"
// - Offline: amarelo, "Sem conexão — alterações ficam locais"
//
// O modo "neon ativo" é detectado via /api/db-status (rota já existe no app).
// Se a rota não responder ou retornar ready=false, considera local-only.

type DbState = 'unknown' | 'neon' | 'local'

export default function ConnectionIndicator() {
  const [online, setOnline] = useState<boolean>(true)
  const [db,     setDb]     = useState<DbState>('unknown')

  useEffect(() => {
    setOnline(navigator.onLine)
    const on  = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online',  on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const res = await fetch('/api/db-status', { cache: 'no-store' })
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (!cancelled) setDb(data?.ready ? 'neon' : 'local')
      } catch {
        if (!cancelled) setDb('local')
      }
    }
    check()
    // Re-checa quando volta online
    if (online) check()
    return () => { cancelled = true }
  }, [online])

  const config = !online
    ? { color: 'bg-amber-500/10 border-amber-500/40 text-amber-300', icon: WifiOff, label: 'Offline', sub: 'alterações ficam locais' }
    : db === 'neon'
      ? { color: 'bg-green-500/10 border-green-500/40 text-green-300', icon: Wifi, label: 'Online · Nuvem', sub: 'sincronizando' }
      : { color: 'bg-neutral-500/10 border-neutral-500/40 text-neutral-400', icon: HardDrive, label: 'Online · Local', sub: 'sem backend configurado' }

  const Icon = config.icon

  return (
    <div
      className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded border ${config.color}`}
      title={`${config.label} — ${config.sub}`}
    >
      <Icon className="w-3 h-3" />
      <span>{config.label}</span>
    </div>
  )
}
