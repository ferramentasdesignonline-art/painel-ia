import { createClient } from "@supabase/supabase-js"

const MODEL = "gpt-4o-mini"
const BATCH_SIZE = 20          // conversas por chamada na fase "map"
const CONCURRENCY = 25         // chamadas paralelas simultâneas
const MSGS_POR_CONVERSA = 16   // últimas N mensagens de cada conversa (foco na negociação)
const CHARS_POR_MSG = 180      // tamanho ideal de mensagem
const MAP_BUDGET_MS = 36000    // orçamento máximo de 36s na fase MAP para resposta total < 45s

const digits = (s: any) => String(s || "").split("@")[0].replace(/\D/g, "")
const tail = (s: any) => digits(s).slice(-8)

// Busca paralela ultrarrápida no banco (evita dezenas de segundos em requisições sequenciais)
async function fetchParallel(db: any, table: string, select: string, maxRows = 50000) {
  const pageSize = 1000
  const promises: Promise<any>[] = []
  for (let from = 0; from < maxRows; from += pageSize) {
    promises.push(
      db.from(table).select(select).range(from, from + pageSize - 1)
    )
  }
  const results = await Promise.all(promises)
  const out: any[] = []
  for (const r of results) {
    if (r.data && r.data.length > 0) {
      out.push(...r.data)
    }
  }
  return out
}

async function callOpenAI(key: string, system: string, user: string, maxTokens = 4000, retries = 2): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        temperature: 0.2,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      }),
    })
    if (res.ok) {
      const j = await res.json()
      const content = j.choices?.[0]?.message?.content
      try { return JSON.parse(content || "{}") } catch { if (attempt === retries) return {} }
      continue
    }
    const txt = await res.text()
    if (res.status === 401) throw new Error("Chave da OpenAI inválida: " + txt.slice(0, 200))
    if (attempt === retries) throw new Error(`OpenAI ${res.status}: ${txt.slice(0, 300)}`)
    await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
  }
  return {}
}

async function pool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let i = 0
  let fatal: any = null
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length && !fatal) {
      const idx = i++
      try { results[idx] = await fn(items[idx], idx) }
      catch (e: any) { results[idx] = null as any; if (String(e?.message).includes("inválida")) fatal = e; else console.error("lote falhou:", e?.message) }
    }
  })
  await Promise.all(workers)
  if (fatal) throw fatal
  return results
}

const MAP_SYSTEM = `Você é um auditor comercial sênior de concessionária de veículos. Vai receber várias conversas de WhatsApp (CLIENTE x ATENDENTE/IA) com dados do lead.
Analise CADA conversa e responda SOMENTE JSON neste formato:
{
  "conversas": [
    {
      "id": "id exato da conversa recebida",
      "temperatura": "quente" | "morna" | "fria",
      "probabilidade": number (0-100),
      "veiculo": "modelo de interesse ou null",
      "motivo": "Explicação COMPLETA (3-5 frases) do porquê dessa temperatura: sinais de compra concretos citados pelo cliente (entrada, troca, financiamento, urgência, pediu visita, perguntou documentação), objeções e em que ponto a negociação parou.",
      "sinais_compra": ["lista curta de sinais concretos"],
      "proximo_passo": "ação objetiva que o vendedor deve fazer agora",
      "copy_resgate": "mensagem curta, humana e personalizada de WhatsApp para retomar",
      "atritos": [
        { "tipo": "Dúvida sem resposta" | "Demora no atendimento" | "Resposta confusa da IA" | "Objeção de preço" | "Objeção de financiamento/crédito" | "Informação incorreta" | "Insatisfação" | "Cliente abandonou" | "Outro",
          "problema": "o que exatamente deu errado",
          "trecho": "citação literal curta do cliente ou da resposta problemática" }
      ],
      "demandas": [
        { "modelo": "modelo/categoria pedido (ex: Ford Edge, SUV até 80 mil, carro blindado)",
          "tipo": "procura" | "troca" | "sem_estoque" | "financiamento" | "caracteristica",
          "detalhe": "ano, faixa de preço, cor, câmbio ou condição citada",
          "trecho": "citação literal curta do cliente" }
      ]
    }
  ]
}
Regras: inclua TODAS as conversas recebidas. Seja específico, use dados reais das conversas, nada genérico. "atritos" e "demandas" podem ser listas vazias.`

