'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, BellRing } from 'lucide-react'
import {
  notificationsSupported, notificationPermission, requestNotificationPermission,
  isEnabled, setEnabled, showNotification,
} from '@/lib/notifications'

export default function NotificationBell() {
  const [supported,  setSupported]  = useState(true)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [enabled,    setEnabledLocal] = useState(false)
  const [open,       setOpen]       = useState(false)

  useEffect(() => {
    setSupported(notificationsSupported())
    setPermission(notificationPermission())
    setEnabledLocal(isEnabled())
  }, [])

  if (!supported) return null

  async function handleEnable() {
    const result = await requestNotificationPermission()
    setPermission(result)
    setEnabledLocal(result === 'granted')
    if (result === 'granted') {
      // Notificação de boas-vindas pra confirmar que funciona
      showNotification({
        title: 'Notificações ativadas',
        body:  'Você receberá alertas de novos problemas reportados.',
        tag:   'bim-welcome',
      })
    }
    setOpen(false)
  }

  function handleDisable() {
    setEnabled(false)
    setEnabledLocal(false)
    setOpen(false)
  }

  // Estado visual do botão
  const Icon = enabled ? BellRing : permission === 'denied' ? BellOff : Bell
  const colorClass = enabled
    ? 'text-green-400'
    : permission === 'denied'
      ? 'text-red-400'
      : 'text-neutral-400 hover:text-white'

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        title={
          enabled ? 'Notificações ativas — clique para gerenciar'
          : permission === 'denied' ? 'Notificações bloqueadas no browser'
          : 'Ativar notificações de problemas'
        }
        aria-label="Configurar notificações"
        className={`p-1.5 rounded-lg transition-colors ${colorClass}
          ${open ? 'bg-neutral-700' : 'hover:bg-neutral-700'}`}>
        <Icon className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-2xl p-4 z-50 text-xs text-gray-700">
          <p className="font-semibold text-gray-900 mb-2">Notificações</p>

          {permission === 'denied' && (
            <div className="space-y-2">
              <p className="text-red-600">
                As notificações estão bloqueadas para este site no seu browser.
              </p>
              <p className="text-gray-500">
                Para ativar: clique no ícone de cadeado na barra de endereço →
                Permissões → permitir notificações → recarregar.
              </p>
            </div>
          )}

          {permission === 'granted' && (
            <div className="space-y-2">
              {enabled ? (
                <>
                  <p className="text-gray-600">
                    Você está recebendo alertas de:
                  </p>
                  <ul className="text-gray-700 space-y-1 ml-2">
                    <li>• Novos problemas reportados</li>
                    <li>• Sincronização concluída</li>
                    <li>• Falhas de sync</li>
                  </ul>
                  <button onClick={handleDisable}
                    className="w-full mt-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-3 py-2 rounded-lg">
                    Desativar
                  </button>
                </>
              ) : (
                <>
                  <p className="text-gray-600">As notificações estão pausadas.</p>
                  <button onClick={() => { setEnabled(true); setEnabledLocal(true); setOpen(false) }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-2 rounded-lg">
                    Ativar
                  </button>
                </>
              )}
            </div>
          )}

          {permission === 'default' && (
            <div className="space-y-2">
              <p className="text-gray-600">
                Receba alertas quando alguém reportar um problema em obra,
                mesmo com o app em segundo plano.
              </p>
              <button onClick={handleEnable}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-2 rounded-lg">
                Permitir notificações
              </button>
            </div>
          )}

          <p className="mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-400 leading-relaxed">
            Funciona localmente neste navegador. Para alertas cross-device em
            tempo real, é necessário um servidor de Push (não configurado).
          </p>
        </div>
      )}
    </div>
  )
}
