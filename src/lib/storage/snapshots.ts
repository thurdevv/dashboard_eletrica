// Snapshots nomeados do estado de progresso de um projeto.
// Permite "fotografar" o conjunto de records + dailyLogs + history em um ponto
// no tempo (ex: fim do mês) e restaurar/comparar depois. Útil para auditoria.

import { localBuildBundle, localRestoreBundle, type ProgressBundle } from './local'

export interface Snapshot {
  id:        string
  projectId: string
  name:      string
  notes?:    string
  createdAt: string
  bundle:    ProgressBundle
}

const KEY_PREFIX = 'bim_snapshot_'

function indexKey(projectId: string): string {
  return `${KEY_PREFIX}index_${projectId}`
}

function snapKey(projectId: string, id: string): string {
  return `${KEY_PREFIX}${projectId}_${id}`
}

interface SnapshotMeta {
  id: string
  name: string
  notes?: string
  createdAt: string
}

export function listSnapshots(projectId: string): SnapshotMeta[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(indexKey(projectId)) ?? '[]')
  } catch {
    return []
  }
}

export function createSnapshot(projectId: string, name: string, notes?: string): Snapshot {
  const snap: Snapshot = {
    id:        crypto.randomUUID(),
    projectId,
    name:      name.trim() || `Snapshot ${new Date().toLocaleString('pt-BR')}`,
    notes,
    createdAt: new Date().toISOString(),
    bundle:    localBuildBundle(projectId),
  }
  localStorage.setItem(snapKey(projectId, snap.id), JSON.stringify(snap))
  const meta: SnapshotMeta = { id: snap.id, name: snap.name, notes: snap.notes, createdAt: snap.createdAt }
  const idx = listSnapshots(projectId)
  localStorage.setItem(indexKey(projectId), JSON.stringify([meta, ...idx]))
  return snap
}

export function getSnapshot(projectId: string, id: string): Snapshot | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(snapKey(projectId, id))
  return raw ? JSON.parse(raw) : null
}

export function deleteSnapshot(projectId: string, id: string): void {
  localStorage.removeItem(snapKey(projectId, id))
  const idx = listSnapshots(projectId).filter(s => s.id !== id)
  localStorage.setItem(indexKey(projectId), JSON.stringify(idx))
}

export function restoreSnapshot(projectId: string, id: string): number {
  const snap = getSnapshot(projectId, id)
  if (!snap) return 0
  return localRestoreBundle(projectId, snap.bundle)
}
