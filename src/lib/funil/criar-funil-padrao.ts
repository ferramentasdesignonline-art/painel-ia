import { SupabaseClient } from '@supabase/supabase-js';

export async function criarFunilPadrao(clienteId: string, supabaseClient: SupabaseClient) {
  // Cria cliente admin para burlar o RLS na inicialização do funil
  const { createClient: createSupabaseAdmin } = require('@supabase/supabase-js');
  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // 1. Criar o funil principal
  const { data: funil, error: funilError } = await supabaseAdmin
    .from('sistema-dash-ia_funis')
    .insert({ cliente_id: clienteId, nome: 'Funil Principal' })
    .select()
    .single();

  if (funilError) {
    console.error('Erro ao criar funil padrão:', funilError);
    return null;
  }

  // 2. Criar etapas automáticas da IA (ordem fixa)
  const etapasIA = [
    { nome: 'Sem contato',  cor: '#94a3b8', ordem: 1, tipo: 'ia_sem_contato' },
    { nome: 'Em andamento', cor: '#6366f1', ordem: 2, tipo: 'ia_em_andamento' },
    { nome: 'Follow-up',    cor: '#f97316', ordem: 3, tipo: 'ia_followup' },
    { nome: 'Qualificado',  cor: '#10b981', ordem: 4, tipo: 'ia_qualificado' },
    { nome: 'Visita Confirmada', cor: '#3b82f6', ordem: 5, tipo: 'manual' },
    { nome: 'Simulação Pré-Aprovada', cor: '#eab308', ordem: 6, tipo: 'manual' },
    { nome: 'Simulação Aprovada',     cor: '#22c55e', ordem: 7, tipo: 'manual' },
    { nome: 'Simulação Reprovada',    cor: '#ef4444', ordem: 8, tipo: 'manual' },
    { nome: 'Perda',        cor: '#9ca3af', ordem: 9, tipo: 'ia_perda' },
  ];

  const { error: etapasError } = await supabaseAdmin
    .from('sistema-dash-ia_etapas_funil')
    .insert(
      etapasIA.map(e => ({ ...e, funil_id: funil.id }))
    );

  if (etapasError) {
    console.error('Erro ao criar etapas padrão:', etapasError);
  }

  return funil;
}
