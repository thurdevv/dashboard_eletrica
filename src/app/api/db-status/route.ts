import { NextResponse } from 'next/server'
import { isDatabaseReady } from '@/lib/db/client'

// GET /api/db-status → { ready: boolean }
// Usado pelo banner de migração para decidir se vale a pena oferecer
// o botão "Migrar agora".
export async function GET() {
  return NextResponse.json({ ready: isDatabaseReady() })
}
