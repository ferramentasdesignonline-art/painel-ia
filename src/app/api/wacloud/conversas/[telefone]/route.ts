import { NextResponse } from 'next/server';
import { getWacloudSupabaseAdmin } from '@/lib/wacloud/supabase';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

// GET /api/wacloud/conversas/[telefone]?instancia=xxx - busca mensagens de um contato
export async function GET(request: Request, { params }: { params: { telefone: string } }) {
  const { searchParams } = new URL(request.url);
  const instancia = searchParams.get('instancia');
  const telefone = params.telefone;

  try {
    const supabase = getWacloudSupabaseAdmin();

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

    return NextResponse.json({ mensagens: data || [] });
  } catch (error) {
    console.error('API mensagens GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
