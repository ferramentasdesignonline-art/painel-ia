import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getActiveClientConfig } from '@/lib/auth/helpers';
import { isNocoDBClient, getNocoDBLeadById, updateNocoDBLead } from '@/lib/nocodb/service';

function findMatchingEtiquetaForEtapa(
  etapa: { nome: string; tipo: string },
  labels: Array<{ id: string; labelid?: string; name: string; owner?: string }>
) {
  const t = (etapa.tipo || '').toLowerCase();
  const n = (etapa.nome || '').toLowerCase().trim();

  const findLbl = (predicate: (name: string) => boolean) => {
    return labels.find(l => predicate((l.name || '').toLowerCase().trim()));
  };

  // 0. Prioridade absoluta: correspondência exata com o nome da etapa
  const exactMatch = findLbl(name => name === n);
  if (exactMatch) return exactMatch;

  // 1. Cliente (estrito para não colidir com 'CLIENTE AGENDADO')
  if (t === 'cliente' || n === 'cliente' || n === 'clientes') {
    return findLbl(name => name === 'cliente' || name === 'clientes');
  }

  // 2. Visita Realizada
  if (t === 'visita_realizada' || (n.includes('visita') && n.includes('realizada'))) {
    return findLbl(name => name.includes('visita - realizada') || name.includes('visita realizada'));
  }

  // 3. Visita Agendada
  if (t === 'visita_agendada' || t === 'visita_confirmada' || (n.includes('visita') && n.includes('agendada')) || n === 'visita confirmada') {
    return findLbl(name => name.includes('visita - agendada') || name.includes('visita agendada')) ||
           findLbl(name => name.includes('cliente agendado')) ||
           findLbl(name => name.includes('visita') && !name.includes('realizada'));
  }

  // 4. Perdido Qualificado (verificado ANTES de oportunidade/qualificado)
  if (t === 'perdido_qualificado' || (n.includes('perdido') && n.includes('qualificado') && !n.includes('desqualificado'))) {
    return findLbl(name => name.includes('perdido | qualificado') || name.includes('perdido qualificado'));
  }

  // 5. Perdido Desqualificado / Perda (verificado ANTES de oportunidade)
  if (t === 'perdido_desqualificado' || t === 'ia_perda' || n.includes('desqualificado') || n.includes('sem resposta') || n === 'perda') {
    return findLbl(name => name.includes('perdido | desqualificado') || name.includes('desqualificado') || name.includes('sem resposta')) ||
           findLbl(name => name.includes('desistiu')) ||
           findLbl(name => name.includes('perdido'));
  }

  // 6. Ficha Reprovada / Simulação Reprovada
  if (t === 'ficha_reprovada' || t === 'simulacao_reprovada' || n.includes('reprovad')) {
    return findLbl(name => name.includes('ficha reprovada') || name.includes('fichas reprovadas')) ||
           findLbl(name => name.includes('finan. reprov')) ||
           findLbl(name => name.includes('reprovad'));
  }

  // 7. Oportunidade / Simulação Aprovada / Qualificado IA
  if (
    t === 'oportunidade' ||
    t === 'simulacao_aprovada' ||
    t === 'simulacao_pre_aprovada' ||
    t === 'ia_qualificado' ||
    n.includes('oportunidade') ||
    n.includes('ficha aprovada') ||
    n.includes('simulação aprovada') ||
    n.includes('simulacao aprovada') ||
    n === 'qualificado'
  ) {
    return findLbl(name => name.includes('oportunidade') || name.includes('ficha aprovada')) ||
           findLbl(name => name.includes('aprovad'));
  }

  // 8. Em atendimento / Recontratar / Recontatar / Em andamento
  if (
    t === 'em_atendimento' ||
    t === 'ia_em_andamento' ||
    t === 'ia_sem_contato' ||
    t === 'ia_followup' ||
    n.includes('atendimento') ||
    n.includes('recontratar') ||
    n.includes('recontatar') ||
    n.includes('andamento') ||
    n.includes('sem contato') ||
    n.includes('follow')
  ) {
    return findLbl(name => name.includes('em atendimento') || name.includes('recontratar') || name.includes('recontatar')) ||
           findLbl(name => name.includes('interessado'));
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
    const isSemIA = cliente.tipo_atendimento === 'sem_ia' || !cliente.tabela_leads;
    const isNocoDB = isNocoDBClient(cliente);

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
          currentLabels = contatoRow.whatsapp_labels;
        }
      }
    } else if (isNocoDB && cliente.tabela_leads) {
      const cleanLeadId = lead_id.toString().startsWith('ia-') ? lead_id.toString().replace('ia-', '') : lead_id;
      const leadRow = await getNocoDBLeadById(cliente.tabela_leads, cleanLeadId);
      if (leadRow) {
        rawPhone = String(leadRow.telefone || leadRow.phone || '').replace(/\D/g, '');
        if (Array.isArray(leadRow.whatsapp_labels)) {
          currentLabels = leadRow.whatsapp_labels;
        }
      }
    } else if (cliente.tabela_leads) {
      const clientDb = createAdminClient(
        cliente.supabase_url || process.env.NEXT_PUBLIC_SUPABASE_URL!,
        cliente.supabase_service_role_key || process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      const targetLeadId = Number(lead_id) || lead_id;
      const { data: leadRow } = await clientDb
        .from(cliente.tabela_leads)
        .select('id, telefone, whatsapp_labels')
        .eq('id', targetLeadId)
        .maybeSingle();

      if (leadRow) {
        rawPhone = String(leadRow.telefone || '').replace(/\D/g, '');
        if (Array.isArray(leadRow.whatsapp_labels)) {
          currentLabels = leadRow.whatsapp_labels;
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
              currentLabels = chat.wa_label;
            }
          } catch (e) {
            // fallback para banco
          }
        }

        const isStageLabel = (labelName: string) => {
          const n = (labelName || '').toLowerCase().trim();
          if (n.startsWith('canal')) return false;
          return (
            n.includes('em atendimento') ||
            n.includes('recontratar') ||
            n.includes('recontatar') ||
            n.includes('oportunidade') ||
            n.includes('ficha aprovada') ||
            n.includes('visita') ||
            n.includes('cliente agendado') ||
            n.includes('ficha reprovada') ||
            n.includes('fichas reprovadas') ||
            n.includes('finan. reprov') ||
            n.includes('reprovad') ||
            n.includes('perdido') ||
            n.includes('desqualificado') ||
            n.includes('desistiu') ||
            n === 'cliente' ||
            n === 'clientes'
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

          const ownerPrefix = targetLabel.owner ? `${targetLabel.owner}:` : '';
          const targetFormattedId = `${ownerPrefix}${cleanTargetId}`;

          // Remove qualquer etiqueta de etapa anterior, mantendo canais e vendedores
          const currentCleanFiltered = currentLabels.filter(item => {
            const cleanId = String(item).includes(':') ? String(item).split(':')[1] : String(item);
            return !stageLabelIds.has(cleanId);
          });

          const setLabels = new Set(currentCleanFiltered);
          setLabels.add(targetFormattedId);
          finalLabels = Array.from(setLabels);

          // Atualiza na Uazapi com os IDs limpos
          if (rawPhone) {
            const uazapiCleanLabelIds = finalLabels.map(l =>
              String(l).includes(':') ? String(l).split(':')[1] : String(l)
            );
            await fetch(`${WACLOUD_CONFIG.uazapiBaseUrl}/chat/labels`, {
              method: 'POST',
              headers: { Accept: 'application/json', 'Content-Type': 'application/json', token },
              body: JSON.stringify({ number: rawPhone, labelids: uazapiCleanLabelIds })
            });
          }
        }
      } catch (labelErr) {
        console.warn('Erro ao sincronizar etiqueta de etapa no WhatsApp:', labelErr);
      }
    }

    // Flags para campos booleanos das tabelas
    const dbEtapaTipo = etapaDestino.tipo || '';
    const isVisita = dbEtapaTipo === 'visita_confirmada' || dbEtapaTipo === 'visita_agendada' || dbEtapaTipo === 'visita_realizada';
    const isSimulacaoAprovada = dbEtapaTipo === 'simulacao_aprovada' || dbEtapaTipo === 'oportunidade' || dbEtapaTipo === 'cliente';
    const isSimulacaoPreAprovada = dbEtapaTipo === 'simulacao_pre_aprovada';
    const isSimulacaoReprovada = dbEtapaTipo === 'simulacao_reprovada' || dbEtapaTipo === 'ficha_reprovada';

    // 1. Atualizar na tabela do cliente (SaaS com IA)
    if (cliente.tabela_leads) {
      try {
        const updateData: any = {
          whatsapp_labels: finalLabels,
          lead_visita_confirmada: isVisita,
          lead_simulacao_pre_aprovada: isSimulacaoPreAprovada,
          lead_simulacao_aprovada: isSimulacaoAprovada,
          lead_simulacao_reprovada: isSimulacaoReprovada,
          update_lead: new Date().toISOString(),
        };

        const cleanLeadId = lead_id.toString().startsWith('ia-') ? lead_id.toString().replace('ia-', '') : lead_id;

        if (isNocoDB) {
          await updateNocoDBLead(cliente.tabela_leads, cleanLeadId, updateData);
        } else {
          const clientDb = createAdminClient(
            cliente.supabase_url || process.env.NEXT_PUBLIC_SUPABASE_URL!,
            cliente.supabase_service_role_key || process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
          );

          const targetLeadId = Number(cleanLeadId) || cleanLeadId;
          const { error: updErr } = await clientDb
            .from(cliente.tabela_leads)
            .update(updateData)
            .eq('id', targetLeadId);

          if (updErr) {
            console.error('Erro ao atualizar tabela de leads do cliente:', updErr);
          }
        }
      } catch (errDb) {
        console.error('Falha de conexão com clientDb / NocoDB:', errDb);
      }
    }

    // 2. Atualizar em wacloud_contatos
    try {
      const updateWacloud: any = {
        whatsapp_labels: finalLabels,
        lead_visita_confirmada: isVisita,
        lead_simulacao_aprovada: isSimulacaoAprovada,
        lead_simulacao_reprovada: isSimulacaoReprovada,
        atualizado_em: new Date().toISOString(),
      };

      if (isSemIA) {
        await wacloudAdmin
          .from('wacloud_contatos')
          .update(updateWacloud)
          .eq('id', lead_id);
      } else if (rawPhone) {
        await wacloudAdmin
          .from('wacloud_contatos')
          .update(updateWacloud)
          .eq('telefone_contato', `${rawPhone}@s.whatsapp.net`);
      }
    } catch (errWacloud) {
      console.warn('Erro ao atualizar wacloud_contatos:', errWacloud);
    }

    // Registrar no histórico de forma não bloqueante
    try {
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
    } catch (hErr) {
      // Ignora erro se tabela de histórico não existir
    }

    // Registrar posição manual no funil
    try {
      const cleanLeadId = lead_id.toString().startsWith('ia-') ? lead_id.toString().replace('ia-', '') : lead_id;
      await supabaseAdmin
        .from('sistema-dash-ia_lead_posicoes')
        .upsert({
          cliente_id: cliente.id,
          lead_id: cleanLeadId,
          etapa_id: etapa_id,
          movido_manualmente_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'cliente_id, lead_id'
        });
    } catch (posErr) {
      console.warn('Aviso ao salvar posicao manual:', posErr);
    }

    return NextResponse.json({ success: true, whatsapp_labels: finalLabels, etapa_id });
  } catch (err: any) {
    console.error('Erro geral em PUT /api/funil/leads/mover:', err);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
