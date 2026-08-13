type Lead = {
  id: number;
  created_at: string;
  nome: string | null;
  telefone: string;
  lead_finalizado: boolean | null;
  quantidade_followup: number;
  horario_lead_qualificado: string | null;
  ultima_mensagem: string | null;
  veiculo_interessado: string | null;
  vendedor_lead: string | null;
  lead_visita_confirmada?: boolean | null;
  lead_simulacao_pre_aprovada?: boolean | null;
  lead_simulacao_aprovada?: boolean | null;
  lead_simulacao_reprovada?: boolean | null;
};

export type TipoEtapaIA =
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
 * Calcula a etapa do funil de um lead com base nos dados da tabela.
 * 
 * Regras (em ordem de prioridade):
 * 1. Simulação Reprovada: lead_simulacao_reprovada = true
 * 2. Simulação Aprovada: lead_simulacao_aprovada = true
 * 3. Simulação Pré-Aprovada: lead_simulacao_pre_aprovada = true
 * 4. Visita Confirmada: lead_visita_confirmada = true
 * 5. Qualificado: lead_finalizado = true
 * 6. Perda: quantidade_followup >= meta_followup (passado como parâmetro)
 * 7. Follow-up: quantidade_followup > 0
 * 8. Sem contato: created_at === ultima_mensagem (ou sem ultima_mensagem)
 * 9. Em andamento: qualquer outra situação (está conversando)
 */
export function calcularEtapaIA(lead: Lead, meta_followup = 3): TipoEtapaIA {
  // Novas etapas de simulação e visita (ordem de prioridade ajustada)
  if (lead.lead_simulacao_aprovada === true) {
    return 'simulacao_aprovada';
  }
  if (lead.lead_simulacao_pre_aprovada === true) {
    return 'simulacao_pre_aprovada';
  }
  if (lead.lead_simulacao_reprovada === true) {
    return 'simulacao_reprovada';
  }
  if (lead.lead_visita_confirmada === true) {
    return 'visita_confirmada';
  }

  // 1. Qualificado: lead marcado como finalizado pela IA
  if (lead.lead_finalizado === true) {
    return 'ia_qualificado';
  }

  // 2. Perda: atingiu o número máximo de follow-ups sem conversão
  if (lead.quantidade_followup >= meta_followup) {
    return 'ia_perda';
  }

  // 3. Follow-up: já tentou contato mas ainda não converteu
  if (lead.quantidade_followup > 0) {
    return 'ia_followup';
  }

  // 4. Sem contato: nunca houve resposta ou ultima_mensagem está no mesmo 
  // segundo que created_at (lead recém criado, IA enviou mas ninguém respondeu)
  if (!lead.ultima_mensagem) {
    return 'ia_sem_contato';
  }

  const criadoTs = new Date(lead.created_at).getTime();
  const ultimaTs = new Date(lead.ultima_mensagem).getTime();
  const diffMs = Math.abs(ultimaTs - criadoTs);

  // Se a ultima_mensagem é praticamente igual ao created_at (menos de 5 segundos de diferença),
  // considera "sem contato" — o lead foi criado mas não houve interação real ainda
  if (diffMs < 5000) {
    return 'ia_sem_contato';
  }

  // 5. Em andamento: está conversando com a IA
  return 'ia_em_andamento';
}
