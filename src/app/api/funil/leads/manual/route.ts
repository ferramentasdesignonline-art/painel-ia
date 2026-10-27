import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getActiveClientConfig, getUserRole } from '@/lib/auth/helpers';
import {
  createNocoDBLeadManual,
  addNocoDBLeadHistorico,
} from '@/lib/nocodb/sistema';

export async function POST(request: Request) {
  const { user } = await getUserRole();
  const cliente = await getActiveClientConfig();
  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado ou sem permissão' }, { status: 401 });

  const { nome, telefone, veiculo_interessado, notas, etapa_id, data_agendamento, observacao_lead_qualificado } = await request.json();

  if (!telefone) {
    return NextResponse.json({ error: 'Telefone é obrigatório' }, { status: 400 });
  }

  const vendedorNome = user?.email?.split('@')[0] || user?.nome || 'Vendedor';

  // 1. Criar no NocoDB
  let leadNoco: any = null;
  try {
    leadNoco = await createNocoDBLeadManual({
      cliente_id: cliente.id,
      nome,
      telefone,
      veiculo_interessado,
      notas,
      etapa_id,
    });

    if (leadNoco?.Id) {
      await addNocoDBLeadHistorico({
        cliente_id: cliente.id,
        lead_id: leadNoco.Id,
        tipo_lead: 'manual',
        etapa_origem_id: etapa_id,
        etapa_destino_id: etapa_id,
        vendedor_nome: vendedorNome,
        evento: 'create',
        descricao: 'Lead criado manualmente',
      });
    }
  } catch (nocoErr) {
    console.warn("Aviso ao criar lead manual no NocoDB:", nocoErr);
  }

  // 2. Sincronizar com Supabase se aplicável
  let leadSb: any = null;
  try {
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: lead, error } = await supabaseAdmin
      .from('sistema-dash-ia_leads_manuais')
      .insert({
        cliente_id: cliente.id,
        nome,
        telefone,
        veiculo_interessado,
        notas,
        etapa_id,
        data_agendamento: data_agendamento || null,
        observacao_lead_qualificado: observacao_lead_qualificado || null,
        created_by: user?.email || 'admin',
      })
      .select()
      .single();

    if (!error && lead) {
      leadSb = lead;
      try {
        await supabaseAdmin
          .from('sistema-dash-ia_lead_historico')
          .insert({
            cliente_id: cliente.id,
            lead_id: lead.id.toString(),
            tipo_lead: 'manual',
            etapa_origem_id: etapa_id,
            etapa_destino_id: etapa_id,
            vendedor_nome: vendedorNome,
            evento: 'create',
            descricao: 'Lead criado manualmente',
            created_at: new Date().toISOString()
          });
      } catch (hErr) {
        // Ignora
      }
    }
  } catch (sbErr) {
    console.warn("Aviso ao sincronizar lead manual no Supabase:", sbErr);
  }

  const finalLead = leadNoco || leadSb;
  if (!finalLead) {
    return NextResponse.json({ error: 'Erro ao criar lead manual' }, { status: 500 });
  }

  return NextResponse.json({ lead: finalLead });
}
