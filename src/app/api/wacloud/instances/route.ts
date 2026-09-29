import { NextResponse } from 'next/server';
import { getWacloudSupabaseAdmin } from '@/lib/wacloud/supabase';
import { WACLOUD_CONFIG } from '@/lib/wacloud/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getWacloudSupabaseAdmin();
    const { data: instances, error } = await supabase
      .from('wacloud_instancias')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching wacloud instances:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ instances });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { nome_instancia } = await request.json();

    if (!nome_instancia || nome_instancia.includes(' ')) {
      return NextResponse.json({ error: 'Nome inválido. Não use espaços.' }, { status: 400 });
    }

    // 1. Criar na Uazapi
    const uazapiRes = await fetch(`${WACLOUD_CONFIG.uazapiBaseUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'admintoken': WACLOUD_CONFIG.uazapiAdminToken
      },
      body: JSON.stringify({ name: nome_instancia })
    });

    const uazapiData = await uazapiRes.json();
    
    // Uazapi returns instance info in `instance` object usually, or an error.
    if (!uazapiRes.ok || !uazapiData?.instance?.name) {
      console.error('Uazapi create error:', uazapiData);
      return NextResponse.json({ error: 'Erro ao criar instância na Uazapi' }, { status: 500 });
    }

    const instanceToken = uazapiData.instance.token;

    const webhookRes = await fetch(`${WACLOUD_CONFIG.uazapiBaseUrl}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': instanceToken
      },
      body: JSON.stringify({
        enabled: true,
        url: WACLOUD_CONFIG.webhookUrl,
        events: ["messages"],
        excludeMessages: ["wasSentByApi", "isGroupYes"]
      })
    });
    const webhookData = await webhookRes.json().catch(() => null);
    if (!webhookRes.ok) {
      console.warn('Erro ao configurar webhook:', webhookData);
    }

    // 3. Salvar no Supabase
    const supabase = getWacloudSupabaseAdmin();
    const { error: dbError } = await supabase
      .from('wacloud_instancias')
      .insert({
        nome_instancia,
        status: 'criada',
        token: instanceToken
      });

    if (dbError) {
      console.error('Supabase insert error:', dbError);
      return NextResponse.json({ error: 'Erro ao salvar no banco de dados' }, { status: 500 });
    }

    return NextResponse.json({ success: true, instance: uazapiData.instance });
  } catch (error) {
    console.error('API create instance error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
