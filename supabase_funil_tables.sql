-- =============================================================
-- TABELAS DO FUNIL DE LEADS - Design Online IA
-- Execute este script no SQL Editor do Supabase
-- =============================================================

-- 1. Funis (um por cliente)
CREATE TABLE IF NOT EXISTS public."sistema-dash-ia_funis" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid REFERENCES public."sistema-dash-ia_clientes"(id) ON DELETE CASCADE,
  nome text DEFAULT 'Funil Principal' NOT NULL,
  meta_followup integer DEFAULT 3,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public."sistema-dash-ia_funis" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public."sistema-dash-ia_funis" FOR ALL USING (true) WITH CHECK (true);

-- 2. Etapas do funil
CREATE TABLE IF NOT EXISTS public."sistema-dash-ia_etapas_funil" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  funil_id uuid REFERENCES public."sistema-dash-ia_funis"(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cor text DEFAULT '#6366f1',
  ordem integer DEFAULT 1,
  tipo text DEFAULT 'manual',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public."sistema-dash-ia_etapas_funil" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public."sistema-dash-ia_etapas_funil" FOR ALL USING (true) WITH CHECK (true);

-- 3. Posições dos leads da IA no funil
CREATE TABLE IF NOT EXISTS public."sistema-dash-ia_lead_posicoes" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid REFERENCES public."sistema-dash-ia_clientes"(id) ON DELETE CASCADE,
  lead_id bigint NOT NULL,
  etapa_id uuid REFERENCES public."sistema-dash-ia_etapas_funil"(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(cliente_id, lead_id)
);
ALTER TABLE public."sistema-dash-ia_lead_posicoes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public."sistema-dash-ia_lead_posicoes" FOR ALL USING (true) WITH CHECK (true);

-- 4. Histórico e notas dos leads (Timeline)
CREATE TABLE IF NOT EXISTS public."sistema-dash-ia_lead_historico" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid REFERENCES public."sistema-dash-ia_clientes"(id) ON DELETE CASCADE,
  lead_id text NOT NULL,
  tipo_lead text DEFAULT 'ia',
  etapa_origem_id uuid REFERENCES public."sistema-dash-ia_etapas_funil"(id) ON DELETE SET NULL,
  etapa_destino_id uuid REFERENCES public."sistema-dash-ia_etapas_funil"(id) ON DELETE SET NULL,
  vendedor_nome text,
  evento text NOT NULL,
  descricao text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public."sistema-dash-ia_lead_historico" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public."sistema-dash-ia_lead_historico" FOR ALL USING (true) WITH CHECK (true);

-- 5. Leads criados manualmente pelos vendedores
CREATE TABLE IF NOT EXISTS public."sistema-dash-ia_leads_manuais" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid REFERENCES public."sistema-dash-ia_clientes"(id) ON DELETE CASCADE,
  etapa_id uuid REFERENCES public."sistema-dash-ia_etapas_funil"(id) ON DELETE SET NULL,
  nome text NOT NULL,
  telefone text,
  veiculo_interessado text,
  vendedor_nome text,
  origem text DEFAULT 'manual',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public."sistema-dash-ia_leads_manuais" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public."sistema-dash-ia_leads_manuais" FOR ALL USING (true) WITH CHECK (true);
