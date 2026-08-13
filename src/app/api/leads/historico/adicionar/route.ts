import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getActiveClientConfig } from '@/lib/auth/helpers';

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { leadId, conteudo, origem } = await request.json();

    if (!leadId || !conteudo) {
      return NextResponse.json({ error: 'Faltam dados obrigatórios' }, { status: 400 });
    }

    const cliente = await getActiveClientConfig(supabase);

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    const emailPrefix = session.user.email?.split('@')[0] || 'Vendedor';

    // Para evitar o erro de NOT NULL nas colunas de etapa, buscamos a etapa atual do lead
    let etapaAtualId = null;
    if (origem === 'ia') {
      const { data: pos } = await supabase
        .from('sistema-dash-ia_lead_posicoes')
        .select('etapa_id')
        .eq('cliente_id', cliente.id)
        .eq('lead_id', Number(leadId))
        .single();
      etapaAtualId = pos?.etapa_id;
    } else {
      const { data: mn } = await supabase
        .from('sistema-dash-ia_leads_manuais')
        .select('etapa_id')
        .eq('id', leadId)
        .single();
      etapaAtualId = mn?.etapa_id;
    }

    const { createClient: createSupabaseAdmin } = require('@supabase/supabase-js');
    const supabaseAdmin = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error: insertError } = await supabaseAdmin
      .from('sistema-dash-ia_lead_historico')
      .insert({
        cliente_id: cliente.id,
        lead_id: leadId.toString(),
        tipo_lead: origem || 'ia',
        etapa_origem_id: etapaAtualId,
        etapa_destino_id: etapaAtualId,
        vendedor_nome: emailPrefix,
        evento: 'note',
        descricao: conteudo,
        created_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Erro ao salvar nota no histórico:', insertError);
      return NextResponse.json({ error: 'Erro ao salvar a nota' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err: any) {
    console.error('Erro interno ao salvar historico:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
