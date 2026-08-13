import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
      return NextResponse.json({ 
        error: "Variáveis de ambiente URL ou SERVICE_ROLE_KEY não encontradas no servidor.",
        tables: [] 
      }, { status: 500 })
    }

    const supabaseAdmin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Tenta chamar a função RPC
    const { data: rpcTables, error: rpcError } = await supabaseAdmin.rpc('list_public_tables')

    if (rpcError) {
      console.error("Erro na RPC list_public_tables:", rpcError)
      
      // Tentativa de buscar via queries diretas se a RPC falhar
      const { data: directTables, error: directError } = await supabaseAdmin
        .from('pg_catalog.pg_tables')
        .select('tablename')
        .eq('schemaname', 'public')

      if (directError) {
        console.error("Erro na consulta direta pg_tables:", directError)
        return NextResponse.json({ 
          error: `Erro ao listar tabelas: ${rpcError.message}. Certifique-se de ter rodado o SQL no Supabase.`,
          tables: [] 
        }, { status: 500 })
      }

      return NextResponse.json({ 
        tables: directTables.map((t: any) => t.tablename).sort() 
      })
    }

    return NextResponse.json({ tables: rpcTables || [] })
  } catch (err: any) {
    console.error("Erro crítico na API de tabelas:", err)
    return NextResponse.json({ error: err.message, tables: [] }, { status: 500 })
  }
}
