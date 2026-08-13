'use client'

import { login } from './actions'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { Loader2, Car, KeyRound, Mail } from 'lucide-react'

function LoginForm() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const [loading, setLoading] = useState(false)

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-gray-950 via-indigo-950 to-gray-900 p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Card */}
        <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          {/* Logo + Título */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-5">
              <img src="/logo.jpeg" alt="Auto Design Online" className="w-24 h-24 rounded-2xl shadow-xl shadow-indigo-500/30 object-cover" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight leading-tight">
              CRM para Concessionárias
            </h1>
            <p className="text-indigo-300 font-bold text-sm mt-1 tracking-wide">Auto Design Online</p>
            <p className="text-white/40 text-xs mt-3 font-medium">
              Entre com suas credenciais para acessar
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-2xl font-medium">
              {error === 'Invalid login credentials' 
                ? 'E-mail ou senha inválidos. Tente novamente.'
                : error}
            </div>
          )}

          <form action={login} onSubmit={() => setLoading(true)} className="space-y-5">
            {/* E-mail */}
            <div className="space-y-2">
              <label 
                className="text-xs font-bold text-white/60 uppercase tracking-widest block" 
                htmlFor="email"
              >
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  name="email"
                  id="email"
                  type="email"
                  placeholder="seu@email.com.br"
                  required
                  className="w-full h-12 pl-11 pr-4 bg-white/5 border border-white/10 hover:border-white/20 focus:border-indigo-500 text-white placeholder:text-white/20 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>
            </div>

            {/* Senha */}
            <div className="space-y-2">
              <label 
                className="text-xs font-bold text-white/60 uppercase tracking-widest block" 
                htmlFor="password"
              >
                Senha
              </label>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  name="password"
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  className="w-full h-12 pl-11 pr-4 bg-white/5 border border-white/10 hover:border-white/20 focus:border-indigo-500 text-white placeholder:text-white/20 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>
            </div>

            {/* Botão */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black text-sm uppercase tracking-widest rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          <p className="text-center text-white/20 text-xs mt-8 font-medium">
            © {new Date().getFullYear()} Auto Design Online — Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center bg-gray-950">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
