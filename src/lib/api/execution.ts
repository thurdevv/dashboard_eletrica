import { zipSync, strToU8 } from 'fflate'
import { supabase } from '@/lib/supabase/client'
import {
  localGet, localGetAll, localUpsert, localGetLevels, localGetElementTypes,
  localExport, localImport, localGetDailyLog, localAddDailyEntry, localDeleteDailyEntry,
  localBuildBundle, localRestoreBundle,
} from '@/lib/storage/local'
import type { ExecutionRecord, ExecutionFormData, IFCElement, FilterState, DailyEntry, LoadedModel } from '@/types'

function isSupabaseReady(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.NEXT_PUBLIC_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  return (
    url.startsWith('https://') &&
    !url.includes('YOUR_PROJECT') &&
    !url.includes('your_project') &&
    key.length > 10 &&
    !key.includes('your-') &&
    !key.includes('YOUR_')
  )
}

// ─── Fetch one record ─────────────────────────────────────────
export async function getExecutionRecord(
  projectId: string,
  ifcGlobalId: string,
): Promise<ExecutionRecord | null> {
  if (!isSupabaseReady()) return localGet(projectId, ifcGlobalId)

  try {
    const { data, error } = await supabase
      .from('execution_records')
      .select('*')
      .eq('project_id', projectId)
      .eq('ifc_global_id', ifcGlobalId)
      .maybeSingle()

    if (error) throw error
    return data
  } catch {
    return localGet(projectId, ifcGlobalId)
  }
}

// ─── Fetch all records ────────────────────────────────────────
export async function getProjectRecords(
  projectId: string,
  filters?: Partial<FilterState>,
): Promise<ExecutionRecord[]> {
  if (!isSupabaseReady()) return localGetAll(projectId, filters)

  try {
    let query = supabase
      .from('execution_records')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (filters?.status && filters.status !== 'ALL') query = query.eq('status', filters.status)
    if (filters?.level)                               query = query.eq('level', filters.level)
    if (filters?.elementType)                         query = query.eq('element_type', filters.elementType)

    const { data, error } = await query
    if (error) throw error
    return data ?? []
  } catch {
    return localGetAll(projectId, filters)
  }
}

// ─── Upsert record ────────────────────────────────────────────
export async function upsertExecutionRecord(
  projectId: string,
  element: IFCElement,
  form: ExecutionFormData,
  photoUrl?: string,
  changedBy: string = 'local',
): Promise<ExecutionRecord> {
  if (!isSupabaseReady()) return localUpsert(projectId, element, form, photoUrl, changedBy)

  try {
    const denom = form.team_size * form.worked_hours
    const record = {
      project_id:        projectId,
      ifc_global_id:     element.globalId,
      element_name:      element.name,
      element_type:      element.type,
      level:             element.level,
      status:            form.status,
      executed_quantity: form.executed_quantity,
      team_size:         form.team_size,
      worked_hours:      form.worked_hours,
      productivity:      denom > 0 ? form.executed_quantity / denom : 0,
      notes:              form.notes,
      photo_url:          photoUrl,
      element_screenshot: element.screenshot,
      element_length:     element.length,
      planned_start:      form.planned_start ?? null,
      planned_end:        form.planned_end ?? null,
      planned_quantity:   form.planned_quantity ?? null,
      updated_by:         changedBy,
    }

    const { data, error } = await supabase
      .from('execution_records')
      .upsert(record, { onConflict: 'project_id,ifc_global_id' })
      .select()
      .single()

    if (error) throw error
    return data
  } catch {
    return localUpsert(projectId, element, form, photoUrl, changedBy)
  }
}

// ─── Compress image to JPEG data URL (max 1024px, 65% quality) ─
function compressPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const MAX = 1024
        let { width, height } = img
        if (width > MAX) { height = Math.round(height * MAX / width); width = MAX }
        if (height > MAX) { width = Math.round(width * MAX / height); height = MAX }
        const canvas = document.createElement('canvas')
        canvas.width  = width
        canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.65))
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

