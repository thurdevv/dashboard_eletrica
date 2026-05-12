// Service Worker v2 — offline-first
// Estratégias:
//   - Assets estáticos (/_next/static/*, ícones, manifest, sw.js): cache-first
//   - Páginas HTML: network-first com fallback ao cache (depois ao shell '/')
//   - APIs (/api/*): direto na rede; falha não cacheia, app já tem fallback
//     local (Drizzle catch → localStorage)
//
// Modelos IFC/XKT NÃO passam por aqui — são gravados no IndexedDB pelo
// modelCache.ts no client. O SW só protege a navegação e o shell.

const VERSION = 'v2'
const STATIC_CACHE = `bim-static-${VERSION}`
const PAGES_CACHE  = `bim-pages-${VERSION}`

const PRECACHE = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-maskable.svg',
]

// ─── Install ─────────────────────────────────────────────────
// Não chama skipWaiting automaticamente — espera o usuário clicar em
// "Atualizar" no prompt (SWUpdatePrompt.tsx) para evitar trocar o SW
// em meio a uma operação (upload, geração de relatório).
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE))
  )
})

// ─── Activate ────────────────────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== PAGES_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// ─── Fetch ───────────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)

  // Não intercepta cross-origin nem APIs
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/'))    return
  if (req.method !== 'GET')                return

  // HTML / navegações → network-first com fallback ao cache → shell
  const isHTML = req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')
  if (isHTML) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(PAGES_CACHE).then((c) => c.put(req, clone))
          }
          return res
        })
        .catch(async () => {
          const cached = await caches.match(req)
          return cached ?? caches.match('/') ?? Response.error()
        })
    )
    return
  }

  // Assets estáticos → cache-first com revalidação em background
  e.respondWith(
    caches.match(req).then((cached) => {
      const fresh = fetch(req).then((res) => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(STATIC_CACHE).then((c) => c.put(req, clone))
        }
        return res
      }).catch(() => cached ?? Response.error())
      return cached ?? fresh
    })
  )
})

// ─── Notifications via SW ────────────────────────────────────
// Quando o app posta uma mensagem 'show-notification', o SW exibe usando
// showNotification (funciona mesmo se a aba está em background, ao
// contrário do new Notification() que requer aba ativa em alguns browsers).
self.addEventListener('message', (e) => {
  const msg = e.data
  if (msg?.type === 'SKIP_WAITING') {
    self.skipWaiting()
    return
  }
  if (msg?.type === 'show-notification') {
    self.registration.showNotification(msg.title ?? 'BIM Elétrico', {
      body:  msg.body  ?? '',
      icon:  '/icon.svg',
      badge: '/icon.svg',
      tag:   msg.tag   ?? 'bim-default',
      data:  msg.data  ?? {},
      requireInteraction: msg.requireInteraction ?? false,
    })
  }
})

// Click na notificação → foca/abre a URL associada (deep-link do QR)
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = e.notification.data?.url
  if (!url) return
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((all) => {
      for (const c of all) {
        if (c.url.includes(self.location.origin)) { c.focus(); c.navigate(url); return }
      }
      return self.clients.openWindow(url)
    })
  )
})
