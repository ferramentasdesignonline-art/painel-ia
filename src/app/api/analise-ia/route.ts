import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { getActiveClientConfig } from "@/lib/auth/helpers"

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // até 60 segundos para análise com OpenAI

export async function GET(request: Request) {
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

    const clientConfig = await getActiveClientConfig(supabaseSession)
    if (!clientConfig) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Busca última análise salva
    const { data: analise, error } = await supabaseAdmin
      .from("sistema-dash-ia_analises")
      .select("*")
      .eq("cliente_id", clientConfig.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error && error.code !== "PGRST116") {
      console.error("Erro ao buscar analise:", error)
    }

    return NextResponse.json({ analise: analise || null })
  } catch (err: any) {
    console.error("Erro GET /api/analise-ia:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
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

    const clientConfig = await getActiveClientConfig(supabaseSession)
    if (!clientConfig) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const openAiKey = process.env.OPENAI_API_KEY
    if (!openAiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY não configurada no servidor." }, { status: 500 })
    }

    // 1. Cliente Supabase do cliente para ler tabela_leads e tabela_memoria
    const clientDb = createClient(
      clientConfig.supabase_url || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      clientConfig.supabase_service_role_key || process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 2. Buscar últimos leads com canal e status
    const { data: leadsRaw } = await clientDb
      .from(clientConfig.tabela_leads)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)

    // 3. Buscar mensagens recentes na tabela de memória (últimas 250 mensagens)
    let mensagensRecentes: any[] = []
    if (clientConfig.tabela_memoria) {
      const { data: msgs } = await clientDb
        .from(clientConfig.tabela_memoria)
        .select("session_id, message, created_at")
        .order("created_at", { ascending: false })
        .limit(250)
      mensagensRecentes = msgs || []
    }

    // Agrupar conversas por cliente (session_id)
    const conversasPorCliente: Record<string, string[]> = {}
    mensagensRecentes.reverse().forEach((row) => {
      const sid = row.session_id || "desconhecido"
      const msgData = typeof row.message === "string" ? JSON.parse(row.message) : row.message
      const papel = msgData.type === "human" ? "CLIENTE" : "IA_VENDEDOR"
      const texto = (msgData.content || "").replace(/\n/g, " ").slice(0, 300)
      if (!conversasPorCliente[sid]) conversasPorCliente[sid] = []
      conversasPorCliente[sid].push(`${papel}: ${texto}`)
    })

    // Montar amostra enxuta de conversas para a OpenAI
    const amostraConversas = Object.entries(conversasPorCliente)
      .slice(0, 15) // até 15 conversas mais recentes
      .map(([sid, lines]) => `--- CONVERSA CLIENTE (${sid}) ---\n${lines.join("\n")}`)
      .join("\n\n")

    // Montar resumo dos leads recentes
    const amostraLeads = (leadsRaw || []).slice(0, 30).map((l: any) => ({
      nome: l.nome,
      telefone: l.telefone,
      veiculo: l.veiculo_interessado || l.veiculo,
      canal: l.origem_lead || l.canal_origem || "desconhecido",
      anuncio: l.anuncio_titulo || null,
      agendado: !!l.data_agendamento,
      finalizado: !!l.lead_finalizado,
      followups: l.quantidade_followup || 0,
    }))

    // 4. Prompt estruturado para OpenAI gpt-4o-mini
    const systemPrompt = `Você é um Diretor Comercial e Especialista Sênior em Tráfego Pago e Vendas Automotivas para Concessionárias de Veículos.
Sua missão é analisar dados reais de leads, canais de anúncios e conversas de WhatsApp para extrair inteligência acionável e aumentar o faturamento da loja.

Responda ESTRITAMENTE em formato JSON válido, sem blocos markdown adicionais, sem texto extra, exatamente neste esquema:
{
  "resumo_geral": "Texto sucinto de 2 a 3 parágrafos com um raio-x do momento das vendas, pontos fortes e gargalos.",
  "metricas": {
    "total_leads_analisados": number,
    "temperatura_geral": "Quente" | "Morna" | "Fria",
    "score_qualidade_leads": number (0 a 100),
    "taxa_agendamento_estimada": "XX%"
  },
  "leads_quentes": [
    {
      "nome": "Nome do cliente",
      "telefone": "Telefone ou session_id",
      "veiculo": "Carro de interesse",
      "probabilidade_fechamento": "95%",
      "motivo": "Por que ele é muito quente (ex: tem entrada, pediu financiamento, quer ver o carro)",
      "acao_recomendada": "O que o vendedor deve fazer agora",
      "copy_resgate": "Mensagem pronta de WhatsApp personalizada e informal para o vendedor enviar"
    }
  ],
  "alertas_atrito": [
    {
      "tipo": "Dúvida sem resposta" | "Insatisfação" | "Objeção de Taxa" | "Demora no Atendimento",
      "descricao": "Explicação detalhada do que ocorreu na conversa",
      "impacto": "Alto" | "Médio" | "Baixo",
      "sugestao_correcao": "Como ajustar a IA ou instruir os vendedores para contornar isso"
    }
  ],
  "diagnostico_canais": [
    {
      "canal": "Instagram Ads / Facebook / OLX / etc",
      "qualidade": "Alta" | "Média" | "Baixa",
      "analise": "Avaliação dos leads que vieram desse canal",
      "recomendacao": "Aumentar verba / Otimizar copy / etc"
    }
  ],
  "insights_estoque": [
    {
      "titulo": "Demanda de Procura / Estoque Encalhado",
      "descricao": "Carros mais procurados nas conversas ou veículos sem procura",
      "acao": "Sugestão prática para o setor de compras ou marketing"
    }
  ]
}`

    const userPrompt = `DADOS DA CONCESSIONÁRIA:
Cliente: ${clientConfig.nome}

AMOSTRA DE LEADS RECENTES (${amostraLeads.length} leads):
${JSON.stringify(amostraLeads, null, 2)}

AMOSTRA DE CONVERSAS RECENTES NO WHATSAPP:
${amostraConversas || "Nenhuma conversa de WhatsApp recuperada para o período."}

Realize uma análise aprofundada, precisa e prática. Retorne apenas o JSON puro.`

    // Chamada à API da OpenAI (gpt-4o-mini)
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error("OpenAI API Error:", errText)
      return NextResponse.json({ error: "Erro na API da OpenAI: " + errText }, { status: 500 })
    }

    const aiResult = await response.json()
    const content = aiResult.choices?.[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: "Resposta vazia da OpenAI" }, { status: 500 })
    }

    const parsedData = JSON.parse(content)

    // 5. Salva no banco Supabase na tabela sistema-dash-ia_analises
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const payloadParaSalvar = {
      cliente_id: clientConfig.id,
      periodo: "tempo_real",
      resumo_geral: parsedData.resumo_geral || "",
      metricas: parsedData.metricas || {},
      leads_quentes: parsedData.leads_quentes || [],
      alertas_atrito: parsedData.alertas_atrito || [],
      diagnostico_canais: parsedData.diagnostico_canais || [],
      insights_estoque: parsedData.insights_estoque || [],
      created_at: new Date().toISOString(),
    }

    const { data: savedRecord, error: insertError } = await supabaseAdmin
      .from("sistema-dash-ia_analises")
      .insert(payloadParaSalvar)
      .select()
      .single()

    if (insertError) {
      console.error("Erro ao salvar analise no Supabase:", insertError)
      // Retorna mesmo assim para a UI visualizar
      return NextResponse.json({ success: true, analise: payloadParaSalvar, warning: "Não persistiu no banco: " + insertError.message })
    }

    return NextResponse.json({ success: true, analise: savedRecord })
  } catch (err: any) {
    console.error("Erro POST /api/analise-ia:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