// ─── Upload photo ─────────────────────────────────────────────
export async function uploadExecutionPhoto(
  projectId: string,
  globalId: string,
  file: File,
): Promise<string> {
  if (!isSupabaseReady()) {
    return compressPhoto(file)
  }

  try {
    const ext  = file.name.split('.').pop()
    const path = `${projectId}/${globalId}/${Date.now()}.${ext}`

    const { error } = await supabase.storage
      .from('execution-photos')
      .upload(path, file, { upsert: true })

    if (error) throw error

    const { data } = supabase.storage.from('execution-photos').getPublicUrl(path)
    return data.publicUrl
  } catch {
    return compressPhoto(file)
  }
}

// ─── Daily progress log ───────────────────────────────────────
export function getDailyLog(projectId: string, globalId: string): DailyEntry[] {
  return localGetDailyLog(projectId, globalId)
}

export function addDailyEntry(
  projectId: string,
  globalId:  string,
  meters:    number,
  date:      string,
  notes:     string,
): DailyEntry[] {
  return localAddDailyEntry(projectId, globalId, meters, date, notes)
}

export function deleteDailyEntry(projectId: string, globalId: string, entryId: string): DailyEntry[] {
  return localDeleteDailyEntry(projectId, globalId, entryId)
}

// ─── Export / Import ─────────────────────────────────────────
export function exportProjectData(projectId: string): string {
  return localExport(projectId)
}

export function importProjectData(projectId: string, json: string): number {
  return localImport(projectId, json)
}

// ─── Exportar modelo + progresso em ZIP ──────────────────────
export async function exportModelWithProgress(
  model:     LoadedModel,
  projectId: string,
): Promise<Blob> {
  const bundle  = localBuildBundle(projectId)
  const ext     = model.type === 'ifc' ? 'ifc' : 'xkt'
  const baseName = model.name.replace(/\.(ifc|xkt)$/i, '')
  const files: Record<string, Uint8Array> = {}

  if (model.data) {
    files[`${baseName}.${ext}`] = new Uint8Array(model.data)
  }
  if (model.type === 'xkt' && model.metaData) {
    files[`${baseName}.json`] = new Uint8Array(model.metaData)
  }

  files['progresso.json'] = strToU8(JSON.stringify(bundle, null, 2))

  const zipped = zipSync(files, { level: 1 })
  return new Blob([zipped as BlobPart], { type: 'application/zip' })
}

// ─── Importar bundle de progresso embutido no ZIP ─────────────
export function importProgressBundle(projectId: string, progressJson: string): number {
  try {
    const bundle = JSON.parse(progressJson)
    return localRestoreBundle(projectId, bundle)
  } catch {
    return 0
  }
}

// ─── Distinct levels ──────────────────────────────────────────
export async function getProjectLevels(projectId: string): Promise<string[]> {
  if (!isSupabaseReady()) return localGetLevels(projectId)

  try {
    const { data, error } = await supabase
      .from('execution_records')
      .select('level')
      .eq('project_id', projectId)
      .not('level', 'is', null)

    if (error) throw error
    const rows = (data ?? []) as Array<{ level: string | null }>
    return [...new Set(rows.map((r) => r.level).filter(Boolean) as string[])].sort()
  } catch {
    return localGetLevels(projectId)
  }
}

// ─── Distinct element types ───────────────────────────────────
export async function getProjectElementTypes(projectId: string): Promise<string[]> {
  if (!isSupabaseReady()) return localGetElementTypes(projectId)

  try {
    const { data, error } = await supabase
      .from('execution_records')
      .select('element_type')
      .eq('project_id', projectId)
      .not('element_type', 'is', null)

    if (error) throw error
    const rows = (data ?? []) as Array<{ element_type: string | null }>
    return [...new Set(rows.map((r) => r.element_type).filter(Boolean) as string[])].sort()
  } catch {
    return localGetElementTypes(projectId)
  }
}
