type Lead = {
  id: number;
  created_at: string;
  nome: string | null;
  telefone: string;
  lead_finalizado?: boolean | null;
  quantidade_followup?: number;
  horario_lead_qualificado?: string | null;
  ultima_mensagem?: string | null;
  veiculo_interessado?: string | null;
  vendedor_lead?: string | null;
  lead_visita_confirmada?: boolean | null;
  lead_simulacao_pre_aprovada?: boolean | null;
  lead_simulacao_aprovada?: boolean | null;
  lead_simulacao_reprovada?: boolean | null;
  veiculo_troca?: string | null;
  whatsapp_labels?: string[];
};

export type TipoEtapaIA =
  | 'cliente'
  | 'visita_realizada'
  | 'visita_agendada'
  | 'oportunidade'
  | 'ficha_reprovada'
  | 'perdido_qualificado'
  | 'perdido_desqualificado'
  | 'em_atendimento'
  // Legados para compatibilidade com outros clientes
  | 'ia_sem_contato'
  | 'ia_em_andamento'
  | 'ia_followup'
  | 'ia_qualificado'
  | 'ia_perda'
  | 'visita_confirmada'
  | 'simulacao_pre_aprovada'
  | 'simulacao_aprovada'
  | 'simulacao_reprovada';

/**
 * Calcula a etapa do funil do lead.
 * 
 * Se o lead tiver etiquetas reais do WhatsApp (wa_label), elas têm prioridade absoluta!
 * Ordem de prioridade quando houver múltiplas etiquetas:
 * 1. Cliente (ID 52)
 * 2. Visita - Realizada (ID 54)
 * 3. Visita - Agendada (ID 53 ou ID 6)
 * 4. Oportunidade - Ficha Aprovada | Troca | Entrada (ID 55)
 * 5. Ficha Reprovada (ID 57)
 * 6. Perdido | Qualificado (ID 59)
 * 7. Perdido | Desqualificado | Sem resposta (ID 58)
 * 8. Em atendimento | Recontratar (ID 56)
 */
export function calcularEtapaPorLabels(
  labelIds: string[] = [],
  mapaNomes?: Map<string, string>
): TipoEtapaIA | null {
  if (!labelIds || labelIds.length === 0) return null;

  // Extrair apenas os IDs numéricos finais (ex: "5511977063365:55" -> "55")
  const ids = Array.from(
    new Set(
      labelIds.map(l => {
        const s = String(l);
        return s.includes(':') ? s.split(':')[1] : s;
      })
    )
  );

  // Se tiver mapa de nomes (id -> nome), avalia por nome com prioridade absoluta
  if (mapaNomes && mapaNomes.size > 0) {
    const nomesPresentes = ids
      .map(id => mapaNomes.get(id) || '')
      .filter(Boolean)
      .map(n => n.toLowerCase());

    // 1. Clientes = Vendas
    if (nomesPresentes.some(n => n === 'cliente' || n.startsWith('cliente ') || n === 'clientes' || n.includes('vendido'))) {
      return 'cliente';
    }

    // 2. Visita - Realizada
    if (nomesPresentes.some(n => n.includes('visita - realizada') || n.includes('visita realizada'))) {
      return 'visita_realizada';
    }

    // 3. Visita - Agendada
    if (nomesPresentes.some(n => n.includes('visita - agendada') || n.includes('visita agendada') || n.includes('cliente agendado'))) {
      return 'visita_agendada';
    }

    // 4. Oportunidade - Ficha Aprovada | Troca | Entrada
    if (nomesPresentes.some(n => n.includes('oportunidade'))) {
      return 'oportunidade';
    }

    // 5. Perdido | Qualificado ou Ficha Reprovada
    if (nomesPresentes.some(n => 
      n.includes('perdido | qualificado') || 
      n.includes('perdido qualificado') || 
      n.includes('ficha reprovada')
    )) {
      return 'perdido_qualificado';
    }

    // 6. Perdido | Desqualificado | Sem resposta
    if (nomesPresentes.some(n => 
      n.includes('desqualificado')
    )) {
      return 'perdido_desqualificado';
    }

    // 7. Em atendimento | Recontatar
    if (nomesPresentes.some(n => n.includes('em atendimento') || n.includes('recontatar') || n.includes('recontratar'))) {
      return 'em_atendimento';
    }
  }

  // Fallback por IDs padrão das instâncias
  const idsSet = new Set(ids);
  if (idsSet.has('52') || idsSet.has('17')) return 'cliente';
  if (idsSet.has('54')) return 'visita_realizada';
  if (idsSet.has('53') || idsSet.has('6')) return 'visita_agendada';
  if (idsSet.has('55')) return 'oportunidade';
  if (idsSet.has('59') || idsSet.has('57')) return 'perdido_qualificado';
  if (idsSet.has('58')) return 'perdido_desqualificado';
  if (idsSet.has('56')) return 'em_atendimento';

  return null;
}

export function calcularEtapaIA(
  lead: Lead,
  meta_followup = 5,
  mapaNomes?: Map<string, string>
): TipoEtapaIA {
  // 1. Simulação aprovada: estritamente se marcado como true na tabela (lead_simulacao_aprovada)
  if (lead.lead_simulacao_aprovada === true) {
    return 'simulacao_aprovada';
  }

  // 2. Prioridade máxima: Etiquetas padrão oficiais do WhatsApp do lead
  if (lead.whatsapp_labels && lead.whatsapp_labels.length > 0) {
    const etapaLabel = calcularEtapaPorLabels(lead.whatsapp_labels, mapaNomes);
    if (etapaLabel) return etapaLabel;
  }

  // 3. Fallback pelas colunas da tabela do lead
  if (lead.lead_visita_confirmada === true) {
    return 'visita_agendada';
  }
  if (lead.lead_simulacao_pre_aprovada === true) {
    return 'oportunidade';
  }
  if (lead.veiculo_troca && lead.veiculo_troca.trim().length > 0) {
    return 'oportunidade';
  }

  return 'em_atendimento';
}

