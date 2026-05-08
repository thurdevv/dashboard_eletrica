/**
 * Camada simples de notificações locais via Notification API + Service Worker.
 *
 * Limites:
 * - Não há servidor de Push (Web Push real exige VAPID + endpoint backend).
 *   Esta camada gera notificações locais "in-tab" + sincroniza entre abas
 *   no mesmo browser via BroadcastChannel.
 * - Notificações cross-device só funcionam quando o backend (Neon ou Drive)
 *   é consultado. O hook periódico em useNotifications faz polling leve
 *   para detectar problemas novos vindos de outros dispositivos.
 */

import type { ExecutionRecord } from '@/types'

const ENABLED_KEY    = 'bim_notifications_enabled'
const LAST_SEEN_KEY  = (projectId: string) => `bim_notifications_last_seen_${projectId}`
const CHANNEL_NAME   = 'bim-elec-notifications'

// ─── Permission ──────────────────────────────────────────────
export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission(): NotificationPermission {
  if (!notificationsSupported()) return 'denied'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied'
  if (Notification.permission === 'granted') {
    setEnabled(true)
    return 'granted'
  }
  const result = await Notification.requestPermission()
  if (result === 'granted') setEnabled(true)
  return result
}

// ─── Estado "ativada pelo usuário" (separado da permissão do browser) ──
export function isEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(ENABLED_KEY) === 'true' && notificationPermission() === 'granted'
}

export function setEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return
  localStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false')
}

// ─── Show notification (via SW pra funcionar com aba em background) ──
interface ShowOpts {
  title: string
  body?: string
  tag?:  string
  url?:  string         // deep-link aberto no click (ex: /projects/X?element=Y)
  requireInteraction?: boolean
}

export async function showNotification(opts: ShowOpts) {
  if (!isEnabled()) return
  if (typeof window === 'undefined') return

  // Caminho 1: Service Worker — preferido (background tab funciona)
  try {
    const reg = await navigator.serviceWorker?.ready
    if (reg) {
      reg.active?.postMessage({
        type: 'show-notification',
        title: opts.title, body: opts.body, tag: opts.tag,
        data: { url: opts.url },
        requireInteraction: opts.requireInteraction,
      })
      return
    }
  } catch { /* fallback abaixo */ }

  // Caminho 2: Notification direta (fallback se SW não estiver registrado)
  try {
    new Notification(opts.title, {
      body: opts.body, icon: '/icon.svg', tag: opts.tag,
    })
  } catch { /* desistir silenciosamente */ }
}

// ─── BroadcastChannel — eco entre abas do mesmo browser ──────
type BroadcastMsg =
  | { type: 'issue-reported'; projectId: string; record: ExecutionRecord }
  | { type: 'sync-completed'; projectId: string }

let _channel: BroadcastChannel | null = null
function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null
  if (typeof BroadcastChannel === 'undefined') return null
  if (!_channel) _channel = new BroadcastChannel(CHANNEL_NAME)
  return _channel
}

export function broadcast(msg: BroadcastMsg) {
  getChannel()?.postMessage(msg)
}

export function onBroadcast(handler: (msg: BroadcastMsg) => void): () => void {
  const ch = getChannel()
  if (!ch) return () => {}
  function listener(e: MessageEvent) { handler(e.data) }
  ch.addEventListener('message', listener)
  return () => ch.removeEventListener('message', listener)
}

// ─── Helpers de "last seen" pra polling de problemas remotos ──
export function getLastSeenIssueAt(projectId: string): number {
  if (typeof window === 'undefined') return 0
  const raw = localStorage.getItem(LAST_SEEN_KEY(projectId))
  return raw ? Number(raw) || 0 : 0
}

export function markIssuesSeen(projectId: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LAST_SEEN_KEY(projectId), String(Date.now()))
}
