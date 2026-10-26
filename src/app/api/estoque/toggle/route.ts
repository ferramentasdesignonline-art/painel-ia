import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { getActiveClientConfig } from "@/lib/auth/helpers"
import { alternarStatusVeiculo } from "@/lib/estoque/service"

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
      return NextResponse.json({ error: "Módulo de estoque não configurado" }, { status: 400 })
    }

    const { id, chave_externa, tornarAtivo } = await request.json()
    if (!id || typeof tornarAtivo !== "boolean") {
      return NextResponse.json({ error: "Parâmetros inválidos (id e tornarAtivo são obrigatórios)" }, { status: 400 })
    }

    const result = await alternarStatusVeiculo(clientConfig.tabela_estoque, id, tornarAtivo, chave_externa)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Erro ao alternar status do veículo:", error)
    return NextResponse.json({ error: error.message || "Erro ao alterar status" }, { status: 500 })
  }
}
