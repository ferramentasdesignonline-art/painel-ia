import { NextResponse } from 'next/server';
import { criarFunilPadrao } from '@/lib/funil/criar-funil-padrao';
import { getActiveClientConfig } from '@/lib/auth/helpers';
import { getNocoDBFunil, updateNocoDBFunil } from '@/lib/nocodb/sistema';

// GET: retornar dados do funil do cliente logado
export async function GET() {
  const cliente = await getActiveClientConfig();
  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado ou sem permissão' }, { status: 401 });

  // 1. Tenta buscar no NocoDB
  let funil = null;
  try {
    funil = await getNocoDBFunil(cliente.id);
    if (!funil) {
      await criarFunilPadrao(cliente.id);
      funil = await getNocoDBFunil(cliente.id);
    }
  } catch (nocoErr) {
    console.warn("Erro ao buscar funil no NocoDB:", nocoErr);
  }

  // 2. Se NocoDB retornou o funil, retorna
  if (funil) {
    return NextResponse.json({ funil });
  }

  // 3. Fallback Supabase
  try {
    const { createClient: createSupabaseAdmin } = require('@supabase/supabase-js');
    const supabaseAdmin = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let { data: sbFunil } = await supabaseAdmin
      .from('sistema-dash-ia_funis')
      .select('*')
      .eq('cliente_id', cliente.id)
      .single();

    if (!sbFunil) {
      await criarFunilPadrao(cliente.id, supabaseAdmin);
      const { data: novoFunil } = await supabaseAdmin
        .from('sistema-dash-ia_funis')
        .select('*')
        .eq('cliente_id', cliente.id)
        .single();
      sbFunil = novoFunil;
    }

    return NextResponse.json({ funil: sbFunil });
  } catch (sbErr) {
    console.error("Erro no fallback do funil Supabase:", sbErr);
    return NextResponse.json({ error: 'Erro ao carregar funil' }, { status: 500 });
  }
}

// PUT: atualizar nome do funil ou meta_followup
export async function PUT(request: Request) {
  const cliente = await getActiveClientConfig();
  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado ou sem permissão' }, { status: 401 });

  const { nome, meta_followup } = await request.json();

  // 1. Atualizar no NocoDB
  try {
    await updateNocoDBFunil(cliente.id, {
      ...(nome && { nome }),
      ...(meta_followup !== undefined && { meta_followup: Number(meta_followup) }),
    });
  } catch (nocoErr) {
    console.warn("Aviso ao atualizar funil no NocoDB:", nocoErr);
  }

  // 2. Sincronizar com Supabase se aplicável
  try {
    const { createClient: createSupabaseAdmin } = require('@supabase/supabase-js');
    const supabaseAdmin = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    await supabaseAdmin
      .from('sistema-dash-ia_funis')
      .update({ 
        ...(nome && { nome }),
        ...(meta_followup !== undefined && { meta_followup: Number(meta_followup) })
      })
      .eq('cliente_id', cliente.id);
  } catch (sbErr) {
    console.warn("Aviso ao atualizar funil no Supabase:", sbErr);
  }

  return NextResponse.json({ success: true });
}
