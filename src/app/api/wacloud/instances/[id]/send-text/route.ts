import { NextResponse } from 'next/server';
import { getWacloudInstanciaByIdOrName, saveWacloudMensagem, upsertWacloudContato } from '@/lib/nocodb/wacloud';
import { WACLOUD_CONFIG } from '@/lib/wacloud/config';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { number, text } = body;

    if (!number || !text) {
      return NextResponse.json({ error: 'Faltam parâmetros' }, { status: 400 });
    }

    const instance = await getWacloudInstanciaByIdOrName(params.id);
    if (!instance?.token) {
      return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 });
    }

    const res = await fetch(`${WACLOUD_CONFIG.uazapiBaseUrl}/send/text`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'token': instance.token,
      },
      body: JSON.stringify({ number, text }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json({ error: 'Erro Uazapi: ' + JSON.stringify(data) }, { status: res.status });
    }

    // Salvar mensagem enviada e atualizar último snippet do contato no NocoDB
    const nowIso = new Date().toISOString();
    try {
      await saveWacloudMensagem({
        nome_instancia: instance.nome_instancia,
        telefone_contato: number,
        mensagem: text,
        enviado_por_mim: true,
        tipo_mensagem: 'text',
        timestamp_whatsapp: nowIso,
      });

      await upsertWacloudContato(instance.nome_instancia, number, {
        ultima_mensagem: text,
        ultimo_tipo: 'text',
        ultimo_timestamp: nowIso,
      });
    } catch (msgErr) {
      console.warn("Aviso ao salvar mensagem enviada no NocoDB:", msgErr);
    }

    // Bloqueia automaticamente a IA para o lead ao enviar mensagem humana
    const { autoBlockLeadOnHumanMessage } = await import('@/lib/whatsapp/auto-block');
    await autoBlockLeadOnHumanMessage({
      instanceIdOrName: instance.nome_instancia || params.id,
      phone: number,
      content: text
    });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
