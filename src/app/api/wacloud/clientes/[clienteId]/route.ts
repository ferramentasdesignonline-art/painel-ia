import { NextResponse } from 'next/server';
import { getWacloudInstancias, updateWacloudInstancia } from '@/lib/nocodb/wacloud';
import { getWacloudSupabaseAdmin } from '@/lib/wacloud/supabase';
import { createWacloudInstance } from '@/lib/wacloud/uazapi';

export const dynamic = 'force-dynamic';

// GET -> instância WhatsApp Cloud vinculada ao cliente (se houver)
export async function GET(_req: Request, { params }: { params: { clienteId: string } }) {
  // 1. Tenta buscar no NocoDB
  try {
    const list = await getWacloudInstancias({ clienteId: params.clienteId });
    if (list && list.length > 0) {
      return NextResponse.json({ instance: list[0] });
    }
  } catch (nocoErr) {
    console.warn("Aviso ao buscar instância do cliente no NocoDB:", nocoErr);
  }

  // 2. Fallback Supabase
  const supabase = getWacloudSupabaseAdmin();
  const { data, error } = await supabase
    .from('wacloud_instancias')
    .select('id, nome_instancia, status, ativo, created_at')
    .eq('cliente_id', params.clienteId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ instance: data || null });
}

// POST { ativo: boolean, nome?: string } -> liga/desliga a integração do cliente
export async function POST(request: Request, { params }: { params: { clienteId: string } }) {
  try {
    const { ativo, nome } = await request.json();

    // 1. Buscar se já existe no NocoDB
    let existing: any = null;
    try {
      const list = await getWacloudInstancias({ clienteId: params.clienteId });
      if (list && list.length > 0) {
        existing = list[0];
      }
    } catch (nocoErr) {
      console.warn("Aviso ao buscar instância existente no NocoDB:", nocoErr);
    }

    if (!existing) {
      const supabase = getWacloudSupabaseAdmin();
      const { data: sbExisting } = await supabase
        .from('wacloud_instancias')
        .select('id, nome_instancia, status, ativo, created_at')
        .eq('cliente_id', params.clienteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      existing = sbExisting;
    }

    if (existing) {
      // Atualizar ativo no NocoDB
      try {
        await updateWacloudInstancia(existing.id || existing.Id, { ativo: !!ativo });
      } catch (nocoUpErr) {
        console.warn("Aviso ao atualizar ativo no NocoDB:", nocoUpErr);
      }

      // Sincronizar no Supabase
      try {
        const supabase = getWacloudSupabaseAdmin();
        await supabase
          .from('wacloud_instancias')
          .update({ ativo: !!ativo })
          .eq('id', existing.id);
      } catch (sbErr) {
        // Ignora
      }

      return NextResponse.json({ instance: { ...existing, ativo: !!ativo } });
    }

    if (!ativo) return NextResponse.json({ instance: null });

    const nomeInstancia = String(nome || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!nomeInstancia) {
      return NextResponse.json({ error: 'Nome de instância inválido' }, { status: 400 });
    }

    const { row } = await createWacloudInstance(nomeInstancia, params.clienteId);
    return NextResponse.json({ instance: row });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
