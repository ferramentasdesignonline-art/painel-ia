import { NextResponse } from 'next/server';
import { getActiveClientConfig, getUserRole } from '@/lib/auth/helpers';
import { addNocoDBLeadHistorico } from '@/lib/nocodb/sistema';

export async function POST(request: Request) {
  const { user } = await getUserRole();
  const cliente = await getActiveClientConfig();
  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado ou sem permissão' }, { status: 401 });

  try {
    const { leadId, conteudo, origem } = await request.json();

    if (!leadId || !conteudo) {
      return NextResponse.json({ error: 'Faltam dados obrigatórios' }, { status: 400 });
    }

    const vendedorNome = user?.email?.split('@')[0] || user?.nome || 'Vendedor';
    const cleanLeadId = leadId.toString().startsWith('ia-') ? leadId.toString().replace('ia-', '') : leadId.toString();

    // 1. Salvar no NocoDB
    try {
      await addNocoDBLeadHistorico({
        cliente_id: cliente.id,
        lead_id: cleanLeadId,
        tipo_lead: origem || 'ia',
        vendedor_nome: vendedorNome,
        evento: 'note',
        descricao: conteudo,
      });
    } catch (nocoErr) {
      console.warn("Aviso ao salvar nota de histórico no NocoDB:", nocoErr);
    }

    // 2. Sincronizar no Supabase se aplicável
    try {
      const { createClient: createSupabaseAdmin } = require('@supabase/supabase-js');
      const supabaseAdmin = createSupabaseAdmin(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      await supabaseAdmin
        .from('sistema-dash-ia_lead_historico')
        .insert({
          cliente_id: cliente.id,
          lead_id: cleanLeadId,
          tipo_lead: origem || 'ia',
          etapa_origem_id: null,
          etapa_destino_id: null,
          vendedor_nome: vendedorNome,
          evento: 'note',
          descricao: conteudo,
          created_at: new Date().toISOString()
        });
    } catch (sbErr) {
      // Ignora erro se não sincronizar
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err: any) {
    console.error('Erro interno ao salvar historico:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
