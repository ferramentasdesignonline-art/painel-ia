import { NextResponse } from 'next/server';
import { getWacloudSupabaseAdmin } from '@/lib/wacloud/supabase';

export const dynamic = 'force-dynamic';

// GET /api/wacloud/conversas - lista contatos (último registro por contato)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const instancia = searchParams.get('instancia'); // filtro opcional por instancia

  try {
    const supabase = getWacloudSupabaseAdmin();

    let query = supabase
      .from('wacloud_mensagens')
      .select('*')
      .order('timestamp_whatsapp', { ascending: false });

    if (instancia) {
      query = query.eq('nome_instancia', instancia);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Agrupar por telefone_contato - pegar última mensagem de cada contato
    const contatosMap = new Map<string, any>();
    for (const msg of data || []) {
      const key = `${msg.nome_instancia}:${msg.telefone_contato}`;
      if (!contatosMap.has(key)) {
        contatosMap.set(key, {
          telefone_contato: msg.telefone_contato,
          nome_contato: msg.nome_contato,
          nome_instancia: msg.nome_instancia,
          ultima_mensagem: msg.mensagem,
          ultimo_tipo: msg.tipo_mensagem,
          ultimo_timestamp: msg.timestamp_whatsapp || msg.created_at,
          nao_lidas: 0,
        });
      }
    }

    const contatos = Array.from(contatosMap.values()).sort(
      (a, b) => new Date(b.ultimo_timestamp).getTime() - new Date(a.ultimo_timestamp).getTime()
    );

    return NextResponse.json({ contatos });
  } catch (error) {
    console.error('API conversas GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
