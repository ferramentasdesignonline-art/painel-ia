import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { getActiveClientConfig } from "@/lib/auth/helpers"
import { listarEstoqueCliente, criarVeiculo } from "@/lib/estoque/service"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    const clientConfig = await getActiveClientConfig(supabase)
    if (!clientConfig) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    if (!clientConfig.tabela_estoque) {
      return NextResponse.json({
        enabled: false,
        message: "Módulo de estoque desativado para este cliente",
        ativos: [],
        inativos: [],
      })
    }

    const data = await listarEstoqueCliente(clientConfig.tabela_estoque)
    return NextResponse.json({
      enabled: true,
      tabela: clientConfig.tabela_estoque,
      ...data,
    })
  } catch (error: any) {
    console.error("Erro ao listar estoque:", error)
    return NextResponse.json({ error: error.message || "Erro interno ao listar estoque" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    const clientConfig = await getActiveClientConfig(supabase)
    if (!clientConfig || !clientConfig.tabela_estoque) {
      return NextResponse.json({ error: "Módulo de estoque não habilitado" }, { status: 400 })
    }

    const body = await request.json()
    const created = await criarVeiculo(clientConfig.tabela_estoque, body)
    return NextResponse.json({ success: true, vehicle: created })
  } catch (error: any) {
    console.error("Erro ao cadastrar veículo:", error)
    return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 })
  }
}
