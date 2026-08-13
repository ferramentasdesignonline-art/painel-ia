import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// PUT: salvar nova ordem das etapas após drag-and-drop
export async function PUT(request: Request) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { etapas_ordenadas } = await request.json();
  // etapas_ordenadas: [{ id: uuid, ordem: number }, ...]

  const updates = etapas_ordenadas.map(({ id, ordem }: { id: string; ordem: number }) =>
    supabase.from('sistema-dash-ia_etapas_funil').update({ ordem }).eq('id', id)
  );

  const results = await Promise.all(updates);
  const errors = results.filter(r => r.error).map(r => r.error);

  if (errors.length > 0) {
    return NextResponse.json({ error: 'Erro ao reordenar uma ou mais etapas', details: errors }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
