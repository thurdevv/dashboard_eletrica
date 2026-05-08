import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db, isDatabaseReady } from '@/lib/db/client'
import { executionRecords } from '@/lib/db/schema'

// GET /api/execution?project_id=X&ifc_global_id=Y
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const projectId = searchParams.get('project_id')
  const globalId  = searchParams.get('ifc_global_id')

  if (!projectId)         return NextResponse.json({ error: 'project_id required' }, { status: 400 })
  if (!isDatabaseReady()) return NextResponse.json({ error: 'database not configured' }, { status: 503 })

  try {
    const conditions = [eq(executionRecords.projectId, projectId)]
    if (globalId) conditions.push(eq(executionRecords.ifcGlobalId, globalId))
    const rows = await db.select().from(executionRecords).where(and(...conditions))
    return NextResponse.json(rows)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'query failed' }, { status: 500 })
  }
}

// POST /api/execution — upsert
export async function POST(req: NextRequest) {
  if (!isDatabaseReady()) return NextResponse.json({ error: 'database not configured' }, { status: 503 })

  try {
    const body = await req.json()
    const [row] = await db
      .insert(executionRecords)
      .values(body)
      .onConflictDoUpdate({
        target: [executionRecords.projectId, executionRecords.ifcGlobalId],
        set: { ...body, updatedAt: new Date() },
      })
      .returning()
    return NextResponse.json(row, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'upsert failed' }, { status: 500 })
  }
}
