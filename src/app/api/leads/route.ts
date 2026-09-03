import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { getActiveClientConfig } from "@/lib/auth/helpers"
import { getClientLeads } from "@/lib/supabase/queries"

export async function GET(request: Request) {
  try {
    const cookieStore = cookies()
    // 1. Instanciamos o client "normal" apenas para ler os cookies e session do Auth
    const supabaseSession = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // 2. Obtemos qual a configuração do cliente ativo (descobre se é admin impersonando ou cliente)
    const clientConfig = await getActiveClientConfig(supabaseSession)
    
    if (!clientConfig) {
      return NextResponse.json({ error: "Unauthorized or no client config found" }, { status: 401 })
    }

    // 3. Instanciamos um client com a SERVICE ROLE KEY, porque as tabelas dinâmicas
    // podem não ter políticas RLS amigáveis configuradas, sendo o backend a ponte segura.
    const supabaseAdmin = createClient(clientConfig.supabase_url || process.env.NEXT_PUBLIC_SUPABASE_URL!, clientConfig.supabase_service_role_key || process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // 4. Busca os dados IA
    const leadsIA = await getClientLeads(supabaseAdmin, clientConfig.tabela_leads)

    // 5. Busca leads manuais
    const { data: leadsManuais } = await supabaseAdmin
      .from('sistema-dash-ia_leads_manuais')
      .select('*, etapa:etapa_id(nome)')
      .eq('cliente_id', clientConfig.id);

    // Formata leads manuais para padrão compatível com a UI
    const manuaisFormatados = (leadsManuais || []).map(lead => {
      const etapaNome = lead.etapa?.nome || 'Lead Manual';
      const isQualificado = etapaNome.toLowerCase() === 'qualificado';
      return {
        ...lead,
        // Se tivermos um identificador especial como 'manual-', ele será util na UI
        original_id: lead.id,
        id: `manual-${lead.id}`,
        origem: 'manual',
        etapa_manual_nome: etapaNome,
        lead_finalizado: isQualificado ? true : lead.lead_finalizado,
      };
    });

    // Formata leads IA para garantir mesmo padrão q usamos no funil
    const iaFormatados = (leadsIA || []).map((lead: any) => {
      let data_agendamento = lead.data_agendamento || null;
      if (lead.data_agendamento_visita) {
        const dateStr = String(lead.data_agendamento_visita).trim();
        const timeStr = lead.horario_agendamento_visita || '00:00';
        let day = 1;
        let month = 1;
        let year = new Date().getFullYear();
        let parsedOk = false;

        if (dateStr.includes('/')) {
          const parts = dateStr.split('/');
          if (parts.length >= 2) {
            day = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1; // 0-based
            if (parts.length >= 3) {
              year = parseInt(parts[2], 10);
              if (year < 100) year += 2000;
            }
            parsedOk = true;
          }
        } else if (dateStr.includes('-')) {
          const parts = dateStr.split('-');
          if (parts.length === 3) {
            if (parts[0].length === 4) {
              year = parseInt(parts[0], 10);
              month = parseInt(parts[1], 10) - 1;
              day = parseInt(parts[2], 10);
              parsedOk = true;
            } else {
              day = parseInt(parts[0], 10);
              month = parseInt(parts[1], 10) - 1;
              year = parseInt(parts[2], 10);
              if (year < 100) year += 2000;
              parsedOk = true;
            }
          }
        }

        if (parsedOk) {
          let hh = 0;
          let mm = 0;
          const timeParts = timeStr.split(':');
          if (timeParts.length >= 2) {
            hh = parseInt(timeParts[0], 10);
            mm = parseInt(timeParts[1], 10);
          }
          try {
            data_agendamento = new Date(year, month, day, hh, mm).toISOString();
          } catch (e) {
            data_agendamento = `${dateStr} ${timeStr}`;
          }
        } else {
          try {
            data_agendamento = new Date(`${dateStr}T${timeStr}:00`).toISOString();
          } catch (e) {
            data_agendamento = `${dateStr} ${timeStr}`;
          }
        }
      }
      return {
        ...lead,
        data_agendamento,
        original_id: lead.id,
        id: `ia-${lead.id}`,
        origem: 'ia'
      };
    });

    const todosLeads = [...iaFormatados, ...manuaisFormatados];

    // Ordena todos por data de criação mais recente
    todosLeads.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ data: todosLeads }, { status: 200 })
  } catch (error) {
    console.error("Leads API Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
