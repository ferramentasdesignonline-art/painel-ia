import { NextResponse } from 'next/server';
import { getWacloudInstanciaByIdOrName, saveWacloudEtiqueta } from '@/lib/nocodb/wacloud';
import { getWacloudSupabaseAdmin } from '@/lib/wacloud/supabase';
import { WACLOUD_CONFIG } from '@/lib/wacloud/config';
import { fetchUazapiLabels } from '@/lib/wacloud/uazapi';

export const dynamic = 'force-dynamic';

// GET: Buscar todas as etiquetas da instância
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    let instance = await getWacloudInstanciaByIdOrName(params.id);
    if (!instance?.token) {
      const supabase = getWacloudSupabaseAdmin();
      const { data: sbInst } = await supabase
        .from('wacloud_instancias')
        .select('id, token, nome_instancia')
        .eq('id', params.id)
        .single();
      instance = sbInst;
    }

    if (!instance?.token) {
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

    let instance = await getWacloudInstanciaByIdOrName(params.id);
    if (!instance?.token) {
      const supabase = getWacloudSupabaseAdmin();
      const { data: sbInst } = await supabase
        .from('wacloud_instancias')
        .select('id, token, nome_instancia')
        .eq('id', params.id)
        .single();
      instance = sbInst;
    }

    if (!instance?.token) {
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
        'Content-Type': 'application/json',
        token: instance.token,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data?.message || 'Erro na UAZAPI' }, { status: res.status });
    }

    // Se criou/editou com sucesso, salvar também no NocoDB
    if (!isDelete && name) {
      try {
        const uazLabelId = data?.labelid || labelid;
        await saveWacloudEtiqueta(instance.nome_instancia, {
          uazapi_label_id: String(uazLabelId),
          nome: name,
        });
      } catch (saveErr) {
        console.warn("Aviso ao salvar etiqueta no NocoDB:", saveErr);
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('Edit label error:', err);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
