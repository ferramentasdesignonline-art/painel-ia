import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { getActiveClientConfig, getUserRole } from "@/lib/auth/helpers"
import { editarVeiculo, excluirVeiculo } from "@/lib/estoque/service"

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
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

    const body = await request.json()
    const ativo = body.ativo !== false
    const updated = await editarVeiculo(clientConfig.tabela_estoque, params.id, ativo, body)
    return NextResponse.json({ success: true, vehicle: updated })
  } catch (error: any) {
    console.error("Erro ao editar veículo:", error)
    return NextResponse.json({ error: error.message || "Erro ao editar veículo" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
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

    const { role } = await getUserRole(supabase)
    if (role !== "master_admin") {
      return NextResponse.json({ error: "Apenas administradores podem excluir veículos" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const ativo = searchParams.get("ativo") !== "false"

    const result = await excluirVeiculo(clientConfig.tabela_estoque, params.id, ativo)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Erro ao excluir veículo:", error)
    return NextResponse.json({ error: error.message || "Erro ao excluir veículo" }, { status: 500 })
  }
}
