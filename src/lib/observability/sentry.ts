/**
 * Wrapper opcional do Sentry — só inicializa se NEXT_PUBLIC_SENTRY_DSN
 * estiver definido. Em qualquer outro cenário (build local, dev, CI),
 * funciona como no-op.
 *
 * Para ativar:
 * 1. Crie projeto em sentry.io
 * 2. Adicione NEXT_PUBLIC_SENTRY_DSN no .env.local (e na Vercel)
 * 3. Reinicie o app
 */

let initialized = false

export async function initSentryIfEnabled() {
  if (initialized) return
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return

  try {
    const Sentry = await import('@sentry/nextjs')
    Sentry.init({
      dsn,
      tracesSampleRate:   0.1,
      replaysOnErrorSampleRate: 1.0,
      replaysSessionSampleRate: 0,
      environment: process.env.NODE_ENV,
    })
    initialized = true
  } catch (err) {
    console.warn('[sentry] falha ao inicializar:', err)
  }
}

export async function captureException(err: unknown, ctx?: Record<string, unknown>) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    console.error('[error]', err, ctx)
    return
  }
  try {
    const Sentry = await import('@sentry/nextjs')
    Sentry.captureException(err, { extra: ctx })
  } catch {
    console.error('[error]', err, ctx)
  }
}
