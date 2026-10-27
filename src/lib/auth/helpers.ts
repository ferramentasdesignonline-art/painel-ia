import { SupabaseClient, createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { getSession } from "./session"
import { getNocoDBClientById, getNocoDBClientByEmail } from "./nocodb-auth"

export type UserRole = 'master_admin' | 'client' | null

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function getUserRole(supabase?: SupabaseClient): Promise<{ role: UserRole, user: any }> {
  // 1. Tenta sessão NocoDB primeiro
  const session = await getSession()
  if (session) {
    return {
      role: session.role,
      user: {
        id: session.userId,
        email: session.email,
        nome: session.nome,
        role: session.role,
        ...session,
      }
    }
  }

  // 2. Fallback para Supabase se houver sessão legada
  if (supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { role: null, user: null }

      const admin = getAdminClient()
      const { data: adminData } = await admin
        .from('sistema-dash-ia-admins')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      if (adminData) {
        return { role: 'master_admin', user }
      }

      return { role: 'client', user }
    } catch {
      // ignore
    }
  }

  return { role: null, user: null }
}

export async function getActiveClientConfig(supabase?: SupabaseClient) {
  const { role, user } = await getUserRole(supabase)
  
  if (!user) return null

  const cookieStore = cookies()

  // Se for admin, verifica se está se passando por algum cliente (Impersonation)
  if (role === 'master_admin') {
    const impersonatingClientId = cookieStore.get('impersonating_client_id')?.value
    
    if (impersonatingClientId) {
      // 1. Tenta buscar no NocoDB
      try {
        const nocoClient = await getNocoDBClientById(impersonatingClientId)
        if (nocoClient) return nocoClient
      } catch (err) {
        console.warn("Erro ao buscar impersonatedClient no NocoDB:", err)
      }

      // 2. Fallback para Supabase
      const admin = getAdminClient()
      const { data: impersonatedClient } = await admin
        .from('sistema-dash-ia_clientes')
        .select('*')
        .eq('id', impersonatingClientId)
        .single()
        
      return impersonatedClient || null
    } else {
      return null
    }
  }

  // Se for um cliente normal:
  // 1. Tenta buscar no NocoDB pelo e-mail
  if (user.email) {
    try {
      const nocoClient = await getNocoDBClientByEmail(user.email)
      if (nocoClient) return nocoClient
    } catch (err) {
      console.warn("Erro ao buscar clientData no NocoDB por email:", err)
    }
  }

  // 2. Tenta buscar no NocoDB pelo ID
  if (user.clientId || user.id) {
    try {
      const nocoClient = await getNocoDBClientById(user.clientId || user.id)
      if (nocoClient) return nocoClient
    } catch (err) {
      console.warn("Erro ao buscar clientData no NocoDB por id:", err)
    }
  }

  // 3. Fallback Supabase
  const admin = getAdminClient()
  const { data: clientData, error } = await admin
    .from('sistema-dash-ia_clientes')
    .select('*')
    .or(`auth_user_id.eq.${user.id},email.eq.${user.email}`)
    .single()

  if (error || !clientData) {
    console.error("Error fetching client config:", error)
    return null
  }

  return clientData
}
