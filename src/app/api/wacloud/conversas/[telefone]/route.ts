import { NextResponse } from 'next/server';
import { getWacloudSupabaseAdmin } from '@/lib/wacloud/supabase';

export const dynamic = 'force-dynamic';

// GET /api/wacloud/conversas/[telefone]?instancia=xxx - busca mensagens de um contato
export async function GET(request: Request, { params }: { params: { telefone: string } }) {
  const { searchParams } = new URL(request.url);
  const instancia = searchParams.get('instancia');
  const telefone = params.telefone;

  try {
    const supabase = getWacloudSupabaseAdmin();

    let query = supabase
      .from('wacloud_mensagens')
      .select('*')
      .eq('telefone_contato', telefone)
      .order('timestamp_whatsapp', { ascending: true });

    if (instancia) {
      query = query.eq('nome_instancia', instancia);
    }

    const { data, error } = await query.limit(200);

    if (error) throw error;

    return NextResponse.json({ mensagens: data || [] });
  } catch (error) {
    console.error('API mensagens GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
