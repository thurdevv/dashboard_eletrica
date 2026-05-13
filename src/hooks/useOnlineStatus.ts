'use client'

import { useEffect, useState } from 'react'

/**
 * Status de conectividade do navegador.
 *
 * Usa `navigator.onLine` + eventos `online`/`offline`. Retorna `true`
 * no SSR (ou quando a API não está disponível) para evitar piscar o
 * banner "offline" no primeiro frame.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return true
    return navigator.onLine
  })

  useEffect(() => {
    function handleOnline()  { setOnline(true) }
    function handleOffline() { setOnline(false) }
    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return online
}
