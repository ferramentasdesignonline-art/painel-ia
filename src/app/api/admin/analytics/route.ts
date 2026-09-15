import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const clientId = searchParams.get('clientId')

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Buscar clientes
    let query = supabaseAdmin.from('sistema-dash-ia_clientes').select('*').eq('active', true)
    if (clientId && clientId !== 'all') {
      query = query.eq('id', clientId)
    }

    const { data: clients, error: clientsError } = await query
    
    if (clientsError || !clients) {
      console.error("Erro ao buscar clientes:", clientsError)
      return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 })
    }

    let totalLeads = 0
    let qualifiedLeads = 0
    let visitasAgendadas = 0
    let simulacoesAprovadas = 0
    let simulacoesPreAprovadas = 0
    let perdas = 0

    // Fetch leads for each client concurrently
    await Promise.all(clients.map(async (client) => {
      if (!client.tabela_leads) return

      const clientSupabaseAdmin = createClient(
        client.supabase_url || process.env.NEXT_PUBLIC_SUPABASE_URL!,
        client.supabase_service_role_key || process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )

      let leadsQuery = clientSupabaseAdmin.from(client.tabela_leads).select('lead_finalizado, horario_lead_qualificado, lead_visita_confirmada, lead_simulacao_aprovada, lead_simulacao_pre_aprovada, lead_perda')

      if (from) leadsQuery = leadsQuery.gte('created_at', from)
      if (to) leadsQuery = leadsQuery.lte('created_at', to)

      const { data: leads, error } = await leadsQuery

      if (!error && leads) {
        totalLeads += leads.length
        qualifiedLeads += leads.filter((l: any) => l.lead_finalizado === true || l.horario_lead_qualificado != null).length
        visitasAgendadas += leads.filter((l: any) => l.lead_visita_confirmada === true).length
        simulacoesAprovadas += leads.filter((l: any) => l.lead_simulacao_aprovada === true).length
        simulacoesPreAprovadas += leads.filter((l: any) => l.lead_simulacao_pre_aprovada === true).length
        perdas += leads.filter((l: any) => l.lead_perda === true).length
      } else {
        console.warn(`Erro ao buscar leads do cliente ${client.nome}:`, error)
      }
    }))

    const emAndamento = Math.max(0, totalLeads - qualifiedLeads - perdas)

    return NextResponse.json({
      kpis: {
        totalLeads,
        visitasAgendadas,
        emAndamento,
        simulacoesAprovadas: simulacoesAprovadas + simulacoesPreAprovadas,
        perdas,
        qualifiedLeads
      }
    }, { status: 200 })

  } catch (error) {
    console.error("Admin Analytics API Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