const REDUCE_SYSTEM = `Você é Diretor Comercial e especialista em tráfego pago para concessionárias. Recebe dados JÁ CONSOLIDADOS de TODAS as conversas e leads da loja: estatísticas reais por canal, lista de atritos encontrados com exemplos e demandas de veículos.
Responda SOMENTE JSON neste formato:
{
  "resumo_geral": "3 parágrafos objetivos com números reais: cenário, onde está o dinheiro, maiores gargalos e resultados de agendamentos.",
  "metricas": { "temperatura_geral": "Quente" | "Morna" | "Fria", "score_qualidade_leads": number 0-100 },
  "diagnostico_canais": [
    { "canal": "nome exato do canal recebido",
      "qualidade": "Alta" | "Média" | "Baixa",
      "analise": "análise completa citando os números (volume, % agendamento, % quentes, atritos)",
      "pontos_fortes": ["..."],
      "pontos_fracos": ["..."],
      "perfil_lead": "que tipo de cliente esse canal traz (veículos, ticket, intenção)",
      "recomendacao": "ação concreta de verba/criativo/segmentação" }
  ],
  "alertas_atrito": [
    { "tipo": "categoria",
      "descricao": "explicação clara do padrão e por que prejudica a venda",
      "impacto": "Alto" | "Médio" | "Baixo",
      "exemplos": [ { "cliente": "nome", "telefone": "telefone", "trecho": "citação literal", "problema": "o que deu errado" } ] }
  ],
  "insights_estoque": [
    { "titulo": "título curto",
      "descricao": "análise completa da demanda (quantos pediram, perfil, faixa de preço)",
      "modelos": ["modelos envolvidos"],
      "volume": number,
      "exemplos": [ { "cliente": "nome", "telefone": "telefone", "trecho": "citação literal" } ],
      "acao": "sugestão prática para compras/marketing" }
  ]
}
Regras: um item de diagnóstico para CADA canal recebido. Em alertas_atrito gere de 5 a 8 padrões diferentes, cada um com 4 a 6 exemplos reais (clientes distintos). Em insights_estoque gere de 6 a 10 itens (modelos mais pedidos, categorias, faixas de preço, veículos de troca, pedidos sem estoque), cada um com 3 a 6 exemplos reais. NÃO invente exemplos.`

