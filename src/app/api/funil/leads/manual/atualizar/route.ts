import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function PUT(request: Request) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { lead_id, notas, origem } = await request.json();

  if (origem === 'manual') {
    const { error } = await supabase
      .from('sistema-dash-ia_leads_manuais')
      .update({ notas, updated_at: new Date().toISOString() })
      .eq('id', lead_id);
    
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    // Para leads da IA, podemos salvar notas na tabela de posições ou em uma tabela de metadados dedicada
    // Por simplicidade neste momento, salvaremos na tabela de posições (que funciona como um registro do CRM para o lead)
    const { data: cliente } = await supabase
      .from('sistema-dash-ia_clientes')
      .select('id')
      .eq('email', session.user.email)
      .single();

    if (cliente) {
      await supabase
        .from('sistema-dash-ia_lead_posicoes')
        .upsert({
          cliente_id: cliente.id,
          lead_id: Number(lead_id),
          notas,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'cliente_id, lead_id'
        });
    }
  }

  return NextResponse.json({ success: true });
}
