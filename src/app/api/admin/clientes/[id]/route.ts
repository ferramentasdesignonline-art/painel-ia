import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { getNocoDBClienteById, updateNocoDBCliente } from "@/lib/nocodb/sistema"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  // 1. Tenta buscar no NocoDB
  try {
    const client = await getNocoDBClienteById(params.id)
    if (client) {
      return NextResponse.json(client)
    }
  } catch (err) {
    console.warn("Erro ao buscar cliente no NocoDB:", err)
  }

  // 2. Fallback Supabase
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
      tabela_estoque,
      supabase_url,
      whatsapp_token,
      tipo_atendimento,
      nome_instancia,
    } = body

    const updatePayload: any = {
      nome,
      slug,
      email,
      tabela_leads,
      tabela_bloqueios,
      tabela_memoria,
      tabela_estoque,
    }
    if (supabase_url !== undefined) updatePayload.supabase_url = supabase_url
    if (whatsapp_token !== undefined) updatePayload.whatsapp_token = whatsapp_token
    if (tipo_atendimento !== undefined) updatePayload.tipo_atendimento = tipo_atendimento
    if (nome_instancia !== undefined) updatePayload.nome_instancia = nome_instancia

    // 1. Atualizar no NocoDB
    try {
      await updateNocoDBCliente(params.id, updatePayload)
    } catch (nocoErr) {
      console.warn("Aviso ao atualizar cliente no NocoDB:", nocoErr)
    }

    // 2. Atualizar no Supabase (se registro existir)
    try {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )

      await supabaseAdmin
        .from('sistema-dash-ia_clientes')
        .update(updatePayload)
        .eq('id', params.id)
    } catch (sbErr) {
      console.warn("Aviso ao atualizar cliente no Supabase:", sbErr)
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error("Erro ao atualizar cliente:", e)
    return NextResponse.json({ error: e.message || "Erro interno" }, { status: 500 })
  }
}
