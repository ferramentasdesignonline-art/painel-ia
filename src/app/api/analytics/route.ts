import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { getActiveClientConfig } from "@/lib/auth/helpers"
import { calcularEtapaIA } from "@/lib/funil/calcular-etapa"
import { getAllBlockedNumbers, getClientLeads } from "@/lib/supabase/queries"
import { getClientWhatsappLabelsData } from "@/lib/wacloud/labels"

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

    const clientSupabaseUrl = clientConfig.supabase_url || process.env.NEXT_PUBLIC_SUPABASE_URL!
    const clientSupabaseKey = clientConfig.supabase_service_role_key || process.env.SUPABASE_SERVICE_ROLE_KEY!

    const supabaseAdmin = createClient(
      clientSupabaseUrl,
      clientSupabaseKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const isSemIA = clientConfig.tipo_atendimento === 'sem_ia' || !clientConfig.tabela_leads;
    const nomeInstancia = clientConfig.nome_instancia || clientConfig.nome;

    // ── 1. Mensagens ──────────────────────────────────────────────────────────
    let aiMessages = 0
    let humanMessages = 0
    const messagesByDay: Record<string, { ai: number; human: number }> = {}

    const fromDate = from ? new Date(from) : null
    const toDate   = to   ? new Date(to)   : null

    if (isSemIA) {
      const { getWacloudSupabaseAdmin } = await import('@/lib/wacloud/supabase');
      const wacloudAdmin = getWacloudSupabaseAdmin();

      let msgQuery = wacloudAdmin
        .from('wacloud_mensagens')
        .select('id, mensagem, enviado_por_mim, created_at')
        .eq('nome_instancia', nomeInstancia);

      if (from) msgQuery = msgQuery.gte('created_at', from);
      if (to)   msgQuery = msgQuery.lte('created_at', to);

      const { data: cloudMsgs, error: cloudMsgErr } = await msgQuery.limit(10000);
      if (cloudMsgErr) {
        console.error("Erro ao buscar mensagens wacloud:", cloudMsgErr.message);
      }

      for (const m of cloudMsgs || []) {
        const isSentByAttendant = m.enviado_por_mim === true;
        if (isSentByAttendant) aiMessages++;
        else humanMessages++;

        if (m.created_at) {
          const day = new Date(m.created_at).toLocaleDateString('pt-BR', {
            timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit'
          });
          if (!messagesByDay[day]) messagesByDay[day] = { ai: 0, human: 0 };
          const type = isSentByAttendant ? 'ai' : 'human';
          messagesByDay[day][type]++;
        }
      }
    } else if (clientConfig.tabela_memoria) {
      console.log('Buscando mensagens da tabela:', clientConfig.tabela_memoria);
      let msgQuery = supabaseAdmin
        .from(clientConfig.tabela_memoria)
        .select('id, message, created_at')

      if (from) msgQuery = msgQuery.gte('created_at', from)
      if (to)   msgQuery = msgQuery.lte('created_at', to)

      const { data: allMessages, error: msgError } = await msgQuery

      if (msgError) {
        console.warn("Memoria query with date failed, retrying without date filter:", msgError.message)
        const { data: allMsgsFallback } = await supabaseAdmin
          .from(clientConfig.tabela_memoria)
          .select('*')
          .limit(5000)
          
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

    // ── 2. Leads ─────────────────────────────────────────────────────────────
    let totalFollowups = 0
    let qualifiedLeads = 0
    const leadsByDay: Record<string, number> = {}
    let allLeads: any[] = []
    let simulacoesPreAprovadas = 0
    let perdas = 0

    if (isSemIA) {
      const { getWacloudSupabaseAdmin } = await import('@/lib/wacloud/supabase');
      const wacloudAdmin = getWacloudSupabaseAdmin();

      let leadsQuery = wacloudAdmin
        .from('wacloud_contatos')
        .select('*')
        .eq('nome_instancia', nomeInstancia);

      if (from) leadsQuery = leadsQuery.gte('created_at', from);
      if (to)   leadsQuery = leadsQuery.lte('created_at', to);

      const { data: dbLeads, error: leadsError } = await leadsQuery.order('created_at', { ascending: false }).limit(50000);
      if (leadsError) {
        console.error("Erro ao buscar contatos wacloud:", leadsError.message);
      } else if (dbLeads) {
        allLeads = dbLeads.filter(c => 
          c.is_group !== true && 
          !c.wa_chatid?.includes('@g.us') && 
          !c.telefone_contato?.includes('@g.us') && 
          !c.telefone?.includes('@g.us')
        );
      }
    } else if (clientConfig.tabela_leads) {
      allLeads = await getClientLeads(supabaseAdmin, clientConfig.tabela_leads, { from, to });
    }

    // Carregar todas as etiquetas da instância para enriquecer leads (com e sem IA)
    const { mapaWhatsappLabels, mapaNomes } = await getClientWhatsappLabelsData(clientConfig);

    const canalParam = searchParams.get('canal');

    // Mapear canal_origem e garantir etiquetas reais do WhatsApp em cada lead
    for (const lead of allLeads) {
      const rawPhone = lead.telefone || lead.phone || lead.telefone_contato || '';
      const phoneClean = String(rawPhone).replace(/@s\.whatsapp\.net/gi, '').replace(/@c\.us/gi, '').replace(/\D/g, '');

      const leadWaLabels = (lead.whatsapp_labels && Array.isArray(lead.whatsapp_labels) && lead.whatsapp_labels.length > 0)
        ? lead.whatsapp_labels
        : (mapaWhatsappLabels.get(phoneClean) || []);

      lead.whatsapp_labels = leadWaLabels;

      let canal_origem: string = lead.origem_lead || '';
      let canal_label_name: string | null = null;

      if (!canal_origem) {
        for (const lId of leadWaLabels) {
          const cleanId = String(lId).includes(':') ? String(lId).split(':')[1] : String(lId);
          const nomeLbl = mapaNomes.get(cleanId);
          if (nomeLbl && nomeLbl.toLowerCase().startsWith('canal')) {
            canal_label_name = nomeLbl.replace(/^canal\s*\|\s*/i, '').trim();
            canal_origem = canal_label_name.toLowerCase().replace(/\s+/g, '_');
            break;
          }
        }
      }

      if (!canal_origem) {
        canal_origem = 'sem_origem';
        canal_label_name = 'Sem Origem';
      } else if (canal_origem === 'desconhecido') {
        canal_label_name = 'Desconhecido';
      }

      lead.canal_origem = canal_origem;
      lead.canal_label_name = canal_label_name;
    }

    // Filtrar por canal se solicitado
    const leadsFiltrados = (canalParam && canalParam !== 'todos')
      ? allLeads.filter(l => (l.canal_origem || 'sem_origem') === canalParam)
      : allLeads;

    let totalLeads = leadsFiltrados.length;
    let emAtendimento = 0;
    let oportunidades = 0;
    let visitasAgendadas = 0;
    let visitasRealizadas = 0;
    let simulacoesAprovadas = 0;
    let perdidosQualificados = 0;
    let perdidosDesqualificados = 0;
    let clientes = 0;

    // Busca os bloqueios para nao contar como em andamento nem somar followups
    const blockedNumbers = (isSemIA || !clientConfig.tabela_bloqueios)
      ? new Set<string>()
      : await getAllBlockedNumbers(supabaseAdmin, clientConfig.tabela_bloqueios);

    for (const lead of leadsFiltrados) {
      const rawPhone = lead.telefone || lead.phone || lead.telefone_contato || '';
      const phoneClean = rawPhone.replace(/@s\.whatsapp\.net/gi, '').replace(/@c\.us/gi, '').replace(/\D/g, '');
      const isBlocked = blockedNumbers.has(phoneClean);

      if (!isBlocked) {
        totalFollowups += parseInt(lead.quantidade_followup || '0');
      }

      const etapa = calcularEtapaIA(lead, 5, mapaNomes);

      if (etapa === 'cliente') {
        clientes++;
      } else if (etapa === 'visita_realizada') {
        visitasRealizadas++;
      } else if (etapa === 'visita_confirmada' || etapa === 'visita_agendada') {
        visitasAgendadas++;
      } else if (etapa === 'simulacao_aprovada') {
        simulacoesAprovadas++;
      } else if (
        etapa === 'oportunidade' ||
        etapa === 'ia_qualificado' ||
        etapa === 'simulacao_pre_aprovada'
      ) {
        oportunidades++;
      } else if (etapa === 'perdido_qualificado') {
        perdidosQualificados++;
      } else if (etapa === 'perdido_desqualificado') {
        perdidosDesqualificados++;
      } else {
        emAtendimento++;
      }
    }

    // Cálculos das 5 Etapas do Funil Visual
    const stage1_novoLead = totalLeads;
    const stage2_emAtendimento = Math.min(
      stage1_novoLead,
      emAtendimento + oportunidades + visitasAgendadas + visitasRealizadas + simulacoesAprovadas + clientes + perdidosQualificados
    );
    const stage3_oportunidade = oportunidades + visitasAgendadas + visitasRealizadas + simulacoesAprovadas + clientes;
    const stage4_simulacaoAprovada = simulacoesAprovadas + clientes;
    const stage5_cliente = clientes;

    const c1to2 = stage1_novoLead > 0 ? (stage2_emAtendimento / stage1_novoLead) * 100 : 0;
    const c2to3 = stage2_emAtendimento > 0 ? (stage3_oportunidade / stage2_emAtendimento) * 100 : 0;
    const c3to4 = stage3_oportunidade > 0 ? (stage4_simulacaoAprovada / stage3_oportunidade) * 100 : 0;
    const c4to5 = stage4_simulacaoAprovada > 0 ? (stage5_cliente / stage4_simulacaoAprovada) * 100 : 0;
    const taxaConversaoGeral = stage1_novoLead > 0 ? (stage5_cliente / stage1_novoLead) * 100 : 0;

    const funnel = {
      stages: [
        { 
          id: 'novo_lead', 
          nome: 'NOVO LEAD', 
          count: stage1_novoLead, 
          conversionRate: null, 
          cor: '#3b82f6',
          detalhe: 'Entrada total no período'
        },
        { 
          id: 'em_atendimento', 
          nome: 'EM ATENDIMENTO', 
          count: stage2_emAtendimento, 
          conversionRate: Number(c1to2.toFixed(1)), 
          cor: '#06b6d4',
          detalhe: 'Em atendimento ativo na esteira'
        },
        { 
          id: 'oportunidade', 
          nome: 'OPORTUNIDADE', 
          count: stage3_oportunidade, 
          conversionRate: Number(c2to3.toFixed(1)), 
          cor: '#8b5cf6',
          detalhe: `${oportunidades} Oportunidades + ${visitasAgendadas + visitasRealizadas} Visitas + ${simulacoesAprovadas} Simulações + ${clientes} Vendas`
        },
        { 
          id: 'simulacao_aprovada', 
          nome: 'SIMULAÇÃO APROVADA', 
          count: stage4_simulacaoAprovada, 
          conversionRate: Number(c3to4.toFixed(1)), 
          cor: '#f59e0b',
          detalhe: `${simulacoesAprovadas} Simulações Aprovadas + ${clientes} Vendas`
        },
        { 
          id: 'cliente', 
          nome: 'CLIENTES / VENDA', 
          count: stage5_cliente, 
          conversionRate: Number(c4to5.toFixed(1)), 
          cor: '#22c55e',
          detalhe: `${stage5_cliente} compras/vendas concluídas`
        },
      ],
      total: stage1_novoLead,
      globalConversionRate: Number(taxaConversaoGeral.toFixed(1)),
      totalVendas: stage5_cliente,
    };

    // Leads por dia
    for (const lead of leadsFiltrados || []) {
      const day = new Date(lead.created_at).toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit'
      })
      leadsByDay[day] = (leadsByDay[day] || 0) + 1
    }

    // Montar séries cronológicas ordenadas
    const allDays = Array.from(new Set([...Object.keys(messagesByDay), ...Object.keys(leadsByDay)]))
      .sort((a, b) => {
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
      tipo_atendimento: isSemIA ? 'sem_ia' : 'com_ia',
      kpis: {
        totalLeads,
        emAtendimento,
        atendimentoHumano: emAtendimento,
        oportunidades,
        visitasAgendadas,
        visitasRealizadas,
        simulacoesAprovadas,
        perdidosQualificados,
        perdidosDesqualificados,
        clientes,
        // Compatibilidade retroativa
        qualifiedLeads: oportunidades + simulacoesAprovadas + visitasAgendadas + visitasRealizadas + clientes,
        perdas: perdidosQualificados + perdidosDesqualificados,
        emAndamento: 0,
        totalFollowups,
        aiMessages,
        humanMessages,
      },
      funnel,
      chartData,
      pieData: [
        { name: 'Oportunidades', value: oportunidades + simulacoesAprovadas + visitasAgendadas + visitasRealizadas, color: '#22c55e' },
        { name: 'Em Atendimento', value: emAtendimento, color: '#f59e0b' },
        { name: 'Perdidos', value: perdidosQualificados + perdidosDesqualificados, color: '#ef4444' },
      ]
    }, { status: 200 })

  } catch (error) {
    console.error("Analytics API Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
