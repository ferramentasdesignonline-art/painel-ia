import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getActiveClientConfig } from '@/lib/auth/helpers';

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { nome, telefone, veiculo_interessado, notas, etapa_id, data_agendamento, observacao_lead_qualificado } = await request.json();

  if (!telefone) {
    return NextResponse.json({ error: 'Telefone é obrigatório' }, { status: 400 });
  }

  const cliente = await getActiveClientConfig(supabase);
  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: lead, error } = await supabaseAdmin
    .from('sistema-dash-ia_leads_manuais')
    .insert({
      cliente_id: cliente.id,
      nome,
      telefone,
      veiculo_interessado,
      notas,
      etapa_id,
      data_agendamento: data_agendamento || null,
      observacao_lead_qualificado: observacao_lead_qualificado || null,
      created_by: session.user.email,
    })
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar lead manual:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Registrar histórico inicial
  try {
    await supabaseAdmin
      .from('sistema-dash-ia_lead_historico')
      .insert({
        cliente_id: cliente.id,
        lead_id: lead.id.toString(),
        tipo_lead: 'manual',
        etapa_origem_id: etapa_id,
        etapa_destino_id: etapa_id,
        vendedor_nome: session.user.email?.split('@')[0] || 'Vendedor',
        evento: 'create',
        descricao: 'Lead criado manualmente',
        created_at: new Date().toISOString()
      });
  } catch (e) {
    console.error('Erro ao registrar histórico inicial:', e);
  }

  return NextResponse.json({ lead });
}
