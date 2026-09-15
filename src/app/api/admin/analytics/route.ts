import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { calcularEtapaIA } from "@/lib/funil/calcular-etapa"

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
        
        for (const lead of leads) {
          // If the lead was manually marked as lost via UI, we might have lead_perda = true
          // Wait, calcularEtapaIA doesn't check lead_perda boolean explicitly, but we can check it first
          const etapa = lead.lead_perda === true ? 'ia_perda' : calcularEtapaIA(lead, 5)
          
          if (etapa === 'ia_qualificado') cQuali++
          else if (etapa === 'visita_confirmada') cVisita++
          else if (etapa === 'simulacao_aprovada') cSimA++
          else if (etapa === 'simulacao_pre_aprovada') cSimPA++
          else if (etapa === 'simulacao_reprovada') cSimR++
          else if (etapa === 'ia_perda') cPerda++
        }

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
