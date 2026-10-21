import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { getActiveClientConfig } from "@/lib/auth/helpers"
import { getClientLeads, getAllBlockedNumbers } from "@/lib/supabase/queries"
import { construirDataAgendamentoIso } from "@/lib/agendamento-utils"

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
    const supabaseAdmin = createClient(clientConfig.supabase_url || process.env.NEXT_PUBLIC_SUPABASE_URL!, clientConfig.supabase_service_role_key || process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const isSemIA = clientConfig.tipo_atendimento === 'sem_ia' || !clientConfig.tabela_leads;
    let leadsIA: any[] = [];
    let blockedNumbers = new Set<string>();

    if (isSemIA) {
      const { getWacloudSupabaseAdmin } = await import('@/lib/wacloud/supabase');
      const wacloudAdmin = getWacloudSupabaseAdmin();
      const nomeInstancia = clientConfig.nome_instancia || clientConfig.nome;

      const { data: contatos } = await wacloudAdmin
        .from('wacloud_contatos')
        .select('*')
        .eq('nome_instancia', nomeInstancia)
        .order('atualizado_em', { ascending: false });

      leadsIA = (contatos || []).map(c => {
        const rawTel = String(c.telefone_contato || c.wa_chatid || '');
        const phoneClean = rawTel.replace(/@s\.whatsapp\.net/gi, '').replace(/@c\.us/gi, '').replace(/\D/g, '');
        return {
          id: c.id,
          nome: c.nome_contato || 'Cliente',
          telefone: phoneClean,
          phone: phoneClean,
          created_at: c.created_at,
          updated_at: c.atualizado_em,
          ultima_mensagem: c.ultima_mensagem || null,
          data_agendamento_visita: c.data_agendamento_visita || null,
          horario_agendamento_visita: c.horario_agendamento_visita || null,
          lead_visita_confirmada: Boolean(c.lead_visita_confirmada),
          veiculo_interessado: c.veiculo_interessado || null,
          veiculo_troca: c.veiculo_troca || null,
          observacao_lead_qualificado: c.observacao_lead_qualificado || c.resumo_ia || null,
          lead_simulacao_aprovada: Boolean(c.lead_simulacao_aprovada),
          lead_simulacao_reprovada: Boolean(c.lead_simulacao_reprovada),
          lead_finalizado: Boolean(c.lead_visita_confirmada || c.lead_simulacao_aprovada),
          vendedor_lead: c.vendedor_responsavel || 'Vendedor',
          origem_lead: c.origem_lead || 'desconhecido',
          origem_detalhe: c.origem_detalhe || null,
          anuncio_id: c.anuncio_id || null,
          anuncio_titulo: c.anuncio_titulo || null,
          anuncio_url: c.anuncio_url || null,
          anuncio_descricao: c.anuncio_descricao || null,
          whatsapp_labels: Array.isArray(c.whatsapp_labels) ? c.whatsapp_labels : [],
        };
      });
    } else {
      leadsIA = await getClientLeads(supabaseAdmin, clientConfig.tabela_leads);
      blockedNumbers = await getAllBlockedNumbers(supabaseAdmin, clientConfig.tabela_bloqueios);
    }

    // 5. Busca leads manuais
    const { data: leadsManuais } = await supabaseAdmin
      .from('sistema-dash-ia_leads_manuais')
      .select('*, etapa:etapa_id(nome)')
      .eq('cliente_id', clientConfig.id);

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
    let mapaWhatsappLabels = new Map<string, string[]>();
    let mapaUazapiLabels = new Map<string, { id: string; name: string; colorHex: string; color: number }>();

    try {
      const { getWacloudSupabaseAdmin } = await import('@/lib/wacloud/supabase');
      const wacloudAdmin = getWacloudSupabaseAdmin();

      const normalizeStr = (str: string) =>
        (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

      const nomeNorm = normalizeStr(clientConfig.nome);
      const slugNorm = normalizeStr(clientConfig.slug || '');

      const { data: instancias } = await wacloudAdmin
        .from('wacloud_instancias')
        .select('id, nome_instancia, token')
        .limit(50);

      let instanciaMatch = clientConfig.nome_instancia 
        ? instancias?.find(i => normalizeStr(i.nome_instancia) === normalizeStr(clientConfig.nome_instancia))
        : null;

      if (!instanciaMatch) {
        instanciaMatch = instancias?.find(i => {
          const instNorm = normalizeStr(i.nome_instancia);
          return instNorm === nomeNorm || instNorm === slugNorm;
        });
      }

      if (!instanciaMatch) {
        instanciaMatch = instancias?.find(i => {
          const instNorm = normalizeStr(i.nome_instancia);
          return instNorm.includes(nomeNorm) || nomeNorm.includes(instNorm);
        });
      }

      if (instanciaMatch) {
        let allContatosCloud: any[] = [];
        const pageSize = 1000;
        let page = 0;
        while (page < 10) {
          const { data: chunk, error: chunkErr } = await wacloudAdmin
            .from('wacloud_contatos')
            .select('telefone_contato, whatsapp_labels')
            .eq('nome_instancia', instanciaMatch.nome_instancia)
            .neq('whatsapp_labels', '[]')
            .range(page * pageSize, (page + 1) * pageSize - 1);
          if (chunkErr || !chunk || chunk.length === 0) break;
          allContatosCloud.push(...chunk);
          if (chunk.length < pageSize) break;
          page++;
        }

        for (const cc of allContatosCloud) {
          if (cc.telefone_contato && Array.isArray(cc.whatsapp_labels) && cc.whatsapp_labels.length > 0) {
            const rawTel = String(cc.telefone_contato).replace(/\D/g, '');
            mapaWhatsappLabels.set(rawTel, cc.whatsapp_labels);
            if (rawTel.startsWith('55')) {
              mapaWhatsappLabels.set(rawTel.slice(2), cc.whatsapp_labels);
            } else {
              mapaWhatsappLabels.set(`55${rawTel}`, cc.whatsapp_labels);
            }
          }
        }

        if (instanciaMatch.token) {
          const { fetchUazapiLabels } = await import('@/lib/wacloud/uazapi');
          const labelsList = await fetchUazapiLabels(instanciaMatch.token);
          for (const lbl of labelsList || []) {
            const key = String(lbl.labelid || lbl.id);
            mapaUazapiLabels.set(key, {
              id: key,
              name: lbl.name,
              colorHex: lbl.colorHex || '#ccc',
              color: lbl.color,
            });
          }
        }

        // Complementar com etiquetas salvas em wacloud_etiquetas_instancia
        const { data: dbLabels } = await wacloudAdmin
          .from('wacloud_etiquetas_instancia')
          .select('*')
          .eq('nome_instancia', instanciaMatch.nome_instancia);

        for (const lbl of dbLabels || []) {
          const key = String(lbl.uazapi_label_id);
          if (!mapaUazapiLabels.has(key)) {
            mapaUazapiLabels.set(key, {
              id: key,
              name: lbl.nome,
              colorHex: lbl.cor_hex || '#ccc',
              color: 0,
            });
          }
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar etiquetas do wacloud em /api/leads:', err);
    }

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

      // Descobrir Canal de Atendimento (via etiqueta WhatsApp 'Canal | ...' ou campo origem_lead)
      let canal_origem: string = lead.origem_lead || 'desconhecido';
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

      return {
        ...lead,
        data_agendamento,
        original_id: lead.id,
        id: `ia-${lead.id}`,
        origem: 'ia',
        is_blocked: isBlocked,
        whatsapp_labels: leadWaLabels,
        canal_origem,
        canal_label_name,
        canal_color,
        anuncio_titulo: lead.anuncio_titulo || null,
        anuncio_id: lead.anuncio_id || null,
        anuncio_url: lead.anuncio_url || null,
        origem_detalhe: lead.origem_detalhe || null,
      };
    });

    const todosLeads = [...iaFormatados, ...manuaisFormatados];

    // Busca tags
    const { data: allTags } = await supabaseAdmin.from('sistema-dash-ia_tags').select('*').eq('cliente_id', clientConfig.id);
    const { data: leadTagsMap } = await supabaseAdmin.from('sistema-dash-ia_lead_tags').select('*').eq('cliente_id', clientConfig.id);
    
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
        if (def && !def.name.toLowerCase().startsWith('canal')) {
          waTags.push({
            id: `wa-${cleanId}`,
            nome: def.name,
            cor: def.colorHex || '#6366f1',
            is_whatsapp: true,
          });
        }
      }
      lead.tags = [...crmTags, ...waTags];
    }

    // Ordena todos por data de criação mais recente
    todosLeads.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ data: todosLeads }, { status: 200 })
  } catch (error) {
    console.error("Leads API Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

