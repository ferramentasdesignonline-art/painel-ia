import { NextResponse } from 'next/server';
import { 
  getWacloudInstanciaByIdOrName, 
  getWacloudContatos, 
  upsertWacloudContato,
  batchUpsertWacloudContatos,
  getWacloudEtiquetas
} from '@/lib/nocodb/wacloud';
import { fetchUazapiChats, fetchUazapiLabels } from '@/lib/wacloud/uazapi';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

// Trava em memória para evitar que requisições concorrentes disparem sync duplicado na mesma instância
const syncInProgress = new Set<string>();

function deduplicateContatos(list: any[]): any[] {
  const map = new Map<string, any>();
  for (const item of list) {
    if (!item?.telefone_contato) continue;
    const cleanPhone = String(item.telefone_contato).replace(/\D/g, '');
    const existing = map.get(cleanPhone);
    if (!existing) {
      map.set(cleanPhone, { ...item, telefone_contato: cleanPhone });
    } else {
      const existingTs = new Date(existing.ultimo_timestamp || 0).getTime();
      const currentTs = new Date(item.ultimo_timestamp || 0).getTime();
      if (currentTs >= existingTs) {
        map.set(cleanPhone, {
          ...item,
          telefone_contato: cleanPhone,
          nome_contato: item.nome_contato || existing.nome_contato,
          whatsapp_labels: (Array.isArray(item.whatsapp_labels) && item.whatsapp_labels.length > 0) 
            ? item.whatsapp_labels 
            : (existing.whatsapp_labels || []),
        });
      }
    }
  }
  const result = Array.from(map.values());
  result.sort((a, b) => new Date(b.ultimo_timestamp || 0).getTime() - new Date(a.ultimo_timestamp || 0).getTime());
  return result;
}

