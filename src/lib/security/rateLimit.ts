// Rate limit in-memory por IP. Funciona bem em runtime único (Node);
// em ambiente serverless (Vercel) cada instância tem seu próprio mapa,
// o que ainda corta brute-force significativamente. Para produção
// distribuída, trocar por Upstash/Redis.

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  ok:        boolean
  remaining: number
  resetAt:   number
}

export function rateLimit(
  key:           string,
  maxAttempts:   number,
  windowMs:      number,
): RateLimitResult {
  const now = Date.now()
  const b   = buckets.get(key)

  if (!b || b.resetAt < now) {
    const fresh: Bucket = { count: 1, resetAt: now + windowMs }
    buckets.set(key, fresh)
    return { ok: true, remaining: maxAttempts - 1, resetAt: fresh.resetAt }
  }

  b.count += 1
  const ok = b.count <= maxAttempts
  return { ok, remaining: Math.max(0, maxAttempts - b.count), resetAt: b.resetAt }
}

export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real.trim()
  return 'unknown'
}
