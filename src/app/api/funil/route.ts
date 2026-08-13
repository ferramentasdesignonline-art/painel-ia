import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { criarFunilPadrao } from '@/lib/funil/criar-funil-padrao';
import { getActiveClientConfig } from '@/lib/auth/helpers';

// GET: retornar dados do funil do cliente logado
export async function GET() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cliente = await getActiveClientConfig(supabase);

  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado ou sem permissão' }, { status: 404 });

  const { createClient: createSupabaseAdmin } = require('@supabase/supabase-js');
  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let { data: funil } = await supabaseAdmin
    .from('sistema-dash-ia_funis')
    .select('*')
    .eq('cliente_id', cliente.id)
    .single();

  // Bootstrap se não existir
  if (!funil) {
    await criarFunilPadrao(cliente.id, supabaseAdmin);
    const { data: novoFunil } = await supabaseAdmin
      .from('sistema-dash-ia_funis')
      .select('*')
      .eq('cliente_id', cliente.id)
      .single();
    funil = novoFunil;
  }

  return NextResponse.json({ funil });
}

// PUT: atualizar nome do funil
export async function PUT(request: Request) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { nome, meta_followup } = await request.json();

  const cliente = await getActiveClientConfig(supabase);

  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });

  const { createClient: createSupabaseAdmin } = require('@supabase/supabase-js');
  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  console.log('Tentando atualizar funil:', { nome, meta_followup, clienteId: cliente.id });

  const { error: updateError } = await supabaseAdmin
    .from('sistema-dash-ia_funis')
    .update({ 
      ...(nome && { nome }),
      ...(meta_followup !== undefined && { meta_followup: Number(meta_followup) })
    })
    .eq('cliente_id', cliente.id);

  if (updateError) {
    console.error('Erro ao atualizar funil:', updateError);
    // Se falhar porque a coluna não existe, tenta atualizar só o nome
    if (updateError.message?.includes('column "meta_followup" does not exist')) {
      console.warn('Coluna meta_followup não existe, salvando apenas o nome.');
      if (nome) {
        await supabaseAdmin
          .from('sistema-dash-ia_funis')
          .update({ nome })
          .eq('cliente_id', cliente.id);
      }
      return NextResponse.json({ success: true, warning: 'meta_followup não salva (coluna ausente)' });
    }
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
