'use client'

import { useEffect, useRef } from 'react'

interface WakeLockSentinelLike {
  released: boolean
  release(): Promise<void>
  addEventListener?: (event: 'release', listener: () => void) => void
}

interface WakeLockApi {
  request(type: 'screen'): Promise<WakeLockSentinelLike>
}

/** Acessa `navigator.wakeLock` com fallback seguro: a API só está disponível
 *  em HTTPS e em navegadores modernos (Chrome 84+, Safari 16.4+, Firefox 126+). */
function getWakeLockApi(): WakeLockApi | null {
  if (typeof navigator === 'undefined') return null
  const api = (navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock
  return api ?? null
}

/**
 * Mantém a tela do dispositivo ligada enquanto o painel do elemento
 * estiver aberto.
 *
 * Em obra é comum o operador deixar o celular sobre a bancada para
 * digitar dados, sair pra medir, voltar — e a tela já bloqueou. O
 * Wake Lock evita esse atrito.
 *
 * Reativa automaticamente quando a aba volta a ficar visível
 * (`visibilitychange`) porque o navegador libera o lock ao esconder.
 */
export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null)

  useEffect(() => {
    if (!active) return
    const api = getWakeLockApi()
    if (!api) return    // API indisponível (iOS < 16.4, alguns Androids antigos)

    let cancelled = false

    async function acquire() {
      try {
        const sentinel = await api!.request('screen')
        if (cancelled) { void sentinel.release(); return }
        sentinelRef.current = sentinel
        sentinel.addEventListener?.('release', () => { sentinelRef.current = null })
      } catch { /* usuário negou ou bateria muito baixa — silencioso */ }
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible' && !sentinelRef.current) {
        void acquire()
      }
    }

    void acquire()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibility)
      const s = sentinelRef.current
      sentinelRef.current = null
      if (s && !s.released) { void s.release() }
    }
  }, [active])
}
