-- 1. Deleta duplicatas de funis, mantendo apenas o mais antigo de cada cliente
DELETE FROM public."sistema-dash-ia_funis"
WHERE id NOT IN (
  SELECT DISTINCT ON (cliente_id) id
  FROM public."sistema-dash-ia_funis"
  ORDER BY cliente_id, created_at ASC
);

-- 2. Deleta as etapas órfãs (cujo funil foi deletado)
DELETE FROM public."sistema-dash-ia_etapas_funil"
WHERE funil_id NOT IN (
  SELECT id FROM public."sistema-dash-ia_funis"
);

-- 3. Confirma quantos funils sobraram (deve ser 1 por cliente)
SELECT cliente_id, COUNT(*) as total FROM public."sistema-dash-ia_funis" GROUP BY cliente_id;
