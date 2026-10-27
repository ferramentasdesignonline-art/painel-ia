'use server'

import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { clearSessionCookie } from "@/lib/auth/session"

export async function logout() {
  // 1. Limpa o cookie de sessão do NocoDB
  clearSessionCookie()

  // 2. Sign out from Supabase (se houver sessão legada)
  try {
    const supabase = createClient()
    await supabase.auth.signOut()
  } catch {
    // ignora
  }
  
  // 3. Limpar cookies extras como o de impersonização
  const cookieStore = cookies()
  cookieStore.delete('impersonating_client_id')

  // 4. Redirecionar para o login
  redirect('/login')
}
