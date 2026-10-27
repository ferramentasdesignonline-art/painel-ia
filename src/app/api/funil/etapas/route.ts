import { NextResponse } from 'next/server';
import { criarFunilPadrao } from '@/lib/funil/criar-funil-padrao';
import { getActiveClientConfig } from '@/lib/auth/helpers';
import {
  getNocoDBFunil,
  getNocoDBEtapasFunil,
  createNocoDBEtapa,
} from '@/lib/nocodb/sistema';

// GET: listar todas as etapas do funil do cliente logado
export async function GET() {
  const cliente = await getActiveClientConfig();
  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado ou sem permissão' }, { status: 401 });

  // 1. Tenta buscar no NocoDB
  try {
    let funil = await getNocoDBFunil(cliente.id);
    if (!funil) {
      await criarFunilPadrao(cliente.id);
      funil = await getNocoDBFunil(cliente.id);
    }

    if (funil?.Id) {
      const etapas = await getNocoDBEtapasFunil(funil.Id);
      if (etapas && etapas.length > 0) {
        return NextResponse.json({ etapas });
      }
    }
  } catch (nocoErr) {
    console.warn("Erro ao buscar etapas no NocoDB:", nocoErr);
  }

  // 2. Fallback Supabase
  try {
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

    return NextResponse.json({ etapas: etapas || [] });
  } catch (sbErr) {
    console.error("Erro ao buscar etapas no Supabase:", sbErr);
    return NextResponse.json({ etapas: [] });
  }
}

// POST: criar nova etapa manual
export async function POST(request: Request) {
  const cliente = await getActiveClientConfig();
  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado ou sem permissão' }, { status: 401 });

  const { nome, cor, inserir_apos_ordem } = await request.json();

  let novaEtapaNoco: any = null;

  // 1. Criar no NocoDB
  try {
    let funil = await getNocoDBFunil(cliente.id);
    if (!funil) {
      funil = await criarFunilPadrao(cliente.id);
    }

    if (funil?.Id) {
      const etapasAtuais = await getNocoDBEtapasFunil(funil.Id);
      const maiorOrdem = etapasAtuais.reduce((max, e) => Math.max(max, e.ordem || 0), 0);
      const novaOrdem = (inserir_apos_ordem !== undefined && inserir_apos_ordem !== null)
        ? Number(inserir_apos_ordem) + 1
        : maiorOrdem + 1;

      novaEtapaNoco = await createNocoDBEtapa({
        funil_id: funil.Id,
        nome,
        cor: cor || '#3b82f6',
        ordem: novaOrdem,
        tipo: 'manual',
      });
    }
  } catch (nocoErr) {
    console.warn("Erro ao criar etapa no NocoDB:", nocoErr);
  }

  // 2. Sincronizar com Supabase se possível
  let novaEtapaSb: any = null;
  try {
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
      .maybeSingle();

    if (!funil) {
      funil = await criarFunilPadrao(cliente.id, supabaseAdmin);
    }

    if (funil?.id) {
      const { data: etapas } = await supabaseAdmin
        .from('sistema-dash-ia_etapas_funil')
        .select('ordem')
        .eq('funil_id', funil.id)
        .order('ordem', { ascending: false })
        .limit(1);

      const maiorOrdem = etapas?.[0]?.ordem || 0;

      const { data: nova } = await supabaseAdmin
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

      novaEtapaSb = nova;
    }
  } catch (sbErr) {
    console.warn("Aviso ao criar etapa no Supabase:", sbErr);
  }

  const finalEtapa = novaEtapaNoco || novaEtapaSb;
  if (!finalEtapa) {
    return NextResponse.json({ error: 'Erro ao criar etapa' }, { status: 500 });
  }

  return NextResponse.json({ etapa: finalEtapa });
}
