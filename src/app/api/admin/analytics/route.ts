import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isNocoDBClient, getNocoDBLeads, getNocoDBBlockedNumbers } from "@/lib/nocodb/service"
import { getAllBlockedNumbers } from "@/lib/supabase/queries"
import { getClientWhatsappLabelsData } from "@/lib/wacloud/labels"
import { getNocoDBClientes } from "@/lib/nocodb/sistema"

export const dynamic = 'force-dynamic'
export const revalidate = 0

function normalizarCanal(lead: any, labelNames: string[]): string {
  // 1. Prioridade: etiqueta Canal | ...
  for (const nome of labelNames) {
    if (nome.startsWith('canal')) {
      const clean = nome.replace(/^canal\s*\|\s*/i, '').trim()
      if (clean) return clean
    }
  }

  // 2. Campo origem_lead
  const raw = String(lead.origem_lead || '').toLowerCase().trim()
  if (raw === 'facebook_ads' || raw === 'instagram_ads' || raw === 'meta_ads') return 'Meta Ads'
  if (raw === 'facebook_marketplace' || raw === 'marketplace') return 'Marketplace'
  if (raw === 'google_ads' || raw === 'google') return 'Google Ads'
  if (raw === 'webmotors') return 'WebMotors'
  if (raw === 'olx') return 'OLX'
  if (raw === 'mercado_livre' || raw === 'mercadolivre') return 'Mercado Livre'
  if (raw === 'icarros') return 'iCarros'
  if (raw === 'desconhecido') return 'Desconhecido'
  if (raw) return raw.charAt(0).toUpperCase() + raw.slice(1)

  return 'Sem Origem'
}

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
    const globalCanaisMap = new Map<string, number>()

    let globalTotalLeads = 0
    let globalEmAtendimento = 0
    let globalAtendimentoHumano = 0
    let globalOportunidades = 0
    let globalVisitasAgendadas = 0
    let globalVisitasRealizadas = 0
    let globalSimulacoesAprovadas = 0
    let globalPerdidos = 0

    // Fetch leads e bloqueios para cada cliente em paralelo
    await Promise.all(clients.map(async (client) => {
      let leads: any[] | null = null
      let error: any = null
      const isSemIA = client.tipo_atendimento === 'sem_ia' || !client.tabela_leads
      const isNoco = isNocoDBClient(client)

      // Supabase client instance se aplicável
      let clientSupabaseAdmin: any = null
      if (!isNoco && client.supabase_url && client.supabase_url.startsWith('http')) {
        clientSupabaseAdmin = createClient(
          client.supabase_url,
          client.supabase_service_role_key || process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } }
        )
      }

      // ── 1. Carregar Bloqueios do Cliente (Atendimento Humano) ──
      let blockedNumbers = new Set<string>()
      if (client.tabela_bloqueios) {
        try {
          if (isNoco) {
            blockedNumbers = await getNocoDBBlockedNumbers(client.tabela_bloqueios)
          } else if (clientSupabaseAdmin) {
            blockedNumbers = await getAllBlockedNumbers(clientSupabaseAdmin, client.tabela_bloqueios)
          }
        } catch (errBloq) {
          console.warn(`Aviso ao carregar bloqueios de ${client.nome}:`, errBloq)
        }
      }

      // ── 2. Carregar Etiquetas do WhatsApp da Instância ──
      let mapaNomes = new Map<string, string>()
      let mapaWhatsappLabels = new Map<string, string[]>()
      try {
        const labelsData = await getClientWhatsappLabelsData(client)
        mapaNomes = labelsData.mapaNomes || new Map()
        mapaWhatsappLabels = labelsData.mapaWhatsappLabels || new Map()
      } catch (errLbl) {
        console.warn(`Aviso ao carregar etiquetas de ${client.nome}:`, errLbl)
      }

      // ── 3. Carregar Leads do Período ──
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
      } else if (isNoco) {
        try {
          leads = await getNocoDBLeads(client.tabela_leads, { from, to })
        } catch (errNoco) {
          error = errNoco
        }
      } else if (clientSupabaseAdmin) {
        try {
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

      // ── 4. Apuração das Métricas do Cliente ──
      let cTotal = 0
      let cEmAtendimento = 0
      let cAtendimentoHumano = 0
      let cOportunidades = 0
      let cVisitasAgendadas = 0
      let cVisitasRealizadas = 0
      let cSimulacoesAprovadas = 0
      let cPerdidos = 0

      const clientCanaisMap = new Map<string, number>()

      if (!error && leads) {
        cTotal = leads.length

        for (const lead of leads) {
          const rawPhone = lead.telefone || lead.phone || lead.telefone_contato || ''
          const phoneClean = String(rawPhone).replace(/@s\.whatsapp\.net/gi, '').replace(/@c\.us/gi, '').replace(/\D/g, '')

          // 👤 Atendimento Humano: Leads com telefone registrado na tabela_bloqueios
          const isBlocked = Boolean(
            phoneClean && (
              blockedNumbers.has(phoneClean) ||
              (phoneClean.startsWith('55') && blockedNumbers.has(phoneClean.slice(2)))
            )
          )

          if (isBlocked) {
            cAtendimentoHumano++
          }

          // Resolução de Etiquetas Reais do WhatsApp
          const leadLabels = (lead.whatsapp_labels && Array.isArray(lead.whatsapp_labels) && lead.whatsapp_labels.length > 0)
            ? lead.whatsapp_labels
            : (mapaWhatsappLabels.get(phoneClean) || [])

          const labelNames = leadLabels.map((l: any) => {
            const id = String(l).includes(':') ? String(l).split(':')[1] : String(l)
            return (mapaNomes.get(id) || '').toLowerCase()
          })

          // 🟢 Visitas Realizadas: Leads com a etiqueta de visita realizada
          const hasVisitaRealizada = Boolean(
            labelNames.some((n: string) => n.includes('visita - realizada') || n.includes('visita realizada') || n === '54') ||
            lead.visita_realizada === true
          )

          // 🔷 Visitas Agendadas: Leads com lead_visita_confirmada === true ou data_agendamento_visita preenchido
          const hasVisitaAgendada = Boolean(
            lead.lead_visita_confirmada === true ||
            Boolean(lead.data_agendamento_visita) ||
            labelNames.some((n: string) => n.includes('visita - agendada') || n.includes('visita agendada') || n === '53' || n === '6')
          )

          // 🏆 Simulações Aprovadas: Leads com lead_simulacao_aprovada === true ou lead_simulacao_pre_aprovada === true
          const hasSimulacaoAprovada = Boolean(
            lead.lead_simulacao_aprovada === true ||
            lead.lead_simulacao_pre_aprovada === true
          )

          // 🟠 Oportunidades: Leads com etiqueta de oportunidade ou veiculo_troca
          const hasOportunidade = Boolean(
            labelNames.some((n: string) => n.includes('oportunidade') || n === '55') ||
            (lead.veiculo_troca && String(lead.veiculo_troca).trim().length > 0)
          )

          // 🔴 Perdidos: Leads com etiqueta de perdido desqualificado / desistiu / sem resposta
          const hasPerdido = Boolean(
            labelNames.some((n: string) => n.includes('desqualificado') || n.includes('sem resposta') || n.includes('desistiu') || n === '58')
          )

          if (hasVisitaRealizada) {
            cVisitasRealizadas++
          } else if (hasVisitaAgendada) {
            cVisitasAgendadas++
          } else if (hasSimulacaoAprovada) {
            cSimulacoesAprovadas++
          } else if (hasOportunidade) {
            cOportunidades++
          } else if (hasPerdido) {
            cPerdidos++
          }

          // 🔵 Em Atendimento: Leads ativos sendo trabalhados (NÃO pode constar como bloqueado na tabela de bloqueio)
          if (!isBlocked && !hasVisitaRealizada && !hasPerdido) {
            cEmAtendimento++
          }

          // Mapeamento de Canal / Origem
          const canal = normalizarCanal(lead, labelNames)
          clientCanaisMap.set(canal, (clientCanaisMap.get(canal) || 0) + 1)
          globalCanaisMap.set(canal, (globalCanaisMap.get(canal) || 0) + 1)
        }

        globalTotalLeads += cTotal
        globalEmAtendimento += cEmAtendimento
        globalAtendimentoHumano += cAtendimentoHumano
        globalOportunidades += cOportunidades
        globalVisitasAgendadas += cVisitasAgendadas
        globalVisitasRealizadas += cVisitasRealizadas
        globalSimulacoesAprovadas += cSimulacoesAprovadas
        globalPerdidos += cPerdidos
      } else if (error) {
        console.warn(`Erro ao buscar leads do cliente ${client.nome}:`, error)
      }

      // Ranking de canais do cliente
      const clientCanaisList = Array.from(clientCanaisMap.entries())
        .map(([nome, count]) => ({ nome, count, pct: cTotal > 0 ? Number(((count / cTotal) * 100).toFixed(1)) : 0 }))
        .sort((a, b) => b.count - a.count)

      clientsKpis.push({
        id: client.id,
        nome: client.nome,
        kpis: {
          totalLeads: cTotal,
          emAtendimento: cEmAtendimento,
          atendimentoHumano: cAtendimentoHumano,
          oportunidades: cOportunidades,
          visitasAgendadas: cVisitasAgendadas,
          visitasRealizadas: cVisitasRealizadas,
          simulacoesAprovadas: cSimulacoesAprovadas,
          perdidos: cPerdidos,
          // Compatibilidade retroativa
          emAndamento: cEmAtendimento,
          simulacoesReprovadas: 0,
          perdas: cPerdidos,
          qualifiedLeads: cOportunidades
        },
        canais: clientCanaisList
      })
    }))

    // Ranking de canais global
    const globalCanaisList = Array.from(globalCanaisMap.entries())
      .map(([nome, count]) => ({
        nome,
        count,
        pct: globalTotalLeads > 0 ? Number(((count / globalTotalLeads) * 100).toFixed(1)) : 0
      }))
      .sort((a, b) => b.count - a.count)

    // Sort clientKpis alphabetically by nome
    clientsKpis.sort((a, b) => a.nome.localeCompare(b.nome))

    return NextResponse.json({
      global: {
        totalLeads: globalTotalLeads,
        emAtendimento: globalEmAtendimento,
        atendimentoHumano: globalAtendimentoHumano,
        oportunidades: globalOportunidades,
        visitasAgendadas: globalVisitasAgendadas,
        visitasRealizadas: globalVisitasRealizadas,
        simulacoesAprovadas: globalSimulacoesAprovadas,
        perdidos: globalPerdidos,
        // Compatibilidade retroativa
        emAndamento: globalEmAtendimento,
        simulacoesReprovadas: 0,
        perdas: globalPerdidos,
        qualifiedLeads: globalOportunidades,
        canais: globalCanaisList
      },
      clients: clientsKpis
    }, { status: 200 })

  } catch (error) {
    console.error("Admin Analytics API Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
