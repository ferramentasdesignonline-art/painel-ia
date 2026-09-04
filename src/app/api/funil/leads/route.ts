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
    funil = criado ? { id: criado.id, meta_followup: 3 } : null;
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
    .eq('bloqueio_existe', true)
    .limit(10000);

  const numerosBloqueados = new Set(bloqueios?.map(b => b.numero_cliente) || []);

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

  // 7. Montar o mapa de etapas por tipo e por id
  const etapaPorTipo = new Map(etapas?.map(e => [e.tipo, e.id]) || []);
  const colunas = etapas?.map(etapa => ({
    ...etapa,
    leads: [] as any[],
  })) || [];

  const colunasPorId = new Map(colunas.map(c => [c.id, c]));

  // 8. Distribuir leads pelas etapas
  for (const lead of leads || []) {
    // IA Leads
    const bloqueado = numerosBloqueados.has(lead.telefone);

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

    // Verificar se tem posição manual recente (30 dias)
    const etapaManualId = mapaPosicoesManuais.get(String(lead.id));
    const etapaIdCalculada = etapaPorTipo.get(calcularEtapaIA({ ...lead, data_agendamento }, funil.meta_followup || 3));
    
    // Se foi movido manualmente, respeita. Caso contrário, lógica da IA.
    const etapaIdFinal = etapaManualId || etapaIdCalculada;

    if (etapaIdFinal && colunasPorId.has(etapaIdFinal)) {
      colunasPorId.get(etapaIdFinal)!.leads.push({
        ...lead,
        data_agendamento,
        id: `ia-${lead.id}`, // Prefixo para evitar conflito com manuais
        origem: 'ia',
        bloqueado,
        movido_manualmente: !!etapaManualId,
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

  return NextResponse.json({ 
    colunas, 
    config: { 
      meta_followup: funil.meta_followup || 3 
    } 
  });
}
