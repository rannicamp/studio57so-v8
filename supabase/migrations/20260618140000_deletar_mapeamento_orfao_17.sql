-- Deleta o mapeamento órfão/incompleto de ID 17 que está em conflito com o mapeamento correto de ID 47
DELETE FROM public.bim_mapeamentos_propriedades 
WHERE id = 17 
  AND organizacao_id = 2 
  AND material_id IS NULL 
  AND sinapi_id IS NULL;
