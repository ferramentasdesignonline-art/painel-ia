import { NextResponse } from 'next/server';
import { getWacloudInstanciaByIdOrName, saveWacloudMensagensBulk } from '@/lib/nocodb/wacloud';
import { getWacloudSupabaseAdmin } from '@/lib/wacloud/supabase';
import { fetchUazapiMessages } from '@/lib/wacloud/uazapi';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PAGE_SIZE = 100;

// POST /api/wacloud/instances/[id]/sync-messages  body: { chatid: string, offset?: number }
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json().catch(() => ({}));
    const offset = Number(body?.offset) || 0;
    const chatid = body?.chatid;

    if (!chatid) {
      return NextResponse.json({ error: 'chatid é obrigatório' }, { status: 400 });
    }

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

    const result = await fetchUazapiMessages(instance.token, chatid, offset, PAGE_SIZE);
    const messages = result.messages || [];

    const telefoneContato = String(chatid).split('@')[0].replace(/\D/g, '');

    const rows = messages.map((m) => {
      let textContent = m.text || '';
      if (!textContent && m.content) {
        if (typeof m.content === 'string') textContent = m.content;
        else if (m.content.text) textContent = m.content.text;
        else if (m.content.caption) textContent = m.content.caption;
      }

      let mimetype = null;
      let urlMidia = m.fileURL || null;

      if (m.messageType === 'ImageMessage') mimetype = 'image/jpeg';
      else if (m.messageType === 'VideoMessage') mimetype = 'video/mp4';
      else if (m.messageType === 'AudioMessage') mimetype = 'audio/ogg';

      return {
        nome_instancia: instance.nome_instancia,
        telefone_contato: telefoneContato,
        nome_contato: m.senderName || null,
        mensagem: textContent,
        tipo_mensagem: m.messageType || 'Conversation',
        timestamp_whatsapp: m.messageTimestamp ? new Date(Number(m.messageTimestamp)).toISOString() : null,
        message_id: m.messageid || m.id,
        enviado_por_mim: !!m.fromMe,
        url_midia: urlMidia,
        mimetype: mimetype,
      };
    });

    if (rows.length > 0) {
      // 1. Salvar no NocoDB (wacloud_mensagens)
      try {
        await saveWacloudMensagensBulk(rows);
      } catch (nocoErr) {
        console.warn("Aviso ao salvar mensagens no NocoDB:", nocoErr);
      }

      // 2. Sincronizar com Supabase
      try {
        const supabase = getWacloudSupabaseAdmin();
        await supabase
          .from('wacloud_mensagens')
          .upsert(rows, { onConflict: 'message_id' });
      } catch (sbErr) {
        // Ignora
      }
    }

    const hasMore = result.hasMore;
    const nextOffset = result.nextOffset || (offset + messages.length);

    return NextResponse.json({
      success: true,
      processed: rows.length,
      offset,
      nextOffset,
      hasMore,
    });
  } catch (err: any) {
    console.error('API sync-messages error:', err);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
