import bcrypt from 'bcryptjs'
import type { AppUser } from '@/types'
import { supabase } from '@/lib/supabase/client'
import { USERS_KEY, SESSION_KEY } from '@/lib/storage/constants'

const BCRYPT_ROUNDS = 10

// Hashes bcrypt sempre começam com `$2`. Use isso para detectar registros
// legados em plaintext e migrá-los on-the-fly no primeiro login bem-sucedido.
function isHashed(value: string): boolean {
  return typeof value === 'string' && /^\$2[aby]\$/.test(value)
}

function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, BCRYPT_ROUNDS)
}

function verifyPassword(plain: string, stored: string): boolean {
  if (!stored) return false
  if (isHashed(stored)) return bcrypt.compareSync(plain, stored)
  // Registro legado em plaintext — aceita igualdade direta. O chamador deve
  // re-hashear logo após para migrar o storage.
  return stored === plain
}

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
    password:  hashPassword(password),
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
  const users = getUsers()
  const user  = users.find((u) => u.username.toLowerCase() === emailOrUsername.toLowerCase())
  if (!user || !verifyPassword(password, user.password)) return null
  // Migração on-the-fly: se ainda for plaintext, re-hasheia agora.
  if (!isHashed(user.password)) {
    user.password = hashPassword(password)
    saveUsers(users)
  }
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
    password:  hashPassword(password),
    createdAt: new Date().toISOString(),
  }
  saveUsers([...users, user])
  return user
}

export function login(username: string, password: string): AppUser | null {
  if (isSupabaseAuthReady()) return null   // forçar uso de signIn() no modo supabase
  const users = getUsers()
  const user  = users.find((u) => u.username.toLowerCase() === username.toLowerCase())
  if (!user || !verifyPassword(password, user.password)) return null
  if (!isHashed(user.password)) {
    user.password = hashPassword(password)
    saveUsers(users)
  }
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
