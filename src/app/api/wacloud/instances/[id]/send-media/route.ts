import { NextResponse } from 'next/server';
import { getWacloudSupabaseAdmin } from '@/lib/wacloud/supabase';
import { WACLOUD_CONFIG } from '@/lib/wacloud/config';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { number, type, file, text } = body;

    if (!number || !type || !file) {
      return NextResponse.json({ error: 'Faltam parâmetros' }, { status: 400 });
    }

    const supabase = getWacloudSupabaseAdmin();
    const { data: instance, error } = await supabase
      .from('wacloud_instancias')
      .select('id, token')
      .eq('id', params.id)
      .single();

    if (error || !instance?.token) {
      return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 });
    }

    const res = await fetch(`${WACLOUD_CONFIG.uazapiBaseUrl}/send/media`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'token': instance.token,
      },
      body: JSON.stringify({ number, type, file, text: text || '' }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json({ error: 'Erro Uazapi: ' + JSON.stringify(data) }, { status: res.status });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
