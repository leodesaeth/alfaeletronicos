import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, Zap, AlertCircle } from 'lucide-react'
import { signIn, resetPassword } from '@/services/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/FormFields'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/admin'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'reset'>('login')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro de autenticação.'
      if (msg.includes('Invalid login')) {
        setError('E-mail ou senha incorretos. Verifique e tente novamente.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      setError('Digite seu e-mail para recuperar a senha.')
      return
    }
    setResetLoading(true)
    setError('')
    try {
      await resetPassword(email)
      setResetSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar e-mail.')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center p-4">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-brand/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-modal p-8 animate-slide-up">
          {/* Logo */}
          <div className="text-center mb-8">
            <img
              src="/logo-alfa-dark.png"
              alt="Alfa Eletrônicos"
              className="h-10 mx-auto object-contain mb-3"
            />
            <p className="text-sm text-muted">
              {mode === 'login' ? 'Acesso ao painel administrativo' : 'Recuperação de senha'}
            </p>
          </div>

          {/* Login Form */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <Input
                label="E-mail"
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
              />

              <div className="flex flex-col gap-1">
                <label htmlFor="password" className="text-sm font-medium text-graphite">
                  Senha <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-200 bg-white text-graphite text-sm transition-colors outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-graphite"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2.5 rounded-lg">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <Button
                type="submit"
                loading={loading}
                className="w-full mt-1"
                size="lg"
              >
                Entrar
              </Button>

              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-graphite rounded-xl text-sm font-semibold transition-colors"
              >
                ⚡ Entrar sem senha (Modo Edição)
              </button>

              <button
                type="button"
                onClick={() => { setMode('reset'); setError('') }}
                className="text-xs text-muted hover:text-brand text-center transition-colors"
              >
                Esqueci minha senha
              </button>
            </form>
          )}

          {/* Reset Password Form */}
          {mode === 'reset' && !resetSent && (
            <form onSubmit={handleReset} className="flex flex-col gap-4">
              <Input
                label="E-mail cadastrado"
                type="email"
                id="reset-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                hint="Enviaremos um link para redefinir sua senha."
              />

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2.5 rounded-lg">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <Button type="submit" loading={resetLoading} className="w-full" size="lg">
                Enviar link de recuperação
              </Button>

              <button
                type="button"
                onClick={() => { setMode('login'); setError('') }}
                className="text-xs text-muted hover:text-brand text-center transition-colors"
              >
                Voltar ao login
              </button>
            </form>
          )}

          {/* Reset success */}
          {mode === 'reset' && resetSent && (
            <div className="text-center flex flex-col gap-4">
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-graphite text-sm">E-mail enviado!</p>
                <p className="text-xs text-muted mt-1">
                  Verifique sua caixa de entrada e siga as instruções para redefinir a senha.
                </p>
              </div>
              <button
                onClick={() => { setMode('login'); setResetSent(false); setError('') }}
                className="text-xs text-brand hover:underline"
              >
                Voltar ao login
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-white/30 mt-6">
          © {new Date().getFullYear()} NexaFlow · Alfa Eletrônicos
        </p>
      </div>
    </div>
  )
}
