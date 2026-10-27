import { NextResponse } from 'next/server';
import { getWacloudInstanciaByIdOrName, upsertWacloudContato } from '@/lib/nocodb/wacloud';
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

    const result = await fetchUazapiChats(instance.token, offset, PAGE_SIZE);
    const chats = result.chats || [];
    const total = result.pagination?.totalRecords ?? chats.length;

    const rows = chats
      .filter((c) => c?.wa_chatid)
      .map((c) => ({
        instancia_id: String(instance.id),
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
      // 1. Salvar no NocoDB (wacloud_contatos)
      try {
        await Promise.all(
          rows.map((row) =>
            upsertWacloudContato(instance.nome_instancia, row.telefone_contato, row)
          )
        );
      } catch (nocoErr) {
        console.warn("Aviso ao salvar contatos no NocoDB:", nocoErr);
      }

      // 2. Sincronizar com Supabase
      try {
        const supabase = getWacloudSupabaseAdmin();
        await supabase
          .from('wacloud_contatos')
          .upsert(rows, { onConflict: 'nome_instancia,wa_chatid' });
      } catch (sbErr) {
        // Ignora
      }
    }

    const nextOffset = offset + chats.length;
    const done = chats.length === 0 || nextOffset >= total;

    return NextResponse.json({
      success: true,
      processed: rows.length,
      next_offset: nextOffset,
      total,
      done,
    });
  } catch (err: any) {
    console.error('API sync-chats error:', err);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
