import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { getActiveClientConfig } from "@/lib/auth/helpers"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const telefone = searchParams.get('telefone')

    if (!telefone) {
      return NextResponse.json({ error: "O parâmetro telefone é obrigatório" }, { status: 400 })
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
      return NextResponse.json({ error: "Unauthorized or no client config found" }, { status: 401 })
    }

    const supabaseAdmin = createClient(clientConfig.supabase_url || process.env.NEXT_PUBLIC_SUPABASE_URL!, clientConfig.supabase_service_role_key || process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    )

    // O formato na tabela parece ser exatamente o JID do WhatsApp
    // Ex: 5527999287028@s.whatsapp.net
    // Vamos buscar pelo número puro dentro do session_id
    const pureNumbers = telefone.replace(/\D/g, '')

    const { data: mensagens, error } = await supabaseAdmin
      .from(clientConfig.tabela_memoria)
      .select('*')
      .ilike('session_id', `%${pureNumbers}%`)
      .order('created_at', { ascending: true }) // Ordenando rigorosamente pela coluna de horário

    if (error) {
      console.error(`Error fetching chat from ${clientConfig.tabela_memoria}:`, error)
      return NextResponse.json({ error: "Erro ao buscar mensagens", details: error.message }, { status: 400 })
    }

    // Na sua nova tabela, cada linha é UMA mensagem (não pergunta/resposta na mesma linha)
    // E o conteúdo está dentro da coluna 'message' que é um JSONB
    const formattedMessages = mensagens?.map((row) => {
      const msgData = typeof row.message === 'string' ? JSON.parse(row.message) : row.message
      
      return {
        id: row.id ? row.id.toString() : `${row.session_id}-${row.created_at}`,
        type: msgData.type === 'human' ? 'human' : 'ai', // human ou ai
        message: msgData.content || '',
        created_at: row.created_at
      }
    })

    return NextResponse.json({ data: formattedMessages || [] }, { status: 200 })
  } catch (error) {
    console.error("Chat API Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
