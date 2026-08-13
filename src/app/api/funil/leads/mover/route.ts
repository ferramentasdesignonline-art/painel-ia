import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getActiveClientConfig } from '@/lib/auth/helpers';

export async function PUT(request: Request) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { lead_id, etapa_id, origem } = await request.json();
  console.log('Mover lead:', { lead_id, etapa_id, origem });

  const cliente = await getActiveClientConfig(supabase);
  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  if (origem === 'manual') {
    // Lead manual: atualizar etapa diretamente
    const { error } = await supabaseAdmin
      .from('sistema-dash-ia_leads_manuais')
      .update({ etapa_id, updated_at: new Date().toISOString() })
      .eq('id', lead_id)
      .eq('cliente_id', cliente.id);

    if (error) {
      console.error('Erro ao mover lead manual:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    // Lead da IA: registrar posição manual (upsert)
    // Isso faz com que na próxima carga o sistema respeite a posição manual
    // ao invés da posição calculada pela IA
    const { error: upsertError } = await supabaseAdmin
      .from('sistema-dash-ia_lead_posicoes')
      .upsert({
        cliente_id: cliente.id,
        lead_id: Number(lead_id),
        etapa_id,
        movido_manualmente_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'cliente_id,lead_id',
      });
      
    if (upsertError) {
      console.error('Erro ao salvar posição do lead IA:', upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }
  }

  // Registrar histórico da movimentação e atualizar colunas de flags na tabela do lead
  try {
    const { data: etapaDestino } = await supabaseAdmin
      .from('sistema-dash-ia_etapas_funil')
      .select('nome, tipo')
      .eq('id', etapa_id)
      .maybeSingle();

    if (origem !== 'manual' && etapaDestino) {
      const dbEtapaTipo = etapaDestino.tipo || '';
      const updateFlags: any = {
        lead_visita_confirmada: dbEtapaTipo === 'visita_confirmada',
        lead_simulacao_pre_aprovada: dbEtapaTipo === 'simulacao_pre_aprovada',
        lead_simulacao_aprovada: dbEtapaTipo === 'simulacao_aprovada',
        lead_simulacao_reprovada: dbEtapaTipo === 'simulacao_reprovada',
        update_lead: new Date().toISOString()
      };
      
      if (dbEtapaTipo === 'ia_qualificado') {
        updateFlags.lead_finalizado = true;
      } else if (['visita_confirmada', 'simulacao_pre_aprovada', 'simulacao_aprovada', 'simulacao_reprovada', 'ia_sem_contato', 'ia_em_andamento', 'ia_followup', 'ia_perda'].includes(dbEtapaTipo)) {
        updateFlags.lead_finalizado = false;
      }

      await supabaseAdmin
        .from(cliente.tabela_leads)
        .update(updateFlags)
        .eq('id', lead_id);
    }

    const { error: histError } = await supabaseAdmin
      .from('sistema-dash-ia_lead_historico')
      .insert({
        cliente_id: cliente.id,
        lead_id: lead_id.toString(),
        tipo_lead: origem,
        etapa_origem_id: null,
        etapa_destino_id: etapa_id,
        vendedor_nome: session.user.email?.split('@')[0] || 'Vendedor',
        evento: 'move',
        descricao: `Lead movido para: ${etapaDestino?.nome || 'Nova Etapa'}`,
        created_at: new Date().toISOString()
      });

    if (histError) console.error('Erro ao inserir no histórico:', histError);
  } catch (e) {
    console.error('Erro ao registrar histórico:', e);
  }

  return NextResponse.json({ success: true });
}
