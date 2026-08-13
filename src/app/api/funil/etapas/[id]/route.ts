import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// PUT: renomear ou mudar cor de uma etapa manual
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { nome, cor } = await request.json();

  // Verificar que não é etapa automática
  const { data: etapa } = await supabase
    .from('sistema-dash-ia_etapas_funil')
    .select('tipo')
    .eq('id', params.id)
    .single();

  if (etapa?.tipo?.startsWith('ia_')) {
    return NextResponse.json({ error: 'Etapas automáticas não podem ser editadas' }, { status: 403 });
  }

  const { createClient: createSupabaseAdmin } = require('@supabase/supabase-js');
  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { error } = await supabaseAdmin
    .from('sistema-dash-ia_etapas_funil')
    .update({ nome, cor })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

// DELETE: excluir etapa manual (mover leads para etapa anterior)
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: etapa } = await supabase
    .from('sistema-dash-ia_etapas_funil')
    .select('tipo, funil_id, ordem')
    .eq('id', params.id)
    .single();

  if (etapa?.tipo?.startsWith('ia_')) {
    return NextResponse.json({ error: 'Etapas automáticas não podem ser excluídas' }, { status: 403 });
  }

  const { createClient: createSupabaseAdmin } = require('@supabase/supabase-js');
  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Mover leads manuais que estavam nessa etapa para a etapa anterior
  const { data: etapaAnterior } = await supabaseAdmin
    .from('sistema-dash-ia_etapas_funil')
    .select('id')
    .eq('funil_id', etapa!.funil_id)
    .lt('ordem', etapa!.ordem)
    .order('ordem', { ascending: false })
    .limit(1)
    .single();

  // Se não houver etapa manual anterior, tenta qualquer uma anterior (inclusive automáticas)
  // O prompt original dizia para mover para etapa anterior
  if (etapaAnterior) {
    await supabaseAdmin
      .from('sistema-dash-ia_leads_manuais')
      .update({ etapa_id: etapaAnterior.id })
      .eq('etapa_id', params.id);

    await supabaseAdmin
      .from('sistema-dash-ia_lead_posicoes')
      .update({ etapa_id: etapaAnterior.id })
      .eq('etapa_id', params.id);
  }

  const { error } = await supabaseAdmin.from('sistema-dash-ia_etapas_funil').delete().eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
