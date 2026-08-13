import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { getActiveClientConfig } from "@/lib/auth/helpers"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nome, telefone, veiculo_interessado } = body

    if (!nome || !telefone) {
      return NextResponse.json({ error: "Nome e telefone são obrigatórios." }, { status: 400 })
    }

    const cookieStore = cookies()
    const supabaseSession = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
    )

    const clientConfig = await getActiveClientConfig(supabaseSession)
    if (!clientConfig) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data, error } = await supabaseAdmin
      .from(clientConfig.tabela_leads)
      .insert({
        nome,
        telefone,
        veiculo_interessado: veiculo_interessado || null,
        lead_finalizado: false,
        quantidade_followup: 0,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating lead:", error)
      return NextResponse.json({ error: "Erro ao criar lead: " + error.message }, { status: 400 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error("Create Lead API Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
