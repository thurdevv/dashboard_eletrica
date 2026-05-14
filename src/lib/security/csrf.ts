import { NextRequest, NextResponse } from 'next/server'

// Double-submit cookie. O middleware grava `csrf_token` como cookie (não-HttpOnly,
// para o JS ler) e o cliente reenvia o mesmo valor em `x-csrf-token` em requests
// mutativos. Servidor confere a igualdade. Origin precisa bater com host.

export const CSRF_COOKIE = 'csrf_token'
export const CSRF_HEADER = 'x-csrf-token'

export function generateCsrfToken(): string {
  // Edge runtime: crypto.getRandomValues está disponível globalmente.
  const buf = new Uint8Array(24)
  crypto.getRandomValues(buf)
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
}

function originMatchesHost(req: NextRequest): boolean {
  const origin  = req.headers.get('origin')
  const referer = req.headers.get('referer')
  const host    = req.headers.get('host')
  if (!host) return false
  const expected = new Set([
    `http://${host}`,
    `https://${host}`,
  ])
  if (origin)  return expected.has(origin)
  if (referer) return [...expected].some((u) => referer.startsWith(u + '/') || referer === u)
  // Sem origin nem referer → request de fora do navegador (ex.: curl). Permite
  // apenas se vier com token válido (verificado adiante).
  return true
}

// Retorna NextResponse de erro se o request mutativo falhar a checagem.
// Retorna `null` quando ok — o handler pode prosseguir.
export function assertCsrf(req: NextRequest): NextResponse | null {
  // GET/HEAD não exigem token.
  const method = req.method.toUpperCase()
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return null

  if (!originMatchesHost(req)) {
    return NextResponse.json({ error: 'origin mismatch' }, { status: 403 })
  }

  const cookieToken = req.cookies.get(CSRF_COOKIE)?.value
  const headerToken = req.headers.get(CSRF_HEADER)
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return NextResponse.json({ error: 'csrf token invalid' }, { status: 403 })
  }
  return null
}
