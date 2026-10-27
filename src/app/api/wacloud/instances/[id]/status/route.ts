import { NextResponse } from 'next/server';
import { getWacloudInstanciaByIdOrName } from '@/lib/nocodb/wacloud';
import { getWacloudSupabaseAdmin } from '@/lib/wacloud/supabase';
import { WACLOUD_CONFIG } from '@/lib/wacloud/config';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const instanceId = params.id;
    let instance: any = null;

    // 1. Tenta buscar no NocoDB
    try {
      instance = await getWacloudInstanciaByIdOrName(instanceId);
    } catch (nocoErr) {
      console.warn("Aviso ao buscar instância no NocoDB:", nocoErr);
    }

    // 2. Fallback Supabase
    if (!instance?.token) {
      const supabase = getWacloudSupabaseAdmin();
      const { data: sbInst } = await supabase
        .from('wacloud_instancias')
        .select('token')
        .eq('id', instanceId)
        .single();
      instance = sbInst;
    }

    if (!instance?.token) {
      return NextResponse.json({ error: 'Instância não encontrada ou sem token' }, { status: 404 });
    }

    // Fazer GET para Uazapi para pegar status
    const res = await fetch(`${WACLOUD_CONFIG.uazapiBaseUrl}/instance/status`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "token": instance.token
      }
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API status instance error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
