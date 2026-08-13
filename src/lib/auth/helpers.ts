import { SupabaseClient, createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

export type UserRole = 'master_admin' | 'client' | null

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function getUserRole(supabase: SupabaseClient): Promise<{ role: UserRole, user: any }> {
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
}

export async function getActiveClientConfig(supabase: SupabaseClient) {
  const { role, user } = await getUserRole(supabase)
  
  if (!user) return null

  const admin = getAdminClient()

  // Se for admin, verifica se está se passando por algum cliente (Impersonation)
  if (role === 'master_admin') {
    const cookieStore = cookies()
    const impersonatingClientId = cookieStore.get('impersonating_client_id')?.value
    
    if (impersonatingClientId) {
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

  // Se for um cliente normal, busca a própria config
  const { data: clientData, error } = await admin
    .from('sistema-dash-ia_clientes')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (error || !clientData) {
    console.error("Error fetching client config:", error)
    return null
  }

  return clientData
}
