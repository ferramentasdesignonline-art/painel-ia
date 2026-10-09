import { NextResponse } from 'next/server';
import { getWacloudSupabaseAdmin } from '@/lib/wacloud/supabase';

export const dynamic = 'force-dynamic';

// GET /api/wacloud/conversas - lista contatos (último registro por contato)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const instancia = searchParams.get('instancia');

  try {
    const supabase = getWacloudSupabaseAdmin();

    // Query direta sem reatribuição de variável (evita bug de chaining do Supabase client)
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
    const { data: importados } = instancia
      ? await supabase
          .from('wacloud_contatos')
          .select('telefone_contato, nome_contato, nome_instancia, ultima_mensagem, ultimo_tipo, ultimo_timestamp, imagem_preview, nao_lidas, is_group, created_at')
          .eq('nome_instancia', instancia)
          .eq('is_group', false)
          .order('ultimo_timestamp', { ascending: false, nullsFirst: false })
          .limit(5000)
      : await supabase
          .from('wacloud_contatos')
          .select('telefone_contato, nome_contato, nome_instancia, ultima_mensagem, ultimo_tipo, ultimo_timestamp, imagem_preview, nao_lidas, is_group, created_at')
          .eq('is_group', false)
          .order('ultimo_timestamp', { ascending: false, nullsFirst: false })
          .limit(5000);

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
        });
      } else {
        // Já existe via mensagens: completa nome/foto/não lidas
        existing.nome_contato = existing.nome_contato || c.nome_contato;
        existing.imagem_preview = c.imagem_preview || null;
        existing.nao_lidas = c.nao_lidas || 0;
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

    return NextResponse.json({ contatos, total_msgs: data?.length || 0 });
  } catch (err: any) {
    console.error('API conversas GET error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error', contatos: [] }, { status: 500 });
  }
}
