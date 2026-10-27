import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getActiveClientConfig, getUserRole } from "@/lib/auth/helpers";
import { NextResponse } from "next/server";
import { isNocoDBClient, getNocoDBLeadById, updateNocoDBLead } from "@/lib/nocodb/service";
import { updateNocoDBLeadManual, addNocoDBLeadHistorico } from "@/lib/nocodb/sistema";

export async function POST(request: Request) {
  try {
    const { user } = await getUserRole();
    const clientConfig = await getActiveClientConfig();
    if (!clientConfig) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const emailPrefix = user?.email?.split('@')[0] || user?.nome || 'Vendedor';

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { leadId, origem, novasInformacoes } = await request.json();

    if (!leadId || !novasInformacoes || Object.keys(novasInformacoes).length === 0) {
      return NextResponse.json({ error: "Parâmetros insuficientes" }, { status: 400 });
    }

    let errorUpdate = null;
    let oldLead = null;

    const isSemIA = clientConfig.tipo_atendimento === 'sem_ia' || !clientConfig.tabela_leads;

    if (origem === 'manual') {
      try {
        await updateNocoDBLeadManual(leadId, novasInformacoes);
      } catch (nocoErr) {
        console.warn("Aviso ao atualizar lead manual no NocoDB:", nocoErr);
      }

      const { data: old } = await supabaseAdmin
        .from('sistema-dash-ia_leads_manuais')
        .select('nome, veiculo_interessado, etapa_id')
        .eq('id', leadId)
        .single();
      oldLead = old;

      const { error } = await supabaseAdmin
        .from('sistema-dash-ia_leads_manuais')
        .update(novasInformacoes)
        .eq('id', leadId);
      errorUpdate = error;
    } else if (isSemIA) {
      const { getWacloudSupabaseAdmin } = await import('@/lib/wacloud/supabase');
      const wacloudAdmin = getWacloudSupabaseAdmin();

      const { data: old } = await wacloudAdmin
        .from('wacloud_contatos')
        .select('*')
        .eq('id', leadId)
        .maybeSingle();
      oldLead = old ? { nome: old.nome_contato, veiculo_interessado: old.veiculo_interessado } : null;

      const payload: any = {};
      if (novasInformacoes.nome) payload.nome_contato = novasInformacoes.nome;
      if ('veiculo_interessado' in novasInformacoes) payload.veiculo_interessado = novasInformacoes.veiculo_interessado;
      if ('veiculo_troca' in novasInformacoes) payload.veiculo_troca = novasInformacoes.veiculo_troca;
      if ('observacao_lead_qualificado' in novasInformacoes) payload.observacao_lead_qualificado = novasInformacoes.observacao_lead_qualificado;
      if ('lead_simulacao_aprovada' in novasInformacoes) payload.lead_simulacao_aprovada = Boolean(novasInformacoes.lead_simulacao_aprovada);
      if ('lead_simulacao_reprovada' in novasInformacoes) payload.lead_simulacao_reprovada = Boolean(novasInformacoes.lead_simulacao_reprovada);
      if ('lead_visita_confirmada' in novasInformacoes) payload.lead_visita_confirmada = Boolean(novasInformacoes.lead_visita_confirmada);
      if ('email' in novasInformacoes) payload.email = novasInformacoes.email;
      if ('cpf_cnpj' in novasInformacoes) payload.cpf_cnpj = novasInformacoes.cpf_cnpj;
      if ('data_nascimento' in novasInformacoes) payload.data_nascimento = novasInformacoes.data_nascimento;
      if ('possui_cnh' in novasInformacoes) payload.possui_cnh = novasInformacoes.possui_cnh !== null && novasInformacoes.possui_cnh !== undefined ? Boolean(novasInformacoes.possui_cnh) : null;
      if ('endereco' in novasInformacoes) payload.endereco = novasInformacoes.endereco;
      if ('endereço' in novasInformacoes) payload.endereco = novasInformacoes['endereço'];
      if ('genero' in novasInformacoes) payload.genero = novasInformacoes.genero;
      if ('valor_entrada' in novasInformacoes) payload.valor_entrada = novasInformacoes.valor_entrada;

      if ('data_agendamento' in novasInformacoes) {
        if (novasInformacoes.data_agendamento) {
          const d = new Date(novasInformacoes.data_agendamento);
          const brasilStr = d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
          const parts = brasilStr.replace(',', '').split(' ');
          const dateParts = (parts[0] || '').split('/');
          const timeParts = (parts[1] || '').split(':');
          if (dateParts.length === 3) {
            payload.data_agendamento_visita = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
          }
          if (timeParts.length >= 2) {
            payload.horario_agendamento_visita = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;
          }
          payload.lead_visita_confirmada = true;
        } else {
          payload.data_agendamento_visita = null;
          payload.horario_agendamento_visita = null;
        }
      }

      payload.atualizado_em = new Date().toISOString();

      // 1. Atualizar no NocoDB (wacloud_contatos)
      try {
        const { updateWacloudContato } = await import('@/lib/nocodb/wacloud');
        await updateWacloudContato(leadId, clientConfig.nome_instancia || clientConfig.nome || '', payload);
      } catch (nocoUpErr) {
        console.warn("Aviso ao atualizar contato no NocoDB em leads/atualizar:", nocoUpErr);
      }

      // 2. Sincronizar no Supabase
      try {
        const { error } = await wacloudAdmin
          .from('wacloud_contatos')
          .update(payload)
          .eq('id', leadId);
        errorUpdate = error;
      } catch (sbErr) {
        // Ignora
      }
    } else if (isNocoDBClient(clientConfig)) {
      // IA Lead no NocoDB
      const cleanLeadId = leadId.toString().startsWith('ia-') ? leadId.toString().replace('ia-', '') : leadId;
      const old = await getNocoDBLeadById(clientConfig.tabela_leads, cleanLeadId);
      oldLead = old ? { nome: old.nome, veiculo_interessado: old.veiculo_interessado } : null;

      const payload = { ...novasInformacoes };
      if ('data_agendamento' in payload) {
        if (payload.data_agendamento) {
          const d = new Date(payload.data_agendamento);
          const brasilStr = d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
          const parts = brasilStr.replace(',', '').split(' ');
          const dateParts = (parts[0] || '').split('/');
          const timeParts = (parts[1] || '').split(':');
          if (dateParts.length === 3) {
            payload.data_agendamento_visita = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
          }
          if (timeParts.length >= 2) {
            payload.horario_agendamento_visita = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;
          }
        } else {
          payload.data_agendamento_visita = null;
          payload.horario_agendamento_visita = null;
        }
        delete payload.data_agendamento;
      }

      try {
        await updateNocoDBLead(clientConfig.tabela_leads, cleanLeadId, payload);
      } catch (errNoco: any) {
        errorUpdate = errNoco;
      }
    } else {
      // IA Lead (Supabase)
      const clientDb = createAdminClient(
        clientConfig.supabase_url || process.env.NEXT_PUBLIC_SUPABASE_URL!,
        clientConfig.supabase_service_role_key || process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      const { data: old } = await clientDb
        .from(clientConfig.tabela_leads)
        .select('nome, veiculo_interessado')
        .eq('id', leadId)
        .single();
      oldLead = old;

      const payload = { ...novasInformacoes };
      if ('data_agendamento' in payload) {
        if (payload.data_agendamento) {
          const d = new Date(payload.data_agendamento);
          const brasilStr = d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
          const parts = brasilStr.replace(',', '').split(' ');
          const dateParts = (parts[0] || '').split('/');
          const timeParts = (parts[1] || '').split(':');
          if (dateParts.length === 3) {
            payload.data_agendamento_visita = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
          }
          if (timeParts.length >= 2) {
            payload.horario_agendamento_visita = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;
          }
        } else {
          payload.data_agendamento_visita = null;
          payload.horario_agendamento_visita = null;
        }
        delete payload.data_agendamento;
      }

      const { error } = await clientDb
        .from(clientConfig.tabela_leads)
        .update(payload)
        .eq('id', leadId);
      errorUpdate = error;
    }

    if (errorUpdate) {
      console.error('Erro ao atualizar DB do lead', errorUpdate);
      return NextResponse.json({ error: "DB Update Failed" }, { status: 500 });
    }

    // Identifica o que mudou para o log da Timeline
    let mudancas = [];
    if (novasInformacoes.nome && novasInformacoes.nome !== oldLead?.nome) mudancas.push(`Nome alterado de '${oldLead?.nome || "Vazio"}' para '${novasInformacoes.nome}'`);
    if (novasInformacoes.veiculo_interessado && novasInformacoes.veiculo_interessado !== oldLead?.veiculo_interessado) mudancas.push(`Veículo alterado de '${oldLead?.veiculo_interessado || "Vazio"}' para '${novasInformacoes.veiculo_interessado}'`);

    if (mudancas.length > 0) {
      try {
        await addNocoDBLeadHistorico({
          cliente_id: clientConfig.id,
          lead_id: leadId.toString(),
          tipo_lead: origem || 'ia',
          etapa_origem_id: oldLead?.etapa_id || null,
          etapa_destino_id: oldLead?.etapa_id || null,
          vendedor_nome: emailPrefix,
          evento: 'update',
          descricao: mudancas.join(' | '),
        });
      } catch (nocoHistErr) {
        console.warn("Aviso ao salvar histórico no NocoDB:", nocoHistErr);
      }

      try {
        await supabaseAdmin
          .from('sistema-dash-ia_lead_historico')
          .insert({
            cliente_id: clientConfig.id,
            lead_id: leadId.toString(),
            tipo_lead: origem || 'ia',
            etapa_origem_id: oldLead?.etapa_id || null,
            etapa_destino_id: oldLead?.etapa_id || null,
            vendedor_nome: emailPrefix,
            evento: 'update',
            descricao: mudancas.join(' | '),
            created_at: new Date().toISOString()
          });
      } catch (histErr) {
        console.warn("Aviso ao salvar histórico:", histErr);
      }
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("Lead Update Error", err);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
