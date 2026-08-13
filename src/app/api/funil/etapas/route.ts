import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { criarFunilPadrao } from '@/lib/funil/criar-funil-padrao';

import { getActiveClientConfig } from '@/lib/auth/helpers';

// GET: listar todas as etapas do funil do cliente logado
export async function GET() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cliente = await getActiveClientConfig(supabase);

  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });

  const { createClient: createSupabaseAdmin } = require('@supabase/supabase-js');
  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let { data: funil } = await supabaseAdmin
    .from('sistema-dash-ia_funis')
    .select('id')
    .eq('cliente_id', cliente.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!funil) {
    await criarFunilPadrao(cliente.id, supabaseAdmin);
    const { data: novoFunil } = await supabaseAdmin
      .from('sistema-dash-ia_funis')
      .select('id')
      .eq('cliente_id', cliente.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    funil = novoFunil;
  }

  if (!funil) return NextResponse.json({ etapas: [] });

  const { data: etapas } = await supabaseAdmin
    .from('sistema-dash-ia_etapas_funil')
    .select('*')
    .eq('funil_id', funil.id)
    .order('ordem');

  return NextResponse.json({ etapas });
}

// POST: criar nova etapa manual
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { nome, cor, inserir_apos_ordem } = await request.json();

  const cliente = await getActiveClientConfig(supabase);
  console.log('[POST /api/funil/etapas] cliente:', cliente?.id ?? 'NULL');

  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });

  const { createClient: createSupabaseAdmin } = require('@supabase/supabase-js');
  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let { data: funil, error: funilError } = await supabaseAdmin
    .from('sistema-dash-ia_funis')
    .select('id')
    .eq('cliente_id', cliente.id)
    .maybeSingle();

  console.log('[POST /api/funil/etapas] funil:', funil?.id ?? 'NULL', 'error:', funilError?.message);

  if (!funil) {
    const criado = await criarFunilPadrao(cliente.id, supabaseAdmin);
    console.log('[POST /api/funil/etapas] criarFunilPadrao result:', criado?.id ?? 'NULL');
    funil = criado;
  }

  if (!funil) return NextResponse.json({ error: 'Falha ao inicializar funil' }, { status: 500 });

  // Buscar maior ordem atual
  const { data: etapas } = await supabaseAdmin
    .from('sistema-dash-ia_etapas_funil')
    .select('ordem')
    .eq('funil_id', funil.id)
    .order('ordem', { ascending: false })
    .limit(1);

  const maiorOrdem = etapas?.[0]?.ordem || 0;

  const { data: nova, error } = await supabaseAdmin
    .from('sistema-dash-ia_etapas_funil')
    .insert({
      funil_id: funil.id,
      nome,
      cor: cor || '#3b82f6',
      ordem: (inserir_apos_ordem || maiorOrdem) + 1,
      tipo: 'manual',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ etapa: nova });
}
