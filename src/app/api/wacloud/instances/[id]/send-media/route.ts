import { NextResponse } from 'next/server';
import { getWacloudInstanciaByIdOrName, saveWacloudMensagem } from '@/lib/nocodb/wacloud';
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

    // Salvar mídia enviada no NocoDB
    try {
      await saveWacloudMensagem({
        nome_instancia: instance.nome_instancia,
        telefone_contato: number,
        mensagem: text || '',
        enviado_por_mim: true,
        tipo_mensagem: type || 'media',
        url_midia: file,
        timestamp_whatsapp: new Date().toISOString(),
      });
    } catch (msgErr) {
      console.warn("Aviso ao salvar mídia enviada no NocoDB:", msgErr);
    }

    // Bloqueia automaticamente a IA para o lead ao enviar mídia humana
    const { autoBlockLeadOnHumanMessage } = await import('@/lib/whatsapp/auto-block');
    await autoBlockLeadOnHumanMessage({
      instanceIdOrName: instance.nome_instancia || params.id,
      phone: number,
      content: file || text || '[Mídia]'
    });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