// GET /api/wacloud/conversas - lista contatos com Cache-First no NocoDB e sincronização contínua
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const instancia = searchParams.get('instancia');
  const offset = Number(searchParams.get('offset')) || 0;
  const limit = Number(searchParams.get('limit')) || 60;
  const sync = searchParams.get('sync') === 'true';

  try {
    let instData: any = null;
    let labels: any[] = [];

    if (instancia) {
      try {
        instData = await getWacloudInstanciaByIdOrName(instancia);
        if (instData?.token) {
          labels = await fetchUazapiLabels(instData.token).catch(() => []);
        }
      } catch (instErr) {
        console.warn("Aviso ao buscar dados da instância/labels:", instErr);
      }
    }

    // 1. Busca contatos salvos no NocoDB
    let nocoContatos: any[] = [];
    try {
      nocoContatos = await getWacloudContatos({
        nomeInstancia: instancia || undefined,
        limit: 1000,
      });
    } catch (nocoErr) {
      console.warn("Aviso ao buscar contatos no NocoDB:", nocoErr);
    }

    const uniqueNocoContatos = deduplicateContatos(nocoContatos);

    // Se temos contatos no NocoDB e não é sync forçado, retorna IMEDIATAMENTE (super ágil!)
    if (uniqueNocoContatos && uniqueNocoContatos.length > 0 && !sync && offset === 0) {
      // Dispara sincronização em segundo plano na Uazapi (se não houver sync em andamento)
      if (instData?.token && instancia && !syncInProgress.has(instancia)) {
        syncInProgress.add(instancia);
        (async () => {
          try {
            const chatResult = await fetchUazapiChats(instData.token, 0, 40);
            const rawChats = chatResult.chats || [];
            const toUpsert = rawChats
              .filter((c: any) => c?.wa_chatid && !c?.wa_isGroup)
              .map((c: any) => {
                const cleanPhone = String(c.wa_chatid).split('@')[0].replace(/\D/g, '');
                const ts = c.wa_lastMsgTimestamp ? new Date(Number(c.wa_lastMsgTimestamp)).toISOString() : new Date().toISOString();
                return {
                  telefone_contato: cleanPhone,
                  nome_contato: c.wa_contactName || c.lead_fullName || c.lead_name || c.name || c.wa_name || cleanPhone,
                  nome_instancia: instancia,
                  ultima_mensagem: c.wa_lastMessageTextVote || null,
                  ultimo_tipo: c.wa_lastMessageType || 'text',
                  ultimo_timestamp: ts,
                  imagem_preview: c.imagePreview || null,
                  nao_lidas: c.wa_unreadCount || 0,
                  whatsapp_labels: Array.isArray(c.wa_label) ? c.wa_label : [],
                };
              });

            await batchUpsertWacloudContatos(instancia, toUpsert);
          } catch (bgErr) {
            console.warn("Aviso na sincronização background de contatos:", bgErr);
          } finally {
            syncInProgress.delete(instancia);
          }
        })();
      }

      return NextResponse.json({
        contatos: uniqueNocoContatos,
        total: uniqueNocoContatos.length,
        hasMore: true,
        source: 'nocodb_fast',
        labels: labels || [],
      });
    }

    // 2. Se o NocoDB está vazio OU sync=true OU offset > 0, consulta Uazapi e salva em lote no NocoDB
    if (instData?.token && instancia) {
      // Evita concorrência se já houver sync em curso
      if (syncInProgress.has(instancia)) {
        return NextResponse.json({
          contatos: uniqueNocoContatos,
          total: uniqueNocoContatos.length,
          hasMore: true,
          source: 'nocodb_waiting_sync',
          labels: labels || [],
        });
      }

      syncInProgress.add(instancia);
      try {
        const [chatResult, uazLabels] = await Promise.all([
          fetchUazapiChats(instData.token, offset, limit),
          labels.length > 0 ? labels : fetchUazapiLabels(instData.token).catch(() => []),
        ]);

        const rawChats = chatResult.chats || [];
        const contatosFormatados = rawChats
          .filter((c: any) => c?.wa_chatid && !c?.wa_isGroup)
          .map((c: any) => {
            const cleanPhone = String(c.wa_chatid).split('@')[0].replace(/\D/g, '');
            const ts = c.wa_lastMsgTimestamp ? new Date(Number(c.wa_lastMsgTimestamp)).toISOString() : new Date().toISOString();
            return {
              telefone_contato: cleanPhone,
              nome_contato: c.wa_contactName || c.lead_fullName || c.lead_name || c.name || c.wa_name || cleanPhone,
              nome_instancia: instancia,
              ultima_mensagem: c.wa_lastMessageTextVote || null,
              ultimo_tipo: c.wa_lastMessageType || 'text',
              ultimo_timestamp: ts,
              imagem_preview: c.imagePreview || null,
              nao_lidas: c.wa_unreadCount || 0,
              whatsapp_labels: Array.isArray(c.wa_label) ? c.wa_label : [],
            };
          });

        const uniqueFormatados = deduplicateContatos(contatosFormatados);

        // Salva com proteção contra duplicatas e atomicidade
        await batchUpsertWacloudContatos(instancia, uniqueFormatados);

        const totalRecords = chatResult.pagination?.totalRecords || 0;
        const hasMore = chatResult.hasMore !== undefined
          ? Boolean(chatResult.hasMore)
          : (totalRecords > 0 ? (offset + limit < totalRecords) : rawChats.length >= limit);

        return NextResponse.json({
          contatos: uniqueFormatados,
          total: totalRecords || uniqueFormatados.length,
          hasMore,
          source: 'uazapi_synced',
          labels: uazLabels || [],
        });
      } catch (uazErr) {
        console.warn('Erro ao buscar contatos na Uazapi:', uazErr);
      } finally {
        syncInProgress.delete(instancia);
      }
    }

    return NextResponse.json({ 
      contatos: uniqueNocoContatos, 
      total: uniqueNocoContatos.length, 
      source: 'nocodb',
      labels: labels || [],
    });
  } catch (error) {
    console.error('API conversas GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
