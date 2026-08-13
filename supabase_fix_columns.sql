-- Adiciona coluna 'tipo' nas etapas (caso ainda não exista)
ALTER TABLE public."sistema-dash-ia_etapas_funil" 
  ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'manual';

-- Adiciona meta_followup no funil (caso ainda não exista)
ALTER TABLE public."sistema-dash-ia_funis"
  ADD COLUMN IF NOT EXISTS meta_followup integer DEFAULT 3;

-- Adiciona coluna movido_manualmente_em nas posições
ALTER TABLE public."sistema-dash-ia_lead_posicoes"
  ADD COLUMN IF NOT EXISTS movido_manualmente_em timestamp with time zone DEFAULT timezone('utc'::text, now());

-- Adiciona coluna created_by nos leads manuais (caso não exista)  
ALTER TABLE public."sistema-dash-ia_leads_manuais"
  ADD COLUMN IF NOT EXISTS created_by text;

ALTER TABLE public."sistema-dash-ia_leads_manuais"
  ADD COLUMN IF NOT EXISTS notas text;
