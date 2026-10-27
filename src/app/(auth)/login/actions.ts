'use server'

import { redirect } from 'next/navigation'
import { authenticateWithNocoDB } from '@/lib/auth/nocodb-auth'
import { signSessionToken, setSessionCookie } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const email = (formData.get('email') as string) || ''
  const password = (formData.get('password') as string) || ''

  if (!email || !password) {
    return redirect(`/login?error=${encodeURIComponent('Informe e-mail e senha')}`)
  }

  // 1. Tenta autenticar pelo NocoDB primeiro (novo fluxo)
  const nocoAuth = await authenticateWithNocoDB(email, password)

  if (nocoAuth.success && nocoAuth.user) {
    const token = await signSessionToken({
      userId: nocoAuth.user.userId,
      email: nocoAuth.user.email,
      role: nocoAuth.user.role,
      nome: nocoAuth.user.nome,
      clientId: nocoAuth.user.clientId,
      slug: nocoAuth.user.slug,
      uuid_antigo: nocoAuth.user.uuid_antigo,
    })

    setSessionCookie(token)

    if (nocoAuth.role === 'master_admin') {
      return redirect('/admin/dashboard')
    } else {
      return redirect('/dashboard')
    }
  }

  // 2. Fallback temporário no Supabase Auth antigo (para lojas que ainda não têm senha no NocoDB)
  try {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (!error && data?.user) {
      const isAdm = email.toLowerCase().includes('ferramentas') || email.toLowerCase().includes('admin')
      const token = await signSessionToken({
        userId: data.user.id,
        email: data.user.email || email,
        role: isAdm ? 'master_admin' : 'client',
        nome: data.user.user_metadata?.nome || email.split('@')[0],
      })
      setSessionCookie(token)
      return redirect(isAdm ? '/admin/dashboard' : '/dashboard')
    }
  } catch {
    // ignora erro do supabase se falhar
  }

  return redirect(`/login?error=${encodeURIComponent(nocoAuth.error || 'E-mail ou senha incorretos')}`)
}
