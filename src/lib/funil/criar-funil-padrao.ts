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
    .insert({ cliente_id: clienteId, nome: 'Funil Principal', meta_followup: 5 })
    .select()
    .single();

  if (funilError) {
    console.error('Erro ao criar funil padrão:', funilError);
    return null;
  }

  // 2. Criar etapas automáticas padronizadas (8 etapas oficiais)
  const etapasPadrao = [
    { nome: 'Em atendimento | Recontratar', cor: '#6366f1', ordem: 1, tipo: 'em_atendimento' },
    { nome: 'Visita - Agendada', cor: '#fed428', ordem: 2, tipo: 'visita_agendada' },
    { nome: 'Visita - Realizada', cor: '#9ab6c1', ordem: 3, tipo: 'visita_realizada' },
    { nome: 'Oportunidade - Ficha Aprovada | Troca | Entrada', cor: '#56ccb4', ordem: 4, tipo: 'oportunidade' },
    { nome: 'Ficha Reprovada', cor: '#ffc5c7', ordem: 5, tipo: 'ficha_reprovada' },
    { nome: 'Perdido | Qualificado', cor: '#9568cf', ordem: 6, tipo: 'perdido_qualificado' },
    { nome: 'Perdido | Desqualificado | Sem resposta', cor: '#83e421', ordem: 7, tipo: 'perdido_desqualificado' },
    { nome: 'Cliente', cor: '#64c4ff', ordem: 8, tipo: 'cliente' },
  ];

  const { error: etapasError } = await supabaseAdmin
    .from('sistema-dash-ia_etapas_funil')
    .insert(
      etapasPadrao.map(e => ({ ...e, funil_id: funil.id }))
    );

  if (etapasError) {
    console.error('Erro ao criar etapas padrão:', etapasError);
  }

  return funil;
}
