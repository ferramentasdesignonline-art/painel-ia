import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  updateNocoDBEtapa,
  deleteNocoDBEtapa,
  resolveNocoDBEtapaId,
} from '@/lib/nocodb/sistema';

// PUT: renomear ou mudar cor de uma etapa manual
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { nome, cor } = await request.json();

  // 1. Atualizar no NocoDB
  try {
    await updateNocoDBEtapa(params.id, { nome, cor });
  } catch (nocoErr) {
    console.warn("Aviso ao atualizar etapa no NocoDB:", nocoErr);
  }

  // 2. Sincronizar com Supabase se existir
  try {
    const { createClient: createSupabaseAdmin } = require('@supabase/supabase-js');
    const supabaseAdmin = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    await supabaseAdmin
      .from('sistema-dash-ia_etapas_funil')
      .update({ nome, cor })
      .eq('id', params.id);
  } catch (sbErr) {
    console.warn("Aviso ao atualizar etapa no Supabase:", sbErr);
  }

  return NextResponse.json({ success: true });
}

// DELETE: excluir etapa manual
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  // 1. Excluir no NocoDB
  try {
    await deleteNocoDBEtapa(params.id);
  } catch (nocoErr) {
    console.warn("Aviso ao excluir etapa no NocoDB:", nocoErr);
  }

  // 2. Sincronizar com Supabase se aplicável
  try {
    const { createClient: createSupabaseAdmin } = require('@supabase/supabase-js');
    const supabaseAdmin = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    await supabaseAdmin.from('sistema-dash-ia_etapas_funil').delete().eq('id', params.id);
  } catch (sbErr) {
    console.warn("Aviso ao excluir etapa no Supabase:", sbErr);
  }

  return NextResponse.json({ success: true });
}
