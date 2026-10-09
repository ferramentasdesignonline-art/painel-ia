import { NextResponse } from 'next/server';
import { getWacloudSupabaseAdmin } from '@/lib/wacloud/supabase';
import { WACLOUD_CONFIG } from '@/lib/wacloud/config';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { number, labelids } = body;

    if (!number || !Array.isArray(labelids)) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
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

    // Chama a Uazapi para atualizar as etiquetas
    const res = await fetch(`${WACLOUD_CONFIG.uazapiBaseUrl}/chat/labels`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'token': instance.token,
      },
      body: JSON.stringify({ number, labelids }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json({ error: 'Falha na Uazapi: ' + JSON.stringify(data) }, { status: res.status });
    }

    // Opcional: a gente também deveria atualizar as etiquetas no nosso banco (wacloud_contatos) 
    // mas a forma mais fácil é o frontend puxar novamente ou o sync-chats puxar.
    // Como os labels do Uazapi vêm com o owner prefixado (ex: 55119999:3), 
    // salvar apenas '3' no banco temporariamente funciona se o frontend lidar com os dois formatos.
    await supabase
      .from('wacloud_contatos')
      .update({ whatsapp_labels: labelids, atualizado_em: new Date().toISOString() })
      .eq('instancia_id', instance.id)
      .eq('telefone_contato', number);

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('Update labels error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
