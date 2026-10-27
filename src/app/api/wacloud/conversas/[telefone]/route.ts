import { NextResponse } from 'next/server';
import { getWacloudInstanciaByIdOrName, getWacloudMensagens } from '@/lib/nocodb/wacloud';
import { getWacloudSupabaseAdmin } from '@/lib/wacloud/supabase';
import { fetchUazapiMessages } from '@/lib/wacloud/uazapi';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

// GET /api/wacloud/conversas/[telefone] - lista mensagens do contato sob demanda via UAZAPI (ou fallback no banco)
export async function GET(request: Request, { params }: { params: { telefone: string } }) {
  const { telefone } = params;
  const { searchParams } = new URL(request.url);
  const instancia = searchParams.get('instancia');
  const offset = Number(searchParams.get('offset')) || 0;
  const limit = Number(searchParams.get('limit')) || 30;

  try {
    // 1. Tenta buscar direto na UAZAPI em tempo real (sob demanda)
    if (instancia) {
      let instData = await getWacloudInstanciaByIdOrName(instancia);
      if (!instData?.token) {
        const supabase = getWacloudSupabaseAdmin();
        const { data: sbInst } = await supabase
          .from('wacloud_instancias')
          .select('token')
          .eq('nome_instancia', instancia)
          .single();
        instData = sbInst;
      }

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
              telefone_contato: cleanPhone,
              nome_contato: m.senderName || null,
              nome_instancia: instancia,
              mensagem: textContent,
              tipo_mensagem: m.messageType || 'Conversation',
              timestamp_whatsapp: m.messageTimestamp ? new Date(Number(m.messageTimestamp)).toISOString() : new Date().toISOString(),
              message_id: m.messageid || m.id,
              enviado_por_mim: Boolean(m.fromMe),
              url_midia: m.fileURL || null,
              mimetype: mimetype,
            };
          });

          // Reordena do mais antigo para o mais novo
          mensagens.sort((a: any, b: any) => new Date(a.timestamp_whatsapp).getTime() - new Date(b.timestamp_whatsapp).getTime());

          return NextResponse.json({
            mensagens,
            total: result.total || mensagens.length,
            hasMore: result.hasMore ?? false,
            source: 'uazapi_live',
          });
        } catch (uazErr) {
          console.warn('Erro ao buscar mensagens direto da UAZAPI, usando fallback do banco:', uazErr);
        }
      }
    }

    // 2. Fallback: busca no banco NocoDB (wacloud_mensagens)
    try {
      const nocoMsgs = await getWacloudMensagens(telefone, instancia || undefined, 300);
      if (nocoMsgs && nocoMsgs.length > 0) {
        return NextResponse.json({ mensagens: nocoMsgs, source: 'nocodb' });
      }
    } catch (nocoErr) {
      console.warn("Aviso ao buscar mensagens no NocoDB:", nocoErr);
    }

    // 3. Fallback Supabase
    const supabase = getWacloudSupabaseAdmin();
    const { data: sbMsgs } = instancia
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

    return NextResponse.json({ mensagens: sbMsgs || [], source: 'db' });
  } catch (error) {
    console.error('API mensagens GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
