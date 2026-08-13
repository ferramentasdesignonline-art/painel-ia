import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

import { getActiveClientConfig } from '@/lib/auth/helpers';

export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get('leadId');
  if (!leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 });

  const cliente = await getActiveClientConfig(supabase);

  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });

  const { data: historico, error } = await supabase
    .from('sistema-dash-ia_lead_historico')
    .select('*')
    .eq('cliente_id', cliente.id)
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.message?.includes('does not exist')) {
      return NextResponse.json({ historico: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ historico });
}
