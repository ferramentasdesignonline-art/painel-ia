import { NextResponse } from 'next/server';
import { reorderNocoDBEtapas } from '@/lib/nocodb/sistema';

export async function PUT(request: Request) {
  const { etapas } = await request.json(); // Array de { id, ordem }
  if (!etapas || !Array.isArray(etapas)) {
    return NextResponse.json({ error: 'Array de etapas é obrigatório' }, { status: 400 });
  }

  // 1. Reordenar no NocoDB
  try {
    await reorderNocoDBEtapas(etapas);
  } catch (nocoErr) {
    console.warn("Aviso ao reordenar etapas no NocoDB:", nocoErr);
  }

  // 2. Sincronizar com Supabase se aplicável
  try {
    const { createClient: createSupabaseAdmin } = require('@supabase/supabase-js');
    const supabaseAdmin = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    for (const { id, ordem } of etapas) {
      await supabaseAdmin
        .from('sistema-dash-ia_etapas_funil')
        .update({ ordem })
        .eq('id', id);
    }
  } catch (sbErr) {
    console.warn("Aviso ao reordenar no Supabase:", sbErr);
  }

  return NextResponse.json({ success: true });
}
