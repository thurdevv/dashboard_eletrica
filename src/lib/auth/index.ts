import type { AppUser } from '@/types'

const USERS_KEY   = 'bim_users'
const SESSION_KEY = 'bim_session'

function getUsers(): AppUser[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(USERS_KEY) ?? '[]') } catch { return [] }
}

function saveUsers(users: AppUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export function hasAnyUser(): boolean {
  return getUsers().length > 0
}

export function createUser(username: string, password: string): AppUser | null {
  const users = getUsers()
  if (users.find((u) => u.username.toLowerCase() === username.toLowerCase())) return null
  const user: AppUser = {
    id:        crypto.randomUUID(),
    username:  username.trim(),
    password,
    createdAt: new Date().toISOString(),
  }
  saveUsers([...users, user])
  return user
}

export function login(username: string, password: string): AppUser | null {
  const user = getUsers().find(
    (u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password
  )
  if (!user) return null
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, username: user.username }))
  return user
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
}

export function getCurrentSession(): { userId: string; username: string } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
