import { NextResponse } from 'next/server';
import { getWacloudSupabaseAdmin } from '@/lib/wacloud/supabase';
import { WACLOUD_CONFIG } from '@/lib/wacloud/config';
import { fetchUazapiLabels } from '@/lib/wacloud/uazapi';

export const dynamic = 'force-dynamic';

// GET: Buscar todas as etiquetas da instância
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = getWacloudSupabaseAdmin();
    const { data: instance, error } = await supabase
      .from('wacloud_instancias')
      .select('id, token')
      .eq('id', params.id)
      .single();

    if (error || !instance?.token) {
      return NextResponse.json({ error: 'Instância não encontrada ou sem token' }, { status: 404 });
    }

    const labels = await fetchUazapiLabels(instance.token);
    return NextResponse.json({ labels });
  } catch (err: any) {
    console.error('Get labels error:', err);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}

// POST: Criar, editar ou deletar etiqueta
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { labelid, name, color, delete: isDelete } = body;

    if (!labelid) {
      return NextResponse.json({ error: 'labelid é obrigatório ("new" para criar)' }, { status: 400 });
    }

    const supabase = getWacloudSupabaseAdmin();
    const { data: instance, error } = await supabase
      .from('wacloud_instancias')
      .select('id, token')
      .eq('id', params.id)
      .single();

    if (error || !instance?.token) {
      return NextResponse.json({ error: 'Instância não encontrada ou sem token' }, { status: 404 });
    }

    const payload: any = {
      labelid: String(labelid),
      delete: Boolean(isDelete),
    };
    if (name !== undefined) payload.name = name;
    if (color !== undefined) payload.color = Number(color);

    const res = await fetch(`${WACLOUD_CONFIG.uazapiBaseUrl}/label/edit`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        token: instance.token,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Falha na Uazapi: ' + JSON.stringify(data) },
        { status: res.status }
      );
    }

    // Busca a lista atualizada de labels para retornar
    const updatedLabels = await fetchUazapiLabels(instance.token);

    return NextResponse.json({ success: true, data, labels: updatedLabels });
  } catch (err: any) {
    console.error('Edit label error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
