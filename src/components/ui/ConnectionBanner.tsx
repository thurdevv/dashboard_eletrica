'use client'

import { useEffect, useState } from 'react'
import { WifiOff, Wifi } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

/**
 * Faixa fina no topo indicando status de conexão.
 *
 * - Quando o usuário fica **offline**: aparece em amarelo informando
 *   que o app continua funcionando localmente e as alterações serão
 *   sincronizadas depois.
 * - Quando volta a ficar **online**: mostra um toast verde por 3s
 *   confirmando a reconexão (útil em campo para o operador saber que
 *   é seguro continuar).
 *
 * Pensado para uso em obra onde conexão 3G/4G é instável.
 */
export default function ConnectionBanner() {
  const online           = useOnlineStatus()
  const [wasOffline, setWasOffline]       = useState(false)
  const [showReconnect, setShowReconnect] = useState(false)

  useEffect(() => {
    if (!online) {
      setWasOffline(true)
      setShowReconnect(false)
      return
    }
    if (online && wasOffline) {
      setShowReconnect(true)
      const t = setTimeout(() => setShowReconnect(false), 3000)
      return () => clearTimeout(t)
    }
  }, [online, wasOffline])

  if (online && !showReconnect) return null

  return (
    <div role="status" aria-live="polite"
      className={`flex-shrink-0 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold border-b
        ${online
          ? 'bg-green-50 text-green-800 border-green-200'
          : 'bg-amber-50 text-amber-900 border-amber-300'}`}>
      {online ? (
        <>
          <Wifi className="w-3.5 h-3.5" />
          <span>Conexão restabelecida. Alterações pendentes serão sincronizadas.</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3.5 h-3.5" />
          <span>
            Modo offline — suas alterações ficam salvas no dispositivo e enviadas
            quando a conexão voltar.
          </span>
        </>
      )}
    </div>
  )
}
