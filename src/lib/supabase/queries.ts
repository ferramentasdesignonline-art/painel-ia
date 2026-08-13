import { SupabaseClient } from "@supabase/supabase-js"

export async function getClientLeads(supabaseAdmin: SupabaseClient, leadsTableName: string) {
  const { data, error } = await supabaseAdmin
    .from(leadsTableName)
    .select('*')
    // Ajuste essa ordenação com base no schema real dessas tabelas. Ex: order by created_at desc
    .order('id', { ascending: false })
    .limit(100)
    
  if (error) {
    console.error(`Error fetching from ${leadsTableName}:`, error)
    return []
  }
  return data
}

export async function getClientBloqueios(supabaseAdmin: SupabaseClient, bloqueiosTableName: string) {
  const { data, error } = await supabaseAdmin
    .from(bloqueiosTableName)
    .select('*')
    .limit(100)
    
  if (error) {
    console.error(`Error fetching from ${bloqueiosTableName}:`, error)
    return []
  }
  return data
}

export async function getClientEstoque(supabaseAdmin: SupabaseClient, estoqueTableName: string) {
  const { data, error } = await supabaseAdmin
    .from(estoqueTableName)
    .select('*')
    .limit(100)
    
  if (error) {
    console.error(`Error fetching from ${estoqueTableName}:`, error)
    return []
  }
  return data
}

