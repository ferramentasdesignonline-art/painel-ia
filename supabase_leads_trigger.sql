-- Trigger DITÂMICO E ESCALÁVEL para registrar alterações de leads na timeline do cliente correto
CREATE OR REPLACE FUNCTION public.fn_leads_historico_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_cliente_id UUID;
  v_mudancas TEXT := '';
  v_vendedor TEXT := 'Sistema';
BEGIN
  -- Busca dinamicamente o ID do cliente correspondente à tabela que disparou o gatilho (TG_TABLE_NAME)
  SELECT id INTO v_cliente_id 
  FROM public."sistema-dash-ia_clientes" 
  WHERE tabela_leads = TG_TABLE_NAME 
  LIMIT 1;

  -- Se não encontrar o cliente cadastrado para esta tabela, ignora
  IF v_cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Se o vendedor_lead mudou ou existe, usamos ele como referência de quem editou
  IF NEW.vendedor_lead IS NOT DISTINCT FROM OLD.vendedor_lead AND NEW.vendedor_lead IS NOT NULL THEN
    v_vendedor := NEW.vendedor_lead;
  END IF;

  -- Comparações campo a campo
  IF OLD.nome IS DISTINCT FROM NEW.nome THEN
    v_mudancas := v_mudancas || 'Nome (de "' || COALESCE(OLD.nome, '-') || '" para "' || COALESCE(NEW.nome, '-') || '") | ';
  END IF;

  IF OLD.telefone IS DISTINCT FROM NEW.telefone THEN
    v_mudancas := v_mudancas || 'Telefone (de "' || COALESCE(OLD.telefone, '-') || '" para "' || COALESCE(NEW.telefone, '-') || '") | ';
  END IF;

  IF OLD.email IS DISTINCT FROM NEW.email THEN
    v_mudancas := v_mudancas || 'E-mail (de "' || COALESCE(OLD.email, '-') || '" para "' || COALESCE(NEW.email, '-') || '") | ';
  END IF;

  IF OLD.cpf_cnpj IS DISTINCT FROM NEW.cpf_cnpj THEN
    v_mudancas := v_mudancas || 'CPF/CNPJ (de "' || COALESCE(OLD.cpf_cnpj, '-') || '" para "' || COALESCE(NEW.cpf_cnpj, '-') || '") | ';
  END IF;

  IF OLD.veiculo_interessado IS DISTINCT FROM NEW.veiculo_interessado THEN
    v_mudancas := v_mudancas || 'Veículo de Interesse (de "' || COALESCE(OLD.veiculo_interessado, '-') || '" para "' || COALESCE(NEW.veiculo_interessado, '-') || '") | ';
  END IF;

  IF OLD.veiculo_troca IS DISTINCT FROM NEW.veiculo_troca THEN
    v_mudancas := v_mudancas || 'Veículo de Troca (de "' || COALESCE(OLD.veiculo_troca, '-') || '" para "' || COALESCE(NEW.veiculo_troca, '-') || '") | ';
  END IF;

  IF OLD.endereço IS DISTINCT FROM NEW.endereço THEN
    v_mudancas := v_mudancas || 'Endereço (de "' || COALESCE(OLD.endereço, '-') || '" para "' || COALESCE(NEW.endereço, '-') || '") | ';
  END IF;

  IF OLD.possui_cnh IS DISTINCT FROM NEW.possui_cnh THEN
    v_mudancas := v_mudancas || 'Possui CNH (de "' || COALESCE(OLD.possui_cnh::text, '-') || '" para "' || COALESCE(NEW.possui_cnh::text, '-') || '") | ';
  END IF;

  IF OLD.genero IS DISTINCT FROM NEW.genero THEN
    v_mudancas := v_mudancas || 'Gênero (de "' || COALESCE(OLD.genero, '-') || '" para "' || COALESCE(NEW.genero, '-') || '") | ';
  END IF;

  IF OLD.data_nascimento IS DISTINCT FROM NEW.data_nascimento THEN
    v_mudancas := v_mudancas || 'Data de Nascimento (de "' || COALESCE(OLD.data_nascimento, '-') || '" para "' || COALESCE(NEW.data_nascimento, '-') || '") | ';
  END IF;

  IF OLD.data_agendamento_visita IS DISTINCT FROM NEW.data_agendamento_visita OR OLD.horario_agendamento_visita IS DISTINCT FROM NEW.horario_agendamento_visita THEN
    v_mudancas := v_mudancas || 'Agendamento de Visita (de "' || COALESCE(OLD.data_agendamento_visita, '-') || ' às ' || COALESCE(OLD.horario_agendamento_visita, '-') || '" para "' || COALESCE(NEW.data_agendamento_visita, '-') || ' às ' || COALESCE(NEW.horario_agendamento_visita, '-') || '") | ';
  END IF;

  IF OLD.observacao_lead_qualificado IS DISTINCT FROM NEW.observacao_lead_qualificado THEN
    v_mudancas := v_mudancas || 'Observação de Qualificação atualizada | ';
  END IF;

  IF OLD.vendedor_lead IS DISTINCT FROM NEW.vendedor_lead THEN
    v_mudancas := v_mudancas || 'Vendedor (de "' || COALESCE(OLD.vendedor_lead, '-') || '" para "' || COALESCE(NEW.vendedor_lead, '-') || '") | ';
  END IF;

  -- Etapas / Flags
  IF OLD.lead_visita_confirmada IS DISTINCT FROM NEW.lead_visita_confirmada AND NEW.lead_visita_confirmada = true THEN
    v_mudancas := v_mudancas || 'Etapa alterada para: Visita Confirmada | ';
  END IF;

  IF OLD.lead_simulacao_pre_aprovada IS DISTINCT FROM NEW.lead_simulacao_pre_aprovada AND NEW.lead_simulacao_pre_aprovada = true THEN
    v_mudancas := v_mudancas || 'Etapa alterada para: Simulação Pré-Aprovada | ';
  END IF;

  IF OLD.lead_simulacao_aprovada IS DISTINCT FROM NEW.lead_simulacao_aprovada AND NEW.lead_simulacao_aprovada = true THEN
    v_mudancas := v_mudancas || 'Etapa alterada para: Simulação Aprovada | ';
  END IF;

  IF OLD.lead_simulacao_reprovada IS DISTINCT FROM NEW.lead_simulacao_reprovada AND NEW.lead_simulacao_reprovada = true THEN
    v_mudancas := v_mudancas || 'Etapa alterada para: Simulação Reprovada | ';
  END IF;

  -- Se houve mudanças, grava na timeline
  IF v_mudancas <> '' THEN
    v_mudancas := rtrim(v_mudancas, ' | ');
    
    INSERT INTO public."sistema-dash-ia_lead_historico" (
      cliente_id,
      lead_id,
      tipo_lead,
      vendedor_nome,
      evento,
      descricao,
      created_at
    ) VALUES (
      v_cliente_id,
      NEW.id::text,
      'ia',
      v_vendedor,
      'update',
      v_mudancas,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Exemplo de como associar esse trigger a qualquer tabela de leads de novos clientes:
-- DROP TRIGGER IF EXISTS trg_leads_historico ON public.NOME_DA_TABELA_DO_CLIENTE;
-- CREATE TRIGGER trg_leads_historico
-- AFTER UPDATE ON public.NOME_DA_TABELA_DO_CLIENTE;
-- FOR EACH ROW
-- EXECUTE FUNCTION public.fn_leads_historico_trigger();

-- Associando à tabela auto_new_leads do cliente atual
DROP TRIGGER IF EXISTS trg_leads_historico ON public.auto_new_leads;
CREATE TRIGGER trg_leads_historico
AFTER UPDATE ON public.auto_new_leads
FOR EACH ROW
EXECUTE FUNCTION public.fn_leads_historico_trigger();
