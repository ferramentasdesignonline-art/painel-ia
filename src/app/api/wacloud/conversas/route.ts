import { NextResponse } from 'next/server';
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
    const supabase = getWacloudSupabaseAdmin();

    // 1. Se tem instância informada, busca direto na UAZAPI sob demanda
    if (instancia) {
      const { data: instData } = await supabase
        .from('wacloud_instancias')
        .select('id, token, nome_instancia, cliente_id')
        .eq('nome_instancia', instancia)
        .single();

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
            total_msgs: 0,
            labels: labels || [],
            source: 'uazapi',
            total: chatResult.pagination?.totalRecords ?? contatos.length,
          });
        } catch (uazErr) {
          console.warn('Erro ao buscar contatos direto da UAZAPI, usando fallback do banco:', uazErr);
        }
      }
    }

    // 2. Fallback caso a Uazapi falhe ou não tenha token
    const { data, error } = instancia
      ? await supabase
          .from('wacloud_mensagens')
          .select('telefone_contato, nome_contato, nome_instancia, mensagem, tipo_mensagem, timestamp_whatsapp, created_at')
          .eq('nome_instancia', instancia)
          .order('timestamp_whatsapp', { ascending: false })
          .limit(2000)
      : await supabase
          .from('wacloud_mensagens')
          .select('telefone_contato, nome_contato, nome_instancia, mensagem, tipo_mensagem, timestamp_whatsapp, created_at')
          .order('timestamp_whatsapp', { ascending: false })
          .limit(2000);

    let mensagensData: any[] = [];
    if (error) {
      console.warn('Supabase wacloud_mensagens error (maybe table missing?):', error.message);
    } else {
      mensagensData = data || [];
    }

    // Agrupar por telefone_contato — pegar última mensagem de cada contato
    const contatosMap = new Map<string, any>();
    for (const msg of mensagensData) {
      const key = `${msg.nome_instancia}:${msg.telefone_contato}`;
      if (!contatosMap.has(key)) {
        contatosMap.set(key, {
          telefone_contato: msg.telefone_contato,
          nome_contato: msg.nome_contato,
          nome_instancia: msg.nome_instancia,
          ultima_mensagem: msg.mensagem || null,
          ultimo_tipo: msg.tipo_mensagem || 'text',
          ultimo_timestamp: msg.timestamp_whatsapp || msg.created_at,
        });
      }
    }

    // Contatos importados via /chat/find (wacloud_contatos)
    const { data: importados, error: impError } = instancia
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

    if (impError) {
      console.error('wacloud_contatos error:', impError);
    }

    for (const c of importados || []) {
      const key = `${c.nome_instancia}:${c.telefone_contato}`;
      const ts = c.ultimo_timestamp || c.created_at;
      const existing = contatosMap.get(key);
      if (!existing) {
        contatosMap.set(key, {
          telefone_contato: c.telefone_contato,
          nome_contato: c.nome_contato,
          nome_instancia: c.nome_instancia,
          ultima_mensagem: c.ultima_mensagem || null,
          ultimo_tipo: c.ultimo_tipo || 'text',
          ultimo_timestamp: ts,
          imagem_preview: c.imagem_preview || null,
          nao_lidas: c.nao_lidas || 0,
          whatsapp_labels: c.whatsapp_labels || [],
        });
      } else {
        // Já existe via mensagens: completa nome/foto/não lidas
        existing.nome_contato = existing.nome_contato || c.nome_contato;
        existing.imagem_preview = c.imagem_preview || null;
        existing.nao_lidas = c.nao_lidas || 0;
        existing.whatsapp_labels = c.whatsapp_labels || [];
        if (ts && new Date(ts).getTime() > new Date(existing.ultimo_timestamp).getTime()) {
          existing.ultima_mensagem = c.ultima_mensagem || existing.ultima_mensagem;
          existing.ultimo_tipo = c.ultimo_tipo || existing.ultimo_tipo;
          existing.ultimo_timestamp = ts;
        }
      }
    }

    const contatos = Array.from(contatosMap.values()).sort(
      (a, b) => new Date(b.ultimo_timestamp).getTime() - new Date(a.ultimo_timestamp).getTime()
    );

    let labels = [];
    if (instancia) {
      const { data: instData } = await supabase
        .from('wacloud_instancias')
        .select('token')
        .eq('nome_instancia', instancia)
        .single();
      if (instData?.token) {
        const { fetchUazapiLabels } = await import('@/lib/wacloud/uazapi');
        labels = await fetchUazapiLabels(instData.token);
      }
    }

    return NextResponse.json({ contatos, total_msgs: data?.length || 0, labels });
  } catch (err: any) {
    console.error('API conversas GET error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error', contatos: [] }, { status: 500 });
  }
}
