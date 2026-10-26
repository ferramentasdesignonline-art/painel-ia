import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { criarFunilPadrao } from "@/lib/funil/criar-funil-padrao"

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

    // 1. Criar o usuário Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError || !authData.user) {
      console.error("Auth Error:", authError)
      return NextResponse.json({ error: authError?.message || "Erro ao criar usuário Auth" }, { status: 400 })
    }

    // 2. Inserir o registro na tabela de clientes
    const isSemIA = tipo_atendimento === 'sem_ia'

    const { data: dbData, error: dbError } = await supabaseAdmin
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

    if (dbError) {
      console.error("DB Error:", dbError)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: dbError.message }, { status: 400 })
    }

    // 3. Criar Funil Padrão para o novo cliente
    const { data: newClient } = await supabaseAdmin
      .from('sistema-dash-ia_clientes')
      .select('id')
      .eq('auth_user_id', authData.user.id)
      .single();

    if (newClient) {
      await criarFunilPadrao(newClient.id, supabaseAdmin);

      // 4. Se houver nome_instancia, vincular ou criar na tabela wacloud_instancias / Uazapi
      if (nome_instancia) {
        try {
          const { getWacloudSupabaseAdmin } = await import('@/lib/wacloud/supabase');
          const wacloudAdmin = getWacloudSupabaseAdmin();
          const { data: existingInst } = await wacloudAdmin
            .from('wacloud_instancias')
            .select('id')
            .eq('nome_instancia', nome_instancia)
            .maybeSingle();

          if (existingInst) {
            await wacloudAdmin
              .from('wacloud_instancias')
              .update({ cliente_id: newClient.id, ativo: true })
              .eq('nome_instancia', nome_instancia);
          } else {
            const { createWacloudInstance } = await import('@/lib/wacloud/uazapi');
            await createWacloudInstance(nome_instancia, newClient.id);
          }
        } catch (linkErr) {
          console.warn("Aviso ao vincular/criar wacloud_instancias:", linkErr);
        }
      }
    }

    return NextResponse.json({ success: true, data: dbData }, { status: 201 })
  } catch (error: any) {
    console.error("Server Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
