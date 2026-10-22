import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { calcularEtapaIA } from '@/lib/funil/calcular-etapa';
import { NextResponse } from 'next/server';
import { criarFunilPadrao } from '@/lib/funil/criar-funil-padrao';
import { getActiveClientConfig } from '@/lib/auth/helpers';
import { getAllBlockedNumbers } from '@/lib/supabase/queries';
import { construirDataAgendamentoIso } from '@/lib/agendamento-utils';

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

  const isSemIA = cliente.tipo_atendimento === 'sem_ia' || !cliente.tabela_leads;
  let leads: any[] = [];
  let numerosBloqueados = new Set<string>();

  if (isSemIA) {
    const { getWacloudSupabaseAdmin } = await import('@/lib/wacloud/supabase');
    const wacloudAdmin = getWacloudSupabaseAdmin();
    const nomeInstancia = cliente.nome_instancia || cliente.nome;

    let query = wacloudAdmin
      .from('wacloud_contatos')
      .select('*')
      .eq('nome_instancia', nomeInstancia);

    if (dataInicioStr && dataFimStr) {
      query = query.gte('created_at', dataInicioStr).lte('created_at', dataFimStr);
    } else {
      const diasAtras = periodo === '7d' ? 7 : periodo === '30d' ? 30 : 90;
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - diasAtras);
      query = query.gte('created_at', dataLimite.toISOString());
    }

    const { data: contatos } = await query.order('created_at', { ascending: false }).limit(10000);

    const contatosFiltrados = (contatos || []).filter(c =>
      c.is_group !== true &&
      !c.wa_chatid?.includes('@g.us') &&
      !c.telefone_contato?.includes('@g.us')
    );
    leads = contatosFiltrados.map(c => {
      const telLimpo = String(c.telefone_contato || c.wa_chatid || '').replace(/@.*$/, '').replace(/\D/g, '');
      return {
        id: c.id,
        nome: c.nome_contato || 'Cliente',
        telefone: telLimpo,
        phone: telLimpo,
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
        vendedor_lead: c.vendedor_responsavel || 'Atendente',
        origem_lead: c.origem_lead || 'desconhecido',
        origem: 'sem_ia',
        origem_detalhe: c.origem_detalhe || null,
        anuncio_id: c.anuncio_id || null,
        anuncio_titulo: c.anuncio_titulo || null,
        anuncio_url: c.anuncio_url || null,
        whatsapp_labels: Array.isArray(c.whatsapp_labels) ? c.whatsapp_labels : [],
      };
    });
  } else {
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

    const { data: leadsData } = await queryLeads.order('created_at', { ascending: false }).limit(10000);
    leads = leadsData || [];
    numerosBloqueados = await getAllBlockedNumbers(supabaseClientDB, cliente.tabela_bloqueios);
  }

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

    const normalizeStr = (str: string) =>
      (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    const nomeNorm = normalizeStr(cliente.nome);
    const slugNorm = normalizeStr(cliente.slug || '');

    const { data: instancias } = await wacloudAdmin
      .from('wacloud_instancias')
      .select('id, nome_instancia, token')
      .limit(50);

    // Prioriza correspondência exata por cliente.nome_instancia
    let instanciaMatch = cliente.nome_instancia
      ? instancias?.find(i => normalizeStr(i.nome_instancia) === normalizeStr(cliente.nome_instancia))
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
      // Buscar TODOS os contatos com etiquetas dessa instância (paginado)
      let allContatosCloud: any[] = [];
      const pageSize = 1000;
      let page = 0;
      while (page < 10) { // até 10.000 contatos
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
    console.warn('Erro ao carregar etiquetas do wacloud:', err);
  }

  // 8. Montar o mapa de etapas por tipo e por id
  const etapaPorTipo = new Map(etapas?.map(e => [e.tipo, e.id]) || []);
  const colunas = etapas?.map(etapa => ({
    ...etapa,
    leads: [] as any[],
  })) || [];

  const colunasPorId = new Map(colunas.map(c => [c.id, c]));

  // Mapa de equivalências entre etapas lógicas da IA/etiquetas e as colunas físicas do funil
  const getEtapaIdParaTipo = (tipo: string): string | undefined => {
    if (etapaPorTipo.has(tipo)) return etapaPorTipo.get(tipo);

    if (tipo === 'em_atendimento') {
      return etapaPorTipo.get('ia_em_andamento') || etapaPorTipo.get('ia_sem_contato');
    }
    if (tipo === 'oportunidade') {
      return etapaPorTipo.get('ia_qualificado') || etapaPorTipo.get('simulacao_pre_aprovada') || etapaPorTipo.get('simulacao_aprovada');
    }
    if (tipo === 'visita_agendada' || tipo === 'visita_realizada') {
      return etapaPorTipo.get('visita_confirmada');
    }
    if (tipo === 'simulacao_aprovada') {
      return etapaPorTipo.get('simulacao_aprovada') || etapaPorTipo.get('ia_qualificado');
    }
    if (tipo === 'simulacao_reprovada' || tipo === 'ficha_reprovada') {
      return etapaPorTipo.get('simulacao_reprovada') || etapaPorTipo.get('ia_perda');
    }
    if (tipo === 'perdido_qualificado' || tipo === 'perdido_desqualificado') {
      return etapaPorTipo.get('ia_perda');
    }
    if (tipo === 'cliente') {
      return etapaPorTipo.get('simulacao_aprovada') || etapaPorTipo.get('ia_qualificado');
    }

    return undefined;
  };

  // Mapa de IDs numéricos -> Nomes de etiquetas para inferência dinâmica de etapas
  const mapaNomes = new Map<string, string>();
  mapaUazapiLabels.forEach((val, key) => mapaNomes.set(key, val.name));

  // 9. Distribuir leads pelas etapas
  for (const lead of leads || []) {
    // IA Leads
    const rawPhone = lead.telefone || lead.phone || '';
    const phoneClean = rawPhone.replace(/@s\.whatsapp\.net/gi, '').replace(/@c\.us/gi, '').replace(/\D/g, '');
    const bloqueado = numerosBloqueados.has(phoneClean);

    // Correlaciona etiquetas do WhatsApp
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

    // Construct data_agendamento from database columns
    let data_agendamento = lead.data_agendamento || null;
    if (lead.data_agendamento_visita) {
      data_agendamento = construirDataAgendamentoIso(lead.data_agendamento_visita, lead.horario_agendamento_visita) || data_agendamento;
    }

    // Passa whatsapp_labels para calcularEtapaIA priorizar etiquetas
    const leadComLabels = {
      ...lead,
      data_agendamento,
      whatsapp_labels: leadWaLabels,
    };

    // Verificar se tem posição manual recente (30 dias)
    const etapaManualId = mapaPosicoesManuais.get(String(lead.id));
    const tipoCalculado = calcularEtapaIA(leadComLabels, funil.meta_followup || 5, mapaNomes);
    const etapaIdCalculada = etapaPorTipo.get(tipoCalculado) || getEtapaIdParaTipo(tipoCalculado);
    
    // Se foi movido manualmente, respeita. Caso contrário, lógica das etiquetas / IA.
    const etapaIdFinal = etapaManualId || etapaIdCalculada || etapaPorTipo.get('ia_em_andamento') || colunas[0]?.id;

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
        anuncio_titulo: lead.anuncio_titulo || null,
        anuncio_id: lead.anuncio_id || null,
        anuncio_url: lead.anuncio_url || null,
        origem_detalhe: lead.origem_detalhe || null,
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
        
        // Converte as etiquetas de WhatsApp reais em tags do lead
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
      }
    }
  } else {
    for (const col of colunas) {
      for (const lead of col.leads) {
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
        lead.tags = waTags;
      }
    }
  }

  return NextResponse.json({ 
    colunas, 
    config: { 
      meta_followup: funil.meta_followup || 5,
      tipo_atendimento: cliente.tipo_atendimento || (isSemIA ? 'sem_ia' : 'com_ia'),
    } 
  });
}
