import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getActiveClientConfig } from '@/lib/auth/helpers';

function findMatchingEtiquetaForEtapa(
  etapa: { nome: string; tipo: string },
  labels: Array<{ id: string; labelid?: string; name: string }>
) {
  const t = (etapa.tipo || '').toLowerCase();
  const n = (etapa.nome || '').toLowerCase();

  const findLbl = (predicate: (name: string) => boolean) => {
    return labels.find(l => predicate((l.name || '').toLowerCase()));
  };

  // 1. Visita Agendada / Confirmada
  if (t === 'visita_confirmada' || t === 'visita_agendada' || n.includes('visita')) {
    return findLbl(name => name.includes('visita - agendada') || name.includes('visita agendada') || (name.includes('visita') && !name.includes('realizada')));
  }

  // 2. Visita Realizada
  if (t === 'visita_realizada' || (n.includes('visita') && n.includes('realizada'))) {
    return findLbl(name => name.includes('visita - realizada') || name.includes('visita realizada'));
  }

  // 3. Simulação Aprovada / Qualificado / Oportunidade
  if (
    t === 'simulacao_aprovada' ||
    t === 'simulacao_pre_aprovada' ||
    t === 'ia_qualificado' ||
    t === 'oportunidade' ||
    n.includes('aprovada') ||
    n.includes('qualificado') ||
    n.includes('oportunidade')
  ) {
    return findLbl(name => name.includes('oportunidade') || name.includes('ficha aprovada'));
  }

  // 4. Simulação Reprovada / Ficha Reprovada
  if (t === 'simulacao_reprovada' || t === 'ficha_reprovada' || n.includes('reprovad')) {
    return findLbl(name => name.includes('reprovad'));
  }

  // 5. Perda / Perdido Desqualificado / Perdido Qualificado
  if (t === 'ia_perda' || t === 'perdido_desqualificado' || t === 'perdido_qualificado' || n.includes('perda') || n.includes('perdido')) {
    if (n.includes('qualificado') && !n.includes('desqualificado')) {
      return (
        findLbl(name => name.includes('perdido | qualificado') || name.includes('perdido qualificado')) ||
        findLbl(name => name.includes('perdido') || name.includes('desqualificado'))
      );
    }
    return findLbl(name => name.includes('perdido') || name.includes('desqualificado') || name.includes('sem resposta'));
  }

  // 6. Em andamento / Sem contato / Follow-up / Em atendimento
  if (
    t === 'ia_em_andamento' ||
    t === 'ia_sem_contato' ||
    t === 'ia_followup' ||
    t === 'em_atendimento' ||
    n.includes('andamento') ||
    n.includes('contato') ||
    n.includes('atendimento') ||
    n.includes('follow')
  ) {
    return findLbl(name => name.includes('em atendimento') || name.includes('recontratar') || name.includes('recontatar'));
  }

  // 7. Cliente / Fechado / Ganho
  if (t === 'cliente' || n.includes('cliente') || n.includes('venda') || n.includes('fechado')) {
    return findLbl(name => name === 'cliente' || name.startsWith('cliente'));
  }

  return undefined;
}

