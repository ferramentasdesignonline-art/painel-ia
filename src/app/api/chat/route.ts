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

    const pureNumbers = telefone.replace(/\D/g, '')
    const isSemIA = clientConfig.tipo_atendimento === 'sem_ia' || !clientConfig.tabela_memoria;

    if (isSemIA) {
      const { getWacloudSupabaseAdmin } = await import('@/lib/wacloud/supabase');
      const wacloudAdmin = getWacloudSupabaseAdmin();
      const nomeInstancia = clientConfig.nome_instancia || clientConfig.nome;

      const { data: mensagens, error } = await wacloudAdmin
        .from('wacloud_mensagens')
        .select('*')
        .eq('nome_instancia', nomeInstancia)
        .or(`telefone_contato.ilike.%${pureNumbers}%,telefone_contato.ilike.%${pureNumbers.slice(-8)}%`)
        .order('created_at', { ascending: true });

      if (error) {
        console.error("Error fetching chat from wacloud_mensagens:", error);
        return NextResponse.json({ error: "Erro ao buscar mensagens", details: error.message }, { status: 400 });
      }

      const formattedMessages = mensagens?.map((row) => ({
        id: row.id ? row.id.toString() : `${row.telefone_contato}-${row.created_at}`,
        type: row.enviado_por_mim ? 'ai' : 'human',
        message: row.mensagem || '',
        created_at: row.created_at,
        tipo_mensagem: row.tipo_mensagem,
        url_midia: row.url_midia,
      }));

      return NextResponse.json({ data: formattedMessages || [] }, { status: 200 });
    }

    const { data: mensagens, error } = await supabaseAdmin
      .from(clientConfig.tabela_memoria)
      .select('*')
      .ilike('session_id', `%${pureNumbers}%`)
      .order('created_at', { ascending: true })

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

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { telefone, text, type, mediaUrl, fileName } = body

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

    const supabaseAdmin = createClient(
      clientConfig.supabase_url || process.env.NEXT_PUBLIC_SUPABASE_URL!, 
      clientConfig.supabase_service_role_key || process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    )

    const pureNumbers = telefone.replace(/\D/g, '')
    const whatsappJid = telefone.includes('@') ? telefone : `${pureNumbers}@s.whatsapp.net`
    const numberOnly = pureNumbers

    // 1. Localiza a instância Wacloud do cliente
    const { getWacloudSupabaseAdmin } = await import('@/lib/wacloud/supabase')
    const { WACLOUD_CONFIG } = await import('@/lib/wacloud/config')
    const wacloudAdmin = getWacloudSupabaseAdmin()

    const { data: instances } = await wacloudAdmin
      .from('wacloud_instancias')
      .select('id, nome_instancia, token, cliente_id')

    const normalize = (str: string) =>
      str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase()

    const clientNameNorm = normalize(clientConfig.nome || '')
    const clientSlugNorm = normalize(clientConfig.slug || '')
    const clientInstNorm = normalize(clientConfig.whatsapp_instancia || '')

    const clientInstanciaCustom = normalize(clientConfig.nome_instancia || '')

    const instance = instances?.find((inst: any) => {
      if (inst.cliente_id && (inst.cliente_id === clientConfig.id || inst.cliente_id === clientConfig.auth_user_id)) return true
      const instNorm = normalize(inst.nome_instancia || '')
      if (clientInstanciaCustom && instNorm === clientInstanciaCustom) return true
      if (clientInstNorm && instNorm === clientInstNorm) return true
      if (clientNameNorm && (instNorm === clientNameNorm || instNorm.includes(clientNameNorm) || clientNameNorm.includes(instNorm))) return true
      if (clientSlugNorm && (instNorm === clientSlugNorm || instNorm.includes(clientSlugNorm))) return true
      return false
    })

    // 2. Dispara envio no WhatsApp via Uazapi se instância encontrada
    let sendResult = null
    if (instance && instance.token) {
      if (type && type !== 'text' && mediaUrl) {
        // Envio de mídia
        const resMedia = await fetch(`${WACLOUD_CONFIG.uazapiBaseUrl}/send/media`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'token': instance.token,
          },
          body: JSON.stringify({
            number: numberOnly,
            type: type,
            file: mediaUrl,
            text: fileName || text || '',
          }),
        })
        sendResult = await resMedia.json().catch(() => null)
      } else if (text && text.trim()) {
        // Envio de texto
        const resText = await fetch(`${WACLOUD_CONFIG.uazapiBaseUrl}/send/text`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'token': instance.token,
          },
          body: JSON.stringify({
            number: numberOnly,
            text: text.trim(),
          }),
        })
        sendResult = await resText.json().catch(() => null)
      }
    }

    // 3. Registra na tabela correspondente
    const isSemIAClient = clientConfig.tipo_atendimento === 'sem_ia' || !clientConfig.tabela_memoria;
    const contentToStore = type && type !== 'text' && mediaUrl
      ? `[ATENDIMENTO HUMANO] ${text ? text.trim() + ' ' : ''}${mediaUrl}`
      : `[ATENDIMENTO HUMANO] ${text ? text.trim() : ''}`;

    if (isSemIAClient) {
      try {
        await wacloudAdmin
          .from('wacloud_mensagens')
          .insert({
            nome_instancia: instance?.nome_instancia || clientConfig.nome_instancia || clientConfig.nome,
            telefone_contato: pureNumbers,
            nome_contato: 'Atendente',
            mensagem: text || fileName || '',
            enviado_por_mim: true,
            tipo_mensagem: type || 'text',
            url_midia: mediaUrl || null,
            created_at: new Date().toISOString()
          });
      } catch (wErr) {
        console.warn("Aviso ao salvar mensagem em wacloud_mensagens:", wErr);
      }
    } else if (clientConfig.tabela_memoria) {
      const messageJson = {
        type: "ai",
        content: contentToStore,
        additional_kwargs: {
          is_human: true,
          media_url: mediaUrl || null,
          media_type: type || 'text'
        }
      }

      const sessionIdCandidate = pureNumbers.startsWith('55') ? whatsappJid : `55${whatsappJid}`

      try {
        await supabaseAdmin
          .from(clientConfig.tabela_memoria)
          .insert({
            session_id: sessionIdCandidate,
            message: messageJson
          })
      } catch (memErr) {
        console.warn("Aviso ao salvar mensagem na memória da IA:", memErr);
      }
    }

    // 4. Bloqueia a IA automaticamente na tabela_bloqueios apenas para clientes com IA
    if (!isSemIAClient && clientConfig.tabela_bloqueios) {
      const pureWith55 = pureNumbers.startsWith('55') ? pureNumbers : `55${pureNumbers}`
      const instanciaNome = clientConfig.whatsapp_instancia || clientConfig.nome.replace(/\s+/g, '')
      const numeroClientePadrao = `${instanciaNome} ${pureWith55}@s.whatsapp.net block`

      try {
        const { data: existente } = await supabaseAdmin
          .from(clientConfig.tabela_bloqueios)
          .select('id, bloqueio_existe')
          .or(`numero_cliente.eq.${numeroClientePadrao},numero_cliente.ilike.%${pureNumbers}%,numero_cliente.ilike.%${pureWith55}%`)
          .limit(1)

        if (!existente || existente.length === 0) {
          await supabaseAdmin
            .from(clientConfig.tabela_bloqueios)
            .insert({
              numero_cliente: numeroClientePadrao,
              bloqueio_existe: true
            })
        } else if (existente[0].bloqueio_existe === false) {
          await supabaseAdmin
            .from(clientConfig.tabela_bloqueios)
            .update({ bloqueio_existe: true })
            .eq('id', existente[0].id)
        }
      } catch (e: any) {
        console.error("Erro ao criar bloqueio humano:", e)
      }
    }

    return NextResponse.json({
      success: true,
      message: "Mensagem enviada com sucesso",
      sendResult,
      content: contentToStore
    }, { status: 200 })

  } catch (error: any) {
    console.error("Chat API POST Error:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0


