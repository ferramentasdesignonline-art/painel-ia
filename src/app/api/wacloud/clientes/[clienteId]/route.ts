import { NextResponse } from 'next/server';
import { getWacloudSupabaseAdmin } from '@/lib/wacloud/supabase';
import { createWacloudInstance } from '@/lib/wacloud/uazapi';

export const dynamic = 'force-dynamic';

// GET -> instância WhatsApp Cloud vinculada ao cliente (se houver)
export async function GET(_req: Request, { params }: { params: { clienteId: string } }) {
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
    const supabase = getWacloudSupabaseAdmin();

    const { data: existing } = await supabase
      .from('wacloud_instancias')
      .select('id, nome_instancia, status, ativo, created_at')
      .eq('cliente_id', params.clienteId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from('wacloud_instancias')
        .update({ ativo: !!ativo })
        .eq('id', existing.id)
        .select('id, nome_instancia, status, ativo, created_at')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ instance: data });
    }

    if (!ativo) return NextResponse.json({ instance: null });

    const nomeInstancia = String(nome || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!nomeInstancia) {
      return NextResponse.json({ error: 'Nome da instância inválido' }, { status: 400 });
    }

    const { row } = await createWacloudInstance(nomeInstancia, params.clienteId);
    return NextResponse.json({ instance: row });
  } catch (err: any) {
    console.error('wacloud cliente toggle error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