export async function PUT(request: Request) {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { lead_id, etapa_id, origem } = await request.json();
    console.log('Mover lead:', { lead_id, etapa_id, origem });

    const cliente = await getActiveClientConfig(supabase);
    if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    if (origem === 'manual') {
      const { error } = await supabaseAdmin
        .from('sistema-dash-ia_leads_manuais')
        .update({ etapa_id, updated_at: new Date().toISOString() })
        .eq('id', lead_id)
        .eq('cliente_id', cliente.id);

      if (error) {
        console.error('Erro ao mover lead manual:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    // Lead da IA / wacloud
    const { data: etapaDestino } = await supabaseAdmin
      .from('sistema-dash-ia_etapas_funil')
      .select('nome, tipo')
      .eq('id', etapa_id)
      .maybeSingle();

    if (!etapaDestino) {
      return NextResponse.json({ error: 'Etapa de destino não encontrada' }, { status: 404 });
    }

    const { getWacloudSupabaseAdmin } = await import('@/lib/wacloud/supabase');
    const { WACLOUD_CONFIG } = await import('@/lib/wacloud/config');
    const { fetchUazapiLabels } = await import('@/lib/wacloud/uazapi');
    const wacloudAdmin = getWacloudSupabaseAdmin();

    const normalizeStr = (str: string) =>
      (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    const nomeNorm = normalizeStr(cliente.nome);
    const slugNorm = normalizeStr(cliente.slug || '');
    const instConfigNorm = normalizeStr(cliente.nome_instancia || cliente.whatsapp_instancia || '');

    const { data: instancias } = await wacloudAdmin
      .from('wacloud_instancias')
      .select('id, nome_instancia, token')
      .limit(50);

    let instanciaMatch = instConfigNorm
      ? instancias?.find(i => normalizeStr(i.nome_instancia) === instConfigNorm)
      : null;

    if (!instanciaMatch) {
      instanciaMatch = instancias?.find(i => {
        const instNorm = normalizeStr(i.nome_instancia);
        return instNorm === nomeNorm || instNorm === slugNorm;
      });
    }

    if (!instanciaMatch) {
      instanciaMatch = instancias?.find(i => {
        const instNorm = normalizeStr(i.nome_instancia);
        return instNorm.includes(nomeNorm) || nomeNorm.includes(instNorm);
      });
    }

    const token = instanciaMatch?.token || cliente.whatsapp_token;
    const nomeInstancia = instanciaMatch?.nome_instancia || cliente.nome_instancia || cliente.whatsapp_instancia;
    const isSemIA = cliente.tipo_atendimento === 'sem_ia' || !cliente.tabela_leads;

    let rawPhone = '';
    let currentLabels: string[] = [];

    // Localizar contato e telefone
    if (isSemIA) {
      const { data: contatoRow } = await wacloudAdmin
        .from('wacloud_contatos')
        .select('id, telefone_contato, whatsapp_labels')
        .eq('id', lead_id)
        .maybeSingle();

      if (contatoRow) {
        rawPhone = String(contatoRow.telefone_contato || '').replace(/@.*$/, '').replace(/\D/g, '');
        if (Array.isArray(contatoRow.whatsapp_labels)) {
          currentLabels = contatoRow.whatsapp_labels.map((l: any) => String(l).includes(':') ? String(l).split(':')[1] : String(l));
        }
      }
    } else if (cliente.tabela_leads) {
      const clientDb = createAdminClient(
        cliente.supabase_url || process.env.NEXT_PUBLIC_SUPABASE_URL!,
        cliente.supabase_service_role_key || process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      const { data: leadRow } = await clientDb
        .from(cliente.tabela_leads)
        .select('id, telefone, whatsapp_labels')
        .eq('id', lead_id)
        .maybeSingle();

      if (leadRow) {
        rawPhone = String(leadRow.telefone || '').replace(/\D/g, '');
        if (Array.isArray(leadRow.whatsapp_labels)) {
          currentLabels = leadRow.whatsapp_labels.map((l: any) => String(l).includes(':') ? String(l).split(':')[1] : String(l));
        }
      }
    }

    // Se temos instância e token, sincronizar a etiqueta da etapa no WhatsApp
    let finalLabels = [...currentLabels];
    if (token) {
      try {
        const uazapiLabels = await fetchUazapiLabels(token);

        // Se puder, consulta o chat na Uazapi para ter o estado mais fiel
        if (rawPhone) {
          try {
            const uazRes = await fetch(`${WACLOUD_CONFIG.uazapiBaseUrl}/chat/find`, {
              method: 'POST',
              headers: { Accept: 'application/json', 'Content-Type': 'application/json', token },
              body: JSON.stringify({ wa_chatid: `${rawPhone}@s.whatsapp.net` })
            });
            const uazData = await uazRes.json();
            const chat = uazData.chats?.[0];
            if (chat && Array.isArray(chat.wa_label)) {
              currentLabels = chat.wa_label.map((l: any) => String(l).includes(':') ? String(l).split(':')[1] : String(l));
            }
          } catch (e) {
            // fallback para banco
          }
        }

        const isStageLabel = (labelName: string) => {
          const n = (labelName || '').toLowerCase();
          if (n.startsWith('canal')) return false;
          return (
            n.includes('em atendimento') ||
            n.includes('recontratar') ||
            n.includes('recontatar') ||
            n.includes('oportunidade') ||
            n.includes('ficha aprovada') ||
            n.includes('visita') ||
            n.includes('ficha reprovada') ||
            n.includes('reprovad') ||
            n.includes('perdido') ||
            n.includes('desqualificado') ||
            n === 'cliente' ||
            n.startsWith('cliente')
          );
        };

        const stageLabelIds = new Set(
          (uazapiLabels || [])
            .filter(l => isStageLabel(l.name))
            .map(l => {
              const s = String(l.labelid || l.id);
              return s.includes(':') ? s.split(':')[1] : s;
            })
        );

        const targetLabel = findMatchingEtiquetaForEtapa(etapaDestino, uazapiLabels || []);
        if (targetLabel) {
          const cleanTargetId = String(targetLabel.labelid || targetLabel.id).includes(':')
            ? String(targetLabel.labelid || targetLabel.id).split(':')[1]
            : String(targetLabel.labelid || targetLabel.id);

          // Remove qualquer etiqueta de etapa anterior, mantendo canais e etiquetas personalizadas (ex: vendedores)
          const setLabels = new Set(currentLabels.filter(id => !stageLabelIds.has(id)));
          setLabels.add(cleanTargetId);
          finalLabels = Array.from(setLabels);

          // Atualiza na Uazapi
          if (rawPhone) {
            await fetch(`${WACLOUD_CONFIG.uazapiBaseUrl}/chat/labels`, {
              method: 'POST',
              headers: { Accept: 'application/json', 'Content-Type': 'application/json', token },
              body: JSON.stringify({ number: rawPhone, labelids: finalLabels })
            });
          }
        }
      } catch (labelErr) {
        console.warn('Erro ao sincronizar etiqueta de etapa no WhatsApp:', labelErr);
      }
    }

    // Atualizar no banco correto
    const dbEtapaTipo = etapaDestino.tipo || '';
    const updateFlags: any = {
      whatsapp_labels: finalLabels,
      lead_visita_confirmada: dbEtapaTipo === 'visita_confirmada' || dbEtapaTipo === 'visita_agendada',
      lead_simulacao_pre_aprovada: dbEtapaTipo === 'simulacao_pre_aprovada',
      lead_simulacao_aprovada: dbEtapaTipo === 'simulacao_aprovada' || dbEtapaTipo === 'oportunidade',
      lead_simulacao_reprovada: dbEtapaTipo === 'simulacao_reprovada' || dbEtapaTipo === 'ficha_reprovada',
      atualizado_em: new Date().toISOString(),
    };

    if (dbEtapaTipo === 'ia_qualificado' || dbEtapaTipo === 'oportunidade' || dbEtapaTipo === 'visita_confirmada' || dbEtapaTipo === 'simulacao_aprovada') {
      updateFlags.lead_finalizado = true;
    } else {
      updateFlags.lead_finalizado = false;
    }

    if (isSemIA) {
      await wacloudAdmin
        .from('wacloud_contatos')
        .update(updateFlags)
        .eq('id', lead_id);
    } else if (cliente.tabela_leads) {
      const clientDb = createAdminClient(
        cliente.supabase_url || process.env.NEXT_PUBLIC_SUPABASE_URL!,
        cliente.supabase_service_role_key || process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      updateFlags.update_lead = new Date().toISOString();
      await clientDb
        .from(cliente.tabela_leads)
        .update(updateFlags)
        .eq('id', lead_id);
    }

    // Registrar no histórico
    await supabaseAdmin
      .from('sistema-dash-ia_lead_historico')
      .insert({
        cliente_id: cliente.id,
        lead_id: lead_id.toString(),
        tipo_lead: origem,
        etapa_origem_id: null,
        etapa_destino_id: etapa_id,
        vendedor_nome: session.user.email?.split('@')[0] || 'Vendedor',
        evento: 'move',
        descricao: `Lead movido para: ${etapaDestino.nome}`,
        created_at: new Date().toISOString()
      });

    return NextResponse.json({ success: true, whatsapp_labels: finalLabels, etapa_id });
  } catch (err: any) {
    console.error('Erro geral em PUT /api/funil/leads/mover:', err);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
