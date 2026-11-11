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
      modulo_bancos_habilitado,
      credere_store_id,
      config_simulacao,
    } = body

    const updatePayload: any = {
      nome,
      slug,
      email,
      tabela_leads: tipo_atendimento === 'sem_ia' ? 'semia_contatos' : tabela_leads,
      tabela_bloqueios: tipo_atendimento === 'sem_ia' ? null : tabela_bloqueios,
      tabela_memoria: tipo_atendimento === 'sem_ia' ? null : tabela_memoria,
      tabela_estoque,
    }
    if (supabase_url !== undefined) updatePayload.supabase_url = supabase_url
    if (whatsapp_token !== undefined) updatePayload.whatsapp_token = whatsapp_token
    if (tipo_atendimento !== undefined) updatePayload.tipo_atendimento = tipo_atendimento
    if (nome_instancia !== undefined) updatePayload.nome_instancia = nome_instancia
    if (body.whatsapp_instancia !== undefined) updatePayload.whatsapp_instancia = body.whatsapp_instancia
    if (body.whatsapp_provider !== undefined) updatePayload.whatsapp_provider = body.whatsapp_provider
    if (body.whatsapp_api_url !== undefined) updatePayload.whatsapp_api_url = body.whatsapp_api_url
    if (modulo_bancos_habilitado !== undefined) updatePayload.modulo_bancos_habilitado = Boolean(modulo_bancos_habilitado)
    if (credere_store_id !== undefined) updatePayload.credere_store_id = credere_store_id ? String(credere_store_id) : null
    if (config_simulacao !== undefined) {
      let finalJsonStr: string | null = null;
      if (config_simulacao) {
        if (typeof config_simulacao === 'string' && config_simulacao.includes('"simulation"')) {
          finalJsonStr = config_simulacao;
        } else {
          const { generateN8nSimulationJson } = await import('@/lib/credere/simulation-template');
          finalJsonStr = generateN8nSimulationJson(config_simulacao);
        }
      }
      updatePayload.config_simulacao = finalJsonStr;
    }

    // 1. Atualizar no NocoDB
    try {
      await updateNocoDBCliente(params.id, updatePayload)
    } catch (nocoErr) {
      console.warn("Aviso ao atualizar cliente no NocoDB:", nocoErr)
    }

    // 2. Se houver nome_instancia, garante vínculo e token real da Uazapi sem duplicar
    if (nome_instancia) {
      try {
        const { syncOrLinkUazapiInstance } = await import('@/lib/wacloud/uazapi')
        const linked = await syncOrLinkUazapiInstance(nome_instancia, params.id)
        if (whatsapp_token && linked?.id) {
          const { updateWacloudInstancia } = await import('@/lib/nocodb/wacloud')
          await updateWacloudInstancia(linked.id, { token: whatsapp_token })
        }
      } catch (instErr) {
        console.warn("Aviso ao sincronizar instância na edição:", instErr)
      }
    }

    // 3. Atualizar no Supabase (se registro existir)
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
