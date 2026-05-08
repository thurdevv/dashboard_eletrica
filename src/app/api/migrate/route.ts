import { NextRequest, NextResponse } from 'next/server'
import { db, isDatabaseReady } from '@/lib/db/client'
import { executionRecords } from '@/lib/db/schema'
import type { ExecutionRecord } from '@/types'

// POST /api/migrate
// Body: { records: ExecutionRecord[] }
// Faz upsert em massa dos registros locais para a nuvem.
export async function POST(req: NextRequest) {
  if (!isDatabaseReady()) {
    return NextResponse.json({ error: 'database not configured' }, { status: 503 })
  }

  let body: { records?: ExecutionRecord[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const records = body.records ?? []
  if (!Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ migrated: 0 })
  }

  const rows = records
    .filter((r) => r.project_id && r.ifc_global_id)
    .map((r) => ({
      projectId:         r.project_id,
      ifcGlobalId:       r.ifc_global_id,
      elementName:       r.element_name ?? null,
      elementType:       r.element_type ?? null,
      level:             r.level ?? null,
      status:            r.status ?? 'NOT_STARTED',
      executedQuantity:  Number(r.executed_quantity ?? 0),
      teamSize:          Number(r.team_size ?? 1),
      workedHours:       Number(r.worked_hours ?? 0),
      productivity:      Number(r.productivity ?? 0),
      notes:             r.notes ?? null,
      photoUrl:          r.photo_url ?? null,
      elementScreenshot: r.element_screenshot ?? null,
      elementLength:     r.element_length ?? null,
      plannedStart:      r.planned_start ?? null,
      plannedEnd:        r.planned_end ?? null,
      plannedQuantity:   r.planned_quantity ?? null,
      updatedBy:         r.updated_by ?? 'migration',
    }))

  if (rows.length === 0) return NextResponse.json({ migrated: 0 })

  try {
    // Postgres aceita upsert em batch via VALUES + ON CONFLICT.
    // Drizzle não tem helper direto pra batch upsert com colunas específicas,
    // então fazemos um loop em Promise.all (Neon HTTP é statelss e isso é eficiente).
    let migrated = 0
    for (const row of rows) {
      await db
        .insert(executionRecords)
        .values(row)
        .onConflictDoUpdate({
          target: [executionRecords.projectId, executionRecords.ifcGlobalId],
          set: { ...row, updatedAt: new Date() },
        })
      migrated++
    }
    return NextResponse.json({ migrated })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'migration failed' }, { status: 500 })
  }
}
