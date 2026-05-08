import type { ExecutionRecord } from '@/types'

const MIGRATED_FLAG = 'bim_migrated_to_cloud'
const PREFIX        = 'bim_exec'

/**
 * Coleta TODOS os registros bim_exec_* do localStorage (de todos os projetos).
 */
export function collectLocalRecords(): ExecutionRecord[] {
  if (typeof window === 'undefined') return []
  const records: ExecutionRecord[] = []
  for (const k of Object.keys(localStorage)) {
    if (!k.startsWith(`${PREFIX}_`)) continue
    try {
      const r = JSON.parse(localStorage.getItem(k) ?? '')
      if (r?.ifc_global_id && r?.project_id) records.push(r)
    } catch { /* ignora chaves inválidas */ }
  }
  return records
}

export function hasLocalRecordsToMigrate(): boolean {
  if (typeof window === 'undefined') return false
  if (localStorage.getItem(MIGRATED_FLAG) === 'true') return false
  return collectLocalRecords().length > 0
}

export function markMigrated() {
  if (typeof window !== 'undefined') localStorage.setItem(MIGRATED_FLAG, 'true')
}

export function resetMigrationFlag() {
  if (typeof window !== 'undefined') localStorage.removeItem(MIGRATED_FLAG)
}

/**
 * Envia os registros locais para /api/migrate em uma única chamada.
 * Retorna a quantidade migrada (ou lança em caso de erro).
 */
export async function migrateLocalToCloud(): Promise<number> {
  const records = collectLocalRecords()
  if (records.length === 0) return 0

  const res = await fetch('/api/migrate', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ records }),
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new Error(errBody?.error ?? `migration failed (HTTP ${res.status})`)
  }

  const { migrated } = await res.json()
  markMigrated()
  return migrated as number
}
