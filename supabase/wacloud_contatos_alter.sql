-- =============================================================
-- ATUALIZAÇÃO DA TABELA wacloud_contatos (Design Online / Wacloud)
-- Execute este script no SQL Editor do Supabase do WhatsApp Cloud (iztcqwvlqvismixmpuzx)
-- =============================================================

ALTER TABLE public.wacloud_contatos 
  ADD COLUMN IF NOT EXISTS cpf_cnpj text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS data_nascimento text,
  ADD COLUMN IF NOT EXISTS possui_cnh boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS genero text,
  ADD COLUMN IF NOT EXISTS valor_entrada text,
  ADD COLUMN IF NOT EXISTS lead_simulacao_pre_aprovada boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS visita_realizada boolean DEFAULT false;

-- Índices úteis para busca rápida de clientes por CPF ou Email
CREATE INDEX IF NOT EXISTS idx_wacloud_contatos_cpf ON public.wacloud_contatos(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_wacloud_contatos_email ON public.wacloud_contatos(email);
