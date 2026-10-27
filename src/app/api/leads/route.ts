import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { getActiveClientConfig } from "@/lib/auth/helpers"
import { getClientLeads, getAllBlockedNumbers } from "@/lib/supabase/queries"
import { construirDataAgendamentoIso } from "@/lib/agendamento-utils"
import { getClientWhatsappLabelsData } from "@/lib/wacloud/labels"
import { calcularEtapaIA } from "@/lib/funil/calcular-etapa"
import { isNocoDBClient, getNocoDBLeads, getNocoDBBlockedNumbers } from "@/lib/nocodb/service"
import { getNocoDBLeadsManuais, getNocoDBTags, getNocoDBLeadTags } from "@/lib/nocodb/sistema"

export async function GET(request: Request) {
  try {
    const cookieStore = cookies()
    // 1. Instanciamos o client "normal" apenas para ler os cookies e session do Auth
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

    // 2. Obtemos qual a configuração do cliente ativo (descobre se é admin impersonando ou cliente)
    const clientConfig = await getActiveClientConfig(supabaseSession)
    
    if (!clientConfig) {
      return NextResponse.json({ error: "Unauthorized or no client config found" }, { status: 401 })
    }

    // 3. Instanciamos um client com a SERVICE ROLE KEY, porque as tabelas dinâmicas
    // podem não ter políticas RLS amigáveis configuradas, sendo o backend a ponte segura.
    const isNocoDB = isNocoDBClient(clientConfig)
    const clientSupabaseUrl = (!isNocoDB && clientConfig.supabase_url && clientConfig.supabase_url !== 'nocodb') 
      ? clientConfig.supabase_url 
      : process.env.NEXT_PUBLIC_SUPABASE_URL!
    const clientSupabaseKey = (!isNocoDB && clientConfig.supabase_service_role_key) 
      ? clientConfig.supabase_service_role_key 
      : process.env.SUPABASE_SERVICE_ROLE_KEY!

    const supabaseAdmin = createClient(
      clientSupabaseUrl,
      clientSupabaseKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const isSemIA = clientConfig.tipo_atendimento === 'sem_ia' || !clientConfig.tabela_leads;
    let leadsIA: any[] = [];
    let blockedNumbers = new Set<string>();

    let statsMapIA = new Map<string, {
      ultima_mensagem: string | null;
      ultimo_remetente: 'vendedor' | 'cliente' | null;
      ultimo_timestamp: string | null;
      tempo_medio_resposta_segundos: number | null;
    }>();

    if (isSemIA) {
      const nomeInstancia = clientConfig.nome_instancia || clientConfig.nome;
      let contatos: any[] = [];
      let mensagensRecentes: any[] = [];

      try {
        const { getWacloudContatos, getWacloudMensagens } = await import('@/lib/nocodb/wacloud');
        const [nocoContatos, nocoMsgs] = await Promise.all([
          getWacloudContatos(nomeInstancia),
          getWacloudMensagens({ nomeInstancia, limit: 10000 })
        ]);

        if (nocoContatos && nocoContatos.length > 0) {
          contatos = nocoContatos;
        }
        if (nocoMsgs && nocoMsgs.length > 0) {
          mensagensRecentes = nocoMsgs;
        }
      } catch (nocoErr) {
        console.warn("Aviso ao carregar contatos/mensagens do NocoDB:", nocoErr);
      }

      // Supabase fallback if empty
      if (contatos.length === 0 || mensagensRecentes.length === 0) {
        try {
          const { getWacloudSupabaseAdmin } = await import('@/lib/wacloud/supabase');
          const wacloudAdmin = getWacloudSupabaseAdmin();

          let contatosQuery = wacloudAdmin
            .from('wacloud_contatos')
            .select('*')
            .eq('nome_instancia', nomeInstancia)
            .order('atualizado_em', { ascending: false });

          if (from) contatosQuery = contatosQuery.gte('created_at', from);
          if (to) contatosQuery = contatosQuery.lte('created_at', to);

          const [resContatos, resMsgs] = await Promise.all([
            contatos.length === 0 ? contatosQuery.limit(50000) : Promise.resolve({ data: [] }),
            mensagensRecentes.length === 0 ? wacloudAdmin
              .from('wacloud_mensagens')
              .select('telefone_contato, mensagem, enviado_por_mim, created_at')
              .eq('nome_instancia', nomeInstancia)
              .order('created_at', { ascending: true })
              .limit(10000) : Promise.resolve({ data: [] })
          ]);

          if (contatos.length === 0 && resContatos.data) contatos = resContatos.data;
          if (mensagensRecentes.length === 0 && resMsgs.data) mensagensRecentes = resMsgs.data;
        } catch (sbErr) {
          console.warn("Aviso ao carregar contatos/mensagens do Supabase fallback:", sbErr);
        }
      }

      // Agrupa mensagens por telefone limpo
      const msgsPorTelefone = new Map<string, any[]>();
      for (const m of mensagensRecentes) {
        const raw = String(m.telefone_contato || '');
        const clean = raw.replace(/@.*$/, '').replace(/\D/g, '');
        if (!clean) continue;
        if (!msgsPorTelefone.has(clean)) msgsPorTelefone.set(clean, []);
        msgsPorTelefone.get(clean)!.push(m);
      }

      // Estatísticas de mensagem e tempo de resposta por telefone
      const statsMap = new Map<string, {
        ultima_mensagem: string | null;
        ultimo_remetente: 'vendedor' | 'cliente' | null;
        ultimo_timestamp: string | null;
        tempo_medio_resposta_segundos: number | null;
      }>();

      for (const [tel, msgs] of msgsPorTelefone.entries()) {
        if (!msgs || msgs.length === 0) continue;
        const lastMsg = msgs[msgs.length - 1];

        let lastClientTime: number | null = null;
        const responseTimes: number[] = [];

        for (const m of msgs) {
          const time = new Date(m.created_at).getTime();
          if (!m.enviado_por_mim) {
            lastClientTime = time;
          } else if (lastClientTime) {
            const diffSec = Math.round((time - lastClientTime) / 1000);
            if (diffSec >= 0 && diffSec < 86400) {
              responseTimes.push(diffSec);
            }
            lastClientTime = null;
          }
        }

        const avgSec = responseTimes.length > 0
          ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
          : null;

        statsMap.set(tel, {
          ultima_mensagem: lastMsg.mensagem || null,
          ultimo_remetente: lastMsg.enviado_por_mim ? 'vendedor' : 'cliente',
          ultimo_timestamp: lastMsg.created_at || null,
          tempo_medio_resposta_segundos: avgSec,
        });
      }

      const getMsgStats = (cleanPhone: string) => {
        if (statsMap.has(cleanPhone)) return statsMap.get(cleanPhone);
        const without55 = cleanPhone.startsWith('55') ? cleanPhone.slice(2) : cleanPhone;
        if (statsMap.has(without55)) return statsMap.get(without55);
        const with55 = '55' + cleanPhone;
        if (statsMap.has(with55)) return statsMap.get(with55);
        return null;
      };

      const contatosFiltrados = contatos.filter(c =>
        c.is_group !== true &&
        !c.wa_chatid?.includes('@g.us') &&
        !c.telefone_contato?.includes('@g.us') &&
        !c.telefone?.includes('@g.us')
      );

      leadsIA = contatosFiltrados.map(c => {
        const rawTel = String(c.telefone_contato || c.wa_chatid || '');
        const phoneClean = rawTel.replace(/@s\.whatsapp\.net/gi, '').replace(/@c\.us/gi, '').replace(/\D/g, '');
        const stats = getMsgStats(phoneClean);

        return {
          id: c.id,
          nome: c.nome_contato || 'Cliente',
          telefone: phoneClean,
          phone: phoneClean,
          created_at: c.created_at,
          updated_at: c.atualizado_em,
          ultima_mensagem: stats?.ultima_mensagem || c.ultima_mensagem || null,
          ultimo_remetente: stats?.ultimo_remetente || (c.ultimo_remetente ? (c.ultimo_remetente === 'bot' || c.ultimo_remetente === 'vendedor' ? 'vendedor' : 'cliente') : null),
          ultimo_timestamp: stats?.ultimo_timestamp || c.ultimo_timestamp || c.atualizado_em || c.created_at || null,
          tempo_medio_resposta_segundos: stats?.tempo_medio_resposta_segundos || c.tempo_primeira_resposta_segundos || null,
          tempo_primeira_resposta_segundos: c.tempo_primeira_resposta_segundos || null,
          data_agendamento_visita: c.data_agendamento_visita || null,
          horario_agendamento_visita: c.horario_agendamento_visita || null,
          lead_visita_confirmada: Boolean(c.lead_visita_confirmada),
          veiculo_interessado: c.veiculo_interessado || null,
          veiculo_troca: c.veiculo_troca || null,
          observacao_lead_qualificado: c.observacao_lead_qualificado || c.resumo_ia || null,
          lead_simulacao_aprovada: Boolean(c.lead_simulacao_aprovada),
          lead_simulacao_reprovada: Boolean(c.lead_simulacao_reprovada),
          lead_finalizado: Boolean(c.lead_visita_confirmada || c.lead_simulacao_aprovada),
          vendedor_lead: c.vendedor_responsavel || 'Atendente',
          origem_lead: c.origem_lead || 'desconhecido',
          origem: 'sem_ia',
          origem_detalhe: c.origem_detalhe || null,
          anuncio_id: c.anuncio_id || null,
          anuncio_titulo: c.anuncio_titulo || null,
          anuncio_url: c.anuncio_url || null,
          anuncio_descricao: c.anuncio_descricao || null,
          whatsapp_labels: Array.isArray(c.whatsapp_labels) ? c.whatsapp_labels : [],
          email: c.email || null,
          cpf_cnpj: c.cpf_cnpj || null,
          data_nascimento: c.data_nascimento || null,
          possui_cnh: c.possui_cnh !== undefined ? c.possui_cnh : null,
          endereco: c.endereco || c.endereço || null,
          endereço: c.endereco || c.endereço || null,
          genero: c.genero || null,
          valor_entrada: c.valor_entrada || null,
        };
      });
    } else {
      const [leadsRes, blockedRes] = await Promise.all([
        isNocoDB
          ? getNocoDBLeads(clientConfig.tabela_leads, { from, to })
          : getClientLeads(supabaseAdmin, clientConfig.tabela_leads, { from, to }),
        isNocoDB
          ? getNocoDBBlockedNumbers(clientConfig.tabela_bloqueios)
          : getAllBlockedNumbers(supabaseAdmin, clientConfig.tabela_bloqueios)
      ]);
      leadsIA = leadsRes;
      blockedNumbers = blockedRes;

      // Se cliente tem tabela_memoria, enriquece com as mensagens reais e estatísticas de resposta da IA
      if (!isNocoDB && clientConfig.tabela_memoria) {
        try {
          const { data: rawMsgs } = await supabaseAdmin
            .from(clientConfig.tabela_memoria)
            .select('session_id, message, created_at')
            .order('created_at', { ascending: false })
            .limit(10000);

          if (rawMsgs && rawMsgs.length > 0) {
            const cronoMsgs = [...rawMsgs].reverse();
            const msgsPorTelefone = new Map<string, any[]>();

            for (const m of cronoMsgs) {
              const rawSession = String(m.session_id || '');
              if (rawSession.includes('_oportunidade') || rawSession.includes('_dados')) continue;
              const clean = rawSession.replace(/@.*$/, '').replace(/\D/g, '');
              if (!clean) continue;
              if (!msgsPorTelefone.has(clean)) msgsPorTelefone.set(clean, []);
              msgsPorTelefone.get(clean)!.push(m);
            }

            for (const [tel, msgs] of msgsPorTelefone.entries()) {
              let lastValidMsg: any = null;
              let lastClientTime: number | null = null;
              const responseTimes: number[] = [];

              for (const m of msgs) {
                const msgData = typeof m.message === 'string' ? (() => {
                  try { return JSON.parse(m.message); } catch { return { content: m.message }; }
                })() : (m.message || {});

                let content = typeof msgData.content === 'string' ? msgData.content : '';
                if (!content) continue;

                // Ignora triggers automáticos de follow-up do sistema
                if (
                  content.includes("Execute agora o follow-up") ||
                  content.includes("Execute o follow-up") ||
                  content.includes("Analise primeiro todo o histórico")
                ) {
                  continue;
                }

                // Limpa estado interno da IA e prefixos de webhook
                content = content
                  .replace(/<estado>[\s\S]*?<\/estado>/gi, '')
                  .replace(/Mensagem do cliente:\s*/gi, '')
                  .replace(/Se caso tiver, o cliente pode ter respondido uma mensagem e a mensagem era essa:\s*/gi, '')
                  .trim();

                if (!content) continue;

                const isHuman = msgData.type === 'human';
                const time = new Date(m.created_at).getTime();

                lastValidMsg = {
                  content,
                  isHuman,
                  created_at: m.created_at,
                };

                if (isHuman) {
                  lastClientTime = time;
                } else if (lastClientTime) {
                  const diffSec = Math.round((time - lastClientTime) / 1000);
                  if (diffSec >= 0 && diffSec < 86400) {
                    responseTimes.push(diffSec);
                  }
                  lastClientTime = null;
                }
              }

              if (lastValidMsg) {
                const avgSec = responseTimes.length > 0
                  ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
                  : null;

                statsMapIA.set(tel, {
                  ultima_mensagem: lastValidMsg.content,
                  ultimo_remetente: lastValidMsg.isHuman ? 'cliente' : 'vendedor',
                  ultimo_timestamp: lastValidMsg.created_at,
                  tempo_medio_resposta_segundos: avgSec,
                });
              }
            }
          }
        } catch (err) {
          console.error("Erro ao buscar mensagens da tabela_memoria da IA:", err);
        }
      }
    }

    // 5. Busca leads manuais
    let leadsManuais: any[] = [];
    try {
      leadsManuais = await getNocoDBLeadsManuais(clientConfig.id);
    } catch (nocoManErr) {
      console.warn("Aviso ao buscar leads manuais no NocoDB:", nocoManErr);
    }

    if (leadsManuais.length === 0) {
      let manuaisQuery = supabaseAdmin
        .from('sistema-dash-ia_leads_manuais')
        .select('*, etapa:etapa_id(nome)')
        .eq('cliente_id', clientConfig.id);

      if (from) manuaisQuery = manuaisQuery.gte('created_at', from);
      if (to) manuaisQuery = manuaisQuery.lte('created_at', to);

      const { data: sbManuais } = await manuaisQuery;
      leadsManuais = sbManuais || [];
    }

    // Formata leads manuais para padrão compatível com a UI
    const manuaisFormatados = (leadsManuais || []).map(lead => {
      const etapaNome = lead.etapa?.nome || 'Lead Manual';
      const isQualificado = etapaNome.toLowerCase() === 'qualificado';
      
      const rawPhone = lead.telefone || '';
      const phoneClean = rawPhone.replace(/@s\.whatsapp\.net/gi, '').replace(/@c\.us/gi, '').replace(/\D/g, '');
      const isBlocked = blockedNumbers.has(phoneClean);

      return {
        ...lead,
        // Se tivermos um identificador especial como 'manual-', ele será util na UI
        original_id: lead.id,
        id: `manual-${lead.id}`,
        origem: 'manual',
        etapa_manual_nome: etapaNome,
        lead_finalizado: isQualificado ? true : lead.lead_finalizado,
        is_blocked: isBlocked
      };
    });

    // 6. Buscar contatos e etiquetas do WhatsApp Cloud para enriquecer leads
    const { mapaWhatsappLabels, mapaNomes, mapaUazapiLabels } = await getClientWhatsappLabelsData(clientConfig);

    // Formata leads IA para garantir mesmo padrão q usamos no funil
    const iaFormatados = (leadsIA || []).map((lead: any) => {
      let data_agendamento = lead.data_agendamento || null;
      if (lead.data_agendamento_visita) {
        data_agendamento = construirDataAgendamentoIso(lead.data_agendamento_visita, lead.horario_agendamento_visita) || data_agendamento;
      }
      
      const rawPhone = lead.telefone || lead.phone || '';
      const phoneClean = rawPhone.replace(/@s\.whatsapp\.net/gi, '').replace(/@c\.us/gi, '').replace(/\D/g, '');
      const isBlocked = blockedNumbers.has(phoneClean);

      // Correlaciona etiquetas do WhatsApp (usa do lead se já vier do wacloud_contatos)
      const leadWaLabels = (lead.whatsapp_labels && Array.isArray(lead.whatsapp_labels) && lead.whatsapp_labels.length > 0)
        ? lead.whatsapp_labels
        : (mapaWhatsappLabels.get(phoneClean) || []);

      // Descobrir Canal de Atendimento (prioridade para etiqueta WhatsApp 'Canal | ...')
      let canal_origem: string = '';
      let canal_label_name: string | null = null;
      let canal_color: string | null = null;

      for (const lId of leadWaLabels) {
        const cleanId = String(lId).includes(':') ? String(lId).split(':')[1] : String(lId);
        const def = mapaUazapiLabels.get(cleanId);
        if (def && def.name.toLowerCase().startsWith('canal')) {
          canal_label_name = def.name.replace(/^canal\s*\|\s*/i, '').trim();
          canal_color = def.colorHex;
          canal_origem = canal_label_name.toLowerCase().replace(/\s+/g, '_');
          break;
        }
      }

      if (!canal_origem && lead.origem_lead) {
        canal_origem = lead.origem_lead;
        canal_label_name = (
          canal_origem === 'facebook_ads' ? 'Facebook Ads' :
          canal_origem === 'instagram_ads' ? 'Instagram Ads' :
          canal_origem === 'meta_ads' ? 'Meta Ads' :
          canal_origem === 'facebook_marketplace' ? 'Marketplace' :
          canal_origem === 'mercado_livre' || canal_origem === 'mercadolivre' ? 'Mercado Livre' :
          canal_origem === 'webmotors' ? 'WebMotors' :
          canal_origem === 'olx' ? 'OLX' :
          canal_origem === 'icarros' ? 'iCarros' :
          canal_origem
        );
      }

      if (!canal_origem) {
        canal_origem = 'sem_origem';
        canal_label_name = 'Sem Origem';
        canal_color = '#94a3b8';
      } else if (canal_origem === 'desconhecido') {
        canal_label_name = 'Desconhecido';
        canal_color = '#64748b';
      }

      const getMsgStatsIA = (cleanPhone: string) => {
        if (statsMapIA.has(cleanPhone)) return statsMapIA.get(cleanPhone);
        const without55 = cleanPhone.startsWith('55') ? cleanPhone.slice(2) : cleanPhone;
        if (statsMapIA.has(without55)) return statsMapIA.get(without55);
        const with55 = '55' + cleanPhone;
        if (statsMapIA.has(with55)) return statsMapIA.get(with55);
        return null;
      };

      const statsIA = getMsgStatsIA(phoneClean);

      // Tratamento da última mensagem
      let ultimaMensagemTexto = statsIA?.ultima_mensagem || lead.ultima_mensagem || null;
      // Se a coluna da tabela_leads continha apenas um timestamp ISO (ex: "2026-10-23T..."), nunca exibe o timestamp como texto
      if (ultimaMensagemTexto && typeof ultimaMensagemTexto === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:/i.test(ultimaMensagemTexto.trim())) {
        ultimaMensagemTexto = statsIA?.ultima_mensagem || null;
      }

      return {
        ...lead,
        data_agendamento,
        original_id: lead.id,
        id: `ia-${lead.id}`,
        origem: isSemIA ? 'sem_ia' : 'ia',
        is_blocked: isBlocked,
        whatsapp_labels: leadWaLabels,
        canal_origem,
        canal_label_name,
        canal_color,
        anuncio_titulo: lead.anuncio_titulo || null,
        anuncio_id: lead.anuncio_id || null,
        anuncio_url: lead.anuncio_url || null,
        origem_detalhe: lead.origem_detalhe || null,
        ultima_mensagem: ultimaMensagemTexto,
        ultimo_remetente: statsIA?.ultimo_remetente || (lead.ultimo_remetente ? (lead.ultimo_remetente === 'bot' || lead.ultimo_remetente === 'vendedor' ? 'vendedor' : 'cliente') : null),
        ultimo_timestamp: statsIA?.ultimo_timestamp || lead.ultimo_timestamp || lead.created_at || null,
        tempo_medio_resposta_segundos: statsIA?.tempo_medio_resposta_segundos || lead.tempo_medio_resposta_segundos || null,
      };
    });

    const todosLeads = [...iaFormatados, ...manuaisFormatados];

    // Busca tags
    let allTags: any[] = [];
    let leadTagsMap: any[] = [];
    try {
      allTags = await getNocoDBTags(clientConfig.id);
      leadTagsMap = await getNocoDBLeadTags(clientConfig.id);
    } catch (nocoTagsErr) {
      console.warn("Aviso ao buscar tags no NocoDB:", nocoTagsErr);
    }

    if (allTags.length === 0) {
      const { data: sbTags } = await supabaseAdmin.from('sistema-dash-ia_tags').select('*').eq('cliente_id', clientConfig.id);
      const { data: sbLeadTags } = await supabaseAdmin.from('sistema-dash-ia_lead_tags').select('*').eq('cliente_id', clientConfig.id);
      allTags = sbTags || [];
      leadTagsMap = sbLeadTags || [];
    }
    
    const tagsById = new Map((allTags || []).map((t: any) => [t.id, t]));
    const tagsByLeadId = new Map();
    for (const lt of leadTagsMap || []) {
      if (!tagsByLeadId.has(lt.lead_id)) tagsByLeadId.set(lt.lead_id, []);
      const tagObj = tagsById.get(lt.tag_id);
      if (tagObj) tagsByLeadId.get(lt.lead_id).push(tagObj);
    }
    
    for (const lead of todosLeads) {
      const crmTags = tagsByLeadId.get(lead.id) || [];
      const waTags: any[] = [];
      for (const lId of (lead.whatsapp_labels || [])) {
        const cleanId = String(lId).includes(':') ? String(lId).split(':')[1] : String(lId);
        const def = mapaUazapiLabels.get(cleanId);
        if (def) {
          waTags.push({
            id: `wa-${cleanId}`,
            nome: def.name,
            cor: def.colorHex || '#6366f1',
            is_whatsapp: true,
          });
        }
      }
      lead.tags = [...crmTags, ...waTags];
      lead.etapa = calcularEtapaIA(lead, 5, mapaNomes);
    }

    // Ordena todos por data de criação mais recente
    todosLeads.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ 
      data: todosLeads,
      tipo_atendimento: clientConfig.tipo_atendimento || (isSemIA ? 'sem_ia' : 'com_ia')
    }, { status: 200 })
  } catch (error) {
    console.error("Leads API Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

