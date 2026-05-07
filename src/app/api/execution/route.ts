import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/client'

// GET /api/execution?project_id=X&ifc_global_id=Y
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const projectId  = searchParams.get('project_id')
  const globalId   = searchParams.get('ifc_global_id')

  if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  const supabase = createServerClient()
  let query = supabase.from('execution_records').select('*').eq('project_id', projectId)
  if (globalId) query = query.eq('ifc_global_id', globalId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/execution — upsert
export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('execution_records')
    .upsert(body, { onConflict: 'project_id,ifc_global_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 200 })
}
