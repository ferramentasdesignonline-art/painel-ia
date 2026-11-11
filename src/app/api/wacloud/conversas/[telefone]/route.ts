import { NextResponse } from 'next/server';
import { 
  getWacloudInstanciaByIdOrName, 
  getWacloudMensagens, 
  saveWacloudMensagensBulk 
} from '@/lib/nocodb/wacloud';
import { fetchUazapiMessages } from '@/lib/wacloud/uazapi';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

function formatarMensagemUazapi(m: any, cleanPhone: string, instancia: string) {
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

  const ts = m.messageTimestamp ? new Date(Number(m.messageTimestamp)).toISOString() : new Date().toISOString();
  const mid = m.messageid || m.id || `${cleanPhone}_${Date.now()}`;

  return {
    id: mid,
    telefone_contato: cleanPhone,
    nome_contato: m.senderName || null,
    nome_instancia: instancia,
    mensagem: textContent,
    tipo_mensagem: m.messageType || 'Conversation',
    timestamp_whatsapp: ts,
    message_id: mid,
    enviado_por_mim: Boolean(m.fromMe),
    url_midia: m.fileURL || null,
    mimetype: mimetype,
    created_at: ts,
  };
}

// GET /api/wacloud/conversas/[telefone] - lista mensagens com Cache-First no NocoDB e sincronização em segundo plano
export async function GET(request: Request, { params }: { params: { telefone: string } }) {
  const { telefone } = params;
  const { searchParams } = new URL(request.url);
  const instancia = searchParams.get('instancia');
  const offset = Number(searchParams.get('offset')) || 0;
  const limit = Number(searchParams.get('limit')) || 40;
  const sync = searchParams.get('sync') === 'true';

  try {
    const cleanPhone = telefone.replace(/\D/g, '');

    // 1. Busca mensagens já gravadas no NocoDB
    let nocoMsgs: any[] = [];
    try {
      nocoMsgs = await getWacloudMensagens(cleanPhone, instancia || undefined, 300);
    } catch (err) {
      console.warn("Aviso ao buscar mensagens no NocoDB:", err);
    }

    // Se temos mensagens no NocoDB e não é um sync forçado, retorna IMEDIATAMENTE (abertura ultra rápida!)
    if (nocoMsgs && nocoMsgs.length > 0 && !sync && offset === 0) {
      // Dispara verificação em segundo plano na Uazapi para sincronizar mensagens novas se houver
      if (instancia) {
        (async () => {
          try {
            const instData = await getWacloudInstanciaByIdOrName(instancia);
            if (instData?.token) {
              const chatid = `${cleanPhone}@s.whatsapp.net`;
              const result = await fetchUazapiMessages(instData.token, chatid, 0, 20);
              const rawMsgs = result.messages || [];
              if (rawMsgs.length > 0) {
                const existingIds = new Set(nocoMsgs.map((m: any) => m.message_id || m.id).filter(Boolean));
                const formatted = rawMsgs.map((m: any) => formatarMensagemUazapi(m, cleanPhone, instancia));
                const toSave = formatted.filter((m: any) => m.message_id && !existingIds.has(m.message_id));
                if (toSave.length > 0) {
                  await saveWacloudMensagensBulk(toSave);
                }
              }
            }
          } catch (bgErr) {
            console.warn("Aviso na checagem em segundo plano Uazapi -> NocoDB:", bgErr);
          }
        })();
      }

      return NextResponse.json({
        mensagens: nocoMsgs,
        total: nocoMsgs.length,
        hasMore: false,
        source: 'nocodb_fast',
      });
    }

    // 2. Se o NocoDB está vazio (primeira vez abrindo este contato) OU sync=true:
    if (instancia) {
      const instData = await getWacloudInstanciaByIdOrName(instancia);
      if (instData?.token) {
        try {
          const chatid = `${cleanPhone}@s.whatsapp.net`;
          const result = await fetchUazapiMessages(instData.token, chatid, offset, limit);
          const rawMsgs = result.messages || [];

          const existingIds = new Set(nocoMsgs.map((m: any) => m.message_id || m.id).filter(Boolean));
          const formatted = rawMsgs.map((m: any) => formatarMensagemUazapi(m, cleanPhone, instancia));

          // Salva no NocoDB todas as mensagens novas
          const toSave = formatted.filter((m: any) => m.message_id && !existingIds.has(m.message_id));
          if (toSave.length > 0) {
            try {
              await saveWacloudMensagensBulk(toSave);
            } catch (saveErr) {
              console.warn("Erro ao salvar mensagens novas no NocoDB:", saveErr);
            }
          }

          // Junta mensagens e ordena por timestamp
          const mapaFinal = new Map<string, any>();
          for (const m of nocoMsgs) {
            mapaFinal.set(m.message_id || m.id, m);
          }
          for (const m of formatted) {
            mapaFinal.set(m.message_id || m.id, m);
          }
          const todas = Array.from(mapaFinal.values());
          todas.sort((a: any, b: any) => new Date(a.timestamp_whatsapp || a.created_at).getTime() - new Date(b.timestamp_whatsapp || b.created_at).getTime());

          return NextResponse.json({
            mensagens: todas,
            total: result.total || todas.length,
            hasMore: result.hasMore ?? false,
            source: 'uazapi_synced',
          });
        } catch (uazErr) {
          console.warn('Erro ao buscar mensagens na Uazapi:', uazErr);
        }
      }
    }

    return NextResponse.json({ mensagens: nocoMsgs, source: 'nocodb' });
  } catch (error) {
    console.error('API mensagens GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
