import { NextResponse } from 'next/server';
import { getActiveClientConfig } from '@/lib/auth/helpers';
import { updateNocoDBLeadManual, upsertNocoDBLeadPosicao } from '@/lib/nocodb/sistema';

export async function PUT(request: Request) {
  const cliente = await getActiveClientConfig();
  if (!cliente) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { lead_id, notas, origem } = await request.json();

  if (origem === 'manual') {
    // 1. NocoDB
    try {
      await updateNocoDBLeadManual(lead_id, { notas });
    } catch (nocoErr) {
      console.warn("Aviso ao atualizar notas do lead manual no NocoDB:", nocoErr);
    }

    // 2. Supabase
    try {
      const { createClient: createSupabaseAdmin } = require('@supabase/supabase-js');
      const supabaseAdmin = createSupabaseAdmin(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      await supabaseAdmin
        .from('sistema-dash-ia_leads_manuais')
        .update({ notas, updated_at: new Date().toISOString() })
        .eq('id', lead_id);
    } catch (sbErr) {
      console.warn("Aviso ao atualizar notas no Supabase:", sbErr);
    }
  } else {
    // Para leads da IA
    try {
      const cleanLeadId = lead_id.toString().startsWith('ia-') ? lead_id.toString().replace('ia-', '') : lead_id;
      await upsertNocoDBLeadPosicao(cliente.id, cleanLeadId, 0, notas);
    } catch (nocoErr) {
      console.warn("Aviso ao salvar notas do lead IA no NocoDB:", nocoErr);
    }

    try {
      const { createClient: createSupabaseAdmin } = require('@supabase/supabase-js');
      const supabaseAdmin = createSupabaseAdmin(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      await supabaseAdmin
        .from('sistema-dash-ia_lead_posicoes')
        .upsert({
          cliente_id: cliente.id,
          lead_id: Number(lead_id),
          notas,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'cliente_id, lead_id'
        });
    } catch (sbErr) {
      console.warn("Aviso ao salvar notas no Supabase:", sbErr);
    }
  }

  return NextResponse.json({ success: true });
}
