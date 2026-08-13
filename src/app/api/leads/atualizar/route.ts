import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getActiveClientConfig } from "@/lib/auth/helpers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const supabaseSession = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const clientConfig = await getActiveClientConfig(supabaseSession);
    if (!clientConfig) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: { session } } = await supabaseSession.auth.getSession();
    const emailPrefix = session?.user?.email?.split('@')[0] || 'Vendedor';

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

    if (origem === 'manual') {
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
    } else {
      // IA Lead
      const { data: old } = await supabaseAdmin
        .from(clientConfig.tabela_leads)
        .select('nome, veiculo_interessado')
        .eq('id', leadId)
        .single();
      oldLead = old;

      // Recupera etapa do IA Lead apenas para o constraint de histórico
      const { data: pos } = await supabaseAdmin
        .from('sistema-dash-ia_lead_posicoes')
        .select('etapa_id')
        .eq('cliente_id', clientConfig.id)
        .eq('lead_id', leadId)
        .single();
      
      if (oldLead) oldLead.etapa_id = pos?.etapa_id;

      const payload = { ...novasInformacoes };
      if ('data_agendamento' in payload) {
        if (payload.data_agendamento) {
          const d = new Date(payload.data_agendamento);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          payload.data_agendamento_visita = `${yyyy}-${mm}-${dd}`;
          
          const hh = String(d.getHours()).padStart(2, '0');
          const min = String(d.getMinutes()).padStart(2, '0');
          payload.horario_agendamento_visita = `${hh}:${min}`;
        } else {
          payload.data_agendamento_visita = null;
          payload.horario_agendamento_visita = null;
        }
        delete payload.data_agendamento;
      }

      const { error } = await supabaseAdmin
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
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("Lead Update Error", err);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
