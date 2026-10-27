import { NextResponse } from 'next/server';
import { getWacloudInstanciaByIdOrName, getWacloudContatos, getWacloudMensagens } from '@/lib/nocodb/wacloud';
import { getWacloudSupabaseAdmin } from '@/lib/wacloud/supabase';
import { fetchUazapiChats, fetchUazapiLabels } from '@/lib/wacloud/uazapi';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

// GET /api/wacloud/conversas - lista contatos sob demanda via UAZAPI (ou fallback no banco)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const instancia = searchParams.get('instancia');
  const offset = Number(searchParams.get('offset')) || 0;
  const limit = Number(searchParams.get('limit')) || 60;

  try {
    // 1. Se tem instância informada, busca direto na UAZAPI sob demanda
    if (instancia) {
      let instData = await getWacloudInstanciaByIdOrName(instancia);
      if (!instData?.token) {
        const supabase = getWacloudSupabaseAdmin();
        const { data: sbInst } = await supabase
          .from('wacloud_instancias')
          .select('id, token, nome_instancia, cliente_id')
          .eq('nome_instancia', instancia)
          .single();
        instData = sbInst;
      }

      if (instData?.token) {
        try {
          const [chatResult, labels] = await Promise.all([
            fetchUazapiChats(instData.token, offset, limit),
            fetchUazapiLabels(instData.token).catch(() => []),
          ]);

          const rawChats = chatResult.chats || [];
          const contatos = rawChats
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

          return NextResponse.json({
            contatos,
            total: chatResult.pagination?.totalRecords || contatos.length,
            hasMore: chatResult.hasMore ?? false,
            source: 'uazapi_live',
            labels: labels || [],
          });
        } catch (uazErr) {
          console.warn('Erro ao buscar contatos direto da UAZAPI, usando fallback do banco:', uazErr);
        }
      }
    }

    // 2. Fallback caso a Uazapi falhe ou não tenha token: NocoDB
    const contatosMap = new Map<string, any>();

    try {
      const nocoContatos = await getWacloudContatos({
        nomeInstancia: instancia || undefined,
        limit: 1000,
      });

      for (const c of nocoContatos) {
        const key = `${c.nome_instancia}:${c.telefone_contato}`;
        contatosMap.set(key, {
          telefone_contato: c.telefone_contato,
          nome_contato: c.nome_contato,
          nome_instancia: c.nome_instancia,
          ultima_mensagem: c.ultima_mensagem || null,
          ultimo_tipo: c.ultimo_tipo || 'text',
          ultimo_timestamp: c.ultimo_timestamp || c.created_at,
          imagem_preview: c.imagem_preview || null,
          nao_lidas: c.nao_lidas || 0,
          whatsapp_labels: Array.isArray(c.whatsapp_labels) ? c.whatsapp_labels : [],
        });
      }
    } catch (nocoErr) {
      console.warn("Aviso fallback NocoDB conversas:", nocoErr);
    }

    // Se NocoDB ainda não tiver registros (ou vazio), consulta Supabase
    if (contatosMap.size === 0) {
      const supabase = getWacloudSupabaseAdmin();
      const { data: importados } = instancia
        ? await supabase
            .from('wacloud_contatos')
            .select('telefone_contato, nome_contato, nome_instancia, ultima_mensagem, ultimo_tipo, ultimo_timestamp, imagem_preview, nao_lidas, is_group, created_at, whatsapp_labels')
            .eq('nome_instancia', instancia)
            .eq('is_group', false)
            .order('ultimo_timestamp', { ascending: false, nullsFirst: false })
            .limit(5000)
        : await supabase
            .from('wacloud_contatos')
            .select('telefone_contato, nome_contato, nome_instancia, ultima_mensagem, ultimo_tipo, ultimo_timestamp, imagem_preview, nao_lidas, is_group, created_at, whatsapp_labels')
            .eq('is_group', false)
            .order('ultimo_timestamp', { ascending: false, nullsFirst: false })
            .limit(5000);

      for (const c of importados || []) {
        const key = `${c.nome_instancia}:${c.telefone_contato}`;
        contatosMap.set(key, {
          telefone_contato: c.telefone_contato,
          nome_contato: c.nome_contato,
          nome_instancia: c.nome_instancia,
          ultima_mensagem: c.ultima_mensagem || null,
          ultimo_tipo: c.ultimo_tipo || 'text',
          ultimo_timestamp: c.ultimo_timestamp || c.created_at,
          imagem_preview: c.imagem_preview || null,
          nao_lidas: c.nao_lidas || 0,
          whatsapp_labels: Array.isArray(c.whatsapp_labels) ? c.whatsapp_labels : [],
        });
      }
    }

    const contatos = Array.from(contatosMap.values()).sort((a, b) => {
      const dateA = a.ultimo_timestamp ? new Date(a.ultimo_timestamp).getTime() : 0;
      const dateB = b.ultimo_timestamp ? new Date(b.ultimo_timestamp).getTime() : 0;
      return dateB - dateA;
    });

    return NextResponse.json({ contatos, total: contatos.length, source: 'db' });
  } catch (error) {
    console.error('API conversas GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
