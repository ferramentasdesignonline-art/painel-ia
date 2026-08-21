import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { getActiveClientConfig } from "@/lib/auth/helpers"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const cookieStore = cookies()
    const supabaseSession = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
    )

    const clientConfig = await getActiveClientConfig(supabaseSession)
    if (!clientConfig) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // ── 1. Mensagens (tabela_memoria) ─────────────────────────────────────────
    let aiMessages = 0
    let humanMessages = 0
    const messagesByDay: Record<string, { ai: number; human: number }> = {}

    const fromDate = from ? new Date(from) : null
    const toDate   = to   ? new Date(to)   : null

    if (clientConfig.tabela_memoria) {
      console.log('Buscando mensagens da tabela:', clientConfig.tabela_memoria);
      // Tenta buscar com filtro de data em created_at
      let msgQuery = supabaseAdmin
        .from(clientConfig.tabela_memoria)
        .select('id, message, created_at')

      if (from) msgQuery = msgQuery.gte('created_at', from)
      if (to)   msgQuery = msgQuery.lte('created_at', to)

      const { data: allMessages, error: msgError } = await msgQuery
      console.log(`Resumo mensagens (${clientConfig.tabela_memoria}):`, { 
        count: allMessages?.length || 0, 
        error: msgError?.message || null 
      });

      if (msgError) {
        // Fallback: busca sem filtro de data e filtra em memória
        console.warn("Memoria query with date failed, retrying without date filter:", msgError.message)
        const { data: allMsgsFallback, error: fallbackErr } = await supabaseAdmin
          .from(clientConfig.tabela_memoria)
          .select('*')
          .limit(5000) // Evitar estouro de memória em bases gigantes
          
        if (fallbackErr) console.error("Fallback query failed as well:", fallbackErr.message);

        for (const row of allMsgsFallback || []) {
          const rowDate = row.created_at 
            ? new Date(row.created_at) 
            : row.timestamp 
              ? new Date(row.timestamp)
              : null

          if (rowDate) {
            if (fromDate && rowDate < fromDate) continue
            if (toDate && rowDate > toDate) continue
          }

          const msgData = typeof row.message === 'string' 
            ? (() => { try { return JSON.parse(row.message) } catch { return {} } })()
            : row.message

          // Detecção robusta de tipo
          const isHuman = 
            msgData?.type === 'human' || 
            msgData?.role === 'user' || 
            msgData?.fromMe === false || 
            msgData?.author === 'customer' ||
            msgData?.sender === 'user'

          const type = isHuman ? 'human' : 'ai'
          
          if (type === 'ai') aiMessages++
          else humanMessages++

          if (rowDate) {
            const day = rowDate.toLocaleDateString('pt-BR', { 
              timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' 
            })
            if (!messagesByDay[day]) messagesByDay[day] = { ai: 0, human: 0 }
            messagesByDay[day][type]++
          }
        }
      } else {
        for (const row of allMessages || []) {
          const msgData = typeof row.message === 'string' 
            ? (() => { try { return JSON.parse(row.message) } catch { return {} } })()
            : row.message

          const isHuman = 
            msgData?.type === 'human' || 
            msgData?.role === 'user' || 
            msgData?.fromMe === false || 
            msgData?.author === 'customer' ||
            msgData?.sender === 'user'

          const type = isHuman ? 'human' : 'ai'
          const day = row.created_at
            ? new Date(row.created_at).toLocaleDateString('pt-BR', { 
                timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' 
              })
            : 'Sem data'

          if (type === 'ai') aiMessages++
          else humanMessages++

          if (!messagesByDay[day]) messagesByDay[day] = { ai: 0, human: 0 }
          messagesByDay[day][type]++
        }
      }
    }

    // ── 2. Leads (tabela_leads) ───────────────────────────────────────────────
    let totalFollowups = 0
    let qualifiedLeads = 0
    let totalLeads = 0
    const leadsByDay: Record<string, number> = {}
    let allLeads: any[] = []

    let visitasAgendadas = 0
    let simulacoesAprovadas = 0
    let simulacoesPreAprovadas = 0
    let perdas = 0

    if (clientConfig.tabela_leads) {
      let leadsQuery = supabaseAdmin
        .from(clientConfig.tabela_leads)
        .select('id, created_at, lead_finalizado, quantidade_followup, horario_lead_qualificado, lead_visita_confirmada, lead_simulacao_pre_aprovada, lead_simulacao_aprovada, lead_simulacao_reprovada, lead_perda')

      if (from) leadsQuery = leadsQuery.gte('created_at', from)
      if (to)   leadsQuery = leadsQuery.lte('created_at', to)

      const { data: dbLeads, error: leadsError } = await leadsQuery
      if (leadsError) {
        console.error("Erro ao buscar leads do cliente:", leadsError.message)
      } else if (dbLeads) {
        allLeads = dbLeads
      }
    }

    totalFollowups = allLeads.reduce((sum, l) => sum + parseInt(l.quantidade_followup || '0'), 0)
    qualifiedLeads = allLeads.filter(l => l.lead_finalizado === true || l.horario_lead_qualificado != null).length
    totalLeads = allLeads.length
    visitasAgendadas = allLeads.filter(l => l.lead_visita_confirmada === true).length
    simulacoesAprovadas = allLeads.filter(l => l.lead_simulacao_aprovada === true).length
    simulacoesPreAprovadas = allLeads.filter(l => l.lead_simulacao_pre_aprovada === true).length
    perdas = allLeads.filter(l => l.lead_perda === true).length

    // Leads por dia
    for (const lead of allLeads || []) {
      const day = new Date(lead.created_at).toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit'
      })
      leadsByDay[day] = (leadsByDay[day] || 0) + 1
    }

    // Montar séries cronológicas ordenadas
    const allDays = Array.from(new Set([...Object.keys(messagesByDay), ...Object.keys(leadsByDay)]))
      .sort((a, b) => {
        // Ordenar por data: "dd/mm" format
        const [da, ma] = a.split('/').map(Number)
        const [db, mb] = b.split('/').map(Number)
        if (ma !== mb) return ma - mb
        return da - db
      })

    const chartData = allDays.map(day => ({
      day,
      mensagensIA: messagesByDay[day]?.ai || 0,
      mensagensCliente: messagesByDay[day]?.human || 0,
      leads: leadsByDay[day] || 0,
    }))

    return NextResponse.json({
      kpis: { aiMessages, humanMessages, totalFollowups, qualifiedLeads, totalLeads, visitasAgendadas, simulacoesAprovadas, simulacoesPreAprovadas, perdas },
      chartData,
      pieData: [
        { name: 'Qualificados', value: qualifiedLeads, color: '#22c55e' },
        { name: 'Em Andamento', value: Math.max(0, totalLeads - qualifiedLeads), color: '#f59e0b' },
      ]
    }, { status: 200 })

  } catch (error) {
    console.error("Analytics API Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
