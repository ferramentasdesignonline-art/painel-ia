import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await supabaseAdmin
    .from('sistema-dash-ia_clientes')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { 
      nome, 
      slug, 
      email, 
      tabela_leads, 
      tabela_bloqueios, 
      tabela_memoria,
      tabela_estoque
    } = body

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { error: dbError } = await supabaseAdmin
      .from('sistema-dash-ia_clientes')
      .update({
        nome,
        slug,
        email,
        tabela_leads,
        tabela_bloqueios,
        tabela_memoria,
        tabela_estoque,
      })
      .eq('id', params.id)

    if (dbError) throw dbError

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error("Erro ao atualizar cliente:", e)
    return NextResponse.json({ error: e.message || "Erro interno" }, { status: 500 })
  }
}
