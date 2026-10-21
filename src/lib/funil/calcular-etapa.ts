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

    // 1. Cliente
    if (nomesPresentes.some(n => n === 'cliente' || n.startsWith('cliente '))) return 'cliente';

    // 2. Visita - Realizada
    if (nomesPresentes.some(n => n.includes('visita - realizada') || n.includes('visita realizada'))) return 'visita_realizada';

    // 3. Visita - Agendada
    if (nomesPresentes.some(n => n.includes('visita - agendada') || n.includes('visita agendada'))) return 'visita_agendada';

    // 4. Simulação Aprovada
    if (nomesPresentes.some(n => n.includes('simulação aprovada') || n.includes('simulacao aprovada') || n.includes('ficha aprovada'))) return 'simulacao_aprovada';

    // 5. Oportunidade
    if (nomesPresentes.some(n => n.includes('oportunidade'))) return 'oportunidade';

    // 6. Perdido Qualificado (Etiquetas: Perdido Qualificado, Ficha Reprovada, etc.)
    if (nomesPresentes.some(n => 
      n.includes('perdido | qualificado') || 
      n.includes('perdido qualificado') || 
      n.includes('ficha reprovada') || 
      n.includes('simulação reprovada') || 
      n.includes('simulacao reprovada') ||
      n.includes('achou caro') ||
      n.includes('concorrente') ||
      n.includes('desistiu')
    )) return 'perdido_qualificado';

    // 7. Perdido Desqualificado (Etiquetas: Perdido Desqualificado, Sem resposta, Sem perfil, Número errado)
    if (nomesPresentes.some(n => 
      n.includes('desqualificado') || 
      n.includes('sem resposta') || 
      n.includes('sem perfil') || 
      n.includes('número errado') || 
      n.includes('numero errado') || 
      (n.includes('perdido') && !n.includes('qualificado'))
    )) return 'perdido_desqualificado';

    // 8. Em atendimento
    if (nomesPresentes.some(n => n.includes('em atendimento') || n.includes('recontratar') || n.includes('recontatar'))) return 'em_atendimento';
  }

  // Fallback por IDs legados da Auto Prosperitá
  const idsSet = new Set(ids);
  if (idsSet.has('52')) return 'cliente';
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
  // 1. Prioridade máxima: Etiquetas do WhatsApp do lead (perdidos SEMPRE por etiqueta)
  if (lead.whatsapp_labels && lead.whatsapp_labels.length > 0) {
    const etapaLabel = calcularEtapaPorLabels(lead.whatsapp_labels, mapaNomes);
    if (etapaLabel) return etapaLabel;
  }

  // 2. Fallback pelas colunas da tabela do lead (apenas etapas ativas; perdidos apenas se houver etiqueta)
  if (lead.lead_visita_confirmada === true) {
    return 'visita_agendada';
  }
  if (lead.lead_simulacao_aprovada === true) {
    return 'simulacao_aprovada';
  }
  if (lead.lead_simulacao_pre_aprovada === true) {
    return 'oportunidade';
  }
  if (lead.veiculo_troca && lead.veiculo_troca.trim().length > 0) {
    return 'oportunidade';
  }

  return 'em_atendimento';
}

