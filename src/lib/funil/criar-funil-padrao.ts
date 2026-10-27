import { SupabaseClient } from '@supabase/supabase-js';
import { criarFunilPadraoNocoDB } from '@/lib/nocodb/sistema';

export async function criarFunilPadrao(clienteId: string | number, supabaseClient?: SupabaseClient) {
  // 1. Cria funil e etapas padrão no NocoDB
  let nocoFunil: any = null;
  try {
    nocoFunil = await criarFunilPadraoNocoDB(clienteId);
  } catch (nocoErr) {
    console.warn('Aviso ao criar funil padrão no NocoDB:', nocoErr);
  }

  // 2. Se cliente Supabase fornecido ou variáveis de ambiente configuradas, sincroniza no Supabase
  try {
    const { createClient: createSupabaseAdmin } = require('@supabase/supabase-js');
    const supabaseAdmin = supabaseClient || createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: funil, error: funilError } = await supabaseAdmin
      .from('sistema-dash-ia_funis')
      .insert({ cliente_id: clienteId, nome: 'Funil Principal', meta_followup: 5 })
      .select()
      .single();

    if (!funilError && funil) {
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

      await supabaseAdmin
        .from('sistema-dash-ia_etapas_funil')
        .insert(
          etapasPadrao.map(e => ({ ...e, funil_id: funil.id }))
        );

      return funil;
    }
  } catch (sbErr) {
    console.warn('Aviso ao sincronizar funil padrão no Supabase:', sbErr);
  }

  return nocoFunil;
}
