import { NextResponse } from 'next/server';
import { getActiveClientConfig } from '@/lib/auth/helpers';
import { getNocoDBLeadHistorico } from '@/lib/nocodb/sistema';

export async function GET(request: Request) {
  const cliente = await getActiveClientConfig();
  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado ou sem permissão' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get('leadId');
  if (!leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 });

  // 1. Tenta buscar no NocoDB
  try {
    const cleanLeadId = leadId.startsWith('ia-') ? leadId.replace('ia-', '') : (leadId.startsWith('manual-') ? leadId.replace('manual-', '') : leadId);
    const historico = await getNocoDBLeadHistorico(cliente.id, cleanLeadId);
    if (historico && historico.length > 0) {
      return NextResponse.json({ historico });
    }
  } catch (nocoErr) {
    console.warn("Aviso ao buscar histórico no NocoDB:", nocoErr);
  }

  // 2. Fallback Supabase
  try {
    const { createClient: createSupabaseAdmin } = require('@supabase/supabase-js');
    const supabaseAdmin = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: historico, error } = await supabaseAdmin
      .from('sistema-dash-ia_lead_historico')
      .select('*')
      .eq('cliente_id', cliente.id)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    return NextResponse.json({ historico: historico || [] });
  } catch (sbErr) {
    return NextResponse.json({ historico: [] });
  }
}
