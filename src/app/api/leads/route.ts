import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { getActiveClientConfig } from "@/lib/auth/helpers"
import { getClientLeads } from "@/lib/supabase/queries"

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

    // 4. Busca os dados IA
    const leadsIA = await getClientLeads(supabaseAdmin, clientConfig.tabela_leads)

    // Busca bloqueios ativos para o cliente atual
    const blockedNumbers = new Set<string>()
    if (clientConfig.tabela_bloqueios) {
      const { data: bData } = await supabaseAdmin.from(clientConfig.tabela_bloqueios).select('numero_cliente').neq('bloqueio_existe', false)
      if (bData) {
        for (const b of bData) {
          if (b.numero_cliente) blockedNumbers.add(b.numero_cliente.replace(/\D/g, ''))
        }
      }
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

      const nomeLimpo = clientConfig.nome.replace(/\s+/g, '').toLowerCase();
      const { data: instancias } = await wacloudAdmin
        .from('wacloud_instancias')
        .select('id, nome_instancia, token')
        .limit(50);

      const instanciaMatch = instancias?.find(i => {
        const instNome = i.nome_instancia.replace(/\s+/g, '').toLowerCase();
        return instNome === nomeLimpo || instNome.includes(nomeLimpo) || nomeLimpo.includes(instNome);
      });

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
      }
    } catch (err) {
      console.warn('Erro ao carregar etiquetas do wacloud em /api/leads:', err);
    }

    // Formata leads IA para garantir mesmo padrão q usamos no funil
    const iaFormatados = (leadsIA || []).map((lead: any) => {
      let data_agendamento = lead.data_agendamento || null;
      if (lead.data_agendamento_visita) {
        const dateStr = String(lead.data_agendamento_visita).trim();
        const timeStr = lead.horario_agendamento_visita || '00:00';
        let day = 1;
        let month = 1;
        let year = new Date().getFullYear();
        let parsedOk = false;

        if (dateStr.includes('/')) {
          const parts = dateStr.split('/');
          if (parts.length >= 2) {
            day = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1; // 0-based
            if (parts.length >= 3) {
              year = parseInt(parts[2], 10);
              if (year < 100) year += 2000;
            }
            parsedOk = true;
          }
        } else if (dateStr.includes('-')) {
          const parts = dateStr.split('-');
          if (parts.length === 3) {
            if (parts[0].length === 4) {
              year = parseInt(parts[0], 10);
              month = parseInt(parts[1], 10) - 1;
              day = parseInt(parts[2], 10);
              parsedOk = true;
            } else {
              day = parseInt(parts[0], 10);
              month = parseInt(parts[1], 10) - 1;
              year = parseInt(parts[2], 10);
              if (year < 100) year += 2000;
              parsedOk = true;
            }
          }
        }

        if (parsedOk) {
          let hh = 0;
          let mm = 0;
          const timeParts = timeStr.split(':');
          if (timeParts.length >= 2) {
            hh = parseInt(timeParts[0], 10);
            mm = parseInt(timeParts[1], 10);
          }
          try {
            data_agendamento = new Date(year, month, day, hh, mm).toISOString();
          } catch (e) {
            data_agendamento = `${dateStr} ${timeStr}`;
          }
        } else {
          try {
            data_agendamento = new Date(`${dateStr}T${timeStr}:00`).toISOString();
          } catch (e) {
            data_agendamento = `${dateStr} ${timeStr}`;
          }
        }
      }
      
      const rawPhone = lead.telefone || lead.phone || '';
      const phoneClean = rawPhone.replace(/@s\.whatsapp\.net/gi, '').replace(/@c\.us/gi, '').replace(/\D/g, '');
      const isBlocked = blockedNumbers.has(phoneClean);

      // Correlaciona etiquetas do WhatsApp
      const leadWaLabels = mapaWhatsappLabels.get(phoneClean) || [];

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

