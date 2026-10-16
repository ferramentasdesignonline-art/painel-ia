import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { calcularEtapaIA } from '@/lib/funil/calcular-etapa';
import { NextResponse } from 'next/server';
import { criarFunilPadrao } from '@/lib/funil/criar-funil-padrao';
import { getActiveClientConfig } from '@/lib/auth/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const periodo = searchParams.get('periodo') || '30d';

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cliente = await getActiveClientConfig(supabase);
  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });

  // Usar sempre service role para evitar bloqueios de RLS
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const supabaseClientDB = createAdminClient(
    cliente.supabase_url || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    cliente.supabase_service_role_key || process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let { data: funil } = await supabaseAdmin
    .from('sistema-dash-ia_funis')
    .select('id, meta_followup')
    .eq('cliente_id', cliente.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!funil) {
    const criado = await criarFunilPadrao(cliente.id, supabaseAdmin);
    funil = criado ? { id: criado.id, meta_followup: 5 } : null;
  }

  if (!funil) {
    return NextResponse.json({ error: 'Falha ao inicializar funil' }, { status: 500 });
  }

  const { data: etapas } = await supabaseAdmin
    .from('sistema-dash-ia_etapas_funil')
    .select('*')
    .eq('funil_id', funil.id)
    .order('ordem');

  const dataInicioStr = searchParams.get('dataInicio');
  const dataFimStr = searchParams.get('dataFim');

  let queryLeads = supabaseClientDB
    .from(cliente.tabela_leads)
    .select('*');

  if (dataInicioStr && dataFimStr) {
    queryLeads = queryLeads
      .gte('created_at', dataInicioStr)
      .lte('created_at', dataFimStr);
  } else {
    const diasAtras = periodo === '7d' ? 7 : periodo === '30d' ? 30 : 90;
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - diasAtras);
    queryLeads = queryLeads.gte('created_at', dataLimite.toISOString());
  }

  const { data: leads } = await queryLeads.order('created_at', { ascending: false }).limit(10000);

  // Buscar bloqueios ativos
  const { data: bloqueios } = await supabaseClientDB
    .from(cliente.tabela_bloqueios)
    .select('numero_cliente')
    .neq('bloqueio_existe', false)
    .limit(10000);

  const numerosBloqueados = new Set(
    bloqueios?.map(b => b.numero_cliente ? b.numero_cliente.replace(/\D/g, '') : '').filter(Boolean) || []
  );

  // Buscar posições manuais salvas
  const limite30d = new Date();
  limite30d.setDate(limite30d.getDate() - 30);

  const { data: posicoesManuais } = await supabaseAdmin
    .from('sistema-dash-ia_lead_posicoes')
    .select('lead_id, etapa_id, movido_manualmente_em')
    .eq('cliente_id', cliente.id)
    .gte('movido_manualmente_em', limite30d.toISOString());

  const mapaPosicoesManuais = new Map(
    posicoesManuais?.map(p => [String(p.lead_id), p.etapa_id]) || []
  );

  // Buscar leads manuais
  const { data: leadsManuais } = await supabaseAdmin
    .from('sistema-dash-ia_leads_manuais')
    .select('*')
    .eq('cliente_id', cliente.id);

  // 7. Buscar contatos e etiquetas do WhatsApp Cloud para correlacionar
  let mapaWhatsappLabels = new Map<string, string[]>();
  let mapaUazapiLabels = new Map<string, { id: string; name: string; colorHex: string; color: number }>();

  try {
    const { getWacloudSupabaseAdmin } = await import('@/lib/wacloud/supabase');
    const wacloudAdmin = getWacloudSupabaseAdmin();

    // Encontra a instância vinculada ao nome do cliente ou slug
    const nomeLimpo = cliente.nome.replace(/\s+/g, '').toLowerCase();
    const { data: instancias } = await wacloudAdmin
      .from('wacloud_instancias')
      .select('id, nome_instancia, token')
      .limit(50);

    const instanciaMatch = instancias?.find(i => {
      const instNome = i.nome_instancia.replace(/\s+/g, '').toLowerCase();
      return instNome === nomeLimpo || instNome.includes(nomeLimpo) || nomeLimpo.includes(instNome);
    });

    if (instanciaMatch) {
      // Buscar contatos com etiquetas dessa instância
      const { data: contatosCloud } = await wacloudAdmin
        .from('wacloud_contatos')
        .select('telefone_contato, whatsapp_labels')
        .eq('nome_instancia', instanciaMatch.nome_instancia)
        .neq('whatsapp_labels', '[]')
        .limit(10000);

      for (const cc of contatosCloud || []) {
        if (cc.telefone_contato && Array.isArray(cc.whatsapp_labels) && cc.whatsapp_labels.length > 0) {
          mapaWhatsappLabels.set(cc.telefone_contato, cc.whatsapp_labels);
        }
      }

      // Buscar dicionário de etiquetas da Uazapi se houver token
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
    console.warn('Erro ao carregar etiquetas do wacloud:', err);
  }

  // 8. Montar o mapa de etapas por tipo e por id
  const etapaPorTipo = new Map(etapas?.map(e => [e.tipo, e.id]) || []);
  const colunas = etapas?.map(etapa => ({
    ...etapa,
    leads: [] as any[],
  })) || [];

  const colunasPorId = new Map(colunas.map(c => [c.id, c]));

  // 9. Distribuir leads pelas etapas
  for (const lead of leads || []) {
    // IA Leads
    const rawPhone = lead.telefone || lead.phone || '';
    const phoneClean = rawPhone.replace(/@s\.whatsapp\.net/gi, '').replace(/@c\.us/gi, '').replace(/\D/g, '');
    const bloqueado = numerosBloqueados.has(phoneClean);

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

    // Construct data_agendamento from database columns
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

    // Passa whatsapp_labels para calcularEtapaIA priorizar etiquetas
    const leadComLabels = {
      ...lead,
      data_agendamento,
      whatsapp_labels: leadWaLabels,
    };

    // Verificar se tem posição manual recente (30 dias)
    const etapaManualId = mapaPosicoesManuais.get(String(lead.id));
    const tipoCalculado = calcularEtapaIA(leadComLabels, funil.meta_followup || 5);
    const etapaIdCalculada = etapaPorTipo.get(tipoCalculado);
    
    // Se foi movido manualmente, respeita. Caso contrário, lógica das etiquetas / IA.
    const etapaIdFinal = etapaManualId || etapaIdCalculada;

    if (etapaIdFinal && colunasPorId.has(etapaIdFinal)) {
      colunasPorId.get(etapaIdFinal)!.leads.push({
        ...lead,
        data_agendamento,
        id: `ia-${lead.id}`, // Prefixo para evitar conflito com manuais
        origem: 'ia',
        bloqueado,
        movido_manualmente: !!etapaManualId,
        whatsapp_labels: leadWaLabels,
        canal_origem,
        canal_label_name,
        canal_color,
      });
    }
  }

  // Leads manuais
  for (const lead of leadsManuais || []) {
    const etapaId = lead.etapa_id;
    if (etapaId && colunasPorId.has(etapaId)) {
      colunasPorId.get(etapaId)!.leads.push({
        ...lead,
        id: `manual-${lead.id}`, // Prefixo para evitar conflito com IA
        origem: 'manual',
        bloqueado: false,
      });
    }
  }

  // Busca tags
  const { data: allTags } = await supabaseAdmin.from('sistema-dash-ia_tags').select('*').eq('cliente_id', cliente.id);
  const { data: leadTagsMap } = await supabaseAdmin.from('sistema-dash-ia_lead_tags').select('*').eq('cliente_id', cliente.id);
  
  if (allTags && leadTagsMap) {
    const tagsById = new Map(allTags.map((t: any) => [t.id, t]));
    const tagsByLeadId = new Map();
    for (const lt of leadTagsMap) {
      if (!tagsByLeadId.has(lt.lead_id)) tagsByLeadId.set(lt.lead_id, []);
      const tagObj = tagsById.get(lt.tag_id);
      if (tagObj) tagsByLeadId.get(lt.lead_id).push(tagObj);
    }
    
    for (const col of colunas) {
      for (const lead of col.leads) {
        const crmTags = tagsByLeadId.get(lead.id) || [];
        
        // Converte as etiquetas de WhatsApp reais (que não sejam canal) em tags resumidas
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
    }
  } else {
    for (const col of colunas) {
      for (const lead of col.leads) {
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
        lead.tags = waTags;
      }
    }
  }

  return NextResponse.json({ 
    colunas, 
    config: { 
      meta_followup: funil.meta_followup || 5 
    } 
  });
}
