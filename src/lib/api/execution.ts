import { zipSync, strToU8 } from 'fflate'
import { and, desc, eq, isNotNull } from 'drizzle-orm'
import { db, isDatabaseReady } from '@/lib/db/client'
import { executionRecords, type ExecutionRecordRow, type ExecutionRecordInsertRow } from '@/lib/db/schema'
import {
  localGet, localGetAll, localUpsert, localGetLevels, localGetElementTypes,
  localExport, localImport, localGetDailyLog, localAddDailyEntry, localDeleteDailyEntry,
  localBuildBundle, localRestoreBundle,
} from '@/lib/storage/local'
import type { ExecutionRecord, ExecutionFormData, IFCElement, FilterState, DailyEntry, LoadedModel, ExecutionChecklist } from '@/types'

// ─── Row ↔ ExecutionRecord mappers ────────────────────────────
// Banco usa snake_case + camelCase do Drizzle; o resto do app espera o
// shape ExecutionRecord (snake_case).
function rowToRecord(row: ExecutionRecordRow): ExecutionRecord {
  return {
    id:                row.id,
    project_id:        row.projectId,
    ifc_global_id:     row.ifcGlobalId,
    element_name:      row.elementName ?? '',
    element_type:      row.elementType ?? '',
    level:             row.level ?? '',
    status:            (row.status ?? 'NOT_STARTED') as ExecutionRecord['status'],
    executed_quantity: Number(row.executedQuantity ?? 0),
    team_size:         row.teamSize ?? 1,
    worked_hours:      Number(row.workedHours ?? 0),
    productivity:      Number(row.productivity ?? 0),
    notes:             row.notes ?? '',
    photo_url:          row.photoUrl ?? undefined,
    element_screenshot: row.elementScreenshot ?? undefined,
    element_length:     row.elementLength ?? undefined,
    checklist:          (row.checklist ?? undefined) as ExecutionChecklist | undefined,
    planned_start:      row.plannedStart ?? undefined,
    planned_end:        row.plannedEnd ?? undefined,
    planned_quantity:   row.plannedQuantity ?? undefined,
    updated_by:         row.updatedBy ?? undefined,
    created_at:         row.createdAt?.toISOString(),
    updated_at:         row.updatedAt?.toISOString(),
  }
}

// Faz merge de checklist novo (do form) com o existente. photoAttached
// é auto-marcado quando há photo_url. Mantém em sincronia com mergeChecklist
// do storage local pra que Neon e localStorage produzam o mesmo resultado.
function buildChecklist(
  existing: ExecutionChecklist | undefined,
  fromForm: ExecutionChecklist | undefined,
  hasPhoto: string | undefined,
): ExecutionChecklist | null {
  const next: ExecutionChecklist = { ...(existing ?? {}), ...(fromForm ?? {}) }
  if (hasPhoto) next.photoAttached = true
  return Object.keys(next).length > 0 ? next : null
}

// ─── Fetch one record ─────────────────────────────────────────
export async function getExecutionRecord(
  projectId: string,
  ifcGlobalId: string,
): Promise<ExecutionRecord | null> {
  if (!isDatabaseReady()) return localGet(projectId, ifcGlobalId)

  try {
    const rows = await db
      .select()
      .from(executionRecords)
      .where(and(
        eq(executionRecords.projectId, projectId),
        eq(executionRecords.ifcGlobalId, ifcGlobalId),
      ))
      .limit(1)

    return rows[0] ? rowToRecord(rows[0]) : null
  } catch {
    return localGet(projectId, ifcGlobalId)
  }
}

