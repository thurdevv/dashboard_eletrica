// CRUD local de projetos — guardados no localStorage do dispositivo.
// O modelo BIM é carregado pelo usuário via upload manual (ModelUploader)
// e mantido em IndexedDB (modelCache) ligado ao mesmo id de projeto.

import type { Project } from '@/types'

const PROJECTS_KEY = 'bim_projects'

export function getProjects(): Project[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(PROJECTS_KEY) ?? '[]') } catch { return [] }
}

export function getProject(id: string): Project | null {
  return getProjects().find((p) => p.id === id) ?? null
}

function saveProjects(projects: Project[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects))
}

export function createProject(input: { name: string; description?: string }): Project {
  const project: Project = {
    id:          crypto.randomUUID(),
    name:        input.name.trim(),
    description: (input.description ?? '').trim(),
    createdAt:   new Date().toISOString(),
  }
  saveProjects([project, ...getProjects()])
  return project
}

export function updateProject(id: string, patch: Partial<Omit<Project, 'id' | 'createdAt'>>): Project | null {
  const all = getProjects()
  const idx = all.findIndex(p => p.id === id)
  if (idx < 0) return null
  all[idx] = { ...all[idx], ...patch }
  saveProjects(all)
  return all[idx]
}

export function upsertProjectCache(project: Project): void {
  const all = getProjects()
  const idx = all.findIndex(p => p.id === project.id)
  if (idx >= 0) all[idx] = { ...all[idx], ...project }
  else all.push(project)
  saveProjects(all)
}

export function deleteProject(id: string): void {
  saveProjects(getProjects().filter(p => p.id !== id))
  purgeLocalProjectData(id)
}

// Limpa registros locais do projeto (progresso, histórico, comentários, anotações).
export function purgeLocalProjectData(id: string): void {
  if (typeof window === 'undefined') return
  const prefixes = [`bim_exec_${id}_`, `bim_history_${id}_`, `bim_comments_${id}_`, `bim_annotations_${id}_`]
  Object.keys(localStorage)
    .filter((k) => prefixes.some(p => k === p || k.startsWith(p)))
    .forEach((k) => localStorage.removeItem(k))
}
