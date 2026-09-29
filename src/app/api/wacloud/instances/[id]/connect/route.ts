import { NextResponse } from 'next/server';
import { getWacloudSupabaseAdmin } from '@/lib/wacloud/supabase';
import { WACLOUD_CONFIG } from '@/lib/wacloud/config';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const instanceId = params.id;
    const supabase = getWacloudSupabaseAdmin();
    
    // Buscar a instância para pegar o token
    const { data: instance, error } = await supabase
      .from('wacloud_instancias')
      .select('token')
      .eq('id', instanceId)
      .single();

    if (error || !instance?.token) {
      return NextResponse.json({ error: 'Instância não encontrada ou sem token' }, { status: 404 });
    }

    // Fazer POST para Uazapi para conectar e pegar QR Code
    const res = await fetch(`${WACLOUD_CONFIG.uazapiBaseUrl}/instance/connect`, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "token": instance.token
      }
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API connect instance error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
