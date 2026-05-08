import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

// ─── Database readiness check ────────────────────────────────
// Usado por execution.ts para decidir entre Neon e fallback local.
// Retorna true só quando há uma DATABASE_URL Postgres válida configurada.
export function isDatabaseReady(): boolean {
  const url = process.env.DATABASE_URL ?? ''
  return url.startsWith('postgres://') || url.startsWith('postgresql://')
}

// ─── Lazy Drizzle client ─────────────────────────────────────
// Inicializa só na primeira chamada para não quebrar o build sem env vars.
// Lança erro claro se acessado sem DATABASE_URL — toda chamada externa deve
// proteger com isDatabaseReady() antes de tocar `db`.
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

function getClient() {
  if (_db) return _db
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set — guarded by isDatabaseReady()')
  const sql = neon(url)
  _db = drizzle(sql, { schema })
  return _db
}

export const db: ReturnType<typeof getClient> = new Proxy({} as any, {
  get(_t, prop) {
    return (getClient() as any)[prop]
  },
})

export { schema }