export async function runAnalise(clientConfig: any, openAiKey: string, log: (s: string) => void = () => {}) {
  const clientDb = createClient(
    clientConfig.supabase_url || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    clientConfig.supabase_service_role_key || process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // 1. TODOS os leads e TODAS as mensagens em paralelo ultrarrápido
  const leadsPromise = fetchParallel(clientDb, clientConfig.tabela_leads, "*", 10000)
  const msgsPromise = clientConfig.tabela_memoria
    ? fetchParallel(clientDb, clientConfig.tabela_memoria, "id, session_id, message", 50000)
    : Promise.resolve([])

  // 2. Buscar contatos e etiquetas do Wacloud para correlação precisa de canais e agendamento de visitas
  const agendamentoPhones = new Set<string>()
  const canalByPhone = new Map<string, string>()

  const enrichmentPromise = (async () => {
    try {
      const { getWacloudSupabaseAdmin } = await import("@/lib/wacloud/supabase")
      const { fetchUazapiLabels } = await import("@/lib/wacloud/uazapi")
      const wacloudAdmin = getWacloudSupabaseAdmin()

      const { data: insts } = await wacloudAdmin.from("wacloud_instancias").select("id, nome_instancia, token, cliente_id")
      const instNorm = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
      const clientNameNorm = instNorm(clientConfig.whatsapp_instancia || clientConfig.nome || "")

      const instMatch = insts?.find((i: any) => {
        if (i.cliente_id && (i.cliente_id === clientConfig.id || i.cliente_id === clientConfig.auth_user_id)) return true
        const n = instNorm(i.nome_instancia || "")
        return n === clientNameNorm || n.includes(clientNameNorm) || clientNameNorm.includes(n)
      })

      if (instMatch) {
        let uazapiLabels: any[] = []
        if (instMatch.token) {
          uazapiLabels = await fetchUazapiLabels(instMatch.token).catch(() => [])
        }

        const agendamentoLabelIds = new Set<string>()
        const canalLabels = new Map<string, string>()

        for (const lbl of uazapiLabels || []) {
          const id = String(lbl.labelid || lbl.id)
          const name = String(lbl.name || "").trim()
          const nameNorm = name.toLowerCase()

          if (nameNorm.includes("agendad") || nameNorm.includes("visita") || nameNorm.includes("agendamento")) {
            agendamentoLabelIds.add(id)
            if (lbl.id) agendamentoLabelIds.add(String(lbl.id))
            if (lbl.labelid) agendamentoLabelIds.add(String(lbl.labelid))
          }

          if (nameNorm.startsWith("canal")) {
            const cleanName = name.replace(/^canal\s*\|\s*/i, "").trim()
            canalLabels.set(id, cleanName)
            if (lbl.id) canalLabels.set(String(lbl.id), cleanName)
            if (lbl.labelid) canalLabels.set(String(lbl.labelid), cleanName)
          }
        }

        const contatosPromises: Promise<any>[] = []
        for (let p = 0; p < 8; p++) {
          contatosPromises.push(
            wacloudAdmin.from("wacloud_contatos")
              .select("telefone_contato, whatsapp_labels")
              .eq("nome_instancia", instMatch.nome_instancia)
              .range(p * 1000, (p + 1) * 1000 - 1)
          )
        }
        const contatosChunks = await Promise.all(contatosPromises)
        for (const chunk of contatosChunks) {
          if (!chunk.data) continue
          for (const c of chunk.data) {
            if (!c.telefone_contato || !Array.isArray(c.whatsapp_labels) || c.whatsapp_labels.length === 0) continue
            const cleanPhone = String(c.telefone_contato).replace(/\D/g, "")
            if (!cleanPhone) continue

            const hasAgendamento = c.whatsapp_labels.some((lId: any) => {
              const cleanId = String(lId).includes(":") ? String(lId).split(":")[1] : String(lId)
              return agendamentoLabelIds.has(String(lId)) || agendamentoLabelIds.has(cleanId)
            })

            if (hasAgendamento) {
              agendamentoPhones.add(cleanPhone)
              if (cleanPhone.startsWith("55")) agendamentoPhones.add(cleanPhone.slice(2))
              else agendamentoPhones.add(`55${cleanPhone}`)
            }

            for (const lId of c.whatsapp_labels) {
              const cleanId = String(lId).includes(":") ? String(lId).split(":")[1] : String(lId)
              if (canalLabels.has(cleanId) || canalLabels.has(String(lId))) {
                const cName = canalLabels.get(cleanId) || canalLabels.get(String(lId))!
                canalByPhone.set(cleanPhone, cName)
                if (cleanPhone.startsWith("55")) canalByPhone.set(cleanPhone.slice(2), cName)
                else canalByPhone.set(`55${cleanPhone}`, cName)
                break
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn("Aviso ao carregar etiquetas do Wacloud para análise:", err)
    }
  })()

  const [leads, mensagensRaw] = await Promise.all([leadsPromise, msgsPromise, enrichmentPromise])
  const mensagens = mensagensRaw.sort((a: any, b: any) => (Number(a.id) || 0) - (Number(b.id) || 0))

  // Enriquecer cada lead com status de agendamento e canal identificado
  for (const l of leads) {
    const rawTel = String(l.telefone || l.phone || "").replace(/\D/g, "")
    const hasLabelAgendamento = rawTel ? agendamentoPhones.has(rawTel) : false
    const hasDbAgendamento = l.lead_visita_confirmada === true ||
      (l.data_agendamento_visita != null && String(l.data_agendamento_visita).trim() !== "") ||
      (l.data_agendamento != null && String(l.data_agendamento).trim() !== "")

    l.agendado = hasDbAgendamento || hasLabelAgendamento
    if (l.agendado && !l.data_agendamento) {
      l.data_agendamento = l.data_agendamento_visita
        ? `${l.data_agendamento_visita} ${l.horario_agendamento_visita || ""}`.trim()
        : "Visita Agendada"
    }

    if (rawTel && canalByPhone.has(rawTel)) {
      l.canal_label_name = canalByPhone.get(rawTel)
    }
  }

  const leadByTail = new Map<string, any>()
  leads.forEach((l: any) => { const t = tail(l.telefone || l.phone); if (t) leadByTail.set(t, l) })

  log(`leads=${leads.length} mensagens=${mensagens.length}`)

  const conversas: Record<string, { cliente: number; total: number; ultimo: number; linhas: string[] }> = {}
  for (const row of mensagens) {
    const sid = row.session_id
    if (!sid) continue
    let m: any = row.message
    if (typeof m === "string") { try { m = JSON.parse(m) } catch { m = { content: m } } }
    const content = typeof m?.content === "string" ? m.content : JSON.stringify(m?.content || "")
    if (!content.trim()) continue
    const isHuman = m?.type === "human"
    if (!conversas[sid]) conversas[sid] = { cliente: 0, total: 0, ultimo: 0, linhas: [] }
    if (isHuman) conversas[sid].cliente++
    conversas[sid].total++
    conversas[sid].ultimo = Math.max(conversas[sid].ultimo, Number(row.id) || 0)
    conversas[sid].linhas.push(`${isHuman ? "CLIENTE" : "ATENDENTE"}: ${content.replace(/\s+/g, " ").slice(0, CHARS_POR_MSG).replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")}`)
  }

  // Mais recentes primeiro
  const sessoes = Object.entries(conversas).filter(([, c]) => c.cliente > 0).sort((a, b) => b[1].ultimo - a[1].ultimo)
  const canalDe = (l: any) => l?.canal_label_name || l?.origem_lead || l?.canal_origem || l?.origem || "Orgânico / Direto"

  // 3. MAP — analisa conversas em lotes paralelos
  const itens = sessoes.map(([sid, c]) => {
    const lead = leadByTail.get(tail(sid))
    return {
      id: sid,
      lead,
      total: c.total,
      texto: `### CONVERSA id=${sid}
Lead: ${lead?.nome || "desconhecido"} | Canal: ${canalDe(lead)} | Anúncio: ${lead?.anuncio_titulo || "-"} | Veículo cadastrado: ${lead?.veiculo_interessado || "-"} | Troca: ${lead?.veiculo_troca || "-"} | Agendado: ${lead?.agendado ? "sim" : "não"}
${c.linhas.slice(-MSGS_POR_CONVERSA).join("\n")}`,
    }
  })

  const lotes: typeof itens[] = []
  for (let i = 0; i < itens.length; i += BATCH_SIZE) lotes.push(itens.slice(i, i + BATCH_SIZE))
  log(`conversas=${sessoes.length} lotes=${lotes.length}`)

  const inicio = Date.now()
  const mapResults = await pool(lotes, CONCURRENCY, async (lote) => {
    if (Date.now() - inicio > MAP_BUDGET_MS) return [] // orçamento rigoroso de tempo para evitar timeout
    const r = await callOpenAI(openAiKey, MAP_SYSTEM, lote.map(x => x.texto).join("\n\n"), 4000)
    return Array.isArray(r?.conversas) ? r.conversas : []
  })

  const itemById = new Map(itens.map(x => [x.id, x]))
  const analisadas: any[] = []
  const vistos = new Set<string>()
  mapResults.flat().filter(Boolean).forEach((c: any) => {
    const it = itemById.get(c.id) || itens.find(x => tail(x.id) === tail(c.id))
    if (!it || vistos.has(it.id)) return
    vistos.add(it.id)
    analisadas.push({ ...c, id: it.id, lead: it.lead })
  })
  log(`analisadas=${analisadas.length}`)

  // 4. Estatísticas reais por canal
  const analisePorTail = new Map(analisadas.map(a => [tail(a.id), a]))
  const canais: Record<string, any> = {}
  for (const l of leads) {
    const nome = canalDe(l)
    const c = canais[nome] ||= { canal: nome, total_leads: 0, com_conversa: 0, agendados: 0, finalizados: 0, quentes: 0, mornos: 0, frios: 0, atritos: 0, veiculos: {} as Record<string, number>, anuncios: {} as Record<string, number> }
    c.total_leads++
    if (l.agendado) c.agendados++
    if (l.lead_finalizado) c.finalizados++
    const v = l.veiculo_interessado; if (v) c.veiculos[v] = (c.veiculos[v] || 0) + 1
    const an = l.anuncio_titulo; if (an) c.anuncios[an] = (c.anuncios[an] || 0) + 1
    const a = analisePorTail.get(tail(l.telefone || l.phone))
    if (a) {
      c.com_conversa++
      if (a.temperatura === "quente") c.quentes++; else if (a.temperatura === "morna") c.mornos++; else c.frios++
      c.atritos += (a.atritos || []).length
    }
  }
  const top = (o: Record<string, number>, n = 5) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} (${v})`)
  const statsCanais = Object.values(canais).map((c: any) => ({
    canal: c.canal,
    total_leads: c.total_leads,
    com_conversa: c.com_conversa,
    agendados: c.agendados,
    taxa_agendamento: c.total_leads ? Math.round((c.agendados / c.total_leads) * 100) : 0,
    finalizados: c.finalizados,
    quentes: c.quentes, mornos: c.mornos, frios: c.frios,
    taxa_quentes: c.com_conversa ? Math.round((c.quentes / c.com_conversa) * 100) : 0,
    atritos: c.atritos,
    top_veiculos: top(c.veiculos),
    top_anuncios: top(c.anuncios, 3),
  })).sort((a, b) => b.total_leads - a.total_leads)

  // 5. Leads quentes
  const leadsQuentes = analisadas
    .filter(a => a.temperatura === "quente" || (a.probabilidade || 0) >= 60)
    .sort((a, b) => (b.probabilidade || 0) - (a.probabilidade || 0))
    .slice(0, 40)
    .map(a => ({
      nome: a.lead?.nome || a.id.split("@")[0],
      telefone: a.lead?.telefone || a.id,
      session_id: a.id,
      veiculo: a.veiculo || a.lead?.veiculo_interessado || null,
      canal: canalDe(a.lead),
      probabilidade_fechamento: `${a.probabilidade || 0}%`,
      motivo: a.motivo,
      sinais_compra: a.sinais_compra || [],
      acao_recomendada: a.proximo_passo,
      copy_resgate: a.copy_resgate,
      lead: a.lead || null,
    }))

  // 6. Atritos e demandas brutos
  const atritosBrutos = analisadas.flatMap(a => (a.atritos || []).map((t: any) => ({
    ...t, cliente: a.lead?.nome || a.id.split("@")[0], telefone: digits(a.lead?.telefone || a.id), canal: canalDe(a.lead),
  })))
  const demandasBrutas = analisadas.flatMap(a => (a.demandas || []).map((d: any) => ({
    ...d, cliente: a.lead?.nome || a.id.split("@")[0], telefone: digits(a.lead?.telefone || a.id),
  })))

  // 7. REDUCE
  const temps = { quente: 0, morna: 0, fria: 0 } as Record<string, number>
  analisadas.forEach(a => { temps[a.temperatura] = (temps[a.temperatura] || 0) + 1 })
  const totalAgendados = leads.filter((l: any) => l.agendado).length
  const taxaAgendamentoNum = leads.length ? Math.round((totalAgendados / leads.length) * 100) : 0

  const reduceUser = `CONCESSIONÁRIA: ${clientConfig.nome}
TOTAL DE LEADS NO BANCO: ${leads.length}
CONVERSAS ANALISADAS: ${analisadas.length} (quentes ${temps.quente || 0}, mornas ${temps.morna || 0}, frias ${temps.fria || 0})
LEADS COM VISITA AGENDADA: ${totalAgendados} (taxa de agendamento real de ${taxaAgendamentoNum}%)

ESTATÍSTICAS REAIS POR CANAL:
${JSON.stringify(statsCanais)}

ATRITOS ENCONTRADOS (${atritosBrutos.length}):
${JSON.stringify(atritosBrutos.slice(0, 250))}

DEMANDAS DE VEÍCULOS (${demandasBrutas.length}):
${JSON.stringify(demandasBrutas.slice(0, 300))}`

  const final = await callOpenAI(openAiKey, REDUCE_SYSTEM, reduceUser, 4500)
  log(`reduce ok`)

  const diagnostico = (final.diagnostico_canais || []).map((d: any) => {
    const s = statsCanais.find(x => x.canal.toLowerCase() === String(d.canal || "").toLowerCase())
    return { ...d, stats: s || null }
  })

  return {
    cliente_id: clientConfig.id,
    periodo: "completo",
    resumo_geral: final.resumo_geral || "",
    metricas: {
      total_leads_analisados: analisadas.length,
      total_leads_banco: leads.length,
      total_mensagens: mensagens.length,
      temperatura_geral: final.metricas?.temperatura_geral || "Morna",
      score_qualidade_leads: final.metricas?.score_qualidade_leads ?? 0,
      taxa_agendamento_estimada: `${taxaAgendamentoNum}%`,
      quentes: temps.quente || 0, mornas: temps.morna || 0, frias: temps.fria || 0,
    },
    leads_quentes: leadsQuentes,
    alertas_atrito: final.alertas_atrito || [],
    diagnostico_canais: diagnostico,
    insights_estoque: final.insights_estoque || [],
    created_at: new Date().toISOString(),
  }
}
