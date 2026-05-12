'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'

// Detecta nova versão do Service Worker e oferece um botão para recarregar.
// Sem isso, usuários PWA podem ficar presos numa versão antiga por dias
// (o cache-first do sw.js só revalida em background).
export default function SWUpdatePrompt() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    let active = true
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg || !active) return

      // Se já existe um SW esperando ativação ao montar — mostra logo
      if (reg.waiting) setWaiting(reg.waiting)

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaiting(newWorker)
          }
        })
      })

      // Verifica atualizações periodicamente (a cada 30 min)
      const interval = setInterval(() => { reg.update().catch(() => {}) }, 30 * 60 * 1000)
      return () => clearInterval(interval)
    })

    // Quando o SW que controla a página muda, recarrega
    const onControllerChange = () => { window.location.reload() }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    return () => {
      active = false
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  if (!waiting || dismissed) return null

  function handleUpdate() {
    waiting?.postMessage({ type: 'SKIP_WAITING' })
  }

  return (
    <div className="fixed bottom-4 right-4 z-[60] bg-blue-600 text-white rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3 max-w-sm">
      <RefreshCw className="w-5 h-5 flex-shrink-0" />
      <div className="flex-1 text-sm">
        <p className="font-semibold">Nova versão disponível</p>
        <p className="text-xs opacity-90">Atualize para receber as últimas melhorias.</p>
      </div>
      <button
        onClick={handleUpdate}
        className="bg-white text-blue-700 hover:bg-blue-50 text-sm font-semibold px-3 py-1.5 rounded-lg"
      >
        Atualizar
      </button>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dispensar"
        className="p-1 rounded text-white/80 hover:text-white hover:bg-white/10"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
