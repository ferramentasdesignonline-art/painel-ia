import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { getActiveClientConfig } from "@/lib/auth/helpers"
import { getClientBloqueios } from "@/lib/supabase/queries"

export async function GET(request: Request) {
  try {
    const cookieStore = cookies()
    const supabaseSession = createServerClient(
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

    const clientConfig = await getActiveClientConfig(supabaseSession)
    
    if (!clientConfig) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const bloqueios = await getClientBloqueios(supabaseAdmin, clientConfig.tabela_bloqueios)

    return NextResponse.json({ data: bloqueios }, { status: 200 })
  } catch (error) {
    console.error("Bloqueios API Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { numero_cliente } = body

    if (!numero_cliente) {
      return NextResponse.json({ error: "numero_cliente é obrigatório" }, { status: 400 })
    }

    const cookieStore = cookies()
    const supabaseSession = createServerClient(
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

    const clientConfig = await getActiveClientConfig(supabaseSession)

    if (!clientConfig) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Tenta excluir pelo numero_cliente exato
    const { error } = await supabaseAdmin
      .from(clientConfig.tabela_bloqueios)
      .delete()
      .eq('numero_cliente', numero_cliente)

    if (error) {
      console.error("Erro ao excluir bloqueio:", error)
      return NextResponse.json({ error: "Erro ao reativar IA" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "IA reativada com sucesso" }, { status: 200 })
  } catch (error) {
    console.error("Bloqueios DELETE Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
