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
      tabela_estoque, // Novo campo
      supabase_url,
      supabase_anon_key,
      supabase_service_role_key,
      whatsapp_token
    } = body

    const supabaseAdmin = createClient(clientConfig.supabase_url || process.env.NEXT_PUBLIC_SUPABASE_URL!, clientConfig.supabase_service_role_key || process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
    const { data: dbData, error: dbError } = await supabaseAdmin
      .from('sistema-dash-ia_clientes')
      .insert([
        {
          auth_user_id: authData.user.id,
          nome,
          slug,
          email,
          tabela_leads,
          tabela_bloqueios,
          tabela_memoria,
          tabela_estoque, // Enviando para o banco
          supabase_url,
          supabase_anon_key,
          supabase_service_role_key,
          whatsapp_token,
          active: true
        }
      ])

    if (dbError) {
      console.error("DB Error:", dbError)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: dbError.message }, { status: 400 })
    }

    // 3. Criar Funil Padrão para o novo cliente
    // Precisamos de um objeto cliente com a ID recém criada
    const { data: newClient } = await supabaseAdmin
      .from('sistema-dash-ia_clientes')
      .select('id')
      .eq('auth_user_id', authData.user.id)
      .single();

    if (newClient) {
      await criarFunilPadrao(newClient.id, supabaseAdmin);
    }

    return NextResponse.json({ success: true, data: dbData }, { status: 201 })
  } catch (error: any) {
    console.error("Server Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
