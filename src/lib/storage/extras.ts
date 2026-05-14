/**
 * CRUD localStorage para Comments, Annotations 3D, Scheduled Tasks
 * e History (audit log).
 *
 * Cada coleção é gravada como uma única chave por projeto contendo um array,
 * exceto o history que é particionado por (projectId, globalId).
 */

import type {
  ElementComment,
  Annotation3D,
  ScheduledTask,
  ExecutionHistoryEntry,
  ExecutionRecord,
} from '@/types'

import { COMMENTS_PREFIX, ANNOTATIONS_PREFIX, SCHEDULE_PREFIX, HISTORY_PREFIX } from './constants'

function readArray<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') } catch { return [] }
}

function writeArray<T>(key: string, value: T[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
}

// ─── Comments ────────────────────────────────────────────────
export function getComments(projectId: string, globalId: string): ElementComment[] {
  const all = readArray<ElementComment>(`${COMMENTS_PREFIX}_${projectId}`)
  return all
    .filter((c) => c.globalId === globalId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function addComment(
  projectId: string,
  globalId:  string,
  author:    string,
  text:      string,
): ElementComment {
  const comment: ElementComment = {
    id:         crypto.randomUUID(),
    project_id: projectId,
    globalId,
    author,
    text,
    createdAt:  new Date().toISOString(),
  }
  const all = readArray<ElementComment>(`${COMMENTS_PREFIX}_${projectId}`)
  writeArray(`${COMMENTS_PREFIX}_${projectId}`, [...all, comment])
  return comment
}

export function deleteComment(projectId: string, commentId: string) {
  const all = readArray<ElementComment>(`${COMMENTS_PREFIX}_${projectId}`)
  writeArray(`${COMMENTS_PREFIX}_${projectId}`, all.filter((c) => c.id !== commentId))
}

// ─── 3D Annotations ──────────────────────────────────────────
export function getAnnotations(projectId: string): Annotation3D[] {
  return readArray<Annotation3D>(`${ANNOTATIONS_PREFIX}_${projectId}`)
}

export function addAnnotation(
  projectId: string,
  partial: Omit<Annotation3D, 'id' | 'project_id' | 'createdAt' | 'status'> & { status?: Annotation3D['status'] },
): Annotation3D {
  const annotation: Annotation3D = {
    ...partial,
    id:         crypto.randomUUID(),
    project_id: projectId,
    status:     partial.status ?? 'OPEN',
    createdAt:  new Date().toISOString(),
  }
  const all = getAnnotations(projectId)
  writeArray(`${ANNOTATIONS_PREFIX}_${projectId}`, [...all, annotation])
  return annotation
}

export function updateAnnotation(projectId: string, id: string, patch: Partial<Annotation3D>): Annotation3D | null {
  const all = getAnnotations(projectId)
  const idx = all.findIndex((a) => a.id === id)
  if (idx < 0) return null
  const updated = { ...all[idx], ...patch }
  all[idx] = updated
  writeArray(`${ANNOTATIONS_PREFIX}_${projectId}`, all)
  return updated
}

export function deleteAnnotation(projectId: string, id: string) {
  const all = getAnnotations(projectId)
  writeArray(`${ANNOTATIONS_PREFIX}_${projectId}`, all.filter((a) => a.id !== id))
}

// ─── Scheduled Tasks ─────────────────────────────────────────
export function getScheduledTasks(projectId: string): ScheduledTask[] {
  return readArray<ScheduledTask>(`${SCHEDULE_PREFIX}_${projectId}`)
    .sort((a, b) => a.plannedStart.localeCompare(b.plannedStart))
}

export function addScheduledTask(
  projectId: string,
  partial: Omit<ScheduledTask, 'id' | 'project_id' | 'createdAt' | 'status'> & { status?: ScheduledTask['status'] },
): ScheduledTask {
  const task: ScheduledTask = {
    ...partial,
    id:         crypto.randomUUID(),
    project_id: projectId,
    status:     partial.status ?? 'NOT_STARTED',
    createdAt:  new Date().toISOString(),
  }
  const all = getScheduledTasks(projectId)
  writeArray(`${SCHEDULE_PREFIX}_${projectId}`, [...all, task])
  return task
}

export function updateScheduledTask(projectId: string, id: string, patch: Partial<ScheduledTask>): ScheduledTask | null {
  const all = getScheduledTasks(projectId)
  const idx = all.findIndex((t) => t.id === id)
  if (idx < 0) return null
  const updated = { ...all[idx], ...patch }
  all[idx] = updated
  writeArray(`${SCHEDULE_PREFIX}_${projectId}`, all)
  return updated
}

export function deleteScheduledTask(projectId: string, id: string) {
  const all = getScheduledTasks(projectId)
  writeArray(`${SCHEDULE_PREFIX}_${projectId}`, all.filter((t) => t.id !== id))
}

// ─── Execution History (audit log) ───────────────────────────
function historyKey(projectId: string, globalId: string) {
  return `${HISTORY_PREFIX}_${projectId}_${globalId}`
}

export function getHistory(projectId: string, globalId: string): ExecutionHistoryEntry[] {
  return readArray<ExecutionHistoryEntry>(historyKey(projectId, globalId))
    .sort((a, b) => b.changedAt.localeCompare(a.changedAt))
}

export function appendHistory(
  projectId: string,
  globalId:  string,
  changedBy: string,
  next:      ExecutionRecord,
  prev?:     ExecutionRecord | null,
): ExecutionHistoryEntry {
  const trackedFields: Array<keyof ExecutionRecord> = [
    'status', 'executed_quantity', 'team_size', 'worked_hours', 'notes',
  ]
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  if (prev) {
    for (const f of trackedFields) {
      if (prev[f] !== next[f]) changes[f as string] = { from: prev[f], to: next[f] }
    }
    // Diff do checklist — itens individuais aparecem como "checklist.installed", etc.
    const prevCk = prev.checklist ?? {}
    const nextCk = next.checklist ?? {}
    const allKeys = new Set([...Object.keys(prevCk), ...Object.keys(nextCk)])
    for (const k of allKeys) {
      const a = (prevCk as Record<string, unknown>)[k]
      const b = (nextCk as Record<string, unknown>)[k]
      if (a !== b) changes[`checklist.${k}`] = { from: a, to: b }
    }
  }
  // Não grava se nada relevante mudou (e há um prev)
  if (prev && Object.keys(changes).length === 0) {
    return {
      id: '', project_id: projectId, globalId,
      changedAt: new Date().toISOString(), changedBy,
      status: next.status, executed_quantity: next.executed_quantity,
      team_size: next.team_size, worked_hours: next.worked_hours,
      notes: next.notes, changes: {},
    }
  }
  const entry: ExecutionHistoryEntry = {
    id:         crypto.randomUUID(),
    project_id: projectId,
    globalId,
    changedAt:  new Date().toISOString(),
    changedBy,
    status:     next.status,
    executed_quantity: next.executed_quantity,
    team_size:  next.team_size,
    worked_hours: next.worked_hours,
    notes:      next.notes,
    changes,
  }
  const all = readArray<ExecutionHistoryEntry>(historyKey(projectId, globalId))
  writeArray(historyKey(projectId, globalId), [...all, entry])
  return entry
}

export function getAllHistory(projectId: string): ExecutionHistoryEntry[] {
  if (typeof window === 'undefined') return []
  const prefix = `${HISTORY_PREFIX}_${projectId}_`
  const all: ExecutionHistoryEntry[] = []
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith(prefix)) {
      try { all.push(...(JSON.parse(localStorage.getItem(k) ?? '[]') as ExecutionHistoryEntry[])) }
      catch { /* ignore */ }
    }
  }
  return all.sort((a, b) => b.changedAt.localeCompare(a.changedAt))
}
