import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Buscar clientes
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('sistema-dash-ia_clientes')
      .select('*')
      .eq('active', true)
      .order('nome')
    
    if (clientsError || !clients) {
      console.error("Erro ao buscar clientes:", clientsError)
      return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 })
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
      if (!client.tabela_leads) return

      const clientSupabaseAdmin = createClient(
        client.supabase_url || process.env.NEXT_PUBLIC_SUPABASE_URL!,
        client.supabase_service_role_key || process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )

      let leadsQuery = clientSupabaseAdmin
        .from(client.tabela_leads)
        .select('*')

      if (from) leadsQuery = leadsQuery.gte('created_at', from)
      if (to) leadsQuery = leadsQuery.lte('created_at', to)

      // Se a query falhar por algum motivo (ex: tabela nao existe), capturamos o erro
      const { data: leads, error } = await leadsQuery

      let cTotal = 0
      let cQuali = 0
      let cVisita = 0
      let cSimA = 0
      let cSimPA = 0
      let cSimR = 0
      let cPerda = 0

      if (!error && leads) {
        cTotal = leads.length
        cQuali = leads.filter((l: any) => l.lead_finalizado === true || l.horario_lead_qualificado != null).length
        cVisita = leads.filter((l: any) => l.lead_visita_confirmada === true).length
        cSimA = leads.filter((l: any) => l.lead_simulacao_aprovada === true).length
        cSimPA = leads.filter((l: any) => l.lead_simulacao_pre_aprovada === true).length
        cSimR = leads.filter((l: any) => l.lead_simulacao_reprovada === true).length
        cPerda = leads.filter((l: any) => l.lead_perda === true).length

        globalTotalLeads += cTotal
        globalQualifiedLeads += cQuali
        globalVisitasAgendadas += cVisita
        globalSimulacoesAprovadas += cSimA
        globalSimulacoesPreAprovadas += cSimPA
        globalSimulacoesReprovadas += cSimR
        globalPerdas += cPerda
      } else {
        console.warn(`Erro ao buscar leads do cliente ${client.nome}:`, error)
      }

      clientsKpis.push({
        id: client.id,
        nome: client.nome,
        kpis: {
          totalLeads: cTotal,
          visitasAgendadas: cVisita,
          emAndamento: Math.max(0, cTotal - cQuali - cPerda),
          simulacoesAprovadas: cSimA + cSimPA,
          simulacoesReprovadas: cSimR,
          perdas: cPerda,
          qualifiedLeads: cQuali
        }
      })
    }))

    const globalEmAndamento = Math.max(0, globalTotalLeads - globalQualifiedLeads - globalPerdas)

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
