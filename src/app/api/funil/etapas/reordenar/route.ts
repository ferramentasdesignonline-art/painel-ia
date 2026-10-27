import { NextResponse } from 'next/server';
import { reorderNocoDBEtapas } from '@/lib/nocodb/sistema';

// PUT: salvar nova ordem das etapas após drag-and-drop
export async function PUT(request: Request) {
  const { etapas_ordenadas } = await request.json();
  // etapas_ordenadas: [{ id: uuid/id, ordem: number }, ...]

  if (!etapas_ordenadas || !Array.isArray(etapas_ordenadas)) {
    return NextResponse.json({ error: 'Array etapas_ordenadas é obrigatório' }, { status: 400 });
  }

  // 1. Reordenar no NocoDB
  try {
    await reorderNocoDBEtapas(etapas_ordenadas);
  } catch (nocoErr) {
    console.warn("Aviso ao reordenar etapas no NocoDB:", nocoErr);
  }

  // 2. Sincronizar no Supabase se aplicável
  try {
    const { createClient: createSupabaseAdmin } = require('@supabase/supabase-js');
    const supabaseAdmin = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const updates = etapas_ordenadas.map(({ id, ordem }: { id: string | number; ordem: number }) =>
      supabaseAdmin.from('sistema-dash-ia_etapas_funil').update({ ordem }).eq('id', id)
    );
    await Promise.all(updates);
  } catch (sbErr) {
    console.warn("Aviso ao sincronizar reordenação no Supabase:", sbErr);
  }

  return NextResponse.json({ success: true });
}