// ─── Fetch all records ────────────────────────────────────────
export async function getProjectRecords(
  projectId: string,
  filters?: Partial<FilterState>,
): Promise<ExecutionRecord[]> {
  if (!isDatabaseReady()) return localGetAll(projectId, filters)

  try {
    const conditions = [eq(executionRecords.projectId, projectId)]
    if (filters?.status && filters.status !== 'ALL') conditions.push(eq(executionRecords.status, filters.status))
    if (filters?.level)                               conditions.push(eq(executionRecords.level, filters.level))
    if (filters?.elementType)                         conditions.push(eq(executionRecords.elementType, filters.elementType))

    const rows = await db
      .select()
      .from(executionRecords)
      .where(and(...conditions))
      .orderBy(desc(executionRecords.createdAt))

    return rows.map(rowToRecord)
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
  if (!isDatabaseReady()) return localUpsert(projectId, element, form, photoUrl, changedBy)

  // Lê o registro atual pra preservar checklist já marcado (Neon não tem
  // operador de "merge jsonb" simples — fazemos no app code).
  let existing: ExecutionRecord | null = null
  try { existing = await getExecutionRecord(projectId, element.globalId) } catch { /* segue sem prev */ }

  const denom    = form.team_size * form.worked_hours
  const photoFinal = photoUrl ?? existing?.photo_url
  const checklist = buildChecklist(existing?.checklist, form.checklist, photoFinal)

  const insertRow: ExecutionRecordInsertRow = {
    projectId,
    ifcGlobalId:      element.globalId,
    elementName:      element.name,
    elementType:      element.type,
    level:            element.level,
    status:           form.status,
    executedQuantity: form.executed_quantity,
    teamSize:         form.team_size,
    workedHours:      form.worked_hours,
    productivity:     denom > 0 ? form.executed_quantity / denom : 0,
    notes:            form.notes,
    photoUrl:         photoUrl ?? null,
    elementScreenshot: element.screenshot ?? null,
    elementLength:    element.length ?? null,
    checklist,
    plannedStart:     form.planned_start ?? null,
    plannedEnd:       form.planned_end ?? null,
    plannedQuantity:  form.planned_quantity ?? null,
    updatedBy:        changedBy,
  }

  try {
    const [row] = await db
      .insert(executionRecords)
      .values(insertRow)
      .onConflictDoUpdate({
        target: [executionRecords.projectId, executionRecords.ifcGlobalId],
        set: {
          elementName:       insertRow.elementName,
          elementType:       insertRow.elementType,
          level:             insertRow.level,
          status:            insertRow.status,
          executedQuantity:  insertRow.executedQuantity,
          teamSize:          insertRow.teamSize,
          workedHours:       insertRow.workedHours,
          productivity:      insertRow.productivity,
          notes:             insertRow.notes,
          photoUrl:          insertRow.photoUrl,
          elementScreenshot: insertRow.elementScreenshot,
          elementLength:     insertRow.elementLength,
          checklist:         insertRow.checklist,
          plannedStart:      insertRow.plannedStart,
          plannedEnd:        insertRow.plannedEnd,
          plannedQuantity:   insertRow.plannedQuantity,
          updatedBy:         insertRow.updatedBy,
          updatedAt:         new Date(),
        },
      })
      .returning()

    return rowToRecord(row)
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

// ─── Upload photo (sempre base64 — Neon armazena como TEXT) ───
// Retorna a data URL JPEG comprimida pronta para gravar em photo_url.
export async function uploadExecutionPhoto(
  _projectId: string,
  _globalId: string,
  file: File,
): Promise<string> {
  return compressPhoto(file)
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
  if (!isDatabaseReady()) return localGetLevels(projectId)

  try {
    const rows = await db
      .selectDistinct({ level: executionRecords.level })
      .from(executionRecords)
      .where(and(
        eq(executionRecords.projectId, projectId),
        isNotNull(executionRecords.level),
      ))

    return rows.map((r) => r.level).filter(Boolean).sort() as string[]
  } catch {
    return localGetLevels(projectId)
  }
}

// ─── Distinct element types ───────────────────────────────────
export async function getProjectElementTypes(projectId: string): Promise<string[]> {
  if (!isDatabaseReady()) return localGetElementTypes(projectId)

  try {
    const rows = await db
      .selectDistinct({ elementType: executionRecords.elementType })
      .from(executionRecords)
      .where(and(
        eq(executionRecords.projectId, projectId),
        isNotNull(executionRecords.elementType),
      ))

    return rows.map((r) => r.elementType).filter(Boolean).sort() as string[]
  } catch {
    return localGetElementTypes(projectId)
  }
}
