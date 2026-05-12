import type { LoadedModel } from '@/types'

const DB_NAME = 'bim_models'
const STORE   = 'models'
const VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'projectId' })
      }
    }
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result)
    req.onerror   = ()  => reject(req.error)
  })
}

interface CachedModel {
  projectId: string
  type:      'ifc' | 'xkt'
  name:      string
  data:      ArrayBuffer
  metaData?: ArrayBuffer
  savedAt:   string
}

export async function saveModelCache(projectId: string, model: LoadedModel): Promise<void> {
  if (!model.data) return
  try {
    const db    = await openDB()
    const entry: CachedModel = {
      projectId,
      type:     model.type,
      name:     model.name,
      data:     model.data,
      metaData: model.metaData,
      savedAt:  new Date().toISOString(),
    }
    await new Promise<void>((res, rej) => {
      const tx  = db.transaction(STORE, 'readwrite')
      const req = tx.objectStore(STORE).put(entry)
      req.onsuccess = () => res()
      req.onerror   = () => rej(req.error)
    })
  } catch (e) {
    console.warn('[modelCache] save failed', e)
  }
}

export async function loadModelCache(projectId: string): Promise<LoadedModel | null> {
  try {
    const db  = await openDB()
    const row = await new Promise<CachedModel | undefined>((res, rej) => {
      const tx  = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(projectId)
      req.onsuccess = () => res(req.result)
      req.onerror   = () => rej(req.error)
    })
    if (!row) return null
    const metaUrl = row.metaData
      ? URL.createObjectURL(new Blob([row.metaData], { type: 'application/json' }))
      : undefined
    return { type: row.type, url: '', name: row.name, data: row.data, metaData: row.metaData, metaUrl }
  } catch {
    return null
  }
}

export async function deleteModelCache(projectId: string): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((res, rej) => {
      const tx  = db.transaction(STORE, 'readwrite')
      const req = tx.objectStore(STORE).delete(projectId)
      req.onsuccess = () => res()
      req.onerror   = () => rej(req.error)
    })
  } catch {}
}

export async function hasModelCache(projectId: string): Promise<boolean> {
  try {
    const db  = await openDB()
    const row = await new Promise<CachedModel | undefined>((res, rej) => {
      const tx  = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(projectId)
      req.onsuccess = () => res(req.result)
      req.onerror   = () => rej(req.error)
    })
    return !!row
  } catch {
    return false
  }
}

// Lê os ids de projeto com modelo em cache. Usado para mostrar o badge "🟢 carregado"
// na lista de projetos sem precisar carregar o ArrayBuffer inteiro.
export async function listCachedProjectIds(): Promise<Set<string>> {
  try {
    const db = await openDB()
    const ids = await new Promise<string[]>((res, rej) => {
      const tx  = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).getAllKeys()
      req.onsuccess = () => res(req.result as string[])
      req.onerror   = () => rej(req.error)
    })
    return new Set(ids)
  } catch {
    return new Set()
  }
}

// Clona o modelo cacheado de um projeto para outro id. Retorna false se não havia cache.
export async function copyModelCache(fromProjectId: string, toProjectId: string): Promise<boolean> {
  try {
    const db = await openDB()
    const row = await new Promise<CachedModel | undefined>((res, rej) => {
      const tx  = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(fromProjectId)
      req.onsuccess = () => res(req.result)
      req.onerror   = () => rej(req.error)
    })
    if (!row) return false
    await new Promise<void>((res, rej) => {
      const tx  = db.transaction(STORE, 'readwrite')
      const req = tx.objectStore(STORE).put({ ...row, projectId: toProjectId, savedAt: new Date().toISOString() })
      req.onsuccess = () => res()
      req.onerror   = () => rej(req.error)
    })
    return true
  } catch {
    return false
  }
}
