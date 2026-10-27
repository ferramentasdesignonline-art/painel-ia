import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { calcularEtapaIA } from '@/lib/funil/calcular-etapa';
import { NextResponse } from 'next/server';
import { criarFunilPadrao } from '@/lib/funil/criar-funil-padrao';
import { getActiveClientConfig } from '@/lib/auth/helpers';
import { getAllBlockedNumbers } from '@/lib/supabase/queries';
import { construirDataAgendamentoIso } from '@/lib/agendamento-utils';
import { isNocoDBClient, getNocoDBLeads, getNocoDBBlockedNumbers } from '@/lib/nocodb/service';
import {
  getNocoDBFunil,
  getNocoDBEtapasFunil,
  getNocoDBLeadPosicoes,
  getNocoDBLeadsManuais,
  getNocoDBTags,
  getNocoDBLeadTags,
} from '@/lib/nocodb/sistema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const periodo = searchParams.get('periodo') || '30d';

  const cliente = await getActiveClientConfig();
  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado ou sem permissão' }, { status: 401 });

  // Usar sempre service role para evitar bloqueios de RLS
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const isNocoDB = isNocoDBClient(cliente);
  const clientSupabaseUrl = (!isNocoDB && cliente.supabase_url && cliente.supabase_url !== 'nocodb')
    ? cliente.supabase_url
    : process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const clientSupabaseKey = (!isNocoDB && cliente.supabase_service_role_key)
    ? cliente.supabase_service_role_key
    : process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabaseClientDB = createAdminClient(
    clientSupabaseUrl,
    clientSupabaseKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // 1. Tenta carregar funil e etapas do NocoDB
  let funil: any = null;
  let etapas: any[] = [];
  try {
    funil = await getNocoDBFunil(cliente.id);
    if (!funil) {
      funil = await criarFunilPadrao(cliente.id);
    }
    if (funil?.Id) {
      etapas = await getNocoDBEtapasFunil(funil.Id);
    }
  } catch (nocoFunilErr) {
    console.warn("Erro ao buscar funil/etapas no NocoDB:", nocoFunilErr);
  }

  // 2. Fallback Supabase para funil e etapas se vazio
  if (!funil || etapas.length === 0) {
    let { data: sbFunil } = await supabaseAdmin
      .from('sistema-dash-ia_funis')
      .select('id, meta_followup')
      .eq('cliente_id', cliente.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!sbFunil) {
      const criado = await criarFunilPadrao(cliente.id, supabaseAdmin);
      sbFunil = criado ? { id: criado.id, meta_followup: 5 } : null;
    }
    funil = sbFunil;

    if (funil) {
      const { data: sbEtapas } = await supabaseAdmin
        .from('sistema-dash-ia_etapas_funil')
        .select('*')
        .eq('funil_id', funil.id)
        .order('ordem');
      etapas = sbEtapas || [];
    }
  }

  if (!funil) {
    return NextResponse.json({ error: 'Falha ao inicializar funil' }, { status: 500 });
  }

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

    const [resContatos, resMsgs] = await Promise.all([
      query.order('created_at', { ascending: false }).limit(10000),
      wacloudAdmin
        .from('wacloud_mensagens')
        .select('telefone_contato, mensagem, enviado_por_mim, created_at')
        .eq('nome_instancia', nomeInstancia)
        .order('created_at', { ascending: true })
        .limit(10000)
    ]);

    const contatos = resContatos.data || [];
    const mensagensRecentes = resMsgs.data || [];

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
      !c.telefone_contato?.includes('@g.us')
    );
    leads = contatosFiltrados.map(c => {
      const telLimpo = String(c.telefone_contato || c.wa_chatid || '').replace(/@.*$/, '').replace(/\D/g, '');
      const stats = getMsgStats(telLimpo);

      return {
        id: c.id,
        nome: c.nome_contato || 'Cliente',
        telefone: telLimpo,
        phone: telLimpo,
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
  } else if (isNocoDB) {
    const diasAtras = periodo === '7d' ? 7 : periodo === '30d' ? 30 : 90;
    const [leadsData, blockedSet] = await Promise.all([
      getNocoDBLeads(cliente.tabela_leads, {
        from: dataInicioStr || undefined,
        to: dataFimStr || undefined,
        diasAtras: dataInicioStr ? undefined : diasAtras,
      }),
      getNocoDBBlockedNumbers(cliente.tabela_bloqueios),
    ]);
    leads = leadsData;
    numerosBloqueados = blockedSet;
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

  let posicoesManuais: any[] = [];
  try {
    posicoesManuais = await getNocoDBLeadPosicoes(cliente.id, { since: limite30d });
  } catch (nocoPosErr) {
    console.warn("Erro ao buscar posições manuais no NocoDB:", nocoPosErr);
  }

  if (posicoesManuais.length === 0) {
    const { data: sbPos } = await supabaseAdmin
      .from('sistema-dash-ia_lead_posicoes')
      .select('lead_id, etapa_id, movido_manualmente_em')
      .eq('cliente_id', cliente.id)
      .gte('movido_manualmente_em', limite30d.toISOString());
    posicoesManuais = sbPos || [];
  }

  const mapaPosicoesManuais = new Map(
    posicoesManuais.map(p => [String(p.lead_id), p.etapa_id])
  );

  // Buscar leads manuais
  let leadsManuais: any[] = [];
  try {
    leadsManuais = await getNocoDBLeadsManuais(cliente.id);
  } catch (nocoManErr) {
    console.warn("Erro ao buscar leads manuais no NocoDB:", nocoManErr);
  }

  if (leadsManuais.length === 0) {
    const { data: sbLeadsManuais } = await supabaseAdmin
      .from('sistema-dash-ia_leads_manuais')
      .select('*')
      .eq('cliente_id', cliente.id);
    leadsManuais = sbLeadsManuais || [];
  }

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

    // Prioriza correspondência exata por cliente.nome_instancia ou cliente.whatsapp_instancia
    const instConfigNorm = normalizeStr(cliente.nome_instancia || cliente.whatsapp_instancia || '');
    let instanciaMatch = instConfigNorm
      ? instancias?.find(i => normalizeStr(i.nome_instancia) === instConfigNorm)
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
  let allTags: any[] = [];
  let leadTagsMap: any[] = [];
  try {
    allTags = await getNocoDBTags(cliente.id);
    leadTagsMap = await getNocoDBLeadTags(cliente.id);
  } catch (nocoTagsErr) {
    console.warn("Erro ao buscar tags no NocoDB:", nocoTagsErr);
  }

  if (allTags.length === 0) {
    const { data: sbTags } = await supabaseAdmin.from('sistema-dash-ia_tags').select('*').eq('cliente_id', cliente.id);
    const { data: sbLeadTags } = await supabaseAdmin.from('sistema-dash-ia_lead_tags').select('*').eq('cliente_id', cliente.id);
    allTags = sbTags || [];
    leadTagsMap = sbLeadTags || [];
  }
  
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
