'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Layers, Eye, EyeOff } from 'lucide-react'
import { signIn, signUp, getCurrentSession, authMode } from '@/lib/auth'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { AppError, toAppError } from '@/lib/errors'

export default function LoginPage() {
  const router = useRouter()
  const [isRegister,  setIsRegister]  = useState(false)
  const [username,    setUsername]    = useState('')
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [error,       setError]       = useState<AppError | null>(null)
  const [loading,     setLoading]     = useState(false)

  useEffect(() => {
    // Se já logado, vai para projetos
    if (getCurrentSession()) { router.replace('/projects'); return }
    // Padrão é "Entrar"; usuário escolhe explicitamente cadastrar pelo link
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!username.trim() || !password) {
      setError(new AppError('AUTH_MISSING_FIELDS'))
      setLoading(false)
      return
    }

    try {
      if (isRegister) {
        if (password !== confirm) { setError(new AppError('AUTH_PASSWORD_MISMATCH')); setLoading(false); return }
        if (password.length < 6)  { setError(new AppError('AUTH_PASSWORD_TOO_SHORT')); setLoading(false); return }
        const user = await signUp(username, password)
        if (!user) {
          setError(new AppError(authMode() === 'supabase'
            ? 'AUTH_EMAIL_TAKEN_OR_INVALID'
            : 'AUTH_USERNAME_TAKEN'))
          setLoading(false); return
        }
        router.replace('/projects')
      } else {
        const user = await signIn(username, password)
        if (!user) { setError(new AppError('AUTH_INVALID_CREDENTIALS')); setLoading(false); return }
        router.replace('/projects')
      }
    } catch (err: unknown) {
      setError(toAppError(err, 'AUTH_UNEXPECTED'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Layers className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">BIM Elétrico</h1>
          <p className="text-neutral-400 text-sm mt-1">Acompanhamento de Instalações</p>
        </div>

        {/* Card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold text-lg mb-5">
            {isRegister ? 'Criar conta' : 'Entrar'}
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-neutral-400 font-medium block mb-1">Usuário</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="nome de usuário"
                autoComplete="username"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400 font-medium block mb-1">Senha</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 pr-10"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {isRegister && (
              <div>
                <label className="text-xs text-neutral-400 font-medium block mb-1">Confirmar senha</label>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            {error && <ErrorMessage error={error} variant="inline" />}

            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm mt-1"
            >
              {loading ? 'Aguarde…' : isRegister ? 'Criar conta' : 'Entrar'}
            </button>
          </form>

          <button
            onClick={() => { setIsRegister(!isRegister); setError(null) }}
            className="w-full text-center text-xs text-neutral-500 hover:text-neutral-300 mt-4 transition-colors"
          >
            {isRegister ? 'Já tenho conta → Entrar' : 'Criar nova conta'}
          </button>
        </div>
      </div>
    </div>
  )
}
