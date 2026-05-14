import { NextRequest, NextResponse } from 'next/server'
import { CSRF_COOKIE, generateCsrfToken } from '@/lib/security/csrf'
import { rateLimit, clientIp } from '@/lib/security/rateLimit'

// ─── Password Gate (HTTP Basic Auth) ─────────────────────────
// Ativa SOMENTE quando a env var SITE_PASSWORD estiver definida no Vercel.
// Sem ela, o middleware é no-op para auth e o site continua aberto.
//
// Também: emite cookie CSRF (double-submit) em toda navegação e aplica
// rate limit nas tentativas de login.

const LOGIN_PATHS = ['/login']

export function middleware(req: NextRequest) {
  const password = process.env.SITE_PASSWORD
  let res: NextResponse | null = null

  if (password) {
    const username = process.env.SITE_USERNAME ?? 'admin'
    const auth     = req.headers.get('authorization') ?? ''
    let authorized = false
    if (auth.startsWith('Basic ')) {
      try {
        const decoded = atob(auth.slice(6))
        const [u, p]  = decoded.split(':')
        authorized    = u === username && p === password
      } catch { /* malformed → 401 */ }
    }
    if (!authorized) {
      return new NextResponse('Authentication required', {
        status:  401,
        headers: { 'WWW-Authenticate': 'Basic realm="BIM Elétrico"' },
      })
    }
  }

  // Rate limit em /login (POSTs do form) — 5 tentativas / 5 min / IP.
  const path = req.nextUrl.pathname
  if (req.method === 'POST' && LOGIN_PATHS.some((p) => path === p || path.startsWith(p + '/'))) {
    const ip = clientIp(req)
    const rl = rateLimit(`login:${ip}`, 5, 5 * 60_000)
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'too many attempts', retryAt: rl.resetAt },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      )
    }
  }

  res = NextResponse.next()

  // Garante o cookie CSRF — não-HttpOnly para o cliente reenviar no header.
  if (!req.cookies.get(CSRF_COOKIE)) {
    res.cookies.set(CSRF_COOKIE, generateCsrfToken(), {
      path:     '/',
      sameSite: 'lax',
      secure:   process.env.NODE_ENV === 'production',
      httpOnly: false,
    })
  }
  return res
}

// Não roda em assets estáticos, ícones PWA, manifesto e service worker.
export const config = {
  matcher: [
    '/((?!_next/|sw\\.js|manifest\\.webmanifest|icon-.*\\.svg|icon-.*\\.png|favicon).*)',
  ],
}
