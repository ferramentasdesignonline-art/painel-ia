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

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message, contatos: [] }, { status: 500 });
    }

    // Agrupar por telefone_contato — pegar última mensagem de cada contato
    const contatosMap = new Map<string, any>();
    for (const msg of data || []) {
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

    const contatos = Array.from(contatosMap.values()).sort(
      (a, b) => new Date(b.ultimo_timestamp).getTime() - new Date(a.ultimo_timestamp).getTime()
    );

    return NextResponse.json({ contatos, total_msgs: data?.length || 0 });
  } catch (err: any) {
    console.error('API conversas GET error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error', contatos: [] }, { status: 500 });
  }
}
