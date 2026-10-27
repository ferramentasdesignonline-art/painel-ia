import { NextResponse } from 'next/server';
import { getWacloudInstanciaByIdOrName, updateWacloudContato } from '@/lib/nocodb/wacloud';
import { getWacloudSupabaseAdmin } from '@/lib/wacloud/supabase';
import { WACLOUD_CONFIG } from '@/lib/wacloud/config';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { number, labelids } = body;

    if (!number || !Array.isArray(labelids)) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    }

    let instance = await getWacloudInstanciaByIdOrName(params.id);
    if (!instance?.token) {
      const supabase = getWacloudSupabaseAdmin();
      const { data: sbInst } = await supabase
        .from('wacloud_instancias')
        .select('id, token, nome_instancia, cliente_id')
        .eq('id', params.id)
        .single();
      instance = sbInst;
    }

    if (!instance?.token) {
      return NextResponse.json({ error: 'Instância não encontrada ou sem token' }, { status: 404 });
    }

    // Chama a Uazapi para atualizar as etiquetas
    const res = await fetch(`${WACLOUD_CONFIG.uazapiBaseUrl}/chat/labels`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'token': instance.token,
      },
      body: JSON.stringify({ number, labelids }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json({ error: 'Falha na Uazapi: ' + JSON.stringify(data) }, { status: res.status });
    }

    // 2. Atualizar no banco correto:
    // Se for cliente com IA, salva diretamente na tabela de leads do cliente!
    // Se for cliente sem IA (CRM), salva na tabela wacloud_contatos no NocoDB.
    try {
      const { getNocoDBClientes } = await import('@/lib/nocodb/sistema');
      let clients: any[] = [];
      try {
        clients = await getNocoDBClientes();
      } catch (nocoErr) {
        console.warn("Aviso ao buscar clientes no NocoDB em chat-labels:", nocoErr);
      }

      if (!clients || clients.length === 0) {
        const { createClient } = await import('@supabase/supabase-js');
        const sbMain = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        const { data: sbClients } = await sbMain.from('sistema-dash-ia_clientes').select('*');
        clients = sbClients || [];
      }

      const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const targetInst = norm(instance.nome_instancia);

      const client = clients?.find((c: any) => {
        if (instance.cliente_id && (c.id === instance.cliente_id || c.auth_user_id === instance.cliente_id)) return true;
        const ni = norm(c.nome_instancia);
        const n = norm(c.nome);
        const sl = norm(c.slug);
        return ni === targetInst || n === targetInst || sl === targetInst || targetInst.includes(n) || n.includes(targetInst);
      });

      if (client && client.tabela_leads) {
        const { createClient } = await import('@supabase/supabase-js');
        const clientDb = createClient(
          client.supabase_url || process.env.NEXT_PUBLIC_SUPABASE_URL!,
          client.supabase_service_role_key || process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const cleanNumber = String(number).replace(/\D/g, '');
        await clientDb
          .from(client.tabela_leads)
          .update({ whatsapp_labels: labelids })
          .ilike('telefone', `%${cleanNumber}%`);
      } else {
        // Atualiza no NocoDB (wacloud_contatos)
        try {
          await updateWacloudContato(number, instance.nome_instancia, {
            whatsapp_labels: labelids,
          });
        } catch (nocoCtErr) {
          console.warn("Aviso ao atualizar contato no NocoDB:", nocoCtErr);
        }

        // Sincroniza no Supabase
        try {
          const supabase = getWacloudSupabaseAdmin();
          await supabase
            .from('wacloud_contatos')
            .update({ whatsapp_labels: labelids, atualizado_em: new Date().toISOString() })
            .eq('nome_instancia', instance.nome_instancia)
            .eq('telefone_contato', number);
        } catch (sbErr) {
          // Ignora
        }
      }
    } catch (dbErr) {
      console.warn('Erro ao atualizar etiqueta no banco local:', dbErr);
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('Update labels error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
