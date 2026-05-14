import { CSRF_COOKIE, CSRF_HEADER } from './csrf'

export function readCsrfCookie(): string {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]+)`))
  return m ? decodeURIComponent(m[1]!) : ''
}

// Conveniência para fetches mutativos do cliente. Adiciona o header CSRF
// automaticamente. Use em vez de fetch() para POST/PUT/PATCH/DELETE.
export function csrfFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers ?? {})
  const token   = readCsrfCookie()
  if (token) headers.set(CSRF_HEADER, token)
  return fetch(input, { ...init, headers, credentials: 'same-origin' })
}
