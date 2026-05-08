import { NextRequest, NextResponse } from 'next/server'

// ─── Password Gate (HTTP Basic Auth) ─────────────────────────
// Ativa SOMENTE quando a env var SITE_PASSWORD estiver definida no Vercel.
// Sem ela, o middleware é no-op e o site continua aberto.
//
// Esta é uma proteção temporária enquanto a auth de usuário está em
// standby. Não substitui o sistema de login — é só um cadeado simples
// no domínio inteiro para deploys com dados sensíveis.
//
// Para ativar: Vercel → Settings → Environment Variables
//   SITE_PASSWORD = sua-senha-aqui
// Opcional:
//   SITE_USERNAME = admin   (default: "admin")

export function middleware(req: NextRequest) {
  const password = process.env.SITE_PASSWORD
  if (!password) return NextResponse.next()

  const username = process.env.SITE_USERNAME ?? 'admin'
  const auth     = req.headers.get('authorization') ?? ''

  if (auth.startsWith('Basic ')) {
    try {
      const decoded = atob(auth.slice(6))
      const [u, p]  = decoded.split(':')
      if (u === username && p === password) return NextResponse.next()
    } catch { /* malformed header → cai no 401 */ }
  }

  return new NextResponse('Authentication required', {
    status:  401,
    headers: { 'WWW-Authenticate': 'Basic realm="BIM Elétrico"' },
  })
}

// Não roda em assets estáticos, ícones PWA, manifesto e service worker.
// Sem isso a PWA não consegue carregar antes do gate liberar.
export const config = {
  matcher: [
    '/((?!_next/|sw\\.js|manifest\\.webmanifest|icon-.*\\.svg|icon-.*\\.png|favicon).*)',
  ],
}
