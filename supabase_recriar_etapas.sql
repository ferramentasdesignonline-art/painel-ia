-- ============================================================
-- RECRIA AS 5 ETAPAS PADRÃO DA IA PARA TODOS OS FUNÍS
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Remove etapas antigas de TODOS os funís
DELETE FROM public."sistema-dash-ia_etapas_funil";

-- 2. Insere as 5 etapas corretas para cada funil existente
INSERT INTO public."sistema-dash-ia_etapas_funil" (funil_id, nome, cor, ordem, tipo)
SELECT 
  f.id,
  e.nome,
  e.cor,
  e.ordem,
  e.tipo
FROM public."sistema-dash-ia_funis" f
CROSS JOIN (
  VALUES
    ('Sem contato',  '#94a3b8', 1, 'ia_sem_contato'),
    ('Em andamento', '#6366f1', 2, 'ia_em_andamento'),
    ('Follow-up',    '#f97316', 3, 'ia_followup'),
    ('Qualificado',  '#10b981', 4, 'ia_qualificado'),
    ('Perda',        '#ef4444', 5, 'ia_perda')
) AS e(nome, cor, ordem, tipo);

-- 3. Confirma o resultado
SELECT f.nome as funil, e.nome as etapa, e.tipo, e.ordem
FROM public."sistema-dash-ia_etapas_funil" e
JOIN public."sistema-dash-ia_funis" f ON f.id = e.funil_id
ORDER BY f.nome, e.ordem;
