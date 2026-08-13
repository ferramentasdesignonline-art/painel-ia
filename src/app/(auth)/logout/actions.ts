'use server'

import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export async function logout() {
  const supabase = createClient()
  
  // 1. Sign out from Supabase (clears the session)
  const { error } = await supabase.auth.signOut()
  
  if (error) {
    console.error("Erro ao sair:", error.message)
  }

  // 2. Limpar cookies extras como o de impersonização
  const cookieStore = cookies()
  cookieStore.delete('impersonating_client_id')

  // 3. Redirecionar para o login
  redirect('/login')
}
