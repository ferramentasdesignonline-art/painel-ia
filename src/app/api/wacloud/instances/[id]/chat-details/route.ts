import { NextResponse } from 'next/server';
import { getWacloudInstanciaByIdOrName, upsertWacloudContato } from '@/lib/nocodb/wacloud';
import { getWacloudSupabaseAdmin } from '@/lib/wacloud/supabase';
import { WACLOUD_CONFIG } from '@/lib/wacloud/config';

export const dynamic = 'force-dynamic';

// POST /api/wacloud/instances/[id]/chat-details body: { number: string }
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json().catch(() => ({}));
    const { number } = body;

    if (!number) {
      return NextResponse.json({ error: 'number é obrigatório' }, { status: 400 });
    }

    const cleanNumber = String(number).split('@')[0].replace(/\D/g, '');

    let instance = await getWacloudInstanciaByIdOrName(params.id);
    if (!instance?.token) {
      const supabase = getWacloudSupabaseAdmin();
      const { data: sbInst } = await supabase
        .from('wacloud_instancias')
        .select('id, nome_instancia, token')
        .eq('id', params.id)
        .single();
      instance = sbInst;
    }

    if (!instance?.token) {
      return NextResponse.json({ error: 'Instância não encontrada ou sem token' }, { status: 404 });
    }

    // Consulta detalhes do chat na Uazapi
    const res = await fetch(`${WACLOUD_CONFIG.uazapiBaseUrl}/chat/details`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        token: instance.token,
      },
      body: JSON.stringify({ number: cleanNumber }),
      cache: 'no-store',
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data) {
      return NextResponse.json({ error: 'Erro ao consultar chat/details na Uazapi' }, { status: res.status || 500 });
    }

    const labels = Array.isArray(data.wa_label) ? data.wa_label : [];

    // Atualiza no NocoDB (wacloud_contatos)
    try {
      await upsertWacloudContato(instance.nome_instancia, cleanNumber, {
        whatsapp_labels: labels,
        ...(data.wa_contactName || data.name || data.wa_name ? { nome_contato: data.wa_contactName || data.name || data.wa_name } : {}),
      });
    } catch (nocoErr) {
      console.warn("Aviso ao atualizar contato no NocoDB:", nocoErr);
    }

    // Atualiza no Supabase para sincronização
    try {
      const supabase = getWacloudSupabaseAdmin();
      await supabase
        .from('wacloud_contatos')
        .update({
          whatsapp_labels: labels,
          nome_contato: data.wa_contactName || data.name || data.wa_name || undefined,
          atualizado_em: new Date().toISOString(),
        })
        .eq('nome_instancia', instance.nome_instancia)
        .eq('telefone_contato', cleanNumber);
    } catch (sbErr) {
      // Ignora
    }

    return NextResponse.json({
      success: true,
      labels,
      data,
    });
  } catch (err: any) {
    console.error('API chat-details error:', err);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
