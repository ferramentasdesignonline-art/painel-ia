import { NextResponse } from "next/server"
import { getActiveClientConfig } from "@/lib/auth/helpers"
import { createClient } from "@supabase/supabase-js"
import { isNocoDBClient, getNocoDBLeads, getNocoDBBlockedNumbers } from "@/lib/nocodb/service"
import { getAllBlockedNumbers } from "@/lib/supabase/queries"

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function normalizeIsoDate(dStr?: string | null): string | null {
  if (!dStr) return null
  let s = String(dStr).trim()
  if (!s) return null
  if (!s.includes('T') && s.includes(' ')) {
    s = s.replace(' ', 'T')
  }
  if (!s.endsWith('Z') && !s.includes('+') && !s.includes('-03') && !s.includes('-00')) {
    s += 'Z'
  }
  return s
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const daysParam = searchParams.get('days') || '7'
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')

    const clientConfig = await getActiveClientConfig()
    if (!clientConfig) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Calcular período
    let startDate: Date
    let endDate: Date = new Date()

    if (fromParam) {
      const [sY, sM, sD] = fromParam.split('-').map(Number)
      startDate = new Date(sY, sM - 1, sD, 0, 0, 0, 0)
    } else {
      const d = parseInt(daysParam, 10) || 7
      startDate = new Date(Date.now() - d * 24 * 60 * 60 * 1000)
    }

    if (toParam) {
      const [eY, eM, eD] = toParam.split('-').map(Number)
      endDate = new Date(eY, eM - 1, eD, 23, 59, 59, 999)
    }

    const startIso = startDate.toISOString()
    const endIso = endDate.toISOString()

    const isNoco = isNocoDBClient(clientConfig)
    const isSemIA = clientConfig.tipo_atendimento === 'sem_ia' || !clientConfig.tabela_leads

    // Supabase admin para cliente com IA própria
    let clientDb: any = null
    if (!isNoco && clientConfig.supabase_url && clientConfig.supabase_url.startsWith('http')) {
      clientDb = createClient(
        clientConfig.supabase_url,
        clientConfig.supabase_service_role_key || process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
    }

    // 1. Carregar Bloqueios
    let blockedPhones = new Set<string>()
    if (clientConfig.tabela_bloqueios) {
      try {
        if (isNoco) {
          blockedPhones = await getNocoDBBlockedNumbers(clientConfig.tabela_bloqueios)
        } else if (clientDb) {
          blockedPhones = await getAllBlockedNumbers(clientDb, clientConfig.tabela_bloqueios)
        }
      } catch (e) {
        console.warn("Erro ao buscar bloqueios:", e)
      }
    }

    // 2. Carregar Estoque
    let estoqueList: any[] = []
    if (clientConfig.tabela_estoque) {
      try {
        if (isNoco) {
          const { listarEstoqueCliente } = await import("@/lib/estoque/service")
          estoqueList = await listarEstoqueCliente(clientConfig.tabela_estoque)
        } else if (clientDb) {
          const { data: est } = await clientDb.from(clientConfig.tabela_estoque).select('*')
          estoqueList = est || []
        }
      } catch (e) {
        console.warn("Erro ao buscar estoque:", e)
      }
    }

    // 3. Carregar Leads
    let leadsList: any[] = []
    if (isSemIA) {
      const { getWacloudContatos } = await import('@/lib/nocodb/wacloud')
      const instName = clientConfig.whatsapp_instancia || clientConfig.nome_instancia || clientConfig.nome
      const contatos = await getWacloudContatos({ nomeInstancia: instName, limit: 10000 })
      leadsList = contatos.filter((c: any) => {
        const dStr = c.created_at || c.CreatedAt || c.atualizado_em
        if (!dStr) return true
        const dt = new Date(dStr)
        return dt >= startDate && dt <= endDate
      })
    } else if (isNoco) {
      leadsList = await getNocoDBLeads(clientConfig.tabela_leads, { from: startIso, to: endIso })
    } else if (clientDb) {
      let offset = 0
      while (true) {
        const res = await clientDb
          .from(clientConfig.tabela_leads)
          .select('*')
          .gte('created_at', startIso)
          .lte('created_at', endIso)
          .order('created_at', { ascending: false })
          .range(offset, offset + 999)
        if (res.error || !res.data || res.data.length === 0) break
        leadsList.push(...res.data)
        if (res.data.length < 1000) break
        offset += 1000
      }
    }

    // 4. Carregar Mensagens / Conversas
    let msgsList: any[] = []
    if (isSemIA) {
      const { getWacloudMensagens } = await import('@/lib/nocodb/wacloud')
      const instName = clientConfig.whatsapp_instancia || clientConfig.nome_instancia || clientConfig.nome
      msgsList = await getWacloudMensagens("", instName, 20000)
    } else if (isNoco && clientConfig.tabela_memoria) {
      const { getNocoDBTableId } = await import("@/lib/nocodb/service")
      const tId = await getNocoDBTableId(clientConfig.tabela_memoria)
      if (tId) {
        const NOCODB_URL = process.env.NOCODB_URL || "https://evolution-nocodb.4lap5g.easypanel.host"
        const NOCODB_TOKEN = process.env.NOCODB_API_TOKEN || "9Qz7ETxba8JnXq3B0e9ybHaSiDar6hLqYBIIkg7u"
        const res = await fetch(`${NOCODB_URL}/api/v2/tables/${tId}/records?limit=10000&sort=-id`, {
          headers: { "xc-token": NOCODB_TOKEN },
          cache: "no-store"
        })
        if (res.ok) {
          const d = await res.json()
          msgsList = d.list || []
        }
      }
    } else if (clientDb && clientConfig.tabela_memoria) {
      let offset = 0
      while (true) {
        const res = await clientDb
          .from(clientConfig.tabela_memoria)
          .select('*')
          .gte('created_at', startIso)
          .lte('created_at', endIso)
          .order('created_at', { ascending: true })
          .range(offset, offset + 999)
        if (res.error || !res.data || res.data.length === 0) break
        msgsList.push(...res.data)
        if (res.data.length < 1000) break
        offset += 1000
      }
    }

    // 5. Agrupar mensagens por telefone / sessão
    const sessionMap = new Map<string, any[]>()
    msgsList.forEach(m => {
      const sId = m.session_id || m.telefone_contato || ''
      if (!sId) return
      const clean = String(sId).replace(/\D/g, '')
      const tail = clean.slice(-8)
      if (!sessionMap.has(tail)) sessionMap.set(tail, [])
      sessionMap.get(tail)!.push(m)
    })

    // 6. Auditoria Lead a Lead com Timestamps precisos
    const leadsAuditados: any[] = []
    let totalFotos = 0
    let totalSemEstoque = 0
    let totalIntervencoes = 0
    let totalErros = 0
    let totalFichasOuSimulacoes = 0
    let totalMalEntendidos = 0

    // Criar mapa de veículos em estoque para cruzamento rápido
    const estoqueNomes = estoqueList.map(e => ({
      marca: String(e.marca || '').toLowerCase().trim(),
      modelo: String(e.modelo || '').toLowerCase().trim(),
      versao: String(e.versao || '').toLowerCase().trim(),
      ano: e.ano,
      cor: String(e.cor || '').toLowerCase().trim(),
      preco: e.valor_venda,
      original: `${e.marca || ''} ${e.modelo || ''} ${e.ano || ''} (${e.cor || ''})`
    }))

    for (const lead of leadsList) {
      const rawPhone = lead.telefone || lead.phone || lead.telefone_contato || ''
      const cleanPhone = String(rawPhone).replace(/\D/g, '')
      const tail = cleanPhone.slice(-8)

      // Ordenar mensagens da sessão estritamente em ordem cronológica crescente
      const rawMsgs = sessionMap.get(tail) || []
      const msgs = rawMsgs.slice().sort((a, b) => {
        const tA = new Date(a.created_at || a.CreatedAt || 0).getTime()
        const tB = new Date(b.created_at || b.CreatedAt || 0).getTime()
        return tA - tB
      })

      const isBlocked = blockedPhones.has(cleanPhone) || (cleanPhone.startsWith('55') && blockedPhones.has(cleanPhone.slice(2))) || blockedPhones.has(tail)

      let mandouFotos = false
      let dataFotos: string | null = null

      let falouSemEstoque = false
      let motivoSemEstoque = ''
      let dataSemEstoque: string | null = null

      let deuErro = false
      let detalheErro = ''
      let dataErro: string | null = null

      let intervenienteHumano = false
      let dataIntervencao: string | null = null

      let coletouFicha = Boolean(lead.cpf_cnpj || lead.observacao_lead_qualificado || lead.lead_simulacao_pre_aprovada || lead.lead_simulacao_aprovada)
      let dataFicha: string | null = null

      let possivelMalEntendido = false
      let sugestaoEstoque = ''

      const historicoResumido: { de: string; texto: string; data: string }[] = []

      msgs.forEach(m => {
        let type = 'human'
        let content = ''
        const dataMsg = normalizeIsoDate(m.created_at || m.CreatedAt || null)

        if (typeof m.message === 'string') {
          try {
            const p = JSON.parse(m.message)
            type = p.type || 'human'
            content = p.content || ''
          } catch {
            content = m.message
          }
        } else if (m.message && typeof m.message === 'object') {
          type = m.message.type || 'human'
          content = m.message.content || ''
        } else if (m.mensagem) {
          type = m.enviado_por_mim ? 'ai' : 'human'
          content = m.mensagem
        }

        const lower = (content || '').toLowerCase()

        if (type === 'human') {
          historicoResumido.push({ de: 'Cliente', texto: content, data: dataMsg || '' })
        } else {
          historicoResumido.push({ de: 'IA', texto: content, data: dataMsg || '' })

          // Detecção de intervenção da loja / vendedor assumiu a conversa
          if (lower.includes('[atendimento humano]') || lower.includes('atendente humano') || lower.includes('[atendimento') || lower.includes('vendedor entrar em contato')) {
            intervenienteHumano = true
            if (!dataIntervencao && dataMsg) dataIntervencao = dataMsg
          }

          // Detecção precisa de envio de fotos reais do veículo (URL real ou frase explícita de entrega)
          const temLinkFotoReal = (
            lower.includes('.jpg') || lower.includes('.jpeg') || lower.includes('.png') || lower.includes('.webp') ||
            lower.includes('s3.amazonaws.com') || lower.includes('cdn-sistema-lojistas') || lower.includes('/upload/') ||
            lower.includes('aqui estão as fotos') || lower.includes('veja as fotos')
          )
          if (temLinkFotoReal) {
            mandouFotos = true
            if (!dataFotos && dataMsg) dataFotos = dataMsg
          }

          if (lower.includes('não temos') || lower.includes('nao temos') || lower.includes('infelizmente no momento não temos') || lower.includes('não está disponível') || lower.includes('acabou de ser vendido')) {
            falouSemEstoque = true
            motivoSemEstoque = content.slice(0, 160)
            if (!dataSemEstoque && dataMsg) dataSemEstoque = dataMsg
          }

          // Detecção refinada de erros e identificação precisa do motivo com data
          if (lower.includes('erro ao tentar') || lower.includes('pequeno erro') || lower.includes('houve um erro') || lower.includes('houve um problema') || lower.includes('sistema indisponível')) {
            deuErro = true
            if (!dataErro && dataMsg) dataErro = dataMsg
            if (lower.includes('simulação') || lower.includes('financiamento') || lower.includes('cpf')) {
              detalheErro = 'Falha ao processar simulação de financiamento (validação de CPF/dados)'
            } else if (lower.includes('veículos') || lower.includes('opções')) {
              detalheErro = 'Falha no envio de opções do estoque'
            } else {
              detalheErro = content.slice(0, 120)
            }
          }

          if (lower.includes('simulação de financiamento') || lower.includes('dados para a simulação') || lower.includes('cpf ou cnpj') || lower.includes('iniciar a simulação')) {
            coletouFicha = true
            if (!dataFicha && dataMsg) dataFicha = dataMsg
          }
        }
      })

      // Se não encontrou mensagem explícita de [ATENDIMENTO HUMANO], mas o lead está na tabela de bloqueios
      if (!intervenienteHumano && isBlocked) {
        intervenienteHumano = true
        // Não jogamos lead.created_at para não confundir o horário do vendedor com o nascimento do lead
      }

      // Se coletou ficha pelos dados do lead e não encontrou no chat, usar update_lead
      if (coletouFicha && !dataFicha) {
        dataFicha = normalizeIsoDate(lead.update_lead || null)
      }

      // Verificar se houve mal entendido de estoque (IA disse não tem, mas no estoque tem modelo similar)
      if (falouSemEstoque) {
        const interesse = String(lead.veiculo_interessado || '').toLowerCase()
        const textoClienteTotal = historicoResumido.filter(h => h.de === 'Cliente').map(h => h.texto).join(' ').toLowerCase()
        
        // Procurar por match de marca/modelo similar
        for (const est of estoqueNomes) {
          if (est.modelo && (interesse.includes(est.modelo) || textoClienteTotal.includes(est.modelo))) {
            possivelMalEntendido = true
            sugestaoEstoque = `Tinha ${est.original} em estoque`
            break
          }
        }
      }

      if (mandouFotos) totalFotos++
      if (falouSemEstoque) totalSemEstoque++
      if (intervenienteHumano) totalIntervencoes++
      if (deuErro) totalErros++
      if (coletouFicha) totalFichasOuSimulacoes++
      if (possivelMalEntendido) totalMalEntendidos++

      // Status da conversa
      let statusGeral: 'sucesso' | 'atencao' | 'erro' = 'sucesso'
      if (deuErro || possivelMalEntendido) statusGeral = 'erro'
      else if (falouSemEstoque || !mandouFotos && msgs.length > 3) statusGeral = 'atencao'

      leadsAuditados.push({
        id: lead.id,
        nome: lead.nome || 'Cliente',
        telefone: cleanPhone,
        veiculoInteresse: lead.veiculo_interessado || 'Geral / Não informado',
        origem: lead.origem_lead || 'WhatsApp',
        dataCriacao: normalizeIsoDate(lead.created_at || lead.CreatedAt || null),
        totalMensagens: msgs.length,
        mandouFotos,
        dataFotos,
        falouSemEstoque,
        motivoSemEstoque,
        dataSemEstoque,
        possivelMalEntendido,
        sugestaoEstoque,
        deuErro,
        detalheErro,
        dataErro,
        intervenienteHumano,
        dataIntervencao,
        coletouFicha,
        dataFicha,
        statusGeral,
        historicoResumido: historicoResumido.slice(-8),
        rawLead: {
          id: lead.id?.toString() || "",
          nome: lead.nome || "Cliente",
          telefone: cleanPhone,
          veiculo: lead.veiculo_interessado || "",
          vendedor: lead.vendedor_lead || "IA",
          status: lead.lead_finalizado ? "Finalizado" : lead.data_agendamento_visita ? "Agendado" : "Em atendimento",
          origem: lead.origem_lead || "ia",
          ultimaMensagem: lead.ultima_mensagem || "-",
          createdAt: lead.created_at || lead.CreatedAt,
          quantidadeFollowup: lead.quantidade_followup,
          leadFinalizado: lead.lead_finalizado === true,
          veiculoInteressado: lead.veiculo_interessado || null,
          dataAgendamentoVisita: lead.data_agendamento_visita || null,
          horarioAgendamentoVisita: lead.horario_agendamento_visita || null,
          observacaoLeadQualificado: lead.observacao_lead_qualificado || null,
          email: lead.email || null,
          cpfCnpj: lead.cpf_cnpj || null,
          dataNascimento: lead.data_nascimento || null,
          veiculoTroca: lead.veiculo_troca || null,
          endereco: lead.endereço || lead.endereco || null,
          possuiCnh: lead.possui_cnh,
          genero: lead.genero || null,
          tags: lead.tags || [],
          canal_origem: lead.origem_lead,
          canal_label_name: lead.origem_detalhe || lead.origem_lead,
          anuncio_titulo: lead.anuncio_titulo,
          anuncio_id: lead.anuncio_id,
          anuncio_url: lead.anuncio_url,
          origem_detalhe: lead.origem_detalhe
        }
      })
    }

    const totalLeads = leadsList.length
    const scoreEficiencia = totalLeads > 0 
      ? Math.round(((totalLeads - totalErros - totalMalEntendidos) / totalLeads) * 100) 
      : 100

    return NextResponse.json({
      cliente: clientConfig.nome,
      periodo: {
        de: startDate.toLocaleDateString('pt-BR'),
        ate: endDate.toLocaleDateString('pt-BR'),
        dias: parseInt(daysParam, 10) || 7
      },
      resumo: {
        totalLeads,
        totalConversasComMensagens: sessionMap.size,
        totalMensagensNoPeriodo: msgsList.length,
        scoreEficiencia,
        totalFotos,
        pctFotos: totalLeads > 0 ? Number(((totalFotos / totalLeads) * 100).toFixed(1)) : 0,
        totalSemEstoque,
        pctSemEstoque: totalLeads > 0 ? Number(((totalSemEstoque / totalLeads) * 100).toFixed(1)) : 0,
        totalMalEntendidos,
        totalIntervencoes,
        pctIntervencoes: totalLeads > 0 ? Number(((totalIntervencoes / totalLeads) * 100).toFixed(1)) : 0,
        totalErros,
        pctErros: totalLeads > 0 ? Number(((totalErros / totalLeads) * 100).toFixed(1)) : 0,
        totalFichasOuSimulacoes,
        pctFichas: totalLeads > 0 ? Number(((totalFichasOuSimulacoes / totalLeads) * 100).toFixed(1)) : 0,
        carrosEstoqueDisponiveis: estoqueList.length
      },
      leads: leadsAuditados
    })
  } catch (err: any) {
    console.error("Erro na API de auditoria de conversas:", err)
    return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 })
  }
}
