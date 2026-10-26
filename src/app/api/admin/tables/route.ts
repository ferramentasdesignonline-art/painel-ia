import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

async function getNocoDBTables(): Promise<string[]> {
  const url = process.env.NOCODB_URL || "https://evolution-nocodb.4lap5g.easypanel.host"
  const token = process.env.NOCODB_API_TOKEN || "9Qz7ETxba8JnXq3B0e9ybHaSiDar6hLqYBIIkg7u"

  try {
    const basesRes = await fetch(`${url}/api/v2/meta/bases`, {
      headers: { "xc-token": token },
      cache: "no-store",
    })
    if (!basesRes.ok) return []
    const basesData = await basesRes.json()
    const bases = basesData.list || []

    const tableNames = new Set<string>()

    for (const b of bases) {
      const res = await fetch(`${url}/api/v2/meta/bases/${b.id}/tables`, {
        headers: { "xc-token": token },
        cache: "no-store",
      })
      if (res.ok) {
        const data = await res.json()
        for (const t of data.list || []) {
          const name = t.table_name || t.title
          if (name && !name.startsWith("nc_") && !name.startsWith("xc_") && name !== "notification") {
            tableNames.add(name)
          }
        }
      }
    }

    return Array.from(tableNames).sort()
  } catch (err) {
    console.error("Erro ao buscar tabelas do NocoDB:", err)
    return []
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const provider = searchParams.get("provider") || "supabase"

    if (provider === "nocodb") {
      const nocodbTables = await getNocoDBTables()
      return NextResponse.json({
        provider: "nocodb",
        tables: nocodbTables,
      })
    }

    // Default: Supabase
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
      return NextResponse.json({
        error: "Variáveis de ambiente URL ou SERVICE_ROLE_KEY não encontradas no servidor.",
        tables: [],
      }, { status: 500 })
    }

    const supabaseAdmin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: rpcTables, error: rpcError } = await supabaseAdmin.rpc("list_public_tables")

    if (rpcError) {
      console.error("Erro na RPC list_public_tables:", rpcError)

      const { data: directTables, error: directError } = await supabaseAdmin
        .from("pg_catalog.pg_tables")
        .select("tablename")
        .eq("schemaname", "public")

      if (directError) {
        console.error("Erro na consulta direta pg_tables:", directError)
        return NextResponse.json({
          provider: "supabase",
          error: `Erro ao listar tabelas: ${rpcError.message}. Certifique-se de ter rodado o SQL no Supabase.`,
          tables: [],
        }, { status: 500 })
      }

      return NextResponse.json({
        provider: "supabase",
        tables: directTables.map((t: any) => t.tablename).sort(),
      })
    }

    return NextResponse.json({
      provider: "supabase",
      tables: rpcTables || [],
    })
  } catch (err: any) {
    console.error("Erro crítico na API de tabelas:", err)
    return NextResponse.json({ error: err.message, tables: [] }, { status: 500 })
  }
}
