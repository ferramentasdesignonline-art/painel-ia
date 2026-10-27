import { createClient } from "@supabase/supabase-js"
import { getWacloudSupabaseAdmin } from "@/lib/wacloud/supabase"
import { getActiveClientConfig } from "@/lib/auth/helpers"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

function normalizeStr(str: string) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
}

/**
 * Bloqueia a IA na tabela_bloqueios e registra atendimento humano na tabela_memoria
 * sempre que qualquer mensagem ou áudio/mídia for enviada manualmente por um humano.
 */
export async function autoBlockLeadOnHumanMessage({
  instanceIdOrName,
  phone,
  content,
  existingClientConfig,
}: {
  instanceIdOrName?: string
  phone: string
  content?: string
  existingClientConfig?: any
}) {
  try {
    if (!phone) return

    let clientConfig = existingClientConfig

    // 1. Se não recebeu clientConfig, tenta obter da sessão de cookies
    if (!clientConfig) {
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
        clientConfig = await getActiveClientConfig(supabaseSession)
      } catch (err) {
        // Ignora se estiver fora de contexto de requisição HTTP com cookies
      }
    }

    // 2. Se ainda não tiver clientConfig, busca através da instância do Wacloud
    if (!clientConfig && instanceIdOrName) {
      let instData: any = null
      try {
        const { getWacloudInstanciaByIdOrName } = await import('@/lib/nocodb/wacloud')
        instData = await getWacloudInstanciaByIdOrName(instanceIdOrName)
      } catch (nocoInstErr) {
        console.warn("Aviso ao buscar instancia no NocoDB em auto-block:", nocoInstErr)
      }

      if (!instData) {
        try {
          const wacloudAdmin = getWacloudSupabaseAdmin()
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(instanceIdOrName)
          let instanceQuery = wacloudAdmin.from('wacloud_instancias').select('*')
          if (isUuid) {
            instanceQuery = instanceQuery.eq('id', instanceIdOrName)
          } else {
            instanceQuery = instanceQuery.eq('nome_instancia', instanceIdOrName)
          }
          const { data } = await instanceQuery.maybeSingle()
          instData = data
        } catch (_) {}
      }

      // 1. Tenta buscar cliente no NocoDB
      if (instData?.cliente_id) {
        try {
          const { getNocoDBClienteById } = await import('@/lib/nocodb/sistema')
          const nocoCli = await getNocoDBClienteById(instData.cliente_id)
          if (nocoCli) clientConfig = nocoCli
        } catch (nocoErr) {
          console.warn("Aviso ao buscar cliente no NocoDB em auto-block:", nocoErr)
        }
      }

      if (!clientConfig && instData?.nome_instancia) {
        try {
          const { getNocoDBClientes } = await import('@/lib/nocodb/sistema')
          const allNocoClients = await getNocoDBClientes()
          const normInst = normalizeStr(instData.nome_instancia)
          clientConfig = allNocoClients?.find((c: any) => {
            const normCli = normalizeStr(c.whatsapp_instancia || c.nome || '')
            const normSlug = normalizeStr(c.slug || '')
            return normCli === normInst || normSlug === normInst || normInst.includes(normCli) || normCli.includes(normInst)
          })
        } catch (nocoListErr) {
          console.warn("Aviso ao buscar clientes no NocoDB em auto-block:", nocoListErr)
        }
      }

      // 2. Fallback Supabase
      if (!clientConfig) {
        const mainAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } }
        )

        if (instData?.cliente_id) {
          const { data: clientById } = await mainAdmin
            .from('sistema-dash-ia_clientes')
            .select('*')
            .or(`id.eq.${instData.cliente_id},auth_user_id.eq.${instData.cliente_id}`)
            .maybeSingle()
          if (clientById) clientConfig = clientById
        }

        if (!clientConfig && instData?.nome_instancia) {
          const { data: allClients } = await mainAdmin.from('sistema-dash-ia_clientes').select('*')
          const normInst = normalizeStr(instData.nome_instancia)
          clientConfig = allClients?.find((c: any) => {
            const normCli = normalizeStr(c.whatsapp_instancia || c.nome || '')
            const normSlug = normalizeStr(c.slug || '')
            return normCli === normInst || normSlug === normInst || normInst.includes(normCli) || normCli.includes(normInst)
          })
        }
      }
    }

    if (!clientConfig || !clientConfig.tabela_bloqueios) {
      return
    }

    // 3. Normaliza telefone e chave de bloqueio
    const pureDigits = phone.replace(/@s\.whatsapp\.net/gi, '').replace(/@c\.us/gi, '').replace(/\D/g, '')
    if (!pureDigits) return

    const pureWith55 = pureDigits.startsWith('55') ? pureDigits : `55${pureDigits}`
    const instanciaNome = clientConfig.whatsapp_instancia || clientConfig.nome.replace(/\s+/g, '')
    const numeroClientePadrao = `${instanciaNome} ${pureWith55}@s.whatsapp.net block`

    const supabaseAdmin = createClient(
      clientConfig.supabase_url || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      clientConfig.supabase_service_role_key || process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 4. Bloqueia na tabela_bloqueios (cria ou reativa)
    const { data: existente } = await supabaseAdmin
      .from(clientConfig.tabela_bloqueios)
      .select('id, bloqueio_existe')
      .or(`numero_cliente.eq.${numeroClientePadrao},numero_cliente.ilike.%${pureDigits}%`)
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

    // 5. Salva no histórico da tabela_memoria se houver conteúdo
    if (clientConfig.tabela_memoria && content) {
      const sessionId = `${pureWith55}@s.whatsapp.net`
      const formattedContent = content.startsWith('[ATENDIMENTO HUMANO]') ? content : `[ATENDIMENTO HUMANO] ${content}`
      await supabaseAdmin
        .from(clientConfig.tabela_memoria)
        .insert({
          session_id: sessionId,
          message: {
            type: 'ai',
            content: formattedContent,
            additional_kwargs: { human_sent_at: new Date().toISOString() }
          }
        })
    }
  } catch (err) {
    console.error("Erro no autoBlockLeadOnHumanMessage:", err)
  }
}
