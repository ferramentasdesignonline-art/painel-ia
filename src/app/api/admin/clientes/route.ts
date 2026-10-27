import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { criarFunilPadrao } from "@/lib/funil/criar-funil-padrao"
import { createNocoDBCliente, criarFunilPadraoNocoDB } from "@/lib/nocodb/sistema"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { 
      nome, 
      slug, 
      email, 
      password, 
      tabela_leads, 
      tabela_bloqueios, 
      tabela_memoria,
      tabela_estoque,
      supabase_url,
      supabase_anon_key,
      supabase_service_role_key,
      whatsapp_token,
      tipo_atendimento = 'com_ia',
      nome_instancia
    } = body

    const isSemIA = tipo_atendimento === 'sem_ia'

    // 1. Criar no NocoDB (Sistema Dash IA)
    let nocoClient: any = null
    try {
      nocoClient = await createNocoDBCliente({
        nome,
        slug,
        email,
        senha: password,
        active: true,
        tabela_leads: isSemIA ? null : tabela_leads,
        tabela_bloqueios: isSemIA ? null : tabela_bloqueios,
        tabela_memoria: isSemIA ? null : tabela_memoria,
        tabela_estoque: tabela_estoque || null,
        supabase_url: isSemIA ? null : supabase_url,
        supabase_anon_key: isSemIA ? null : supabase_anon_key,
        supabase_service_role_key: isSemIA ? null : supabase_service_role_key,
        whatsapp_token: whatsapp_token || null,
        tipo_atendimento: isSemIA ? 'sem_ia' : 'com_ia',
        nome_instancia: nome_instancia || null,
      })

      if (nocoClient?.Id) {
        // Criar funil padrão e 8 etapas no NocoDB
        await criarFunilPadraoNocoDB(nocoClient.Id)
      }
    } catch (nocoErr) {
      console.error("Erro ao criar cliente no NocoDB:", nocoErr)
    }

    // 2. Tentar criar no Supabase para compatibilidade legada
    let dbData: any = null
    try {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      )

      // Criar o usuário Auth no Supabase
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

      if (authData?.user) {
        const { data: insertedDb, error: dbError } = await supabaseAdmin
          .from('sistema-dash-ia_clientes')
          .insert([
            {
              auth_user_id: authData.user.id,
              nome,
              slug,
              email,
              tabela_leads: isSemIA ? null : tabela_leads,
              tabela_bloqueios: isSemIA ? null : tabela_bloqueios,
              tabela_memoria: isSemIA ? null : tabela_memoria,
              tabela_estoque: tabela_estoque || null,
              supabase_url: isSemIA ? null : supabase_url,
              supabase_anon_key: isSemIA ? null : supabase_anon_key,
              supabase_service_role_key: isSemIA ? null : supabase_service_role_key,
              whatsapp_token: whatsapp_token || null,
              tipo_atendimento: isSemIA ? 'sem_ia' : 'com_ia',
              nome_instancia: nome_instancia || null,
              active: true
            }
          ])
          .select()
          .single()

        dbData = insertedDb

        if (insertedDb?.id) {
          await criarFunilPadrao(insertedDb.id, supabaseAdmin)
        }
      }
    } catch (sbErr) {
      console.warn("Aviso: criação legada no Supabase não foi concluída:", sbErr)
    }

    // Se criou no NocoDB ou Supabase, sucesso
    const finalClient = nocoClient || dbData
    if (!finalClient) {
      return NextResponse.json({ error: "Falha ao criar cliente no sistema" }, { status: 400 })
    }

    // 4. Se houver nome_instancia, vincular ou criar na tabela wacloud_instancias / Uazapi
    const clientIdRef = nocoClient?.Id || dbData?.id
    if (nome_instancia && clientIdRef) {
      try {
        const { getWacloudSupabaseAdmin } = await import('@/lib/wacloud/supabase')
        const wacloudAdmin = getWacloudSupabaseAdmin()
        const { data: existingInst } = await wacloudAdmin
          .from('wacloud_instancias')
          .select('id')
          .eq('nome_instancia', nome_instancia)
          .maybeSingle()

        if (existingInst) {
          await wacloudAdmin
            .from('wacloud_instancias')
            .update({ cliente_id: clientIdRef, ativo: true })
            .eq('nome_instancia', nome_instancia)
        } else {
          const { createWacloudInstance } = await import('@/lib/wacloud/uazapi')
          await createWacloudInstance(nome_instancia, clientIdRef)
        }
      } catch (linkErr) {
        console.warn("Aviso ao vincular/criar wacloud_instancias:", linkErr)
      }
    }

    return NextResponse.json({ success: true, data: finalClient }, { status: 201 })
  } catch (error: any) {
    console.error("Server Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
