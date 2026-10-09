import { NextResponse } from 'next/server';
import { getWacloudSupabaseAdmin } from '@/lib/wacloud/supabase';
import { fetchUazapiChats } from '@/lib/wacloud/uazapi';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PAGE_SIZE = 50;

// POST /api/wacloud/instances/[id]/sync-chats  body: { offset?: number }
// Processa UMA página (50 chats) por chamada. O front repete com next_offset até done=true.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json().catch(() => ({}));
    const offset = Number(body?.offset) || 0;

    const supabase = getWacloudSupabaseAdmin();
    const { data: instance, error } = await supabase
      .from('wacloud_instancias')
      .select('id, nome_instancia, token')
      .eq('id', params.id)
      .single();

    if (error || !instance?.token) {
      return NextResponse.json({ error: 'Instância não encontrada ou sem token' }, { status: 404 });
    }

    const result = await fetchUazapiChats(instance.token, offset, PAGE_SIZE);
    const chats = result.chats || [];
    const total = result.pagination?.totalRecords ?? chats.length;

    const rows = chats
      .filter((c) => c?.wa_chatid)
      .map((c) => ({
        instancia_id: instance.id,
        nome_instancia: instance.nome_instancia,
        wa_chatid: c.wa_chatid,
        wa_chatlid: c.wa_chatlid || null,
        telefone_contato: String(c.wa_chatid).split('@')[0].replace(/\D/g, ''),
        nome_contato: c.wa_contactName || c.lead_fullName || c.lead_name || c.name || c.wa_name || null,
        imagem_preview: c.imagePreview || null,
        is_group: !!c.wa_isGroup,
        ultima_mensagem: c.wa_lastMessageTextVote || null,
        ultimo_tipo: c.wa_lastMessageType || null,
        ultimo_timestamp: c.wa_lastMsgTimestamp ? new Date(Number(c.wa_lastMsgTimestamp)).toISOString() : null,
        nao_lidas: c.wa_unreadCount || 0,
        atualizado_em: new Date().toISOString(),
        whatsapp_labels: Array.isArray(c.wa_label) ? c.wa_label : [],
      }));

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from('wacloud_contatos')
        .upsert(rows, { onConflict: 'nome_instancia,wa_chatid' });
      if (upsertError) {
        console.error('Erro ao salvar contatos:', upsertError);
        return NextResponse.json({ error: upsertError.message }, { status: 500 });
      }
    }

    const nextOffset = offset + chats.length;
    const done = chats.length === 0 || nextOffset >= total;

    return NextResponse.json({
      success: true,
      processed: rows.length,
      offset,
      next_offset: done ? null : nextOffset,
      total,
      done,
    });
  } catch (err: any) {
    console.error('sync-chats error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
