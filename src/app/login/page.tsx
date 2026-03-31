'use client'
import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Logo } from '../components/Logo'

function LoginErrorHandler({ onError }: { onError: (msg: string) => void }) {
  const searchParams = useSearchParams()
  useEffect(() => {
    const err = searchParams.get('error')
    if (err === 'not_registered') {
      onError('Seu email Google não está cadastrado no sistema. Solicite ao administrador.')
    }
  }, [searchParams, onError])
  return null
}

export default function LoginPage() {
  const router = useRouter()
  const [employees, setEmployees] = useState<{ id: string; name: string; email: string; role: string; isAdmin: boolean; isManager: boolean; isBP: boolean }[]>([])
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [googleLoading, setGoogleLoading] = useState(false)

  useEffect(() => {
    fetch('/api/employees')
      .then(r => r.json())
      .then(setEmployees)
      .finally(() => setLoading(false))
  }, [])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    const employee = employees.find(emp => emp.email === email.trim().toLowerCase())
    if (!employee) {
      setError('Email não encontrado. Verifique e tente novamente.')
      return
    }
    localStorage.setItem('user', JSON.stringify(employee))
    router.push('/home')
  }

  const handleQuickLogin = (emp: typeof employees[0]) => {
    localStorage.setItem('user', JSON.stringify(emp))
    router.push('/home')
  }

  const handleGoogleLogin = () => {
    setGoogleLoading(true)
    signIn('google', { callbackUrl: '/api/auth/sync' })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-g4-purple-dark via-g4-purple to-g4-burgundy flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <Logo size="lg" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">Talent Review G4</h1>
          <p className="text-g4-gold-light text-sm">Avaliação 360 com Ninebox, PDI e Feedback por IA</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Entrar</h2>

          {/* Google SSO Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors disabled:opacity-50 mb-4"
          >
            {googleLoading ? (
              <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            <span className="text-sm font-medium text-gray-700">
              {googleLoading ? 'Conectando...' : 'Entrar com Google'}
            </span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-xs text-gray-400">ou</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Email corporativo</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                placeholder="seu.email@empresa.com"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-g4-purple focus:border-transparent"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-g4-purple text-white py-3 rounded-xl font-medium hover:bg-g4-purple-dark transition-colors disabled:opacity-50"
            >
              Entrar
            </button>
          </form>

          {/* Quick Access */}
          {employees.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Acesso rápido (demo)</p>
              <div className="space-y-2">
                {employees.map(emp => (
                  <button
                    key={emp.id}
                    onClick={() => handleQuickLogin(emp)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="w-8 h-8 bg-g4-purple/10 text-g4-purple rounded-full flex items-center justify-center text-sm font-bold">
                      {emp.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{emp.name}</div>
                      <div className="text-xs text-gray-400 truncate">{emp.role}</div>
                    </div>
                    {emp.isAdmin && <span className="text-xs bg-g4-purple/10 text-g4-purple px-2 py-0.5 rounded-full">Admin</span>}
                    {emp.isBP && !emp.isAdmin && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">BP</span>}
                    {emp.isManager && !emp.isAdmin && !emp.isBP && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Gestor</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-g4-gold/70 text-xs mt-6">Código de Cultura G4 Educação</p>
      </div>
      <Suspense>
        <LoginErrorHandler onError={setError} />
      </Suspense>
    </div>
  )
}
