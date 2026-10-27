import { NextResponse } from 'next/server';
import { getWacloudInstancias } from '@/lib/nocodb/wacloud';
import { getWacloudSupabaseAdmin } from '@/lib/wacloud/supabase';
import { createWacloudInstance } from '@/lib/wacloud/uazapi';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Tenta buscar no NocoDB
    try {
      const instances = await getWacloudInstancias();
      if (instances && instances.length > 0) {
        return NextResponse.json({ instances });
      }
    } catch (nocoErr) {
      console.warn("Aviso ao buscar instâncias no NocoDB:", nocoErr);
    }

    // 2. Fallback Supabase
    const supabase = getWacloudSupabaseAdmin();
    const { data: instances, error } = await supabase
      .from('wacloud_instancias')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching wacloud instances:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ instances: instances || [] });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { nome_instancia, cliente_id } = await request.json();

    if (!nome_instancia || nome_instancia.includes(' ')) {
      return NextResponse.json({ error: 'Nome inválido. Não use espaços.' }, { status: 400 });
    }

    const { instance } = await createWacloudInstance(nome_instancia, cliente_id);
    return NextResponse.json({ success: true, instance });
  } catch (error: any) {
    console.error('API create instance error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
