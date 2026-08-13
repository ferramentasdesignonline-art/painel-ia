import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function PUT(request: Request) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { etapas } = await request.json(); // Array de { id, ordem }
  if (!etapas || !Array.isArray(etapas)) {
    return NextResponse.json({ error: 'Array de etapas é obrigatório' }, { status: 400 });
  }

  const { createClient: createSupabaseAdmin } = require('@supabase/supabase-js');
  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Update em lote (loop)
  for (const { id, ordem } of etapas) {
    await supabaseAdmin
      .from('sistema-dash-ia_etapas_funil')
      .update({ ordem })
      .eq('id', id);
  }

  return NextResponse.json({ success: true });
}
