import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { calcularEtapaIA } from "@/lib/funil/calcular-etapa"
import { isNocoDBClient, getNocoDBLeads } from "@/lib/nocodb/service"
import { getNocoDBClientes } from "@/lib/nocodb/sistema"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    // 1. Tenta buscar clientes ativos no NocoDB
    let clients: any[] = []
    try {
      clients = await getNocoDBClientes({ activeOnly: true })
    } catch (nocoErr) {
      console.warn("Erro ao buscar clientes ativos no NocoDB:", nocoErr)
    }

    // 2. Fallback Supabase se necessário
    if (!clients || clients.length === 0) {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )

      const { data: sbClients, error: clientsError } = await supabaseAdmin
        .from('sistema-dash-ia_clientes')
        .select('*')
        .eq('active', true)
        .order('nome')

      if (clientsError || !sbClients) {
        console.error("Erro ao buscar clientes:", clientsError)
        return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 })
      }
      clients = sbClients
    }

    const clientsKpis: any[] = []

    let globalTotalLeads = 0
    let globalQualifiedLeads = 0
    let globalVisitasAgendadas = 0
    let globalSimulacoesAprovadas = 0
    let globalSimulacoesPreAprovadas = 0
    let globalSimulacoesReprovadas = 0
    let globalPerdas = 0

    // Fetch leads for each client concurrently
    await Promise.all(clients.map(async (client) => {
      let leads: any[] | null = null
      let error: any = null
      const isSemIA = client.tipo_atendimento === 'sem_ia' || !client.tabela_leads

      if (isSemIA) {
        try {
          const { getWacloudContatos } = await import('@/lib/nocodb/wacloud')
          const instName = client.whatsapp_instancia || client.nome_instancia || client.nome
          const contatos = await getWacloudContatos({ nomeInstancia: instName, limit: 10000 })
          
          const fromDate = from ? new Date(from) : null
          const toDate = to ? new Date(to) : null

          leads = contatos.filter((c: any) => {
            if (c.is_group === true || c.wa_chatid?.includes('@g.us') || c.telefone_contato?.includes('@g.us')) return false
            const dStr = c.created_at || c.CreatedAt || c.atualizado_em || c.ultimo_timestamp
            const dt = dStr ? new Date(dStr) : null
            if (!dt || isNaN(dt.getTime())) return true
            if (fromDate && dt < fromDate) return false
            if (toDate && dt > toDate) return false
            return true
          })
        } catch (errSemIA) {
          error = errSemIA
        }
      } else if (isNocoDBClient(client)) {
        try {
          leads = await getNocoDBLeads(client.tabela_leads, { from, to })
        } catch (errNoco) {
          error = errNoco
        }
      } else if (client.supabase_url && client.supabase_url.startsWith('http')) {
        try {
          const clientSupabaseAdmin = createClient(
            client.supabase_url,
            client.supabase_service_role_key || process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
          )

          let allClientLeads: any[] = []
          let offset = 0
          while (true) {
            let leadsQuery = clientSupabaseAdmin
              .from(client.tabela_leads)
              .select('*')

            if (from) leadsQuery = leadsQuery.gte('created_at', from)
            if (to) leadsQuery = leadsQuery.lte('created_at', to)

            const res = await leadsQuery.range(offset, offset + 999)
            if (res.error) {
              error = res.error
              break
            }
            if (!res.data || res.data.length === 0) break
            allClientLeads.push(...res.data)
            if (res.data.length < 1000) break
            offset += 1000
          }
          if (!error) {
            leads = allClientLeads
          }
        } catch (errSb) {
          error = errSb
        }
      }

      let cTotal = 0
      let cQuali = 0
      let cVisita = 0
      let cSimA = 0
      let cSimPA = 0
      let cSimR = 0
      let cPerda = 0

      if (!error && leads) {
        cTotal = leads.length
        
        for (const lead of leads) {
          if (isSemIA) {
            // Regras de KPIs para clientes sem IA (wacloud_contatos)
            const hasVisita = lead.lead_visita_confirmada === true || Boolean(lead.data_agendamento_visita)
            const hasSimA = lead.lead_simulacao_aprovada === true
            const hasSimPA = lead.lead_simulacao_pre_aprovada === true
            const hasSimR = lead.lead_simulacao_reprovada === true
            const isPerda = lead.alerta_atrito === true || lead.lead_perda === true

            if (isPerda) cPerda++
            else if (hasVisita) cVisita++
            else if (hasSimA) cSimA++
            else if (hasSimPA) cSimPA++
            else if (hasSimR) cSimR++
            else if (lead.observacao_lead_qualificado || lead.veiculo_interessado) cQuali++
          } else {
            // Regras normais de etapas para clientes com IA
            const etapa = lead.lead_perda === true ? 'ia_perda' : calcularEtapaIA(lead, 5)
            
            if (etapa === 'ia_qualificado') cQuali++
            else if (etapa === 'visita_confirmada') cVisita++
            else if (etapa === 'simulacao_aprovada') cSimA++
            else if (etapa === 'simulacao_pre_aprovada') cSimPA++
            else if (etapa === 'simulacao_reprovada') cSimR++
            else if (etapa === 'ia_perda') cPerda++
          }
        }

        globalTotalLeads += cTotal
        globalQualifiedLeads += cQuali
        globalVisitasAgendadas += cVisita
        globalSimulacoesAprovadas += cSimA
        globalSimulacoesPreAprovadas += cSimPA
        globalSimulacoesReprovadas += cSimR
        globalPerdas += cPerda
      } else if (error) {
        console.warn(`Erro ao buscar leads do cliente ${client.nome}:`, error)
      }

      clientsKpis.push({
        id: client.id,
        nome: client.nome,
        kpis: {
          totalLeads: cTotal,
          visitasAgendadas: cVisita,
          emAndamento: Math.max(0, cTotal - cQuali - cVisita - cSimA - cSimPA - cSimR - cPerda),
          simulacoesAprovadas: cSimA + cSimPA,
          simulacoesReprovadas: cSimR,
          perdas: cPerda,
          qualifiedLeads: cQuali
        }
      })
    }))

    const globalEmAndamento = Math.max(0, globalTotalLeads - globalQualifiedLeads - globalVisitasAgendadas - globalSimulacoesAprovadas - globalSimulacoesPreAprovadas - globalSimulacoesReprovadas - globalPerdas)

    // Sort clientKpis alphabetically by nome
    clientsKpis.sort((a, b) => a.nome.localeCompare(b.nome))

    return NextResponse.json({
      global: {
        totalLeads: globalTotalLeads,
        visitasAgendadas: globalVisitasAgendadas,
        emAndamento: globalEmAndamento,
        simulacoesAprovadas: globalSimulacoesAprovadas + globalSimulacoesPreAprovadas,
        simulacoesReprovadas: globalSimulacoesReprovadas,
        perdas: globalPerdas,
        qualifiedLeads: globalQualifiedLeads
      },
      clients: clientsKpis
    }, { status: 200 })

  } catch (error) {
    console.error("Admin Analytics API Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
