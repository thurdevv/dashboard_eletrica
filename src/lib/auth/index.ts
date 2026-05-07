import type { AppUser } from '@/types'
import { supabase } from '@/lib/supabase/client'

const USERS_KEY   = 'bim_users'
const SESSION_KEY = 'bim_session'

function isSupabaseAuthReady(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_ANON_KEY ?? ''
  return (
    url.startsWith('https://') &&
    !url.includes('YOUR_PROJECT') &&
    !url.includes('your_project') &&
    key.length > 10 &&
    !key.includes('your-') &&
    !key.includes('YOUR_')
  )
}

export function authMode(): 'supabase' | 'local' {
  return isSupabaseAuthReady() ? 'supabase' : 'local'
}

// ─── Local-mode (fallback sem Supabase) ──────────────────────
function getUsers(): AppUser[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(USERS_KEY) ?? '[]') } catch { return [] }
}

function saveUsers(users: AppUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export function hasAnyUser(): boolean {
  if (isSupabaseAuthReady()) return true   // não bloqueia o fluxo de cadastro no modo Supabase
  return getUsers().length > 0
}

function setSession(userId: string, username: string) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId, username }))
}

// ─── Sign up ────────────────────────────────────────────────
export async function signUp(emailOrUsername: string, password: string): Promise<AppUser | null> {
  if (isSupabaseAuthReady()) {
    const email = emailOrUsername.includes('@')
      ? emailOrUsername
      : `${emailOrUsername.replace(/[^a-z0-9]/gi, '').toLowerCase()}@local.bim`
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error || !data.user) return null
    const user: AppUser = {
      id:        data.user.id,
      username:  emailOrUsername.trim(),
      password:  '',
      createdAt: data.user.created_at ?? new Date().toISOString(),
    }
    setSession(user.id, user.username)
    return user
  }
  // local
  const users = getUsers()
  if (users.find((u) => u.username.toLowerCase() === emailOrUsername.toLowerCase())) return null
  const user: AppUser = {
    id:        crypto.randomUUID(),
    username:  emailOrUsername.trim(),
    password,
    createdAt: new Date().toISOString(),
  }
  saveUsers([...users, user])
  setSession(user.id, user.username)
  return user
}

// ─── Sign in ────────────────────────────────────────────────
export async function signIn(emailOrUsername: string, password: string): Promise<AppUser | null> {
  if (isSupabaseAuthReady()) {
    const email = emailOrUsername.includes('@')
      ? emailOrUsername
      : `${emailOrUsername.replace(/[^a-z0-9]/gi, '').toLowerCase()}@local.bim`
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) return null
    const user: AppUser = {
      id:        data.user.id,
      username:  emailOrUsername.trim(),
      password:  '',
      createdAt: data.user.created_at ?? new Date().toISOString(),
    }
    setSession(user.id, user.username)
    return user
  }
  // local
  const user = getUsers().find(
    (u) => u.username.toLowerCase() === emailOrUsername.toLowerCase() && u.password === password,
  )
  if (!user) return null
  setSession(user.id, user.username)
  return user
}

// ─── Aliases mantidos por compatibilidade ────────────────────
export function createUser(username: string, password: string): AppUser | null {
  // legacy sync API — usa modo local
  if (isSupabaseAuthReady()) return null
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
  if (isSupabaseAuthReady()) return null   // forçar uso de signIn() no modo supabase
  const user = getUsers().find(
    (u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password,
  )
  if (!user) return null
  setSession(user.id, user.username)
  return user
}

// ─── Logout ─────────────────────────────────────────────────
export async function logout() {
  if (isSupabaseAuthReady()) {
    try { await supabase.auth.signOut() } catch { /* ignore */ }
  }
  if (typeof window !== 'undefined') localStorage.removeItem(SESSION_KEY)
}

export function getCurrentSession(): { userId: string; username: string } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
