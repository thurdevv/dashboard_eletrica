import type { Project } from '@/types'

const PROJECTS_KEY = 'bim_projects'

export function getProjects(): Project[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(PROJECTS_KEY) ?? '[]') } catch { return [] }
}

function saveProjects(projects: Project[]) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects))
}

export function getProject(id: string): Project | null {
  return getProjects().find((p) => p.id === id) ?? null
}

export function createProject(name: string, description: string): Project {
  const project: Project = {
    id:          crypto.randomUUID(),
    name:        name.trim(),
    description: description.trim(),
    createdAt:   new Date().toISOString(),
  }
  saveProjects([...getProjects(), project])
  return project
}

export function updateProject(id: string, fields: Partial<Pick<Project, 'name' | 'description' | 'modelName'>>) {
  const projects = getProjects().map((p) => p.id === id ? { ...p, ...fields } : p)
  saveProjects(projects)
}

export function deleteProject(id: string) {
  saveProjects(getProjects().filter((p) => p.id !== id))
  // Remove todos os registros do projeto
  if (typeof window !== 'undefined') {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(`bim_exec_${id}_`))
    keys.forEach((k) => localStorage.removeItem(k))
  }
}
