import { SupabaseClient } from "@supabase/supabase-js"

/**
 * Retorna um Set com todos os números de telefone bloqueados (com e sem 55)
 * Pagina de 1000 em 1000 para contornar o limite rígido de 1000 linhas do PostgREST/Supabase.
 */
export async function getAllBlockedNumbers(supabaseAdmin: SupabaseClient, bloqueiosTableName: string): Promise<Set<string>> {
  const blockedNumbers = new Set<string>()
  if (!bloqueiosTableName) return blockedNumbers

  const pageSize = 1000
  let from = 0
  const maxRows = 50000

  while (from < maxRows) {
    try {
      const { data, error } = await supabaseAdmin
        .from(bloqueiosTableName)
        .select('numero_cliente')
        .neq('bloqueio_existe', false)
        .range(from, from + pageSize - 1)

      if (error) {
        console.error(`Erro ao paginar bloqueios em ${bloqueiosTableName}:`, error)
        break
      }

      if (!data || data.length === 0) break

      for (const b of data) {
        if (!b.numero_cliente) continue
        const digits = b.numero_cliente.replace(/\D/g, '')
        if (digits) {
          blockedNumbers.add(digits)
          if (digits.startsWith('55') && digits.length >= 12) {
            blockedNumbers.add(digits.slice(2))
          }
          if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
            blockedNumbers.add(`55${digits}`)
          }
        }
      }

      if (data.length < pageSize) break
      from += pageSize
    } catch (err) {
      console.error(`Exceção ao buscar bloqueios em ${bloqueiosTableName}:`, err)
      break
    }
  }

  return blockedNumbers
}

export async function getClientLeads(supabaseAdmin: SupabaseClient, leadsTableName: string) {
  if (!leadsTableName) return []
  const allLeads: any[] = []
  const pageSize = 1000
  let from = 0
  const maxRows = 50000

  while (from < maxRows) {
    try {
      const { data, error } = await supabaseAdmin
        .from(leadsTableName)
        .select('*')
        .order('id', { ascending: false })
        .range(from, from + pageSize - 1)
        
      if (error) {
        // Fallback sem ordenação por 'id' caso a tabela não tenha coluna 'id'
        const { data: fallbackData, error: fbErr } = await supabaseAdmin
          .from(leadsTableName)
          .select('*')
          .range(from, from + pageSize - 1)
        if (fbErr || !fallbackData || fallbackData.length === 0) break
        allLeads.push(...fallbackData)
        if (fallbackData.length < pageSize) break
      } else {
        if (!data || data.length === 0) break
        allLeads.push(...data)
        if (data.length < pageSize) break
      }
      from += pageSize
    } catch (err) {
      console.error(`Erro ao paginar ${leadsTableName}:`, err)
      break
    }
  }

  return allLeads
}

export async function getClientBloqueios(supabaseAdmin: SupabaseClient, bloqueiosTableName: string) {
  if (!bloqueiosTableName) return []
  const allBloqueios: any[] = []
  const pageSize = 1000
  let from = 0
  const maxRows = 50000

  while (from < maxRows) {
    try {
      const { data, error } = await supabaseAdmin
        .from(bloqueiosTableName)
        .select('*')
        .order('id', { ascending: false })
        .range(from, from + pageSize - 1)
        
      if (error) {
        // Fallback sem order se não houver coluna id
        const { data: fbData, error: fbErr } = await supabaseAdmin
          .from(bloqueiosTableName)
          .select('*')
          .range(from, from + pageSize - 1)
        if (fbErr || !fbData || fbData.length === 0) break
        allBloqueios.push(...fbData)
        if (fbData.length < pageSize) break
      } else {
        if (!data || data.length === 0) break
        allBloqueios.push(...data)
        if (data.length < pageSize) break
      }
      from += pageSize
    } catch (err) {
      console.error(`Erro ao paginar ${bloqueiosTableName}:`, err)
      break
    }
  }

  return allBloqueios
}

export async function getClientEstoque(supabaseAdmin: SupabaseClient, estoqueTableName: string) {
  if (!estoqueTableName) return []
  const allEstoque: any[] = []
  const pageSize = 1000
  let from = 0
  const maxRows = 20000

  while (from < maxRows) {
    try {
      const { data, error } = await supabaseAdmin
        .from(estoqueTableName)
        .select('*')
        .range(from, from + pageSize - 1)
        
      if (error || !data || data.length === 0) break
      allEstoque.push(...data)
      if (data.length < pageSize) break
      from += pageSize
    } catch (err) {
      console.error(`Erro ao paginar ${estoqueTableName}:`, err)
      break
    }
  }

  return allEstoque
}
