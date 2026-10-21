import { NextResponse } from 'next/server';
import { getWacloudSupabaseAdmin } from '@/lib/wacloud/supabase';
import { fetchUazapiMessages } from '@/lib/wacloud/uazapi';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

// GET /api/wacloud/conversas/[telefone]?instancia=xxx&offset=0&limit=30
export async function GET(request: Request, { params }: { params: { telefone: string } }) {
  const { searchParams } = new URL(request.url);
  const instancia = searchParams.get('instancia');
  const telefone = params.telefone;
  const offset = Number(searchParams.get('offset')) || 0;
  const limit = Number(searchParams.get('limit')) || 30;

  try {
    const supabase = getWacloudSupabaseAdmin();

    // 1. Tenta buscar direto na UAZAPI em tempo real (sob demanda)
    if (instancia) {
      const { data: instData } = await supabase
        .from('wacloud_instancias')
        .select('token')
        .eq('nome_instancia', instancia)
        .single();

      if (instData?.token) {
        try {
          const cleanPhone = telefone.replace(/\D/g, '');
          const chatid = `${cleanPhone}@s.whatsapp.net`;
          const result = await fetchUazapiMessages(instData.token, chatid, offset, limit);
          const rawMsgs = result.messages || [];

          const mensagens = rawMsgs.map((m: any) => {
            let textContent = '';
            if (typeof m.text === 'string') textContent = m.text;
            else if (typeof m.content === 'string') textContent = m.content;
            else if (m.content?.text) textContent = m.content.text;
            else if (m.content?.caption) textContent = m.content.caption;

            let mimetype = m.content?.mimetype || null;
            if (!mimetype) {
              if (m.messageType === 'ImageMessage') mimetype = 'image/jpeg';
              else if (m.messageType === 'VideoMessage') mimetype = 'video/mp4';
              else if (m.messageType === 'AudioMessage') mimetype = 'audio/ogg';
            }

            return {
              id: m.id || m.messageid,
              nome_instancia: instancia,
              telefone_contato: cleanPhone,
              nome_contato: m.senderName || (m.fromMe ? 'Eu' : 'Cliente'),
              mensagem: textContent || null,
              enviado_por_mim: Boolean(m.fromMe),
              tipo_mensagem: m.messageType || 'Conversation',
              url_midia: m.fileURL || (typeof m.content?.URL === 'string' ? m.content.URL : null),
              mimetype: mimetype,
              timestamp_whatsapp: m.messageTimestamp ? new Date(Number(m.messageTimestamp)).toISOString() : new Date().toISOString(),
              created_at: m.messageTimestamp ? new Date(Number(m.messageTimestamp)).toISOString() : new Date().toISOString(),
            };
          });

          // UAZAPI retorna do mais novo para o mais antigo.
          // Invertemos para que a lista fique cronológica (antigas no topo, novas embaixo)
          mensagens.reverse();

          return NextResponse.json({
            mensagens,
            hasMore: result.hasMore,
            nextOffset: result.nextOffset,
            source: 'uazapi',
          });
        } catch (uazErr) {
          console.warn('Erro ao buscar mensagens direto da UAZAPI, usando fallback do banco:', uazErr);
        }
      }
    }

    // Fallback: busca no banco wacloud_mensagens
    const { data, error } = instancia
      ? await supabase
          .from('wacloud_mensagens')
          .select('*')
          .eq('telefone_contato', telefone)
          .eq('nome_instancia', instancia)
          .order('timestamp_whatsapp', { ascending: true })
          .limit(300)
      : await supabase
          .from('wacloud_mensagens')
          .select('*')
          .eq('telefone_contato', telefone)
          .order('timestamp_whatsapp', { ascending: true })
          .limit(300);

    if (error) {
      console.warn('Supabase wacloud_mensagens error:', error.message);
      return NextResponse.json({ mensagens: [] });
    }

    return NextResponse.json({ mensagens: data || [], source: 'db' });
  } catch (error) {
    console.error('API mensagens GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
